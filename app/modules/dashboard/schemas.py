from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from app.modules.project.schemas import ProjectOut

class ActivityLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    action: str
    details: Optional[str] = None
    created_at: datetime
    project_name: Optional[str] = None

class DashboardStats(BaseModel):
    total_projects: int
    total_repositories: int
    avg_health: int
    indexed_dependencies: int
    architecture_graphs: int
    last_activity: str

class DashboardOverview(BaseModel):
    statistics: DashboardStats
    recent_projects: List[ProjectOut]
    recent_activity: List[ActivityLogOut]
    favorite_projects: List[ProjectOut]
