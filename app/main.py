from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.exceptions import setup_exception_handlers
from app.core.logging import setup_logging

# Import modular router interfaces
from app.modules.auth.router import router as auth_router, user_router
from app.modules.workspace.router import router as workspace_router
from app.modules.project.router import router as project_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.repository.router import router as repository_router
from app.modules.analysis.router import router as analysis_router
from app.modules.dependencies.router import router as dependencies_router
from app.modules.graph.router import router as graph_router
from app.modules.architecture.router import router as architecture_router

# Import database hooks to bootstrap metadata models dynamically
from app.database.session import engine, Base, apply_sqlite_compatibility_upgrades
import app.modules.auth.models
import app.modules.workspace.models
import app.modules.project.models
import app.modules.dashboard.models
import app.modules.repository.models
import app.modules.analysis.models
import app.modules.dependencies.models
import app.modules.graph.models  # registers GraphSyncRun table
import app.modules.architecture.models

# Initialize logger logs
setup_logging()

# Auto-create SQLite database bindings in development/test mode only.
# PostgreSQL environments should use Alembic migrations instead of import-time DDL.
if settings.DATABASE_URL.startswith("sqlite"):
    Base.metadata.create_all(bind=engine)
    apply_sqlite_compatibility_upgrades()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan handler.
    - On startup: create Neo4j indexes (best-effort — skips if Neo4j is down).
    - On shutdown: close Neo4j connection pool cleanly.
    """
    from app.database.neo4j import close_driver, ensure_indexes
    ensure_indexes()
    yield
    close_driver()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
setup_exception_handlers(app)

# Register routes
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(user_router, prefix=settings.API_V1_STR)
app.include_router(workspace_router, prefix=settings.API_V1_STR)
app.include_router(project_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(repository_router, prefix=settings.API_V1_STR)
app.include_router(analysis_router, prefix=settings.API_V1_STR)
app.include_router(dependencies_router, prefix=settings.API_V1_STR)
app.include_router(graph_router, prefix=settings.API_V1_STR)
app.include_router(architecture_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Root"])
def root_status():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "docs": "/docs"
    }
