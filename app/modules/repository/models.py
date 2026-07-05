from datetime import UTC, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database.session import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class Repository(Base):
    __tablename__ = "repositories"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_repository_project_name"),
        CheckConstraint("repo_type IN ('manual', 'zip', 'git')", name="ck_repository_type"),
        CheckConstraint(
            "status IN ('pending', 'uploaded', 'connected', 'archived', 'error')",
            name="ck_repository_status",
        ),
        CheckConstraint(
            "visibility IN ('Private', 'Internal', 'Public')",
            name="ck_repository_visibility",
        ),
        Index("ix_repositories_project_status", "project_id", "status"),
        Index("ix_repositories_workspace_updated", "workspace_id", "updated_at"),
    )

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text)
    repo_type = Column(String(16), nullable=False, default="manual")
    status = Column(String(16), nullable=False, default="pending")
    visibility = Column(String(16), nullable=False, default="Private")
    git_url = Column(String(2048))
    git_branch = Column(String(255), default="main")
    upload_path = Column(String(2048))
    extracted_path = Column(String(2048))
    original_filename = Column(String(255))
    file_size_bytes = Column(BigInteger)
    language = Column(String(64))
    notes = Column(Text)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="repositories")
    owner = relationship("User", back_populates="repositories", foreign_keys=[owner_id])
    metadata_record = relationship("RepositoryMetadata", back_populates="repository", uselist=False, cascade="all, delete-orphan")
    settings = relationship("RepositorySettings", back_populates="repository", uselist=False, cascade="all, delete-orphan")
    tags = relationship("RepositoryTag", back_populates="repository", cascade="all, delete-orphan")
    favorites = relationship("RepositoryFavorite", back_populates="repository", cascade="all, delete-orphan")
    activity_logs = relationship("RepositoryActivity", back_populates="repository", cascade="all, delete-orphan")
    uploads = relationship("RepositoryUpload", back_populates="repository", cascade="all, delete-orphan")


class RepositoryMetadata(Base):
    __tablename__ = "repository_metadata"
    id = Column(String, primary_key=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, unique=True)
    total_files = Column(Integer, nullable=False, default=0)
    total_folders = Column(Integer, nullable=False, default=0)
    extracted_size_bytes = Column(BigInteger, nullable=False, default=0)
    archive_sha256 = Column(String(64))
    generated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    repository = relationship("Repository", back_populates="metadata_record")


class RepositorySettings(Base):
    __tablename__ = "repository_settings"
    __table_args__ = (CheckConstraint("analysis_depth IN ('shallow', 'deep')", name="ck_repository_analysis_depth"),)
    id = Column(String, primary_key=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, unique=True)
    auto_analyze = Column(Boolean, nullable=False, default=False)
    notify_on_change = Column(Boolean, nullable=False, default=False)
    default_branch = Column(String(255), nullable=False, default="main")
    analysis_depth = Column(String(16), nullable=False, default="shallow")
    repository = relationship("Repository", back_populates="settings")


class RepositoryTag(Base):
    __tablename__ = "repository_tags"
    __table_args__ = (UniqueConstraint("repository_id", "name", name="uq_repository_tag_name"),)
    id = Column(String, primary_key=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(64), nullable=False, index=True)
    repository = relationship("Repository", back_populates="tags")


class RepositoryFavorite(Base):
    __tablename__ = "repository_favorites"
    __table_args__ = (UniqueConstraint("user_id", "repository_id", name="uq_repository_favorite"),)
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    user = relationship("User", back_populates="repository_favorites")
    repository = relationship("Repository", back_populates="favorites")


class RepositoryActivity(Base):
    __tablename__ = "repository_activity"
    __table_args__ = (Index("ix_repository_activity_repo_created", "repository_id", "created_at"),)
    id = Column(String, primary_key=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    action = Column(String(80), nullable=False)
    details = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    repository = relationship("Repository", back_populates="activity_logs")
    user = relationship("User", back_populates="repository_activity_logs")


class RepositoryUpload(Base):
    __tablename__ = "repository_uploads"
    __table_args__ = (Index("ix_repository_upload_repo_time", "repository_id", "uploaded_at"),)
    id = Column(String, primary_key=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    uploaded_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    filename = Column(String(255), nullable=False)
    storage_path = Column(String(2048))
    file_size_bytes = Column(BigInteger)
    sha256 = Column(String(64))
    status = Column(String(16), nullable=False, default="success")
    error_message = Column(Text)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    repository = relationship("Repository", back_populates="uploads")
    uploader = relationship("User", back_populates="upload_history", foreign_keys=[uploaded_by])


# Compatibility for existing imports while the public table follows the Phase 2 name.
RepositoryUploadHistory = RepositoryUpload
