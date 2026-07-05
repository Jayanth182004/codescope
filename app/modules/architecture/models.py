from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text

from app.database.session import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class ArchitectureBuild(Base):
    __tablename__ = "architecture_builds"
    __table_args__ = (
        CheckConstraint("status IN ('running','completed','completed_with_warnings','failed')", name="ck_architecture_build_status"),
        Index("ix_architecture_builds_repository_created", "repository_id", "created_at"),
        Index("ix_architecture_builds_repository_status", "repository_id", "status"),
    )

    id = Column(String, primary_key=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    dependency_build_id = Column(String, ForeignKey("dependencies.id", ondelete="SET NULL"), nullable=True, index=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="SET NULL"), nullable=True, index=True)
    requested_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(32), nullable=False, default="running")
    frameworks_json = Column(Text, nullable=False, default="[]")
    warnings_json = Column(Text, nullable=False, default="[]")
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    completed_at = Column(DateTime(timezone=True))
    duration_ms = Column(Integer)


class ArchitectureComponent(Base):
    __tablename__ = "architecture_components"
    __table_args__ = (
        Index("ix_architecture_components_build_layer", "architecture_build_id", "layer"),
        Index("ix_architecture_components_build_type", "architecture_build_id", "component_type"),
    )

    id = Column(String, primary_key=True)
    architecture_build_id = Column(String, ForeignKey("architecture_builds.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    dependency_node_id = Column(String, ForeignKey("dependency_nodes.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(512), nullable=False)
    component_type = Column(String(64), nullable=False)
    layer = Column(String(64), nullable=False)
    path = Column(String(2048))
    framework = Column(String(64))
    confidence = Column(Float, nullable=False, default=0.5)
    metadata_json = Column(Text, nullable=False, default="{}")


class ArchitectureRequestFlow(Base):
    __tablename__ = "architecture_request_flows"
    __table_args__ = (Index("ix_architecture_flows_build", "architecture_build_id", "entry_component_id"),)

    id = Column(String, primary_key=True)
    architecture_build_id = Column(String, ForeignKey("architecture_builds.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(512), nullable=False)
    entry_component_id = Column(String, ForeignKey("architecture_components.id", ondelete="SET NULL"))
    component_ids_json = Column(Text, nullable=False, default="[]")
    layers_json = Column(Text, nullable=False, default="[]")
    confidence = Column(Float, nullable=False, default=0.5)
    metadata_json = Column(Text, nullable=False, default="{}")


class ArchitectureMetric(Base):
    __tablename__ = "architecture_metrics"

    id = Column(String, primary_key=True)
    architecture_build_id = Column(String, ForeignKey("architecture_builds.id", ondelete="CASCADE"), nullable=False, unique=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    layer_count = Column(Integer, nullable=False, default=0)
    layer_coupling = Column(Float, nullable=False, default=0.0)
    layer_cohesion = Column(Float, nullable=False, default=1.0)
    service_count = Column(Integer, nullable=False, default=0)
    controller_count = Column(Integer, nullable=False, default=0)
    repository_count = Column(Integer, nullable=False, default=0)
    api_count = Column(Integer, nullable=False, default=0)
    database_count = Column(Integer, nullable=False, default=0)
    architecture_complexity = Column(Float, nullable=False, default=0.0)
    health_score = Column(Integer, nullable=False, default=100)


class ArchitectureAntiPattern(Base):
    __tablename__ = "architecture_anti_patterns"
    __table_args__ = (Index("ix_architecture_antipatterns_build_severity", "architecture_build_id", "severity"),)

    id = Column(String, primary_key=True)
    architecture_build_id = Column(String, ForeignKey("architecture_builds.id", ondelete="CASCADE"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    pattern_type = Column(String(64), nullable=False)
    severity = Column(String(16), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)
    component_id = Column(String, ForeignKey("architecture_components.id", ondelete="SET NULL"))
    evidence_json = Column(Text, nullable=False, default="[]")
