from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database.session import Base

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    owner = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    repository_count = Column(Integer, default=0)
    health_score = Column(Integer, default=100)
    visibility = Column(String, default="Private") # Private | Internal | Public
    is_archived = Column(Boolean, default=False)
    icon = Column(String, default="🌐")
    color = Column(String, default="#3D8B7A")
    
    # Relationships
    workspace = relationship("Workspace", back_populates="projects")
    favorites = relationship("Favorite", back_populates="project", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="project", cascade="all, delete-orphan")
    repositories = relationship("Repository", back_populates="project", cascade="all, delete-orphan")

class Favorite(Base):
    __tablename__ = "favorites"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    
    user = relationship("User", back_populates="favorites")
    project = relationship("Project", back_populates="favorites")
