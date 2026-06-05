from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import APIError
from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.analysis.models import AnalysisRun
from app.modules.analysis.repository import AnalysisRepository
from app.modules.analysis.schemas import (
    AnalysisReportOut, AnalysisRunOut, AnalysisStartRequest, ClassOut, FileOut, FunctionOut,
    ImportOut, LanguageOut, MetricsOut, ModuleOut, PageOut, class_out, function_out, run_out,
)
from app.modules.analysis.services import AnalysisCoordinatorService
from app.modules.auth.models import User
from app.modules.repository.services import RepositoryValidationService
from app.shared_schemas import APIEnvelope

router = APIRouter(prefix="/analysis", tags=["Repository Analysis"])


def latest_authorized(db: Session, repository_id: str, user_id: str) -> AnalysisRun:
    RepositoryValidationService.repository_access(db, repository_id, user_id, write=False)
    run = AnalysisRepository.latest_run(db, repository_id)
    if run is None: raise APIError("No analysis has been run for this repository", 404)
    return run


@router.post("/start/{repository_id}", response_model=APIEnvelope[AnalysisRunOut])
def start_analysis(repository_id: str, body: AnalysisStartRequest | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    run = AnalysisCoordinatorService(db).start(repository_id, user.id)
    return APIEnvelope(success=True, message="Analysis completed" if run.status.startswith("completed") else "Analysis finished", data=run_out(run))


@router.get("/status", response_model=APIEnvelope[AnalysisRunOut])
def analysis_status(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return APIEnvelope(success=True, message="Analysis status retrieved", data=run_out(latest_authorized(db, repository_id, user.id)))


@router.get("/status/{repository_id}", response_model=APIEnvelope[AnalysisRunOut])
def analysis_status_by_path(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return analysis_status(repository_id, db, user)


@router.post("/cancel/{repository_id}", response_model=APIEnvelope[AnalysisRunOut])
def cancel_analysis(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    RepositoryValidationService.repository_access(db, repository_id, user.id, write=True)
    run = AnalysisRepository.active_run(db, repository_id)
    if run is None: raise APIError("No active analysis to cancel", 409)
    run.status = "cancelled"; db.commit(); db.refresh(run)
    return APIEnvelope(success=True, message="Cancellation requested", data=run_out(run))


def entity_page(entity, schema, repository_id, search, limit, offset, db, user, mapper=None):
    run = latest_authorized(db, repository_id, user.id)
    rows, total = AnalysisRepository.list_entities(db, entity, repository_id, run.id, limit, offset, search)
    items = [mapper(row) if mapper else schema.model_validate(row) for row in rows]
    return APIEnvelope(success=True, message=f"Analysis {entity} retrieved", data=PageOut(items=items, total=total, limit=limit, offset=offset))


@router.get("/files", response_model=APIEnvelope[PageOut])
def files(repository_id: str, search: str | None = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return entity_page("files", FileOut, repository_id, search, limit, offset, db, user)


@router.get("/files/{repository_id}", response_model=APIEnvelope[PageOut])
def files_by_path(repository_id: str, search: str | None = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return files(repository_id, search, limit, offset, db, user)


@router.get("/functions", response_model=APIEnvelope[PageOut])
def functions(repository_id: str, search: str | None = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return entity_page("functions", FunctionOut, repository_id, search, limit, offset, db, user, function_out)


@router.get("/functions/{repository_id}", response_model=APIEnvelope[PageOut])
def functions_by_path(repository_id: str, search: str | None = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return functions(repository_id, search, limit, offset, db, user)


@router.get("/classes", response_model=APIEnvelope[PageOut])
def classes(repository_id: str, search: str | None = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return entity_page("classes", ClassOut, repository_id, search, limit, offset, db, user, class_out)


@router.get("/classes/{repository_id}", response_model=APIEnvelope[PageOut])
def classes_by_path(repository_id: str, search: str | None = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return classes(repository_id, search, limit, offset, db, user)


@router.get("/modules", response_model=APIEnvelope[PageOut])
def modules(repository_id: str, search: str | None = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return entity_page("modules", ModuleOut, repository_id, search, limit, offset, db, user)


@router.get("/modules/{repository_id}", response_model=APIEnvelope[PageOut])
def modules_by_path(repository_id: str, search: str | None = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return modules(repository_id, search, limit, offset, db, user)


@router.get("/imports", response_model=APIEnvelope[PageOut])
def imports(repository_id: str, search: str | None = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return entity_page("imports", ImportOut, repository_id, search, limit, offset, db, user)


@router.get("/imports/{repository_id}", response_model=APIEnvelope[PageOut])
def imports_by_path(repository_id: str, search: str | None = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return imports(repository_id, search, limit, offset, db, user)


@router.get("/metrics", response_model=APIEnvelope[MetricsOut])
def metrics(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    run = latest_authorized(db, repository_id, user.id); row = AnalysisRepository.metrics(db, run.id)
    if row is None: raise APIError("Analysis metrics are unavailable", 404)
    return APIEnvelope(success=True, message="Analysis metrics retrieved", data=MetricsOut.model_validate(row))


@router.get("/metrics/{repository_id}", response_model=APIEnvelope[MetricsOut])
def metrics_by_path(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return metrics(repository_id, db, user)


@router.get("/{repository_id}", response_model=APIEnvelope[AnalysisReportOut])
def report(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    run = latest_authorized(db, repository_id, user.id); metrics = AnalysisRepository.metrics(db, run.id)
    languages = [LanguageOut.model_validate(row) for row in AnalysisRepository.languages(db, run.id)]
    return APIEnvelope(success=True, message="Analysis report retrieved", data=AnalysisReportOut(run=run_out(run), metrics=MetricsOut.model_validate(metrics) if metrics else None, languages=languages))
