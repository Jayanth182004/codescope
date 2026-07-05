"""
app/modules/graph/models.py
───────────────────────────
SQLAlchemy models for graph synchronisation state stored in PostgreSQL.

Why these tables exist
──────────────────────
Neo4j is a query-acceleration layer — PostgreSQL is the source of truth.
When the backend syncs dependency data into Neo4j it records the outcome
in `graph_sync_runs` so the system can:

  • Report sync status to the API without querying Neo4j.
  • Detect which repositories have a stale or missing graph.
  • Resume incremental syncs after a Neo4j restart without full rebuild.
  • Surface sync history in the dashboard for operations observability.

Table: graph_sync_runs
  One row per sync attempt per repository. Similar in structure to
  `analysis_runs` (ADR 7) — snapshots, not mutable state.
  The latest completed row is the canonical sync record for a repository.

Naming follows the project convention: plural snake_case table names,
no abbreviations, PK as `id: String` (opaque UUID via new_id()).
"""

from datetime import UTC, datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from app.database.session import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class GraphSyncRun(Base):
    """
    Records the outcome of a single Neo4j graph synchronisation attempt.

    status values:
      running              — sync is in progress
      completed            — all nodes and edges pushed successfully
      completed_stale      — completed but some nodes were pruned as stale
      failed               — sync failed; error_message contains the reason

    trigger values:
      dependency_build     — auto-triggered after a dependency build
      manual               — triggered directly via POST /graph/build/
    """
    __tablename__ = "graph_sync_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('running','completed','completed_stale','failed')",
            name="ck_graph_sync_run_status",
        ),
        CheckConstraint(
            "trigger IN ('dependency_build','manual')",
            name="ck_graph_sync_run_trigger",
        ),
        Index("ix_graph_sync_runs_repository_started", "repository_id", "started_at"),
        Index("ix_graph_sync_runs_repository_status", "repository_id", "status"),
    )

    id = Column(String, primary_key=True)
    repository_id = Column(
        String,
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dependency_build_id = Column(
        String,
        ForeignKey("dependencies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    analysis_run_id = Column(
        String,
        ForeignKey("analysis_runs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    requested_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    trigger = Column(String(32), nullable=False, default="dependency_build")
    status = Column(String(32), nullable=False, default="running")

    # Counters — filled when status transitions to completed/failed
    nodes_synced = Column(Integer, nullable=False, default=0)
    edges_synced = Column(Integer, nullable=False, default=0)
    nodes_pruned = Column(Integer, nullable=False, default=0)

    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)
