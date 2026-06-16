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

# Import database hooks to bootstrap metadata models dynamically
from app.database.session import engine, Base
import app.modules.auth.models
import app.modules.workspace.models
import app.modules.project.models
import app.modules.dashboard.models

# Initialize logger logs
setup_logging()

# Auto-create SQLite database bindings in development mode
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
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

@app.get("/", tags=["Root"])
def root_status():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "docs": "/docs"
    }
