"""
app/modules/graph/schemas.py
────────────────────────────
Pydantic request / response schemas for the Graph Knowledge API.

All response schemas follow the project's APIEnvelope[T] pattern.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Sync run ──────────────────────────────────────────────────────────────────

class GraphSyncRunOut(ORMModel):
    id: str
    repository_id: str
    dependency_build_id: str | None
    analysis_run_id: str | None
    trigger: str
    status: str
    nodes_synced: int
    edges_synced: int
    nodes_pruned: int
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None
    duration_ms: int | None


# ── Graph node ────────────────────────────────────────────────────────────────

class GraphNodeOut(BaseModel):
    """A node as returned from Neo4j — may carry any extra properties."""
    node_id: str
    entity_type: str
    entity_key: str
    name: str
    label: str
    file_path: str | None = None
    module: str | None = None
    package: str | None = None
    repository_id: str
    analysis_run_id: str
    properties: dict[str, Any] = Field(default_factory=dict)


# ── Graph edge ────────────────────────────────────────────────────────────────

class GraphEdgeOut(BaseModel):
    edge_id: str
    source_node_id: str
    target_node_id: str
    relationship_type: str
    source_type: str
    target_type: str
    weight: float = 1.0
    depth: int = 1
    repository_id: str
    properties: dict[str, Any] = Field(default_factory=dict)


# ── Full graph response ───────────────────────────────────────────────────────

class GraphOut(BaseModel):
    sync_run: GraphSyncRunOut | None
    nodes: list[GraphNodeOut]
    edges: list[GraphEdgeOut]
    total_nodes: int
    total_edges: int


# ── Neighbors ─────────────────────────────────────────────────────────────────

class GraphNeighborsOut(BaseModel):
    root: GraphNodeOut
    incoming: list[GraphNodeOut]
    outgoing: list[GraphNodeOut]
    incoming_edges: list[GraphEdgeOut]
    outgoing_edges: list[GraphEdgeOut]


# ── Shortest path ─────────────────────────────────────────────────────────────

class GraphPathRequest(BaseModel):
    source_node_id: str = Field(..., description="Starting node_id")
    target_node_id: str = Field(..., description="Destination node_id")
    max_depth: int = Field(default=6, ge=1, le=15)


class GraphPathOut(BaseModel):
    found: bool
    length: int | None = None
    nodes: list[GraphNodeOut] = Field(default_factory=list)
    edges: list[GraphEdgeOut] = Field(default_factory=list)


# ── Subgraph ──────────────────────────────────────────────────────────────────

class GraphSubgraphOut(BaseModel):
    root: GraphNodeOut
    nodes: list[GraphNodeOut]
    edges: list[GraphEdgeOut]
    depth: int
    node_count: int
    edge_count: int


# ── Search ────────────────────────────────────────────────────────────────────

class GraphSearchOut(BaseModel):
    query: str
    results: list[GraphNodeOut]
    total: int


# ── Statistics ────────────────────────────────────────────────────────────────

class NodeDistributionItem(BaseModel):
    entity_type: str
    count: int


class RelationshipDistributionItem(BaseModel):
    relationship_type: str
    count: int


class GraphStatisticsOut(BaseModel):
    repository_id: str
    total_nodes: int
    total_relationships: int
    node_distribution: list[NodeDistributionItem]
    relationship_distribution: list[RelationshipDistributionItem]
    most_connected_node: GraphNodeOut | None
    most_connected_degree: int
    average_degree: float
    graph_density: float
    largest_connected_component_size: int | None = None


# ── Health ────────────────────────────────────────────────────────────────────

class GraphHealthOut(BaseModel):
    is_healthy: bool
    uri: str
    database: str
    error: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def sync_run_out(row) -> GraphSyncRunOut:
    return GraphSyncRunOut(
        id=row.id,
        repository_id=row.repository_id,
        dependency_build_id=row.dependency_build_id,
        analysis_run_id=row.analysis_run_id,
        trigger=row.trigger,
        status=row.status,
        nodes_synced=row.nodes_synced,
        edges_synced=row.edges_synced,
        nodes_pruned=row.nodes_pruned,
        error_message=row.error_message,
        started_at=row.started_at,
        completed_at=row.completed_at,
        duration_ms=row.duration_ms,
    )


def neo4j_record_to_node(record: dict) -> GraphNodeOut:
    """Convert a raw Neo4j result record dict into GraphNodeOut."""
    props = dict(record)
    return GraphNodeOut(
        node_id=props.pop("node_id", ""),
        entity_type=props.pop("entity_type", "unknown"),
        entity_key=props.pop("entity_key", ""),
        name=props.pop("name", ""),
        label=props.pop("label", ""),
        file_path=props.pop("file_path", None),
        module=props.pop("module", None),
        package=props.pop("package", None),
        repository_id=props.pop("repository_id", ""),
        analysis_run_id=props.pop("analysis_run_id", ""),
        properties=props,
    )


def neo4j_record_to_edge(record: dict) -> GraphEdgeOut:
    """Convert a raw Neo4j relationship record dict into GraphEdgeOut."""
    props = dict(record)
    return GraphEdgeOut(
        edge_id=props.pop("edge_id", ""),
        source_node_id=props.pop("source_node_id", ""),
        target_node_id=props.pop("target_node_id", ""),
        relationship_type=props.pop("relationship_type", ""),
        source_type=props.pop("source_type", ""),
        target_type=props.pop("target_type", ""),
        weight=props.pop("weight", 1.0),
        depth=props.pop("depth", 1),
        repository_id=props.pop("repository_id", ""),
        properties=props,
    )
