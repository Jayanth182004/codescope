import uuid
import json
from typing import List, Optional
from sqlalchemy.orm import Session

from app.modules.repository.models import (
    Repository,
    RepositorySettings,
    RepositoryFavorite,
    RepositoryActivity,
    RepositoryUploadHistory,
)
from app.modules.repository.schemas import (
    RepositoryCreate,
    RepositoryUpdate,
    ConnectGitRepo,
    RepositorySettingsUpdate,
)
from app.modules.dashboard.models import ActivityLog
from app.modules.project.models import Project


# ──────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────

def _tags_to_json(tags: Optional[List[str]]) -> Optional[str]:
    """Serialize a tag list to a JSON string for storage."""
    if tags is None:
        return None
    return json.dumps(tags)


def _json_to_tags(raw: Optional[str]) -> Optional[List[str]]:
    """Deserialize stored JSON string back to a list."""
    if not raw:
        return []
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []


def _new_id() -> str:
    return str(uuid.uuid4())


def _create_default_settings(db: Session, repo_id: str) -> RepositorySettings:
    """Create default RepositorySettings row for a new repository."""
    settings = RepositorySettings(
        id=_new_id(),
        repository_id=repo_id,
    )
    db.add(settings)
    return settings


def _log_workspace_activity(
    db: Session,
    workspace_id: str,
    project_id: str,
    user_id: str,
    action: str,
    details: str,
    repository_id: Optional[str] = None,
) -> None:
    """Write to the workspace-level activity_logs table (feeds the dashboard)."""
    log = ActivityLog(
        id=_new_id(),
        workspace_id=workspace_id,
        project_id=project_id,
        user_id=user_id,
        action=action,
        details=details,
        repository_id=repository_id,
    )
    db.add(log)


def _log_repo_activity(
    db: Session,
    repository_id: str,
    user_id: str,
    action: str,
    details: str,
) -> None:
    """Write to the repository-scoped repository_activity table."""
    log = RepositoryActivity(
        id=_new_id(),
        repository_id=repository_id,
        user_id=user_id,
        action=action,
        details=details,
    )
    db.add(log)


def _increment_project_repo_count(db: Session, project_id: str, delta: int = 1) -> None:
    """Atomically adjust project.repository_count."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        project.repository_count = max(0, project.repository_count + delta)


# ──────────────────────────────────────────────
# Main Data Access Class
# ──────────────────────────────────────────────

class RepositoryRepo:

    # ── Read ──────────────────────────────────

    @staticmethod
    def get_by_id(db: Session, repo_id: str) -> Optional[Repository]:
        return db.query(Repository).filter(Repository.id == repo_id).first()

    @staticmethod
    def list_by_project(db: Session, project_id: str) -> List[Repository]:
        return (
            db.query(Repository)
            .filter(Repository.project_id == project_id)
            .order_by(Repository.created_at.desc())
            .all()
        )

    @staticmethod
    def check_is_favorite(db: Session, user_id: str, repo_id: str) -> bool:
        fav = db.query(RepositoryFavorite).filter(
            RepositoryFavorite.user_id == user_id,
            RepositoryFavorite.repository_id == repo_id,
        ).first()
        return fav is not None

    @staticmethod
    def get_tags(repo: Repository) -> List[str]:
        return _json_to_tags(repo.tags)

    # ── Create ────────────────────────────────

    @staticmethod
    def create(
        db: Session,
        repo_in: RepositoryCreate,
        workspace_id: str,
        owner_id: str,
    ) -> Repository:
        """Create a bare repository record (no file, no git URL)."""
        repo_id = _new_id()
        repo = Repository(
            id=repo_id,
            project_id=repo_in.project_id,
            workspace_id=workspace_id,
            owner_id=owner_id,
            name=repo_in.name,
            description=repo_in.description,
            repo_type="zip",
            status="pending",
            visibility=repo_in.visibility,
            tags=_tags_to_json(repo_in.tags),
            notes=repo_in.notes,
        )
        db.add(repo)
        db.flush()

        _create_default_settings(db, repo_id)
        _increment_project_repo_count(db, repo_in.project_id, +1)

        _log_repo_activity(db, repo_id, owner_id, "Repository Created", f"Repository '{repo_in.name}' created")
        _log_workspace_activity(
            db,
            workspace_id=workspace_id,
            project_id=repo_in.project_id,
            user_id=owner_id,
            action="Repository Created",
            details=f"Repository '{repo_in.name}' added to project",
            repository_id=repo_id,
        )

        db.commit()
        db.refresh(repo)
        return repo

    @staticmethod
    def create_from_upload(
        db: Session,
        project_id: str,
        workspace_id: str,
        owner_id: str,
        name: str,
        description: Optional[str],
        visibility: str,
        upload_path: str,
        original_filename: str,
        file_size_bytes: int,
        tags: Optional[List[str]] = None,
        notes: Optional[str] = None,
    ) -> Repository:
        """Create a repository record from a ZIP upload."""
        repo_id = _new_id()
        repo = Repository(
            id=repo_id,
            project_id=project_id,
            workspace_id=workspace_id,
            owner_id=owner_id,
            name=name,
            description=description,
            repo_type="zip",
            status="uploaded",
            visibility=visibility,
            upload_path=upload_path,
            original_filename=original_filename,
            file_size_bytes=file_size_bytes,
            tags=_tags_to_json(tags),
            notes=notes,
        )
        db.add(repo)
        db.flush()

        _create_default_settings(db, repo_id)
        _increment_project_repo_count(db, project_id, +1)

        # Record upload history
        upload_record = RepositoryUploadHistory(
            id=_new_id(),
            repository_id=repo_id,
            uploaded_by=owner_id,
            filename=original_filename,
            file_size_bytes=file_size_bytes,
            status="success",
        )
        db.add(upload_record)

        _log_repo_activity(db, repo_id, owner_id, "Repository Uploaded", f"ZIP '{original_filename}' uploaded ({file_size_bytes} bytes)")
        _log_workspace_activity(
            db,
            workspace_id=workspace_id,
            project_id=project_id,
            user_id=owner_id,
            action="Repository Uploaded",
            details=f"ZIP repository '{name}' uploaded to project",
            repository_id=repo_id,
        )

        db.commit()
        db.refresh(repo)
        return repo

    @staticmethod
    def create_from_git(
        db: Session,
        git_in: ConnectGitRepo,
        workspace_id: str,
        owner_id: str,
    ) -> Repository:
        """Create a repository record from a Git URL connection."""
        repo_id = _new_id()
        repo = Repository(
            id=repo_id,
            project_id=git_in.project_id,
            workspace_id=workspace_id,
            owner_id=owner_id,
            name=git_in.name,
            description=git_in.description,
            repo_type="git",
            status="connected",
            visibility=git_in.visibility,
            git_url=git_in.git_url,
            git_branch=git_in.git_branch,
            tags=_tags_to_json(git_in.tags),
            notes=git_in.notes,
        )
        db.add(repo)
        db.flush()

        _create_default_settings(db, repo_id)
        _increment_project_repo_count(db, git_in.project_id, +1)

        _log_repo_activity(db, repo_id, owner_id, "Git Repository Connected", f"Connected to {git_in.git_url} (branch: {git_in.git_branch})")
        _log_workspace_activity(
            db,
            workspace_id=workspace_id,
            project_id=git_in.project_id,
            user_id=owner_id,
            action="Git Repository Connected",
            details=f"Git repo '{git_in.name}' linked from {git_in.git_url}",
            repository_id=repo_id,
        )

        db.commit()
        db.refresh(repo)
        return repo

    # ── Update ────────────────────────────────

    @staticmethod
    def update(
        db: Session,
        repo: Repository,
        repo_in: RepositoryUpdate,
        user_id: str,
    ) -> Repository:
        updateable = ["name", "description", "visibility", "git_branch", "notes", "language"]
        for field in updateable:
            val = getattr(repo_in, field)
            if val is not None:
                setattr(repo, field, val)

        if repo_in.tags is not None:
            repo.tags = _tags_to_json(repo_in.tags)

        db.flush()

        _log_repo_activity(db, repo.id, user_id, "Repository Updated", f"Repository '{repo.name}' metadata updated")
        _log_workspace_activity(
            db,
            workspace_id=repo.workspace_id,
            project_id=repo.project_id,
            user_id=user_id,
            action="Repository Updated",
            details=f"Repository '{repo.name}' details updated",
            repository_id=repo.id,
        )

        db.commit()
        db.refresh(repo)
        return repo

    @staticmethod
    def archive(db: Session, repo: Repository, archive: bool, user_id: str) -> Repository:
        repo.is_archived = archive
        db.flush()
        action = "Repository Archived" if archive else "Repository Unarchived"
        _log_repo_activity(db, repo.id, user_id, action, f"Repository '{repo.name}' {'archived' if archive else 'unarchived'}")
        _log_workspace_activity(
            db,
            workspace_id=repo.workspace_id,
            project_id=repo.project_id,
            user_id=user_id,
            action=action,
            details=f"Repository '{repo.name}' {'archived' if archive else 'unarchived'}",
            repository_id=repo.id,
        )
        db.commit()
        db.refresh(repo)
        return repo

    @staticmethod
    def set_favorite(db: Session, user_id: str, repo_id: str, favorite: bool) -> None:
        fav = db.query(RepositoryFavorite).filter(
            RepositoryFavorite.user_id == user_id,
            RepositoryFavorite.repository_id == repo_id,
        ).first()

        if favorite and not fav:
            db.add(RepositoryFavorite(id=_new_id(), user_id=user_id, repository_id=repo_id))
        elif not favorite and fav:
            db.delete(fav)
        db.commit()

    # ── Settings ──────────────────────────────

    @staticmethod
    def get_settings(db: Session, repo_id: str) -> Optional[RepositorySettings]:
        return db.query(RepositorySettings).filter(RepositorySettings.repository_id == repo_id).first()

    @staticmethod
    def update_settings(
        db: Session,
        settings: RepositorySettings,
        settings_in: RepositorySettingsUpdate,
    ) -> RepositorySettings:
        updateable = ["auto_analyze", "notify_on_change", "default_branch", "analysis_depth"]
        for field in updateable:
            val = getattr(settings_in, field)
            if val is not None:
                setattr(settings, field, val)
        db.commit()
        db.refresh(settings)
        return settings

    # ── Activity ──────────────────────────────

    @staticmethod
    def list_activity(
        db: Session,
        repo_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[RepositoryActivity]:
        return (
            db.query(RepositoryActivity)
            .filter(RepositoryActivity.repository_id == repo_id)
            .order_by(RepositoryActivity.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    # ── Delete ────────────────────────────────

    @staticmethod
    def delete(db: Session, repo: Repository, user_id: str) -> None:
        project_id = repo.project_id
        workspace_id = repo.workspace_id
        name = repo.name

        db.delete(repo)
        db.flush()

        _increment_project_repo_count(db, project_id, -1)
        _log_workspace_activity(
            db,
            workspace_id=workspace_id,
            project_id=project_id,
            user_id=user_id,
            action="Repository Deleted",
            details=f"Repository '{name}' permanently deleted",
            repository_id=None,
        )
        db.commit()
