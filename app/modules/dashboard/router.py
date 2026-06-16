from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.dashboard.schemas import DashboardOverview, DashboardStats, ActivityLogOut
from app.modules.project.schemas import ProjectOut
from app.shared_schemas import APIEnvelope
from app.modules.workspace.repository import WorkspaceRepository
from app.modules.project.repository import ProjectRepository
from app.modules.auth.models import User
from app.modules.dashboard.models import ActivityLog
from app.modules.project.models import Project, Favorite
from app.core.exceptions import APIError

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("", response_model=APIEnvelope[DashboardOverview])
def get_dashboard_overview(
    workspace_id: str = Query(..., description="Target workspace ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role = WorkspaceRepository.check_user_role(db, workspace_id, current_user.id)
    if not role:
        raise APIError("Access denied", status_code=403)
        
    projects = ProjectRepository.list_by_workspace(db, workspace_id)
    
    # 1. Statistics
    total_projects = len(projects)
    total_repos = sum(p.repository_count for p in projects)
    avg_health = 100
    if total_projects > 0:
        avg_health = int(sum(p.health_score for p in projects) / total_projects)
        
    indexed_deps = total_repos * 187
    architecture_graphs = total_projects * 2
    
    # Fetch last log activity
    last_log = db.query(ActivityLog).filter(ActivityLog.workspace_id == workspace_id).order_by(ActivityLog.created_at.desc()).first()
    last_act = "Never"
    if last_log:
        last_act = last_log.created_at.strftime("%Y-%m-%d %H:%M:%S")

    stats = DashboardStats(
        total_projects=total_projects,
        total_repositories=total_repos,
        avg_health=avg_health,
        indexed_dependencies=indexed_deps,
        architecture_graphs=architecture_graphs,
        last_activity=last_act
    )

    # 2. Recent Projects
    recent_projects_db = db.query(Project).filter(Project.workspace_id == workspace_id).order_by(Project.created_at.desc()).limit(5).all()
    recent_projects = []
    for p in recent_projects_db:
        favorite = ProjectRepository.check_is_favorite(db, current_user.id, p.id)
        recent_projects.append(
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

    # 3. Recent Workspace Activity
    activity_db = db.query(ActivityLog).filter(ActivityLog.workspace_id == workspace_id).order_by(ActivityLog.created_at.desc()).limit(10).all()
    recent_activity = []
    for act in activity_db:
        proj_name = None
        if act.project:
            proj_name = act.project.name
            
        recent_activity.append(
            ActivityLogOut(
                id=act.id,
                action=act.action,
                details=act.details,
                created_at=act.created_at,
                project_name=proj_name
            )
        )

    # 4. Favorite Projects
    fav_db = db.query(Project).join(Favorite).filter(
        Favorite.user_id == current_user.id,
        Project.workspace_id == workspace_id
    ).all()
    favorite_projects = []
    for p in fav_db:
        favorite_projects.append(
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
                favorite=True
            )
        )

    return APIEnvelope(
        success=True,
        message="Dashboard overview loaded successfully",
        data=DashboardOverview(
            statistics=stats,
            recent_projects=recent_projects,
            recent_activity=recent_activity,
            favorite_projects=favorite_projects
        )
    )
