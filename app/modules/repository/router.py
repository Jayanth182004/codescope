import os
import uuid
import json
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.auth.models import User
from app.modules.repository.schemas import (
    RepositoryCreate,
    RepositoryUpdate,
    RepositoryOut,
    RepositorySettingsOut,
    RepositorySettingsUpdate,
    RepositoryActivityOut,
    RepositoryFavoriteToggle,
    RepositoryArchiveToggle,
    ConnectGitRepo,
    RepositoryUploadHistoryOut,
)
from app.modules.repository.repository import RepositoryRepo
from app.modules.project.repository import ProjectRepository
from app.modules.workspace.repository import WorkspaceRepository
from app.shared_schemas import APIEnvelope
from app.core.exceptions import APIError
from app.core.config import settings

router = APIRouter(prefix="/repositories", tags=["Repositories"])


# ─────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────

def _build_repo_out(repo, db: Session, user_id: str) -> RepositoryOut:
    """Convert an ORM Repository to RepositoryOut, resolving computed fields."""
    is_fav = RepositoryRepo.check_is_favorite(db, user_id, repo.id)
    tags = RepositoryRepo.get_tags(repo)
    settings_out = None
    if repo.settings:
        settings_out = RepositorySettingsOut(
            id=repo.settings.id,
            repository_id=repo.settings.repository_id,
            auto_analyze=repo.settings.auto_analyze,
            notify_on_change=repo.settings.notify_on_change,
            default_branch=repo.settings.default_branch,
            analysis_depth=repo.settings.analysis_depth,
        )
    return RepositoryOut(
        id=repo.id,
        project_id=repo.project_id,
        workspace_id=repo.workspace_id,
        name=repo.name,
        description=repo.description,
        repo_type=repo.repo_type,
        status=repo.status,
        visibility=repo.visibility,
        git_url=repo.git_url,
        git_branch=repo.git_branch,
        original_filename=repo.original_filename,
        file_size_bytes=repo.file_size_bytes,
        language=repo.language,
        tags=tags,
        notes=repo.notes,
        is_archived=repo.is_archived,
        is_favorite=is_fav,
        created_at=repo.created_at,
        updated_at=repo.updated_at,
        settings=settings_out,
    )


def _get_upload_dir(project_id: str) -> Path:
    """
    Return (and create) the upload directory for a given project.
    Configurable via UPLOAD_DIR in settings; defaults to ./uploads/repositories/{project_id}
    """
    base = Path(settings.UPLOAD_DIR) / "repositories" / project_id
    base.mkdir(parents=True, exist_ok=True)
    return base


def _resolve_project_workspace(db, project_id: str, current_user: User):
    """Shared guard: fetch project and verify user has workspace access."""
    project = ProjectRepository.get_by_id(db, project_id)
    if not project:
        raise APIError("Project not found", status_code=404)
    role = WorkspaceRepository.check_user_role(db, project.workspace_id, current_user.id)
    if not role:
        raise APIError("Access denied to this project", status_code=403)
    return project, role


# ─────────────────────────────────────────────────────────────
# LIST repositories in a project
# GET /repositories?project_id=xxx
# ─────────────────────────────────────────────────────────────

@router.get("", response_model=APIEnvelope[List[RepositoryOut]])
def list_repositories(
    project_id: str = Query(..., description="Project ID to list repositories for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _resolve_project_workspace(db, project_id, current_user)
    repos = RepositoryRepo.list_by_project(db, project_id)
    return APIEnvelope(
        success=True,
        message="Repositories retrieved successfully",
        data=[_build_repo_out(r, db, current_user.id) for r in repos],
    )


# ─────────────────────────────────────────────────────────────
# CREATE bare repository record
# POST /repositories
# ─────────────────────────────────────────────────────────────

@router.post("", response_model=APIEnvelope[RepositoryOut])
def create_repository(
    repo_in: RepositoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project, role = _resolve_project_workspace(db, repo_in.project_id, current_user)
    if role not in ["owner", "admin"]:
        raise APIError("Insufficient privileges to create repositories", status_code=403)

    repo = RepositoryRepo.create(
        db=db,
        repo_in=repo_in,
        workspace_id=project.workspace_id,
        owner_id=current_user.id,
    )
    return APIEnvelope(
        success=True,
        message="Repository created successfully",
        data=_build_repo_out(repo, db, current_user.id),
    )


# ─────────────────────────────────────────────────────────────
# UPLOAD ZIP repository
# POST /repositories/upload
# ─────────────────────────────────────────────────────────────

@router.post("/upload", response_model=APIEnvelope[RepositoryOut])
async def upload_repository(
    project_id:  str         = Form(...),
    name:        str         = Form(...),
    description: Optional[str] = Form(None),
    visibility:  str         = Form("Private"),
    tags:        Optional[str] = Form(None),   # JSON array string e.g. '["python","api"]'
    notes:       Optional[str] = Form(None),
    file:        UploadFile  = File(...),
    db: Session              = Depends(get_db),
    current_user: User       = Depends(get_current_user),
):
    # 1. Guard: project exists and user has access
    project, role = _resolve_project_workspace(db, project_id, current_user)
    if role not in ["owner", "admin"]:
        raise APIError("Insufficient privileges to upload repositories", status_code=403)

    # 2. Validate file extension — only .zip allowed
    filename = file.filename or ""
    if not filename.lower().endswith(".zip"):
        raise APIError(
            "Invalid file type. Only .zip archives are accepted.",
            status_code=400,
            errors=["File must have a .zip extension"],
        )

    # 3. Determine save path: UPLOAD_DIR/repositories/{project_id}/{uuid}.zip
    upload_dir = _get_upload_dir(project_id)
    saved_filename = f"{uuid.uuid4()}.zip"
    save_path = upload_dir / saved_filename

    # 4. Stream file to disk (no size limit — handles enterprise-grade archives)
    try:
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as exc:
        raise APIError(f"Failed to save uploaded file: {str(exc)}", status_code=500)
    finally:
        await file.close()

    # 5. Get actual size from disk
    file_size_bytes = os.path.getsize(save_path)

    # 6. Parse tags from JSON string
    parsed_tags: List[str] = []
    if tags:
        try:
            parsed_tags = json.loads(tags)
        except json.JSONDecodeError:
            parsed_tags = [t.strip() for t in tags.split(",") if t.strip()]

    # 7. Create repository record
    repo = RepositoryRepo.create_from_upload(
        db=db,
        project_id=project_id,
        workspace_id=project.workspace_id,
        owner_id=current_user.id,
        name=name,
        description=description,
        visibility=visibility,
        upload_path=str(save_path),
        original_filename=filename,
        file_size_bytes=file_size_bytes,
        tags=parsed_tags,
        notes=notes,
    )
    return APIEnvelope(
        success=True,
        message="Repository ZIP uploaded and registered successfully",
        data=_build_repo_out(repo, db, current_user.id),
    )


# ─────────────────────────────────────────────────────────────
# CONNECT GIT repository
# POST /repositories/connect-git
# ─────────────────────────────────────────────────────────────

@router.post("/connect-git", response_model=APIEnvelope[RepositoryOut])
def connect_git_repository(
    git_in: ConnectGitRepo,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project, role = _resolve_project_workspace(db, git_in.project_id, current_user)
    if role not in ["owner", "admin"]:
        raise APIError("Insufficient privileges to connect Git repositories", status_code=403)

    repo = RepositoryRepo.create_from_git(
        db=db,
        git_in=git_in,
        workspace_id=project.workspace_id,
        owner_id=current_user.id,
    )
    return APIEnvelope(
        success=True,
        message="Git repository connected successfully",
        data=_build_repo_out(repo, db, current_user.id),
    )


# ─────────────────────────────────────────────────────────────
# GET single repository details
# GET /repositories/{repo_id}
# ─────────────────────────────────────────────────────────────

@router.get("/{repo_id}", response_model=APIEnvelope[RepositoryOut])
def get_repository(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = RepositoryRepo.get_by_id(db, repo_id)
    if not repo:
        raise APIError("Repository not found", status_code=404)

    role = WorkspaceRepository.check_user_role(db, repo.workspace_id, current_user.id)
    if not role:
        raise APIError("Access denied", status_code=403)

    return APIEnvelope(
        success=True,
        message="Repository details retrieved",
        data=_build_repo_out(repo, db, current_user.id),
    )


# ─────────────────────────────────────────────────────────────
# UPDATE repository metadata
# PATCH /repositories/{repo_id}
# ─────────────────────────────────────────────────────────────

@router.patch("/{repo_id}", response_model=APIEnvelope[RepositoryOut])
def update_repository(
    repo_id: str,
    repo_in: RepositoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = RepositoryRepo.get_by_id(db, repo_id)
    if not repo:
        raise APIError("Repository not found", status_code=404)

    role = WorkspaceRepository.check_user_role(db, repo.workspace_id, current_user.id)
    if role not in ["owner", "admin"]:
        raise APIError("Insufficient privileges to update this repository", status_code=403)

    updated = RepositoryRepo.update(db, repo, repo_in, current_user.id)
    return APIEnvelope(
        success=True,
        message="Repository updated successfully",
        data=_build_repo_out(updated, db, current_user.id),
    )


# ─────────────────────────────────────────────────────────────
# ARCHIVE / UNARCHIVE repository
# POST /repositories/{repo_id}/archive
# ─────────────────────────────────────────────────────────────

@router.post("/{repo_id}/archive", response_model=APIEnvelope[RepositoryOut])
def archive_repository(
    repo_id: str,
    body: RepositoryArchiveToggle,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = RepositoryRepo.get_by_id(db, repo_id)
    if not repo:
        raise APIError("Repository not found", status_code=404)

    role = WorkspaceRepository.check_user_role(db, repo.workspace_id, current_user.id)
    if role not in ["owner", "admin"]:
        raise APIError("Insufficient privileges to archive this repository", status_code=403)

    updated = RepositoryRepo.archive(db, repo, body.archive, current_user.id)
    action_label = "archived" if body.archive else "unarchived"
    return APIEnvelope(
        success=True,
        message=f"Repository {action_label} successfully",
        data=_build_repo_out(updated, db, current_user.id),
    )


# ─────────────────────────────────────────────────────────────
# FAVORITE / UNFAVORITE repository
# POST /repositories/{repo_id}/favorite
# ─────────────────────────────────────────────────────────────

@router.post("/{repo_id}/favorite", response_model=APIEnvelope[None])
def toggle_favorite(
    repo_id: str,
    body: RepositoryFavoriteToggle,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = RepositoryRepo.get_by_id(db, repo_id)
    if not repo:
        raise APIError("Repository not found", status_code=404)

    role = WorkspaceRepository.check_user_role(db, repo.workspace_id, current_user.id)
    if not role:
        raise APIError("Access denied", status_code=403)

    RepositoryRepo.set_favorite(db, current_user.id, repo_id, body.favorite)
    label = "added to" if body.favorite else "removed from"
    return APIEnvelope(success=True, message=f"Repository {label} favorites")


# ─────────────────────────────────────────────────────────────
# GET repository activity log
# GET /repositories/{repo_id}/activity
# ─────────────────────────────────────────────────────────────

@router.get("/{repo_id}/activity", response_model=APIEnvelope[List[RepositoryActivityOut]])
def get_repository_activity(
    repo_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = RepositoryRepo.get_by_id(db, repo_id)
    if not repo:
        raise APIError("Repository not found", status_code=404)

    role = WorkspaceRepository.check_user_role(db, repo.workspace_id, current_user.id)
    if not role:
        raise APIError("Access denied", status_code=403)

    logs = RepositoryRepo.list_activity(db, repo_id, limit=limit, offset=offset)
    return APIEnvelope(
        success=True,
        message="Repository activity retrieved",
        data=[
            RepositoryActivityOut(
                id=a.id,
                repository_id=a.repository_id,
                action=a.action,
                details=a.details,
                created_at=a.created_at,
            )
            for a in logs
        ],
    )


# ─────────────────────────────────────────────────────────────
# GET repository settings
# GET /repositories/{repo_id}/settings
# ─────────────────────────────────────────────────────────────

@router.get("/{repo_id}/settings", response_model=APIEnvelope[RepositorySettingsOut])
def get_repository_settings(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = RepositoryRepo.get_by_id(db, repo_id)
    if not repo:
        raise APIError("Repository not found", status_code=404)

    role = WorkspaceRepository.check_user_role(db, repo.workspace_id, current_user.id)
    if not role:
        raise APIError("Access denied", status_code=403)

    s = RepositoryRepo.get_settings(db, repo_id)
    if not s:
        raise APIError("Repository settings not found", status_code=404)

    return APIEnvelope(
        success=True,
        message="Repository settings retrieved",
        data=RepositorySettingsOut(
            id=s.id,
            repository_id=s.repository_id,
            auto_analyze=s.auto_analyze,
            notify_on_change=s.notify_on_change,
            default_branch=s.default_branch,
            analysis_depth=s.analysis_depth,
        ),
    )


# ─────────────────────────────────────────────────────────────
# UPDATE repository settings
# PATCH /repositories/{repo_id}/settings
# ─────────────────────────────────────────────────────────────

@router.patch("/{repo_id}/settings", response_model=APIEnvelope[RepositorySettingsOut])
def update_repository_settings(
    repo_id: str,
    settings_in: RepositorySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = RepositoryRepo.get_by_id(db, repo_id)
    if not repo:
        raise APIError("Repository not found", status_code=404)

    role = WorkspaceRepository.check_user_role(db, repo.workspace_id, current_user.id)
    if role not in ["owner", "admin"]:
        raise APIError("Insufficient privileges to update repository settings", status_code=403)

    s = RepositoryRepo.get_settings(db, repo_id)
    if not s:
        raise APIError("Repository settings not found", status_code=404)

    updated_s = RepositoryRepo.update_settings(db, s, settings_in)
    return APIEnvelope(
        success=True,
        message="Repository settings updated",
        data=RepositorySettingsOut(
            id=updated_s.id,
            repository_id=updated_s.repository_id,
            auto_analyze=updated_s.auto_analyze,
            notify_on_change=updated_s.notify_on_change,
            default_branch=updated_s.default_branch,
            analysis_depth=updated_s.analysis_depth,
        ),
    )


# ─────────────────────────────────────────────────────────────
# DELETE repository
# DELETE /repositories/{repo_id}
# ─────────────────────────────────────────────────────────────

@router.delete("/{repo_id}", response_model=APIEnvelope[None])
def delete_repository(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = RepositoryRepo.get_by_id(db, repo_id)
    if not repo:
        raise APIError("Repository not found", status_code=404)

    role = WorkspaceRepository.check_user_role(db, repo.workspace_id, current_user.id)
    if role not in ["owner", "admin"]:
        raise APIError("Insufficient privileges to delete this repository", status_code=403)

    # Optionally clean up stored ZIP from disk
    if repo.upload_path and os.path.exists(repo.upload_path):
        try:
            os.remove(repo.upload_path)
        except OSError:
            pass  # Non-fatal: DB record still gets deleted

    RepositoryRepo.delete(db, repo, current_user.id)
    return APIEnvelope(success=True, message="Repository deleted successfully")
