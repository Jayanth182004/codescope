import json
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DependencyBuildOut(ORMModel):
    id: str
    repository_id: str
    analysis_run_id: str
    status: str
    nodes_count: int
    edges_count: int
    cycles_count: int
    warnings: list[dict] = Field(default_factory=list)
    error_message: str | None
    built_at: datetime
    completed_at: datetime | None
    duration_ms: int | None


class DependencyNodeOut(ORMModel):
    id: str
    entity_type: str
    entity_key: str
    name: str
    label: str
    file_path: str | None
    module: str | None
    package: str | None
    source_entity_id: str | None
    metadata: dict = Field(default_factory=dict)


class DependencyEdgeOut(ORMModel):
    id: str
    source_node_id: str
    target_node_id: str
    relationship_type: str
    source_type: str
    target_type: str
    depth: int
    weight: float
    metadata: dict = Field(default_factory=dict)


class DependencyMetricsOut(ORMModel):
    total_nodes: int
    total_edges: int
    incoming_dependency_count: int
    outgoing_dependency_count: int
    fan_in: int
    fan_out: int
    dependency_depth: int
    dependency_density: float
    most_referenced_file_node_id: str | None
    most_referenced_file: str | None
    most_referenced_function_node_id: str | None
    most_referenced_function: str | None
    unused_files: int
    unused_functions: int


class DependencyCycleOut(ORMModel):
    id: str
    cycle_type: str
    node_ids: list[str]
    edge_ids: list[str]
    length: int
    severity: str


class DependencyGraphOut(BaseModel):
    build: DependencyBuildOut
    nodes: list[DependencyNodeOut]
    edges: list[DependencyEdgeOut]


class DependencyReportOut(BaseModel):
    build: DependencyBuildOut
    metrics: DependencyMetricsOut | None
    cycles: list[DependencyCycleOut]


class DependencyTreeNode(BaseModel):
    node: DependencyNodeOut
    edges: list[DependencyEdgeOut] = Field(default_factory=list)
    children: list["DependencyTreeNode"] = Field(default_factory=list)


class BlastRadiusOut(BaseModel):
    root: DependencyNodeOut
    direct_dependencies: list[DependencyNodeOut]
    indirect_dependencies: list[DependencyNodeOut]
    levels: list[dict]
    affected_files: list[DependencyNodeOut]
    affected_classes: list[DependencyNodeOut]
    affected_functions: list[DependencyNodeOut]
    total_affected: int


def build_out(row) -> DependencyBuildOut:
    return DependencyBuildOut(
        id=row.id,
        repository_id=row.repository_id,
        analysis_run_id=row.analysis_run_id,
        status=row.status,
        nodes_count=row.nodes_count,
        edges_count=row.edges_count,
        cycles_count=row.cycles_count,
        warnings=json.loads(row.warnings_json or "[]"),
        error_message=row.error_message,
        built_at=row.built_at,
        completed_at=row.completed_at,
        duration_ms=row.duration_ms,
    )


def node_out(row) -> DependencyNodeOut:
    return DependencyNodeOut(
        id=row.id,
        entity_type=row.entity_type,
        entity_key=row.entity_key,
        name=row.name,
        label=row.label,
        file_path=row.file_path,
        module=row.module,
        package=row.package,
        source_entity_id=row.source_entity_id,
        metadata=json.loads(row.metadata_json or "{}"),
    )


def edge_out(row) -> DependencyEdgeOut:
    return DependencyEdgeOut(
        id=row.id,
        source_node_id=row.source_node_id,
        target_node_id=row.target_node_id,
        relationship_type=row.relationship_type,
        source_type=row.source_type,
        target_type=row.target_type,
        depth=row.depth,
        weight=row.weight,
        metadata=json.loads(row.metadata_json or "{}"),
    )


def cycle_out(row) -> DependencyCycleOut:
    return DependencyCycleOut(
        id=row.id,
        cycle_type=row.cycle_type,
        node_ids=json.loads(row.node_ids_json or "[]"),
        edge_ids=json.loads(row.edge_ids_json or "[]"),
        length=row.length,
        severity=row.severity,
    )
