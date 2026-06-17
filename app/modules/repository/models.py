from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey, DateTime, Text, BigInteger
)
from sqlalchemy.orm import relationship
from app.database.session import Base


class Repository(Base):
    """
    Core repository entity. Belongs to one Project.
    Supports two repo_types: 'zip' (uploaded archive) and 'git' (remote URL).
    Status lifecycle: pending → uploaded/connected → (Phase 3: analyzing → indexed) → archived
    """
    __tablename__ = "repositories"

    id                = Column(String,   primary_key=True, index=True)
    project_id        = Column(String,   ForeignKey("projects.id",   ondelete="CASCADE"),  nullable=False, index=True)
    workspace_id      = Column(String,   ForeignKey("workspaces.id", ondelete="CASCADE"),  nullable=False, index=True)
    owner_id          = Column(String,   ForeignKey("users.id",      ondelete="SET NULL"), nullable=True,  index=True)

    # Identity
    name              = Column(String,   nullable=False)
    description       = Column(Text,     nullable=True)

    # Type & Status
    repo_type         = Column(String,   nullable=False, default="zip")   # zip | git
    status            = Column(String,   nullable=False, default="pending") # pending | uploaded | connected | archived | error

    # Visibility
    visibility        = Column(String,   nullable=False, default="Private")  # Private | Internal | Public

    # Git fields (populated only when repo_type == 'git')
    git_url           = Column(String,   nullable=True)
    git_branch        = Column(String,   nullable=True, default="main")

    # ZIP upload fields (populated only when repo_type == 'zip')
    upload_path       = Column(String,   nullable=True)         # absolute server path to stored ZIP
    original_filename = Column(String,   nullable=True)         # original client filename
    file_size_bytes   = Column(BigInteger, nullable=True)       # bytes; BigInteger = no upper limit

    # Enrichment (Phase 3 will fill these)
    language          = Column(String,   nullable=True)         # Primary detected language
    tags              = Column(Text,     nullable=True)         # JSON array stored as text e.g. '["python","api"]'
    notes             = Column(Text,     nullable=True)         # Free-form user notes

    # Flags
    is_archived       = Column(Boolean,  nullable=False, default=False)

    # Timestamps
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ORM Relationships
    project           = relationship("Project",             back_populates="repositories")
    owner             = relationship("User",                back_populates="repositories",       foreign_keys=[owner_id])
    settings          = relationship("RepositorySettings",  back_populates="repository",         uselist=False, cascade="all, delete-orphan")
    favorites         = relationship("RepositoryFavorite",  back_populates="repository",         cascade="all, delete-orphan")
    activity_logs     = relationship("RepositoryActivity",  back_populates="repository",         cascade="all, delete-orphan")
    upload_history    = relationship("RepositoryUploadHistory", back_populates="repository",     cascade="all, delete-orphan")


class RepositorySettings(Base):
    """
    One-to-one with Repository.
    Holds configuration preferences. auto_analyze will be read by Phase 3 analysis engine.
    """
    __tablename__ = "repository_settings"

    id              = Column(String,  primary_key=True, index=True)
    repository_id   = Column(String,  ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, unique=True)

    auto_analyze    = Column(Boolean, nullable=False, default=False)   # Phase 3 hook
    notify_on_change = Column(Boolean, nullable=False, default=False)  # Future use
    default_branch  = Column(String,  nullable=False, default="main")
    analysis_depth  = Column(String,  nullable=False, default="shallow")  # shallow | deep

    # ORM
    repository      = relationship("Repository", back_populates="settings")


class RepositoryFavorite(Base):
    """
    Many-to-many: a user can favorite multiple repositories.
    Separate from project favorites.
    """
    __tablename__ = "repository_favorites"

    id              = Column(String, primary_key=True, index=True)
    user_id         = Column(String, ForeignKey("users.id",         ondelete="CASCADE"), nullable=False, index=True)
    repository_id   = Column(String, ForeignKey("repositories.id",  ondelete="CASCADE"), nullable=False, index=True)

    # ORM
    user            = relationship("User",       back_populates="repository_favorites")
    repository      = relationship("Repository", back_populates="favorites")


class RepositoryActivity(Base):
    """
    Repository-scoped audit log.
    Complements the workspace-level activity_logs table.
    Each repository action writes here AND to activity_logs.
    """
    __tablename__ = "repository_activity"

    id              = Column(String,   primary_key=True, index=True)
    repository_id   = Column(String,   ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id         = Column(String,   ForeignKey("users.id",        ondelete="SET NULL"), nullable=True)
    action          = Column(String,   nullable=False)   # e.g. "Repository Created"
    details         = Column(Text,     nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    # ORM
    repository      = relationship("Repository", back_populates="activity_logs")
    user            = relationship("User",        back_populates="repository_activity_logs")


class RepositoryUploadHistory(Base):
    """
    Tracks every ZIP upload attempt for a repository.
    Useful for re-uploads, audit trails, and debugging failed uploads.
    """
    __tablename__ = "repository_upload_history"

    id              = Column(String,    primary_key=True, index=True)
    repository_id   = Column(String,    ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by     = Column(String,    ForeignKey("users.id",        ondelete="SET NULL"), nullable=True)
    filename        = Column(String,    nullable=False)
    file_size_bytes = Column(BigInteger, nullable=True)
    status          = Column(String,    nullable=False, default="success")  # success | failed
    error_message   = Column(Text,      nullable=True)
    uploaded_at     = Column(DateTime,  default=datetime.utcnow)

    # ORM
    repository      = relationship("Repository", back_populates="upload_history")
    uploader        = relationship("User",        back_populates="upload_history", foreign_keys=[uploaded_by])
