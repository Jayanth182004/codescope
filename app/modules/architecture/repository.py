from __future__ import annotations

from sqlalchemy.orm import Session

from app.modules.architecture.models import (
    ArchitectureAntiPattern,
    ArchitectureBuild,
    ArchitectureComponent,
    ArchitectureMetric,
    ArchitectureRequestFlow,
)


class ArchitectureRepository:
    @staticmethod
    def latest_build(db: Session, repository_id: str) -> ArchitectureBuild | None:
        return (
            db.query(ArchitectureBuild)
            .filter_by(repository_id=repository_id)
            .filter(ArchitectureBuild.status.in_(["completed", "completed_with_warnings"]))
            .order_by(ArchitectureBuild.created_at.desc())
            .first()
        )

    @staticmethod
    def add_all(db: Session, rows: list) -> None:
        if rows:
            db.add_all(rows)

    @staticmethod
    def components(db: Session, build_id: str, *, layer: str | None = None, component_type: str | None = None) -> list[ArchitectureComponent]:
        query = db.query(ArchitectureComponent).filter_by(architecture_build_id=build_id)
        if layer:
            query = query.filter(ArchitectureComponent.layer == layer)
        if component_type:
            query = query.filter(ArchitectureComponent.component_type == component_type)
        return query.order_by(ArchitectureComponent.layer, ArchitectureComponent.name).all()

    @staticmethod
    def flows(db: Session, build_id: str) -> list[ArchitectureRequestFlow]:
        return db.query(ArchitectureRequestFlow).filter_by(architecture_build_id=build_id).order_by(ArchitectureRequestFlow.name).all()

    @staticmethod
    def metrics(db: Session, build_id: str) -> ArchitectureMetric | None:
        return db.query(ArchitectureMetric).filter_by(architecture_build_id=build_id).first()

    @staticmethod
    def anti_patterns(db: Session, build_id: str) -> list[ArchitectureAntiPattern]:
        return (
            db.query(ArchitectureAntiPattern)
            .filter_by(architecture_build_id=build_id)
            .order_by(ArchitectureAntiPattern.severity.desc(), ArchitectureAntiPattern.pattern_type)
            .all()
        )
