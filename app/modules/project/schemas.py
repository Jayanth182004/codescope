from typing import Optional
from pydantic import BaseModel, ConfigDict

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "PR"
    color: Optional[str] = "#3D8B7A"
    visibility: Optional[str] = "Private"  # Private | Internal | Public

class ProjectCreate(ProjectBase):
    workspace_id: str

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    visibility: Optional[str] = None
    is_archived: Optional[bool] = None

class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    owner: str
    repository_count: int
    health_score: int
    is_archived: bool
    favorite: bool = False

class ProjectFavorite(BaseModel):
    favorite: bool