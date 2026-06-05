from datetime import UTC, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database.session import Base


def utc_now():
    return datetime.now(UTC)


class DependencyBuild(Base):
    __tablename__ = "dependencies"
    __table_args__ = (
        CheckConstraint("status IN ('running','completed','completed_with_warnings','failed')", name="ck_dependency_build_status"),
        UniqueConstraint("repository_id", "analysis_run_id", name="uq_dependency_repository_analysis"),
        Index("ix_dependencies_repository_built", "repository_id", "built_at"),
    )

    id = Column(String, primary_key=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    status = Column(String(32), nullable=False, default="running")
    nodes_count = Column(Integer, nullable=False, default=0)
    edges_count = Column(Integer, nullable=False, default=0)
    cycles_count = Column(Integer, nullable=False, default=0)
    warnings_json = Column(Text, nullable=False, default="[]")
    error_message = Column(Text)
    built_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    completed_at = Column(DateTime(timezone=True))
    duration_ms = Column(Integer)
    analysis_run = relationship("AnalysisRun")


class DependencyNode(Base):
    __tablename__ = "dependency_nodes"
    __table_args__ = (
        UniqueConstraint("dependency_id", "entity_type", "entity_key", name="uq_dependency_node_entity"),
        Index("ix_dependency_nodes_repo_type", "repository_id", "entity_type"),
        Index("ix_dependency_nodes_key", "entity_key"),
    )

    id = Column(String, primary_key=True)
    dependency_id = Column(String, ForeignKey("dependencies.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(32), nullable=False)
    entity_key = Column(String(2048), nullable=False)
    name = Column(String(512), nullable=False)
    label = Column(String(1024), nullable=False)
    file_path = Column(String(2048))
    module = Column(String(1024))
    package = Column(String(1024))
    source_entity_id = Column(String(128))
    metadata_json = Column(Text, nullable=False, default="{}")


class DependencyEdge(Base):
    __tablename__ = "dependency_edges"
    __table_args__ = (
        UniqueConstraint("dependency_id", "source_node_id", "target_node_id", "relationship_type", name="uq_dependency_edge"),
        Index("ix_dependency_edges_repo_type", "repository_id", "relationship_type"),
        Index("ix_dependency_edges_source", "source_node_id"),
        Index("ix_dependency_edges_target", "target_node_id"),
    )

    id = Column(String, primary_key=True)
    dependency_id = Column(String, ForeignKey("dependencies.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    source_node_id = Column(String, ForeignKey("dependency_nodes.id", ondelete="CASCADE"), nullable=False)
    target_node_id = Column(String, ForeignKey("dependency_nodes.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String(48), nullable=False)
    source_type = Column(String(32), nullable=False)
    target_type = Column(String(32), nullable=False)
    depth = Column(Integer, nullable=False, default=1)
    weight = Column(Float, nullable=False, default=1.0)
    metadata_json = Column(Text, nullable=False, default="{}")


class DependencyMetrics(Base):
    __tablename__ = "dependency_metrics"

    id = Column(String, primary_key=True)
    dependency_id = Column(String, ForeignKey("dependencies.id", ondelete="CASCADE"), nullable=False, unique=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    total_nodes = Column(Integer, nullable=False)
    total_edges = Column(Integer, nullable=False)
    incoming_dependency_count = Column(Integer, nullable=False)
    outgoing_dependency_count = Column(Integer, nullable=False)
    fan_in = Column(Integer, nullable=False)
    fan_out = Column(Integer, nullable=False)
    dependency_depth = Column(Integer, nullable=False)
    dependency_density = Column(Float, nullable=False)
    most_referenced_file_node_id = Column(String)
    most_referenced_file = Column(String(2048))
    most_referenced_function_node_id = Column(String)
    most_referenced_function = Column(String(2048))
    unused_files = Column(Integer, nullable=False, default=0)
    unused_functions = Column(Integer, nullable=False, default=0)


class DependencyCycle(Base):
    __tablename__ = "dependency_cycles"
    __table_args__ = (
        Index("ix_dependency_cycles_repo_type", "repository_id", "cycle_type"),
    )

    id = Column(String, primary_key=True)
    dependency_id = Column(String, ForeignKey("dependencies.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    cycle_type = Column(String(32), nullable=False)
    node_ids_json = Column(Text, nullable=False)
    edge_ids_json = Column(Text, nullable=False, default="[]")
    length = Column(Integer, nullable=False)
    severity = Column(String(16), nullable=False)
