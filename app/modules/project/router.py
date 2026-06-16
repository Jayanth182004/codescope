from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.project.schemas import ProjectCreate, ProjectUpdate, ProjectOut, ProjectFavorite
from app.shared_schemas import APIEnvelope
from app.modules.workspace.repository import WorkspaceRepository
from app.modules.project.repository import ProjectRepository
from app.modules.auth.models import User
from app.core.exceptions import APIError

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("", response_model=APIEnvelope[List[ProjectOut]])
def list_projects(
    workspace_id: str = Query(..., description="Target workspace context filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role = WorkspaceRepository.check_user_role(db, workspace_id, current_user.id)
    if not role:
        raise APIError("Access denied to workspace project directory", status_code=403)
        
    projects = ProjectRepository.list_by_workspace(db, workspace_id)
    out_projects = []
    for p in projects:
        favorite = ProjectRepository.check_is_favorite(db, current_user.id, p.id)
        out_projects.append(
            ProjectOut(
                id=p.id,
                workspace_id=p.workspace_id,
                name=p.name,
                description=p.description,
                icon=p.icon,
                color=p.color,
                visibility=p.visibility,
                owner=p.owner,
                repository_count=p.repository_count,
                health_score=p.health_score,
                is_archived=p.is_archived,
                favorite=favorite
            )
        )
    return APIEnvelope(success=True, message="Workspace project list retrieved", data=out_projects)

@router.post("", response_model=APIEnvelope[ProjectOut])
def create_project(
    proj_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role = WorkspaceRepository.check_user_role(db, proj_in.workspace_id, current_user.id)
    if role not in ["owner", "admin"]:
        raise APIError("Insufficient workspace privileges to register projects", status_code=403)
        
    proj = ProjectRepository.create(db, proj_in, current_user.name, current_user.id)
    return APIEnvelope(
        success=True,
        message="Workspace project initialized successfully",
        data=ProjectOut(
            id=proj.id,
            workspace_id=proj.workspace_id,
            name=proj.name,
            description=proj.description,
            icon=proj.icon,
            color=proj.color,
            visibility=proj.visibility,
            owner=proj.owner,
            repository_count=0,
            health_score=100,
            is_archived=False,
            favorite=False
        )
    )

@router.get("/{proj_id}", response_model=APIEnvelope[ProjectOut])
def get_project(
    proj_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj = ProjectRepository.get_by_id(db, proj_id)
    if not proj:
        raise APIError("Project not found", status_code=404)
        
    role = WorkspaceRepository.check_user_role(db, proj.workspace_id, current_user.id)
    if not role:
        raise APIError("Access denied", status_code=403)
        
    favorite = ProjectRepository.check_is_favorite(db, current_user.id, proj.id)
    return APIEnvelope(
        success=True,
        message="Project details retrieved",
        data=ProjectOut(
            id=proj.id,
            workspace_id=proj.workspace_id,
            name=proj.name,
            description=proj.description,
            icon=proj.icon,
            color=proj.color,
            visibility=proj.visibility,
            owner=proj.owner,
            repository_count=proj.repository_count,
            health_score=proj.health_score,
            is_archived=proj.is_archived,
            favorite=favorite
        )
    )

@router.patch("/{proj_id}", response_model=APIEnvelope[ProjectOut])
def update_project(
    proj_id: str,
    proj_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj = ProjectRepository.get_by_id(db, proj_id)
    if not proj:
        raise APIError("Project not found", status_code=404)
        
    role = WorkspaceRepository.check_user_role(db, proj.workspace_id, current_user.id)
    if role not in ["owner", "admin"]:
        raise APIError("Insufficient project modification privileges", status_code=403)
        
    updated = ProjectRepository.update(db, proj, proj_in, current_user.id)
    favorite = ProjectRepository.check_is_favorite(db, current_user.id, updated.id)
    
    return APIEnvelope(
        success=True,
        message="Project updated successfully",
        data=ProjectOut(
            id=updated.id,
            workspace_id=updated.workspace_id,
            name=updated.name,
            description=updated.description,
            icon=updated.icon,
            color=updated.color,
            visibility=updated.visibility,
            owner=updated.owner,
            repository_count=updated.repository_count,
            health_score=updated.health_score,
            is_archived=updated.is_archived,
            favorite=favorite
        )
    )

@router.post("/{proj_id}/favorite", response_model=APIEnvelope[None])
def set_favorite_project(
    proj_id: str,
    fav_in: ProjectFavorite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj = ProjectRepository.get_by_id(db, proj_id)
    if not proj:
        raise APIError("Project not found", status_code=404)
        
    role = WorkspaceRepository.check_user_role(db, proj.workspace_id, current_user.id)
    if not role:
        raise APIError("Access denied", status_code=403)
        
    ProjectRepository.set_favorite(db, current_user.id, proj.id, fav_in.favorite)
    return APIEnvelope(success=True, message="Project favorite status updated")

@router.delete("/{proj_id}", response_model=APIEnvelope[None])
def delete_project(
    proj_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj = ProjectRepository.get_by_id(db, proj_id)
    if not proj:
        raise APIError("Project not found", status_code=404)
        
    role = WorkspaceRepository.check_user_role(db, proj.workspace_id, current_user.id)
    if role not in ["owner", "admin"]:
        raise APIError("Insufficient deletion privileges", status_code=403)
        
    ProjectRepository.delete(db, proj)
    return APIEnvelope(success=True, message="Project deleted successfully")
