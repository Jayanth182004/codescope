from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.database.session import Base

# Junction table representing Workspace Membership Roles
workspace_members = Table(
    "workspace_members",
    Base.metadata,
    Column("workspace_id", String, ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role", String, default="member") # owner | admin | member
)

class Workspace(Base):
    __tablename__ = "workspaces"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    avatar = Column(String, nullable=True) # visual initials, e.g. 'NP'
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    members = relationship(
        "User", 
        secondary=workspace_members, 
        back_populates="workspaces"
    )
    
    projects = relationship("Project", back_populates="workspace", cascade="all, delete-orphan")
