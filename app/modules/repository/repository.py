from __future__ import annotations

import uuid

from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session, selectinload

from app.modules.repository.models import (
    Repository,
    RepositoryActivity,
    RepositoryFavorite,
    RepositoryMetadata,
    RepositorySettings,
    RepositoryTag,
    RepositoryUpload,
)


def new_id() -> str:
    return str(uuid.uuid4())


class RepositoryRepo:
    """Persistence operations only; transaction boundaries belong to services."""

    @staticmethod
    def get_by_id(db: Session, repository_id: str) -> Repository | None:
        return db.query(Repository).options(
            selectinload(Repository.settings),
            selectinload(Repository.metadata_record),
            selectinload(Repository.tags),
        ).filter(Repository.id == repository_id).first()

    @staticmethod
    def get_by_project_name(db: Session, project_id: str, name: str, exclude_id: str | None = None) -> Repository | None:
        query = db.query(Repository).filter(
            Repository.project_id == project_id,
            func.lower(Repository.name) == name.lower(),
        )
        if exclude_id:
            query = query.filter(Repository.id != exclude_id)
        return query.first()

    @staticmethod
    def list(
        db: Session,
        project_id: str,
        *,
        search: str | None = None,
        status: str | None = None,
        visibility: str | None = None,
        repo_type: str | None = None,
        tag: str | None = None,
        favorite_user_id: str | None = None,
        sort: str = "updated_at",
        order: str = "desc",
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Repository], int]:
        query = db.query(Repository).options(selectinload(Repository.tags)).filter(Repository.project_id == project_id)
        if search:
            term = f"%{search.strip()}%"
            query = query.filter(or_(Repository.name.ilike(term), Repository.description.ilike(term)))
        if status:
            query = query.filter(Repository.status == status)
        if visibility:
            query = query.filter(Repository.visibility == visibility)
        if repo_type:
            query = query.filter(Repository.repo_type == repo_type)
        if tag:
            query = query.join(RepositoryTag).filter(RepositoryTag.name == tag.lower())
        if favorite_user_id:
            query = query.join(RepositoryFavorite).filter(RepositoryFavorite.user_id == favorite_user_id)
        total = query.order_by(None).count()
        sort_column = {"name": Repository.name, "created_at": Repository.created_at, "updated_at": Repository.updated_at}.get(sort, Repository.updated_at)
        ordering = asc(sort_column) if order == "asc" else desc(sort_column)
        return query.order_by(ordering).offset(offset).limit(limit).all(), total

    @staticmethod
    def add(db: Session, repository: Repository) -> None:
        db.add(repository)

    @staticmethod
    def delete(db: Session, repository: Repository) -> None:
        db.delete(repository)

    @staticmethod
    def replace_tags(db: Session, repository: Repository, tags: list[str]) -> None:
        repository.tags.clear()
        repository.tags.extend(RepositoryTag(id=new_id(), name=tag) for tag in tags)

    @staticmethod
    def is_favorite(db: Session, user_id: str, repository_id: str) -> bool:
        return db.query(RepositoryFavorite.id).filter_by(user_id=user_id, repository_id=repository_id).first() is not None

    @staticmethod
    def set_favorite(db: Session, user_id: str, repository_id: str, favorite: bool) -> None:
        record = db.query(RepositoryFavorite).filter_by(user_id=user_id, repository_id=repository_id).first()
        if favorite and record is None:
            db.add(RepositoryFavorite(id=new_id(), user_id=user_id, repository_id=repository_id))
        elif not favorite and record is not None:
            db.delete(record)

    @staticmethod
    def add_activity(db: Session, repository_id: str, user_id: str, action: str, details: str) -> None:
        db.add(RepositoryActivity(id=new_id(), repository_id=repository_id, user_id=user_id, action=action, details=details))

    @staticmethod
    def list_activity(db: Session, repository_id: str, limit: int, offset: int) -> list[RepositoryActivity]:
        return db.query(RepositoryActivity).filter_by(repository_id=repository_id).order_by(RepositoryActivity.created_at.desc()).offset(offset).limit(limit).all()

    @staticmethod
    def add_upload(db: Session, upload: RepositoryUpload) -> None:
        db.add(upload)

    @staticmethod
    def list_uploads(db: Session, repository_id: str) -> list[RepositoryUpload]:
        return db.query(RepositoryUpload).filter_by(repository_id=repository_id).order_by(RepositoryUpload.uploaded_at.desc()).all()

    @staticmethod
    def get_settings(db: Session, repository_id: str) -> RepositorySettings | None:
        return db.query(RepositorySettings).filter_by(repository_id=repository_id).first()

    @staticmethod
    def create_children(db: Session, repository: Repository, tags: list[str]) -> None:
        repository.settings = RepositorySettings(id=new_id())
        repository.metadata_record = RepositoryMetadata(id=new_id())
        RepositoryRepo.replace_tags(db, repository, tags)
