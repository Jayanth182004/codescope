from datetime import UTC, datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.session import Base

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    id = Column(String, primary_key=True, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String, nullable=False) # e.g. "Project Created"
    details = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    
    # Relationships
    user = relationship("User", back_populates="activity_logs")
    project = relationship("Project", back_populates="activity_logs")
