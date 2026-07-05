from sqlalchemy.orm import Session

from app.modules.analysis.models import (
    AnalysisRun, RepositoryClass, RepositoryFile, RepositoryFolder, RepositoryFunction,
    RepositoryImport, RepositoryLanguage, RepositoryMetrics, RepositoryModule,
)


ENTITY_MODELS = {
    "files": RepositoryFile,
    "functions": RepositoryFunction,
    "classes": RepositoryClass,
    "modules": RepositoryModule,
    "imports": RepositoryImport,
}


class AnalysisRepository:
    @staticmethod
    def latest_run(db: Session, repository_id: str) -> AnalysisRun | None:
        return db.query(AnalysisRun).filter_by(repository_id=repository_id).order_by(AnalysisRun.started_at.desc()).first()

    @staticmethod
    def active_run(db: Session, repository_id: str) -> AnalysisRun | None:
        return db.query(AnalysisRun).filter(AnalysisRun.repository_id == repository_id, AnalysisRun.status.in_(["pending", "running"])).first()

    @staticmethod
    def list_entities(db: Session, entity: str, repository_id: str, run_id: str, limit: int, offset: int, search: str | None = None):
        model = ENTITY_MODELS[entity]
        query = db.query(model).filter(model.repository_id == repository_id, model.analysis_run_id == run_id)
        if search:
            searchable = model.path if entity == "files" else model.name if entity in {"functions", "classes", "modules"} else model.module
            query = query.filter(searchable.ilike(f"%{search}%"))
        total = query.count()
        ordering = model.path if entity == "files" else model.name if hasattr(model, "name") else model.module
        return query.order_by(ordering).offset(offset).limit(limit).all(), total

    @staticmethod
    def metrics(db: Session, run_id: str):
        return db.query(RepositoryMetrics).filter_by(analysis_run_id=run_id).first()

    @staticmethod
    def languages(db: Session, run_id: str):
        return db.query(RepositoryLanguage).filter_by(analysis_run_id=run_id).order_by(RepositoryLanguage.size_bytes.desc()).all()

    @staticmethod
    def bulk_add(db: Session, rows: list) -> None:
        if rows:
            db.bulk_save_objects(rows)
