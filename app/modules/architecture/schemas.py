from __future__ import annotations

import json
from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.architecture.models import (
    ArchitectureAntiPattern,
    ArchitectureBuild,
    ArchitectureComponent,
    ArchitectureMetric,
    ArchitectureRequestFlow,
)


def _loads(value: str | None, default):
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


class ArchitectureBuildOut(BaseModel):
    id: str
    repository_id: str
    dependency_build_id: str | None = None
    analysis_run_id: str | None = None
    status: str
    frameworks: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
    duration_ms: int | None = None


class ArchitectureComponentOut(BaseModel):
    id: str
    name: str
    component_type: str
    layer: str
    path: str | None = None
    framework: str | None = None
    dependency_node_id: str | None = None
    confidence: float
    metadata: dict = Field(default_factory=dict)


class ArchitectureRequestFlowOut(BaseModel):
    id: str
    name: str
    entry_component_id: str | None = None
    component_ids: list[str] = Field(default_factory=list)
    layers: list[str] = Field(default_factory=list)
    confidence: float
    metadata: dict = Field(default_factory=dict)


class ArchitectureMetricsOut(BaseModel):
    layer_count: int
    layer_coupling: float
    layer_cohesion: float
    service_count: int
    controller_count: int
    repository_count: int
    api_count: int
    database_count: int
    architecture_complexity: float
    health_score: int


class ArchitectureAntiPatternOut(BaseModel):
    id: str
    pattern_type: str
    severity: str
    title: str
    description: str
    recommendation: str
    component_id: str | None = None
    evidence: list = Field(default_factory=list)


class ArchitectureOverviewOut(BaseModel):
    build: ArchitectureBuildOut
    frameworks: list[str]
    layers: dict[str, int]
    components: list[ArchitectureComponentOut]
    request_flows: list[ArchitectureRequestFlowOut]
    metrics: ArchitectureMetricsOut
    anti_patterns: list[ArchitectureAntiPatternOut]


def build_out(row: ArchitectureBuild) -> ArchitectureBuildOut:
    return ArchitectureBuildOut(
        id=row.id,
        repository_id=row.repository_id,
        dependency_build_id=row.dependency_build_id,
        analysis_run_id=row.analysis_run_id,
        status=row.status,
        frameworks=_loads(row.frameworks_json, []),
        warnings=_loads(row.warnings_json, []),
        error_message=row.error_message,
        created_at=row.created_at,
        completed_at=row.completed_at,
        duration_ms=row.duration_ms,
    )


def component_out(row: ArchitectureComponent) -> ArchitectureComponentOut:
    return ArchitectureComponentOut(
        id=row.id,
        name=row.name,
        component_type=row.component_type,
        layer=row.layer,
        path=row.path,
        framework=row.framework,
        dependency_node_id=row.dependency_node_id,
        confidence=row.confidence,
        metadata=_loads(row.metadata_json, {}),
    )


def flow_out(row: ArchitectureRequestFlow) -> ArchitectureRequestFlowOut:
    return ArchitectureRequestFlowOut(
        id=row.id,
        name=row.name,
        entry_component_id=row.entry_component_id,
        component_ids=_loads(row.component_ids_json, []),
        layers=_loads(row.layers_json, []),
        confidence=row.confidence,
        metadata=_loads(row.metadata_json, {}),
    )


def metrics_out(row: ArchitectureMetric) -> ArchitectureMetricsOut:
    return ArchitectureMetricsOut(
        layer_count=row.layer_count,
        layer_coupling=row.layer_coupling,
        layer_cohesion=row.layer_cohesion,
        service_count=row.service_count,
        controller_count=row.controller_count,
        repository_count=row.repository_count,
        api_count=row.api_count,
        database_count=row.database_count,
        architecture_complexity=row.architecture_complexity,
        health_score=row.health_score,
    )


def anti_pattern_out(row: ArchitectureAntiPattern) -> ArchitectureAntiPatternOut:
    return ArchitectureAntiPatternOut(
        id=row.id,
        pattern_type=row.pattern_type,
        severity=row.severity,
        title=row.title,
        description=row.description,
        recommendation=row.recommendation,
        component_id=row.component_id,
        evidence=_loads(row.evidence_json, []),
    )
