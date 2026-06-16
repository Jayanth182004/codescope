from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate, WorkspaceOut
from app.schemas.envelope import APIEnvelope
from app.repositories.workspace_repository import WorkspaceRepository
from app.models.models import User
from app.core.exceptions import APIError

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])

@router.get("", response_model=APIEnvelope[List[WorkspaceOut]])
def list_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    workspaces = WorkspaceRepository.get_user_workspaces(db, current_user.id)
    out_workspaces = []
    for ws in workspaces:
        # Fetch member count
        member_count = db.query(User).join(User.workspaces).filter(User.workspaces.any(id=ws.id)).count()
        out_workspaces.append(
            WorkspaceOut(
                id=ws.id,
                name=ws.name,
                avatar=ws.avatar,
                member_count=member_count
            )
        )
        
    return APIEnvelope(
        success=True,
        message="Workspaces list retrieved successfully",
        data=out_workspaces
    )

@router.post("", response_model=APIEnvelope[WorkspaceOut])
def create_workspace(
    ws_in: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ws = WorkspaceRepository.create(
        db, 
        name=ws_in.name, 
        avatar=ws_in.avatar, 
        creator_id=current_user.id
    )
    return APIEnvelope(
        success=True,
        message="Workspace created successfully",
        data=WorkspaceOut(
            id=ws.id,
            name=ws.name,
            avatar=ws.avatar,
            member_count=1
        )
    )

@router.get("/{ws_id}", response_model=APIEnvelope[WorkspaceOut])
def get_workspace(
    ws_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role = WorkspaceRepository.check_user_role(db, ws_id, current_user.id)
    if not role:
        raise APIError("Access denied or workspace not found", status_code=403)
        
    ws = WorkspaceRepository.get_by_id(db, ws_id)
    member_count = db.query(User).join(User.workspaces).filter(User.workspaces.any(id=ws.id)).count()
    
    return APIEnvelope(
        success=True,
        message="Workspace details retrieved",
        data=WorkspaceOut(
            id=ws.id,
            name=ws.name,
            avatar=ws.avatar,
            member_count=member_count
        )
    )

@router.patch("/{ws_id}", response_model=APIEnvelope[WorkspaceOut])
def update_workspace(
    ws_id: str,
    ws_in: WorkspaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role = WorkspaceRepository.check_user_role(db, ws_id, current_user.id)
    # Only owner or admin roles can update settings
    if role not in ["owner", "admin"]:
        raise APIError("Insufficient workspace permissions", status_code=403)
        
    ws = WorkspaceRepository.get_by_id(db, ws_id)
    if not ws:
        raise APIError("Workspace not found", status_code=404)
        
    updated = WorkspaceRepository.update(db, ws, name=ws_in.name, avatar=ws_in.avatar)
    member_count = db.query(User).join(User.workspaces).filter(User.workspaces.any(id=ws.id)).count()
    
    return APIEnvelope(
        success=True,
        message="Workspace updated successfully",
        data=WorkspaceOut(
            id=updated.id,
            name=updated.name,
            avatar=updated.avatar,
            member_count=member_count
        )
    )

@router.delete("/{ws_id}", response_model=APIEnvelope[None])
def delete_workspace(
    ws_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role = WorkspaceRepository.check_user_role(db, ws_id, current_user.id)
    if role != "owner":
        raise APIError("Only the workspace owner can delete it", status_code=403)
        
    ws = WorkspaceRepository.get_by_id(db, ws_id)
    if not ws:
        raise APIError("Workspace not found", status_code=404)
        
    WorkspaceRepository.delete(db, ws)
    return APIEnvelope(success=True, message="Workspace deleted successfully")
