from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.modules.dependencies.models import (
    DependencyBuild,
    DependencyCycle,
    DependencyEdge,
    DependencyMetrics,
    DependencyNode,
)


class DependencyRepository:
    @staticmethod
    def latest_build(db: Session, repository_id: str) -> DependencyBuild | None:
        return db.query(DependencyBuild).filter_by(repository_id=repository_id).order_by(DependencyBuild.built_at.desc()).first()

    @staticmethod
    def build_for_analysis(db: Session, repository_id: str, analysis_run_id: str) -> DependencyBuild | None:
        return db.query(DependencyBuild).filter_by(repository_id=repository_id, analysis_run_id=analysis_run_id).first()

    @staticmethod
    def nodes(db: Session, dependency_id: str, limit: int = 5000, offset: int = 0) -> list[DependencyNode]:
        return db.query(DependencyNode).filter_by(dependency_id=dependency_id).order_by(DependencyNode.entity_type, DependencyNode.label).offset(offset).limit(limit).all()

    @staticmethod
    def edges(db: Session, dependency_id: str, limit: int = 10000, offset: int = 0) -> list[DependencyEdge]:
        return db.query(DependencyEdge).filter_by(dependency_id=dependency_id).order_by(DependencyEdge.relationship_type).offset(offset).limit(limit).all()

    @staticmethod
    def node(db: Session, node_id: str) -> DependencyNode | None:
        return db.query(DependencyNode).filter_by(id=node_id).first()

    @staticmethod
    def node_edges(db: Session, dependency_id: str, node_id: str) -> list[DependencyEdge]:
        return db.query(DependencyEdge).filter(
            DependencyEdge.dependency_id == dependency_id,
            or_(DependencyEdge.source_node_id == node_id, DependencyEdge.target_node_id == node_id),
        ).all()

    @staticmethod
    def outgoing_edges(db: Session, dependency_id: str, node_id: str) -> list[DependencyEdge]:
        return db.query(DependencyEdge).filter_by(dependency_id=dependency_id, source_node_id=node_id).all()

    @staticmethod
    def incoming_edges(db: Session, dependency_id: str, node_id: str) -> list[DependencyEdge]:
        return db.query(DependencyEdge).filter_by(dependency_id=dependency_id, target_node_id=node_id).all()

    @staticmethod
    def metrics(db: Session, dependency_id: str) -> DependencyMetrics | None:
        return db.query(DependencyMetrics).filter_by(dependency_id=dependency_id).first()

    @staticmethod
    def cycles(db: Session, dependency_id: str) -> list[DependencyCycle]:
        return db.query(DependencyCycle).filter_by(dependency_id=dependency_id).order_by(DependencyCycle.cycle_type, DependencyCycle.length).all()

    @staticmethod
    def replace_build_children(db: Session, dependency_id: str) -> None:
        db.query(DependencyCycle).filter_by(dependency_id=dependency_id).delete()
        db.query(DependencyMetrics).filter_by(dependency_id=dependency_id).delete()
        db.query(DependencyEdge).filter_by(dependency_id=dependency_id).delete()
        db.query(DependencyNode).filter_by(dependency_id=dependency_id).delete()

    @staticmethod
    def bulk_add(db: Session, rows: list) -> None:
        if rows:
            db.bulk_save_objects(rows)
