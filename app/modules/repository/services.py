import hashlib
import ipaddress
import json
import logging
import shutil
import socket
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import APIError
from app.modules.dashboard.models import ActivityLog
from app.modules.project.models import Project
from app.modules.project.repository import ProjectRepository
from app.modules.repository.models import Repository, RepositoryUpload
from app.modules.repository.repository import RepositoryRepo, new_id
from app.modules.repository.schemas import ConnectGitRepo, RepositoryCreate, RepositorySettingsUpdate, RepositoryUpdate
from app.modules.workspace.repository import WorkspaceRepository

logger = logging.getLogger("codescope.repository")


class RepositoryValidationService:
    @staticmethod
    def project_access(db: Session, project_id: str, user_id: str, *, write: bool) -> tuple[Project, str]:
        project = ProjectRepository.get_by_id(db, project_id)
        if project is None:
            raise APIError("Project not found", 404)
        role = WorkspaceRepository.check_user_role(db, project.workspace_id, user_id)
        if role is None:
            raise APIError("Permission denied", 403)
        if write and role not in {"owner", "admin"}:
            raise APIError("Owner or admin permission required", 403)
        return project, role

    @staticmethod
    def repository_access(db: Session, repository_id: str, user_id: str, *, write: bool) -> Repository:
        repository = RepositoryRepo.get_by_id(db, repository_id)
        if repository is None:
            raise APIError("Repository not found", 404)
        role = WorkspaceRepository.check_user_role(db, repository.workspace_id, user_id)
        if role is None or (write and role not in {"owner", "admin"}):
            raise APIError("Permission denied", 403)
        return repository

    @staticmethod
    def unique_name(db: Session, project_id: str, name: str, exclude_id: str | None = None) -> None:
        if RepositoryRepo.get_by_project_name(db, project_id, name, exclude_id):
            raise APIError("Repository already exists", 409, [{"field": "name", "message": "Name must be unique within the project"}])


class RepositoryActivityService:
    @staticmethod
    def record(db: Session, repository: Repository, user_id: str, action: str, details: str) -> None:
        RepositoryRepo.add_activity(db, repository.id, user_id, action, details)
        db.add(ActivityLog(
            id=new_id(), workspace_id=repository.workspace_id, project_id=repository.project_id,
            repository_id=repository.id, user_id=user_id, action=action, details=details,
        ))
        logger.info(json.dumps({"event": action, "repository_id": repository.id, "user_id": user_id}))


class RepositoryMetadataService:
    @staticmethod
    def populate(repository: Repository, root: Path, sha256: str) -> None:
        files = [path for path in root.rglob("*") if path.is_file()]
        folders = [path for path in root.rglob("*") if path.is_dir()]
        repository.metadata_record.total_files = len(files)
        repository.metadata_record.total_folders = len(folders)
        repository.metadata_record.extracted_size_bytes = sum(path.stat().st_size for path in files)
        repository.metadata_record.archive_sha256 = sha256


class UploadService:
    @staticmethod
    async def store_and_extract(file: UploadFile, project_id: str) -> tuple[Path, Path, int, str]:
        filename = Path(file.filename or "").name
        if not filename.lower().endswith(".zip"):
            raise APIError("Invalid ZIP", 422, [{"field": "file", "message": "Only .zip archives are accepted"}])
        base = Path(settings.UPLOAD_DIR).resolve() / "repositories" / project_id
        base.mkdir(parents=True, exist_ok=True)
        token = new_id()
        archive_path = base / f"{token}.zip"
        extract_path = base / token
        size = 0
        digest = hashlib.sha256()
        try:
            with archive_path.open("wb") as target:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > settings.MAX_ZIP_SIZE_BYTES:
                        raise APIError("Invalid ZIP", 413, [{"field": "file", "message": "Archive exceeds the configured size limit"}])
                    digest.update(chunk)
                    target.write(chunk)
            UploadService._extract_securely(archive_path, extract_path)
            return archive_path, extract_path, size, digest.hexdigest()
        except Exception:
            archive_path.unlink(missing_ok=True)
            shutil.rmtree(extract_path, ignore_errors=True)
            raise
        finally:
            await file.close()

    @staticmethod
    def _extract_securely(archive_path: Path, extract_path: Path) -> None:
        try:
            with zipfile.ZipFile(archive_path) as archive:
                members = archive.infolist()
                if not members or len(members) > settings.MAX_ZIP_FILES:
                    raise APIError("Invalid ZIP", 422, [{"field": "file", "message": "Archive is empty or contains too many entries"}])
                total = 0
                for member in members:
                    path = PurePosixPath(member.filename.replace("\\", "/"))
                    if path.is_absolute() or ".." in path.parts:
                        raise APIError("Invalid ZIP", 422, [{"field": "file", "message": "Archive contains an unsafe path"}])
                    mode = member.external_attr >> 16
                    if mode & 0o170000 == 0o120000:
                        raise APIError("Invalid ZIP", 422, [{"field": "file", "message": "Symbolic links are not allowed"}])
                    total += member.file_size
                    if total > settings.MAX_EXTRACTED_SIZE_BYTES:
                        raise APIError("Invalid ZIP", 413, [{"field": "file", "message": "Extracted content exceeds the configured size limit"}])
                extract_path.mkdir(parents=True)
                archive.extractall(extract_path)
        except zipfile.BadZipFile as exc:
            raise APIError("Invalid ZIP", 422, [{"field": "file", "message": "Archive is corrupt"}]) from exc


class GitConnectionService:
    @staticmethod
    def validate_public_host(url: str) -> None:
        host = urlparse(url).hostname
        if not host:
            raise APIError("Invalid Git URL", 422)
        try:
            addresses = socket.getaddrinfo(host, None)
        except socket.gaierror:
            return  # Reachability is deliberately deferred; Phase 2 does not clone.
        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                raise APIError("Invalid Git URL", 422, [{"field": "git_url", "message": "Private network hosts are not allowed"}])


class RepositoryService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: RepositoryCreate, user_id: str) -> Repository:
        project, _ = RepositoryValidationService.project_access(self.db, data.project_id, user_id, write=True)
        RepositoryValidationService.unique_name(self.db, data.project_id, data.name)
        repository = Repository(id=new_id(), project_id=data.project_id, workspace_id=project.workspace_id, owner_id=user_id,
                                name=data.name, description=data.description, visibility=data.visibility, notes=data.notes,
                                repo_type="manual", status="pending")
        RepositoryRepo.add(self.db, repository)
        RepositoryRepo.create_children(self.db, repository, data.tags)
        project.repository_count += 1
        self.db.flush()
        RepositoryActivityService.record(self.db, repository, user_id, "Repository Created", f"Repository '{repository.name}' created")
        self.db.commit(); self.db.refresh(repository)
        return repository

    async def upload(self, data: RepositoryCreate, file: UploadFile, user_id: str) -> Repository:
        project, _ = RepositoryValidationService.project_access(self.db, data.project_id, user_id, write=True)
        RepositoryValidationService.unique_name(self.db, data.project_id, data.name)
        archive, extracted, size, sha256 = await UploadService.store_and_extract(file, data.project_id)
        try:
            repository = Repository(id=new_id(), project_id=data.project_id, workspace_id=project.workspace_id, owner_id=user_id,
                                    name=data.name, description=data.description, visibility=data.visibility, notes=data.notes,
                                    repo_type="zip", status="uploaded", upload_path=str(archive), extracted_path=str(extracted),
                                    original_filename=Path(file.filename or "repository.zip").name, file_size_bytes=size)
            RepositoryRepo.add(self.db, repository); RepositoryRepo.create_children(self.db, repository, data.tags)
            self.db.flush(); RepositoryMetadataService.populate(repository, extracted, sha256)
            RepositoryRepo.add_upload(self.db, RepositoryUpload(id=new_id(), repository_id=repository.id, uploaded_by=user_id,
                                      filename=repository.original_filename, storage_path=str(archive), file_size_bytes=size, sha256=sha256))
            project.repository_count += 1
            RepositoryActivityService.record(self.db, repository, user_id, "Repository Uploaded", f"ZIP '{repository.original_filename}' uploaded")
            self.db.commit(); self.db.refresh(repository)
            return repository
        except Exception:
            self.db.rollback(); archive.unlink(missing_ok=True); shutil.rmtree(extracted, ignore_errors=True); raise

    def connect(self, data: ConnectGitRepo, user_id: str) -> Repository:
        project, _ = RepositoryValidationService.project_access(self.db, data.project_id, user_id, write=True)
        RepositoryValidationService.unique_name(self.db, data.project_id, data.name)
        GitConnectionService.validate_public_host(data.git_url)
        repository = Repository(id=new_id(), project_id=data.project_id, workspace_id=project.workspace_id, owner_id=user_id,
                                name=data.name, description=data.description, visibility=data.visibility, notes=data.notes,
                                repo_type="git", status="connected", git_url=data.git_url, git_branch=data.git_branch)
        RepositoryRepo.add(self.db, repository); RepositoryRepo.create_children(self.db, repository, data.tags)
        repository.settings.default_branch = data.git_branch; project.repository_count += 1
        self.db.flush(); RepositoryActivityService.record(self.db, repository, user_id, "Git Connected", f"Git repository connected on branch '{data.git_branch}'")
        self.db.commit(); self.db.refresh(repository)
        return repository

    def update(self, repository: Repository, data: RepositoryUpdate, user_id: str) -> Repository:
        values = data.model_dump(exclude_unset=True); tags = values.pop("tags", None)
        if "name" in values: RepositoryValidationService.unique_name(self.db, repository.project_id, values["name"], repository.id)
        for field, value in values.items(): setattr(repository, field, value)
        if tags is not None: RepositoryRepo.replace_tags(self.db, repository, tags)
        RepositoryActivityService.record(self.db, repository, user_id, "Repository Updated", f"Repository '{repository.name}' updated")
        self.db.commit(); self.db.refresh(repository); return repository

    def archive(self, repository: Repository, archive: bool, user_id: str) -> Repository:
        repository.is_archived = archive; repository.status = "archived" if archive else ("connected" if repository.repo_type == "git" else "uploaded" if repository.repo_type == "zip" else "pending")
        action = "Repository Archived" if archive else "Repository Restored"
        RepositoryActivityService.record(self.db, repository, user_id, action, f"Repository '{repository.name}' status changed")
        self.db.commit(); self.db.refresh(repository); return repository

    def delete(self, repository: Repository, user_id: str) -> None:
        project = ProjectRepository.get_by_id(self.db, repository.project_id)
        paths = [repository.upload_path, repository.extracted_path]
        RepositoryActivityService.record(self.db, repository, user_id, "Repository Deleted", f"Repository '{repository.name}' deleted")
        if project: project.repository_count = max(0, project.repository_count - 1)
        RepositoryRepo.delete(self.db, repository); self.db.commit()
        for raw in paths:
            if raw:
                path = Path(raw); shutil.rmtree(path, ignore_errors=True) if path.is_dir() else path.unlink(missing_ok=True)


class RepositorySearchService:
    @staticmethod
    def list(db: Session, **filters):
        return RepositoryRepo.list(db, **filters)


class RepositorySettingsService:
    @staticmethod
    def update(db: Session, repository: Repository, data: RepositorySettingsUpdate, user_id: str):
        for field, value in data.model_dump(exclude_unset=True).items(): setattr(repository.settings, field, value)
        RepositoryActivityService.record(db, repository, user_id, "Repository Settings Updated", "Repository settings updated")
        db.commit(); db.refresh(repository.settings); return repository.settings
