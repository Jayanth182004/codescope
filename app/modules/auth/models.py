from datetime import UTC, datetime
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database.session import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    
    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user")

    workspaces = relationship(
        "Workspace",
        secondary="workspace_members",
        back_populates="members"
    )

    # Repository module relationships
    repositories = relationship("Repository", back_populates="owner", foreign_keys="Repository.owner_id")
    repository_favorites = relationship("RepositoryFavorite", back_populates="user", cascade="all, delete-orphan")
    repository_activity_logs = relationship("RepositoryActivity", back_populates="user")
    upload_history = relationship("RepositoryUpload", back_populates="uploader", foreign_keys="RepositoryUpload.uploaded_by")

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    refresh_token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    
    user = relationship("User", back_populates="sessions")
