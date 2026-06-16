import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.modules.workspace.models import Workspace, workspace_members

class WorkspaceRepository:
    @staticmethod
    def get_by_id(db: Session, ws_id: str) -> Optional[Workspace]:
        return db.query(Workspace).filter(Workspace.id == ws_id).first()

    @staticmethod
    def get_user_workspaces(db: Session, user_id: str) -> List[Workspace]:
        return db.query(Workspace).join(workspace_members).filter(
            workspace_members.c.user_id == user_id
        ).all()

    @staticmethod
    def create(db: Session, name: str, avatar: Optional[str], creator_id: str) -> Workspace:
        ws_id = str(uuid.uuid4())
        ws_avatar = avatar or name.strip()[:2].upper()
        
        db_ws = Workspace(
            id=ws_id,
            name=name,
            avatar=ws_avatar
        )
        db.add(db_ws)
        db.flush()
        
        # Link creator as workspace owner
        db.execute(
            workspace_members.insert().values(
                workspace_id=ws_id,
                user_id=creator_id,
                role="owner"
            )
        )
        
        db.commit()
        db.refresh(db_ws)
        return db_ws

    @staticmethod
    def update(db: Session, ws: Workspace, name: Optional[str], avatar: Optional[str]) -> Workspace:
        if name:
            ws.name = name
        if avatar:
            ws.avatar = avatar
        db.commit()
        db.refresh(ws)
        return ws

    @staticmethod
    def delete(db: Session, ws: Workspace) -> None:
        db.delete(ws)
        db.commit()

    @staticmethod
    def check_user_role(db: Session, ws_id: str, user_id: str) -> Optional[str]:
        row = db.execute(
            workspace_members.select().where(
                workspace_members.c.workspace_id == ws_id,
                workspace_members.c.user_id == user_id
            )
        ).first()
        return row.role if row else None
