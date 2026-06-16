import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.modules.project.models import Project, Favorite
from app.modules.dashboard.models import ActivityLog
from app.modules.project.schemas import ProjectCreate, ProjectUpdate

class ProjectRepository:
    @staticmethod
    def get_by_id(db: Session, proj_id: str) -> Optional[Project]:
        return db.query(Project).filter(Project.id == proj_id).first()

    @staticmethod
    def list_by_workspace(db: Session, ws_id: str) -> List[Project]:
        return db.query(Project).filter(Project.workspace_id == ws_id).all()

    @staticmethod
    def create(db: Session, proj_in: ProjectCreate, creator_name: str, creator_id: str) -> Project:
        proj_id = str(uuid.uuid4())
        db_proj = Project(
            id=proj_id,
            workspace_id=proj_in.workspace_id,
            name=proj_in.name,
            description=proj_in.description,
            icon=proj_in.icon,
            color=proj_in.color,
            visibility=proj_in.visibility,
            owner=creator_name
        )
        db.add(db_proj)
        db.flush()
        
        # Log active creation audit
        log_id = str(uuid.uuid4())
        db_log = ActivityLog(
            id=log_id,
            workspace_id=proj_in.workspace_id,
            project_id=proj_id,
            user_id=creator_id,
            action="Project Created",
            details=f"Project {proj_in.name} created by {creator_name}"
        )
        db.add(db_log)
        
        db.commit()
        db.refresh(db_proj)
        return db_proj

    @staticmethod
    def update(db: Session, db_proj: Project, proj_in: ProjectUpdate, user_id: str) -> Project:
        fields = ["name", "description", "icon", "color", "visibility", "is_archived"]
        for field in fields:
            val = getattr(proj_in, field)
            if val is not None:
                setattr(db_proj, field, val)
        db.flush()
        
        log_id = str(uuid.uuid4())
        db_log = ActivityLog(
            id=log_id,
            workspace_id=db_proj.workspace_id,
            project_id=db_proj.id,
            user_id=user_id,
            action="Project Updated",
            details=f"Project details updated for {db_proj.name}"
        )
        db.add(db_log)
        
        db.commit()
        db.refresh(db_proj)
        return db_proj

    @staticmethod
    def delete(db: Session, db_proj: Project) -> None:
        db.delete(db_proj)
        db.commit()

    @staticmethod
    def check_is_favorite(db: Session, user_id: str, proj_id: str) -> bool:
        fav = db.query(Favorite).filter(
            Favorite.user_id == user_id,
            Favorite.project_id == proj_id
        ).first()
        return fav is not None

    @staticmethod
    def set_favorite(db: Session, user_id: str, proj_id: str, favorite: bool) -> None:
        fav = db.query(Favorite).filter(
            Favorite.user_id == user_id,
            Favorite.project_id == proj_id
        ).first()
        
        if favorite and not fav:
            new_fav = Favorite(
                id=str(uuid.uuid4()),
                user_id=user_id,
                project_id=proj_id
            )
            db.add(new_fav)
        elif not favorite and fav:
            db.delete(fav)
        db.commit()
