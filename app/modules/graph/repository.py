"""
app/modules/graph/repository.py
────────────────────────────────
PostgreSQL data-access layer for the graph module.

Responsibilities:
  • CRUD for GraphSyncRun rows.
  • Fetch dependency nodes/edges for a given build — the raw
    material that the sync services push into Neo4j.
  • Lookup helpers used by the router for authorization.
"""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.dependencies.models import DependencyBuild, DependencyEdge, DependencyNode
from app.modules.graph.models import GraphSyncRun


class GraphRepository:
    # ── Sync run CRUD ─────────────────────────────────────────────────────────

    @staticmethod
    def create_sync_run(
        db: Session,
        *,
        sync_run_id: str,
        repository_id: str,
        dependency_build_id: str | None,
        analysis_run_id: str | None,
        requested_by: str | None,
        trigger: str = "dependency_build",
    ) -> GraphSyncRun:
        run = GraphSyncRun(
            id=sync_run_id,
            repository_id=repository_id,
            dependency_build_id=dependency_build_id,
            analysis_run_id=analysis_run_id,
            requested_by=requested_by,
            trigger=trigger,
            status="running",
        )
        db.add(run)
        db.flush()
        return run

    @staticmethod
    def latest_sync_run(db: Session, repository_id: str) -> GraphSyncRun | None:
        return (
            db.query(GraphSyncRun)
            .filter_by(repository_id=repository_id)
            .filter(GraphSyncRun.status.in_(["completed", "completed_stale"]))
            .order_by(GraphSyncRun.started_at.desc())
            .first()
        )

    @staticmethod
    def latest_any_sync_run(db: Session, repository_id: str) -> GraphSyncRun | None:
        """Return the most recent sync run regardless of status."""
        return (
            db.query(GraphSyncRun)
            .filter_by(repository_id=repository_id)
            .order_by(GraphSyncRun.started_at.desc())
            .first()
        )

    @staticmethod
    def complete_sync_run(
        db: Session,
        run: GraphSyncRun,
        *,
        status: str,
        nodes_synced: int = 0,
        edges_synced: int = 0,
        nodes_pruned: int = 0,
        error_message: str | None = None,
        duration_ms: int = 0,
    ) -> GraphSyncRun:
        run.status = status
        run.nodes_synced = nodes_synced
        run.edges_synced = edges_synced
        run.nodes_pruned = nodes_pruned
        run.error_message = error_message
        run.completed_at = datetime.now(UTC)
        run.duration_ms = duration_ms
        db.flush()
        return run

    # ── Dependency build + node/edge fetchers ─────────────────────────────────

    @staticmethod
    def latest_dependency_build(db: Session, repository_id: str) -> DependencyBuild | None:
        return (
            db.query(DependencyBuild)
            .filter_by(repository_id=repository_id)
            .filter(DependencyBuild.status.in_(["completed", "completed_with_warnings"]))
            .order_by(DependencyBuild.built_at.desc())
            .first()
        )

    @staticmethod
    def nodes_for_build(
        db: Session,
        dependency_id: str,
        offset: int = 0,
        limit: int = 10_000,
    ) -> list[DependencyNode]:
        return (
            db.query(DependencyNode)
            .filter_by(dependency_id=dependency_id)
            .order_by(DependencyNode.entity_type)
            .offset(offset)
            .limit(limit)
            .all()
        )

    @staticmethod
    def edges_for_build(
        db: Session,
        dependency_id: str,
        offset: int = 0,
        limit: int = 50_000,
    ) -> list[DependencyEdge]:
        return (
            db.query(DependencyEdge)
            .filter_by(dependency_id=dependency_id)
            .order_by(DependencyEdge.relationship_type)
            .offset(offset)
            .limit(limit)
            .all()
        )

    @staticmethod
    def node_by_id(db: Session, node_id: str) -> DependencyNode | None:
        return db.query(DependencyNode).filter_by(id=node_id).first()

    # ── LCC helpers ───────────────────────────────────────────────────────────
    # These two methods power the Python-side BFS LCC calculation.
    # They query PostgreSQL directly — no Neo4j or GDS plugin required.
    # The queries are deliberately lightweight (only IDs) so they scale to
    # 100k+ node graphs without excessive memory pressure.

    @staticmethod
    def node_ids_for_repository(db: Session, repository_id: str) -> list[str]:
        """Return all dependency node IDs for the latest build of a repository."""
        from app.modules.dependencies.models import DependencyBuild

        build = (
            db.query(DependencyBuild)
            .filter_by(repository_id=repository_id)
            .filter(DependencyBuild.status.in_(["completed", "completed_with_warnings"]))
            .order_by(DependencyBuild.built_at.desc())
            .first()
        )
        if build is None:
            return []
        rows = (
            db.query(DependencyNode.id)
            .filter_by(dependency_id=build.id)
            .all()
        )
        return [row[0] for row in rows]

    @staticmethod
    def edge_pairs_for_repository(
        db: Session, repository_id: str
    ) -> list[tuple[str, str]]:
        """Return all (source_node_id, target_node_id) pairs for a repository."""
        from app.modules.dependencies.models import DependencyBuild

        build = (
            db.query(DependencyBuild)
            .filter_by(repository_id=repository_id)
            .filter(DependencyBuild.status.in_(["completed", "completed_with_warnings"]))
            .order_by(DependencyBuild.built_at.desc())
            .first()
        )
        if build is None:
            return []
        rows = (
            db.query(DependencyEdge.source_node_id, DependencyEdge.target_node_id)
            .filter_by(dependency_id=build.id)
            .all()
        )
        return [(row[0], row[1]) for row in rows]

