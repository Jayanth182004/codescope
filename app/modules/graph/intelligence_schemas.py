"""
app/modules/graph/intelligence_schemas.py
─────────────────────────────────────────
Pydantic schemas for the Graph Query & Intelligence Layer (Phase 6).

These schemas are consumed by:
  • Knowledge Graph Explorer
  • Dependency Explorer
  • Architecture Explorer
  • Change Impact Analysis
  • AI Assistant context builder

All schemas extend the project's APIEnvelope[T] pattern and are designed
to be stable API contracts — internal implementation may change without
breaking consumers.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.modules.graph.schemas import GraphEdgeOut, GraphNodeOut


# ── Traversal ─────────────────────────────────────────────────────────────────

class TraversalResult(BaseModel):
    """
    Result of a BFS or DFS traversal from a root node.

    `mode` distinguishes BFS (Neo4j-native breadth-first) from DFS
    (Python application-layer depth-first on Neo4j subgraph data).
    `nodes` are ordered by discovery order within the selected mode.
    """
    mode: str = Field(..., description="'bfs' or 'dfs'")
    root: GraphNodeOut
    nodes: list[GraphNodeOut] = Field(default_factory=list)
    edges: list[GraphEdgeOut] = Field(default_factory=list)
    depth_reached: int
    direction: str = Field(default="outgoing", description="'outgoing', 'incoming', or 'both'")
    relationship_types_filter: list[str] = Field(default_factory=list)
    entity_types_filter: list[str] = Field(default_factory=list)
    total_nodes: int
    total_edges: int


# ── Path finding ──────────────────────────────────────────────────────────────

class PathItem(BaseModel):
    """One path between two nodes."""
    length: int
    nodes: list[GraphNodeOut]
    edges: list[GraphEdgeOut]


class AllPathsOut(BaseModel):
    """All simple paths between source and target up to a depth limit."""
    source: GraphNodeOut
    target: GraphNodeOut
    found: bool
    paths: list[PathItem] = Field(default_factory=list)
    total_paths: int
    shortest_length: int | None = None
    max_paths_cap: int = Field(
        default=50,
        description="Maximum paths returned. Graph may contain more.",
    )


# ── Dependencies ──────────────────────────────────────────────────────────────

class DependencyChainOut(BaseModel):
    """
    Direct and transitive dependency chains for a node.

    `direct_dependencies`: nodes this node directly depends on (depth=1).
    `transitive_dependencies`: all reachable dependency nodes (depth up to limit).
    `reverse_dependencies`: nodes that depend on this node (incoming).
    """
    node: GraphNodeOut
    direct_dependencies: list[GraphNodeOut] = Field(default_factory=list)
    transitive_dependencies: list[GraphNodeOut] = Field(default_factory=list)
    reverse_dependencies: list[GraphNodeOut] = Field(default_factory=list)
    direct_count: int
    transitive_count: int
    reverse_count: int
    max_depth_reached: int
    relationship_types: list[str] = Field(
        default_factory=list,
        description="Relationship types used to traverse the dependency chain.",
    )


# ── Call chain ────────────────────────────────────────────────────────────────

class CallChainOut(BaseModel):
    """
    Call relationship chains for a function / method node.

    `callers`: nodes that call this node directly (depth=1).
    `callees`: nodes this node calls directly (depth=1).
    `transitive_callers`: full upstream call tree.
    `transitive_callees`: full downstream call tree.
    """
    node: GraphNodeOut
    callers: list[GraphNodeOut] = Field(default_factory=list)
    callees: list[GraphNodeOut] = Field(default_factory=list)
    transitive_callers: list[GraphNodeOut] = Field(default_factory=list)
    transitive_callees: list[GraphNodeOut] = Field(default_factory=list)
    caller_count: int
    callee_count: int
    transitive_caller_count: int
    transitive_callee_count: int
    max_depth: int


# ── Import chain ──────────────────────────────────────────────────────────────

class ImportChainOut(BaseModel):
    """
    Import relationship chains for a file / module node.

    `importers`: files/modules that import this node directly.
    `importees`: files/modules this node imports directly.
    `transitive_importers`: full upstream import tree.
    `transitive_importees`: full downstream import tree.
    """
    node: GraphNodeOut
    importers: list[GraphNodeOut] = Field(default_factory=list)
    importees: list[GraphNodeOut] = Field(default_factory=list)
    transitive_importers: list[GraphNodeOut] = Field(default_factory=list)
    transitive_importees: list[GraphNodeOut] = Field(default_factory=list)
    importer_count: int
    importee_count: int
    transitive_importer_count: int
    transitive_importee_count: int
    max_depth: int


# ── Inheritance chain ─────────────────────────────────────────────────────────

class InheritanceChainOut(BaseModel):
    """
    Inheritance relationship chains for a class node.

    `superclasses`: nodes this class directly inherits from (depth=1).
    `subclasses`: nodes that directly inherit from this class (depth=1).
    `transitive_superclasses`: full upstream inheritance tree.
    `transitive_subclasses`: full downstream inheritance tree.
    """
    node: GraphNodeOut
    superclasses: list[GraphNodeOut] = Field(default_factory=list)
    subclasses: list[GraphNodeOut] = Field(default_factory=list)
    transitive_superclasses: list[GraphNodeOut] = Field(default_factory=list)
    transitive_subclasses: list[GraphNodeOut] = Field(default_factory=list)
    superclass_count: int
    subclass_count: int
    transitive_superclass_count: int
    transitive_subclass_count: int
    max_depth: int


# ── Related nodes ─────────────────────────────────────────────────────────────

class RelatedNodesOut(BaseModel):
    """
    N-hop neighborhood of a node with optional relationship type filtering.
    This is the primary "explore from a node" response shape used by all
    graph visualisation consumers.
    """
    root: GraphNodeOut
    nodes: list[GraphNodeOut] = Field(default_factory=list)
    edges: list[GraphEdgeOut] = Field(default_factory=list)
    depth: int
    direction: str
    relationship_types: list[str] = Field(default_factory=list)
    entity_types: list[str] = Field(default_factory=list)
    total_nodes: int
    total_edges: int


# ── Graph summary ─────────────────────────────────────────────────────────────

class HotspotNode(BaseModel):
    """A highly connected node with degree metrics."""
    node: GraphNodeOut
    in_degree: int
    out_degree: int
    total_degree: int


class GraphSummaryOut(BaseModel):
    """
    Repository-level intelligence overview.

    Consumers:
      • Dashboard widget — repo health at a glance
      • Architecture Explorer — identify subsystem entry points
      • AI Assistant context — understand the shape of the codebase

    `hotspot_nodes`: top 10 most connected nodes (high coupling risk).
    `orphan_nodes`: nodes with no edges (dead code candidates).
    `entry_points`: nodes with only outgoing edges (roots/initializers).
    `sink_nodes`: nodes with only incoming edges (leaves/utilities).
    `most_imported`: top files/modules by incoming IMPORTS edges.
    `most_called`: top functions/methods by incoming CALLS edges.
    """
    repository_id: str
    total_nodes: int
    total_edges: int
    hotspot_nodes: list[HotspotNode] = Field(default_factory=list)
    orphan_count: int
    orphan_nodes: list[GraphNodeOut] = Field(default_factory=list)
    entry_points: list[GraphNodeOut] = Field(default_factory=list)
    sink_nodes: list[GraphNodeOut] = Field(default_factory=list)
    most_imported: list[GraphNodeOut] = Field(default_factory=list)
    most_called: list[GraphNodeOut] = Field(default_factory=list)
    entry_point_count: int
    sink_count: int
