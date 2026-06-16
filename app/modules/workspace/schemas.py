from typing import Optional
from pydantic import BaseModel, ConfigDict

class WorkspaceBase(BaseModel):
    name: str
    avatar: Optional[str] = None

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None

class WorkspaceOut(WorkspaceBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    member_count: int = 1
