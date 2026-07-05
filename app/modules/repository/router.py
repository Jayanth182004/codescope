import json
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.auth.models import User
from app.modules.repository.repository import RepositoryRepo
from app.modules.repository.schemas import (
    ConnectGitRepo, RepositoryActivityOut, RepositoryArchiveToggle, RepositoryCreate,
    RepositoryFavoriteToggle, RepositoryListMeta, RepositoryListOut, RepositoryMetadataOut,
    RepositoryOut, RepositorySettingsOut, RepositorySettingsUpdate, RepositoryUpdate,
    RepositoryUploadHistoryOut,
)
from app.modules.repository.services import (
    RepositorySearchService, RepositoryService, RepositorySettingsService, RepositoryValidationService,
)
from app.shared_schemas import APIEnvelope

router = APIRouter(prefix="/repositories", tags=["Repositories"])


def serialize(repository, db: Session, user_id: str) -> RepositoryOut:
    metadata = repository.metadata_record
    return RepositoryOut(
        id=repository.id, project_id=repository.project_id, workspace_id=repository.workspace_id,
        name=repository.name, description=repository.description, repo_type=repository.repo_type,
        status=repository.status, visibility=repository.visibility, git_url=repository.git_url,
        git_branch=repository.git_branch, original_filename=repository.original_filename,
        file_size_bytes=repository.file_size_bytes, language=repository.language,
        tags=[tag.name for tag in repository.tags], notes=repository.notes,
        is_archived=repository.is_archived, is_favorite=RepositoryRepo.is_favorite(db, user_id, repository.id),
        created_at=repository.created_at, updated_at=repository.updated_at,
        settings=RepositorySettingsOut.model_validate(repository.settings) if repository.settings else None,
        metadata=RepositoryMetadataOut.model_validate(metadata) if metadata else None,
    )


@router.post("", response_model=APIEnvelope[RepositoryOut], status_code=201)
def create_repository(data: RepositoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    repository = RepositoryService(db).create(data, user.id)
    return APIEnvelope(success=True, message="Repository created", data=serialize(repository, db, user.id))


@router.get("", response_model=APIEnvelope[RepositoryListOut])
@router.get("/search", response_model=APIEnvelope[RepositoryListOut], include_in_schema=False)
@router.get("/filter", response_model=APIEnvelope[RepositoryListOut], include_in_schema=False)
def list_repositories(
    project_id: str, search: str | None = None, status: str | None = None,
    visibility: str | None = None, repo_type: str | None = None, tag: str | None = None,
    favorite: bool = False, sort: str = Query("updated_at", pattern="^(name|created_at|updated_at)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"), limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    RepositoryValidationService.project_access(db, project_id, user.id, write=False)
    rows, total = RepositorySearchService.list(
        db, project_id=project_id, search=search, status=status, visibility=visibility,
        repo_type=repo_type, tag=tag, favorite_user_id=user.id if favorite else None,
        sort=sort, order=order, limit=limit, offset=offset,
    )
    data = RepositoryListOut(items=[serialize(row, db, user.id) for row in rows], pagination=RepositoryListMeta(total=total, limit=limit, offset=offset))
    return APIEnvelope(success=True, message="Repositories retrieved", data=data)


@router.post("/upload", response_model=APIEnvelope[RepositoryOut], status_code=201)
async def upload_repository(
    project_id: Annotated[str, Form()], name: Annotated[str, Form()], file: Annotated[UploadFile, File()],
    description: Annotated[str | None, Form()] = None, visibility: Annotated[str, Form()] = "Private",
    tags: Annotated[str, Form()] = "[]", notes: Annotated[str | None, Form()] = None,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    try:
        parsed_tags = json.loads(tags)
        if not isinstance(parsed_tags, list): raise ValueError
    except (json.JSONDecodeError, ValueError):
        parsed_tags = [value.strip() for value in tags.split(",") if value.strip()]
    data = RepositoryCreate(project_id=project_id, name=name, description=description, visibility=visibility, tags=parsed_tags, notes=notes)
    repository = await RepositoryService(db).upload(data, file, user.id)
    return APIEnvelope(success=True, message="Repository uploaded and extracted", data=serialize(repository, db, user.id))


@router.post("/connect", response_model=APIEnvelope[RepositoryOut], status_code=201)
@router.post("/connect-git", response_model=APIEnvelope[RepositoryOut], status_code=201, include_in_schema=False)
def connect_repository(data: ConnectGitRepo, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    repository = RepositoryService(db).connect(data, user.id)
    return APIEnvelope(success=True, message="Git repository connected", data=serialize(repository, db, user.id))


@router.get("/{repository_id}", response_model=APIEnvelope[RepositoryOut])
def get_repository(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    repository = RepositoryValidationService.repository_access(db, repository_id, user.id, write=False)
    return APIEnvelope(success=True, message="Repository retrieved", data=serialize(repository, db, user.id))


@router.patch("/{repository_id}", response_model=APIEnvelope[RepositoryOut])
def update_repository(repository_id: str, data: RepositoryUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    repository = RepositoryValidationService.repository_access(db, repository_id, user.id, write=True)
    repository = RepositoryService(db).update(repository, data, user.id)
    return APIEnvelope(success=True, message="Repository updated", data=serialize(repository, db, user.id))


@router.post("/{repository_id}/favorite", response_model=APIEnvelope[None])
def favorite_repository(repository_id: str, data: RepositoryFavoriteToggle, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    RepositoryValidationService.repository_access(db, repository_id, user.id, write=True)
    RepositoryRepo.set_favorite(db, user.id, repository_id, data.favorite); db.commit()
    return APIEnvelope(success=True, message="Favorite updated")


@router.post("/{repository_id}/archive", response_model=APIEnvelope[RepositoryOut])
def archive_repository(repository_id: str, data: RepositoryArchiveToggle, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    repository = RepositoryValidationService.repository_access(db, repository_id, user.id, write=True)
    repository = RepositoryService(db).archive(repository, data.archive, user.id)
    return APIEnvelope(success=True, message="Archive status updated", data=serialize(repository, db, user.id))


@router.get("/{repository_id}/activity", response_model=APIEnvelope[list[RepositoryActivityOut]])
def repository_activity(repository_id: str, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    RepositoryValidationService.repository_access(db, repository_id, user.id, write=False)
    rows = RepositoryRepo.list_activity(db, repository_id, limit, offset)
    return APIEnvelope(success=True, message="Repository activity retrieved", data=[RepositoryActivityOut.model_validate(row) for row in rows])


@router.get("/{repository_id}/uploads", response_model=APIEnvelope[list[RepositoryUploadHistoryOut]])
def repository_uploads(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    RepositoryValidationService.repository_access(db, repository_id, user.id, write=False)
    return APIEnvelope(success=True, message="Upload history retrieved", data=[RepositoryUploadHistoryOut.model_validate(row) for row in RepositoryRepo.list_uploads(db, repository_id)])


@router.get("/{repository_id}/settings", response_model=APIEnvelope[RepositorySettingsOut])
def get_settings(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    repository = RepositoryValidationService.repository_access(db, repository_id, user.id, write=False)
    return APIEnvelope(success=True, message="Settings retrieved", data=RepositorySettingsOut.model_validate(repository.settings))


@router.patch("/{repository_id}/settings", response_model=APIEnvelope[RepositorySettingsOut])
def update_settings(repository_id: str, data: RepositorySettingsUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    repository = RepositoryValidationService.repository_access(db, repository_id, user.id, write=True)
    result = RepositorySettingsService.update(db, repository, data, user.id)
    return APIEnvelope(success=True, message="Settings updated", data=RepositorySettingsOut.model_validate(result))


@router.delete("/{repository_id}", response_model=APIEnvelope[None])
def delete_repository(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    repository = RepositoryValidationService.repository_access(db, repository_id, user.id, write=True)
    RepositoryService(db).delete(repository, user.id)
    return APIEnvelope(success=True, message="Repository deleted")
