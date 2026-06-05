"""
app/modules/graph/intelligence_services.py
───────────────────────────────────────────
Graph Query & Intelligence Layer — Phase 6.

Architecture
────────────
This module provides reusable graph intelligence that every future feature
consumes. It sits between the raw Neo4j driver (Phase 5 infrastructure) and
feature-specific modules (Architecture Engine, AI Assistant, Impact Analysis).

                  Feature modules
                       ↓
          intelligence_services.py   ← THIS FILE
                       ↓
              services.py (Phase 5 infra)
                       ↓
           app/database/neo4j.py
                       ↓
                    Neo4j

Service responsibilities (one per class, no crossover):
─────────────────────────────────────────────────────
  GraphCachingService      Protocol/interface — cache-provider agnostic
  GraphTraversalService    BFS (Neo4j) + DFS (Python on Neo4j data)
  PathFindingService       Shortest path + all simple paths
  NeighborhoodService      N-hop neighborhood with rel/entity type filter
  DependencyQueryService   Direct & transitive deps, reverse deps
  CallChainService         Who calls / is called by (CALLS relationships)
  ImportChainService       Who imports / is imported by (IMPORTS relationships)
  GraphSummaryService      Repository-level intelligence overview

Traversal design decisions (ADR 15, ADR 16):
─────────────────────────────────────────────
• BFS  — Neo4j variable-length pattern matching; database handles ordering.
• DFS  — Fetch subgraph from Neo4j (single query), apply Python iterative
         DFS on the in-memory adjacency list. Correct ordering, single
         round-trip, no APOC dependency.
• NO PostgreSQL fallback — Neo4j is the single source of graph truth.
  PostgreSQL holds relational metadata; graph traversal is Neo4j-only.
• Relationship type filter strings are validated against RELATIONSHIP_MAP
  before being interpolated into Cypher to prevent injection.
"""

from __future__ import annotations

import logging
from collections import defaultdict, deque
from typing import Any, Protocol, runtime_checkable

from app.core.config import settings
from app.core.exceptions import APIError
from app.database.neo4j import neo4j_session
from app.modules.graph.intelligence_schemas import (
    AllPathsOut,
    CallChainOut,
    DependencyChainOut,
    GraphSummaryOut,
    HotspotNode,
    ImportChainOut,
    InheritanceChainOut,
    PathItem,
    RelatedNodesOut,
    TraversalResult,
)
from app.modules.graph.schemas import GraphEdgeOut, GraphNodeOut, neo4j_record_to_node
from app.modules.graph.services import RELATIONSHIP_MAP

logger = logging.getLogger(__name__)

# ── Validated relationship type sets ─────────────────────────────────────────
# These are the only Neo4j relationship types we ever write in Cypher.
# String values come from RELATIONSHIP_MAP in services.py (built at startup).

_VALID_NEO4J_REL_TYPES: frozenset[str] = frozenset(RELATIONSHIP_MAP.values())

# Semantic relationship groups used by intelligence services
_DEPENDENCY_REL_TYPES = frozenset({"IMPORTS", "DEPENDS_ON", "USES"})
_CALL_REL_TYPES = frozenset({"CALLS", "CALLED_BY"})
_IMPORT_REL_TYPES = frozenset({"IMPORTS", "IMPORTED_BY"})

# Query caps — overridable via settings
_MAX_PATHS = 50
_DEFAULT_DEPTH = 3
_NEIGHBORHOOD_NODE_CAP = settings.GRAPH_MAX_SUBGRAPH_NODES


# ── Shared helpers ────────────────────────────────────────────────────────────

def _validate_rel_types(rel_types: list[str] | None) -> list[str]:
    """
    Validate and normalise relationship type names against the known set.
    Returns only safe, uppercase types.
    Prevents Cypher injection — never interpolate user strings directly.
    """
    if not rel_types:
        return []
    return [rt.upper() for rt in rel_types if rt.upper() in _VALID_NEO4J_REL_TYPES]


def _rel_pattern(rel_types: list[str]) -> str:
    """
    Build a Neo4j relationship type filter string for Cypher.
    Example: ['CALLS', 'IMPORTS'] → ':CALLS|IMPORTS'
    Empty list → '' (matches all relationship types).
    """
    if not rel_types:
        return ""
    return ":" + "|".join(rel_types)


def _direction_pattern(direction: str, rel_pattern_str: str, depth: int) -> str:
    """
    Return a Cypher relationship pattern string for a given direction.

    direction='outgoing' → -[r..depth]->
    direction='incoming' → <-[r..depth]-
    direction='both'     → -[r..depth]-
    """
    rel = f"[r{rel_pattern_str}*1..{depth}]"
    if direction == "incoming":
        return f"<-{rel}-"
    elif direction == "both":
        return f"-{rel}-"
    return f"-{rel}->"


def _edge_from_record(r: Any, src_id: str, tgt_id: str) -> GraphEdgeOut:
    """Convert a raw Neo4j relationship record into a GraphEdgeOut."""
    props = dict(r)
    return GraphEdgeOut(
        edge_id=props.get("edge_id", ""),
        source_node_id=src_id,
        target_node_id=tgt_id,
        relationship_type=props.get("relationship_type", r.type if hasattr(r, "type") else ""),
        source_type=props.get("source_type", ""),
        target_type=props.get("target_type", ""),
        weight=float(props.get("weight", 1.0)),
        depth=int(props.get("depth", 1)),
        repository_id=props.get("repository_id", ""),
        properties=props,
    )


def _fetch_root_node(session, node_id: str) -> GraphNodeOut | None:
    result = session.run(
        "MATCH (n:CodeScopeNode {node_id: $node_id}) RETURN n LIMIT 1",
        node_id=node_id,
    )
    record = result.single()
    return neo4j_record_to_node(dict(record["n"])) if record else None


# ─────────────────────────────────────────────────────────────────────────────
# 1. GraphCachingService — Protocol (interface only, ADR 15)
# ─────────────────────────────────────────────────────────────────────────────

@runtime_checkable
class GraphCachingService(Protocol):
    """
    Cache-provider agnostic interface for the graph intelligence layer.

    Concrete implementations (Redis, in-memory, no-op) implement this
    protocol without changing any business logic in intelligence services.

    Designed for dependency injection:
        service = DependencyQueryService(cache=RedisCacheService(...))

    The interface is intentionally minimal — cache invalidation strategies
    (TTL, event-based, repository-scoped) are implementation concerns.
    """

    def get(self, key: str) -> Any | None:
        """Return cached value or None if not found / expired."""
        ...

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        """Store a value with an optional TTL in seconds."""
        ...

    def invalidate(self, key: str) -> None:
        """Remove a specific key from the cache."""
        ...

    def invalidate_repository(self, repository_id: str) -> None:
        """
        Invalidate all cached results scoped to a repository.
        Called automatically after a graph sync run completes.
        """
        ...


class NoOpCacheService:
    """
    A no-op implementation of GraphCachingService for development.
    Satisfies the Protocol without any state. Safe for concurrent use.
    """

    def get(self, key: str) -> Any | None:
        return None

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        pass

    def invalidate(self, key: str) -> None:
        pass

    def invalidate_repository(self, repository_id: str) -> None:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# 2. GraphTraversalService
# ─────────────────────────────────────────────────────────────────────────────

class GraphTraversalService:
    """
    Generic graph traversal — BFS and DFS.

    BFS: Uses Neo4j variable-length pattern matching. Neo4j performs the
         breadth-first expansion internally; we receive the flat node set.

    DFS: Fetches the subgraph up to depth N via a single Neo4j query,
         builds an in-memory adjacency list, then applies Python iterative
         DFS for discovery ordering. This gives correct DFS semantics
         without multiple round-trips or APOC dependency.

    Parameters:
        depth       Traversal depth. Clamped to GRAPH_MAX_DEPTH.
        direction   'outgoing' | 'incoming' | 'both'
        rel_types   Optional list of Neo4j relationship types to follow.
                    Validated against RELATIONSHIP_MAP. Empty = all types.
        entity_types Optional list of entity types to include in results.
                    Filtering is applied in Python after Neo4j returns data.
    """

    VALID_DIRECTIONS = frozenset({"outgoing", "incoming", "both"})

    def bfs(
        self,
        node_id: str,
        depth: int = _DEFAULT_DEPTH,
        direction: str = "outgoing",
        rel_types: list[str] | None = None,
        entity_types: list[str] | None = None,
    ) -> TraversalResult:
        depth = min(depth, settings.GRAPH_MAX_DEPTH)
        direction = direction if direction in self.VALID_DIRECTIONS else "outgoing"
        safe_rel_types = _validate_rel_types(rel_types)
        rel_pat = _rel_pattern(safe_rel_types)
        dir_pat = _direction_pattern(direction, rel_pat, depth)

        node_cypher = f"""
MATCH (root:CodeScopeNode {{node_id: $node_id}})
MATCH (root){dir_pat}(n:CodeScopeNode)
WHERE n.node_id <> root.node_id
RETURN DISTINCT n
LIMIT $limit
"""
        edge_cypher = f"""
MATCH (root:CodeScopeNode {{node_id: $node_id}})
MATCH (root){dir_pat}(n:CodeScopeNode)
WHERE n.node_id <> root.node_id
MATCH (src:CodeScopeNode {{repository_id: root.repository_id}})-[r]->(tgt:CodeScopeNode {{repository_id: root.repository_id}})
WHERE src.node_id IN [root.node_id, n.node_id] AND tgt.node_id IN [root.node_id, n.node_id]
RETURN DISTINCT r, src.node_id AS src_id, tgt.node_id AS tgt_id
LIMIT $limit
"""
        with neo4j_session() as session:
            root = _fetch_root_node(session, node_id)
            if root is None:
                raise APIError("Node not found in knowledge graph", 404)

            node_records = session.run(
                node_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP
            ).data()
            edge_records = session.run(
                edge_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP * 3
            ).data()

        nodes = [neo4j_record_to_node(dict(r["n"])) for r in node_records]
        if entity_types:
            nodes = [n for n in nodes if n.entity_type in entity_types]
        edges = [
            _edge_from_record(r["r"], r["src_id"], r["tgt_id"])
            for r in edge_records
        ]

        return TraversalResult(
            mode="bfs",
            root=root,
            nodes=nodes,
            edges=edges,
            depth_reached=depth,
            direction=direction,
            relationship_types_filter=safe_rel_types,
            entity_types_filter=entity_types or [],
            total_nodes=len(nodes),
            total_edges=len(edges),
        )

    def dfs(
        self,
        node_id: str,
        depth: int = _DEFAULT_DEPTH,
        direction: str = "outgoing",
        rel_types: list[str] | None = None,
        entity_types: list[str] | None = None,
    ) -> TraversalResult:
        """
        DFS implementation:
          1. Fetch the full subgraph up to `depth` from Neo4j (single query).
          2. Build an in-memory adjacency list keyed by node_id.
          3. Run Python iterative DFS, yielding nodes in discovery order.
        """
        depth = min(depth, settings.GRAPH_MAX_DEPTH)
        direction = direction if direction in self.VALID_DIRECTIONS else "outgoing"
        safe_rel_types = _validate_rel_types(rel_types)
        rel_pat = _rel_pattern(safe_rel_types)
        dir_pat = _direction_pattern(direction, rel_pat, depth)

        subgraph_cypher = f"""
MATCH (root:CodeScopeNode {{node_id: $node_id}})
MATCH (root){dir_pat}(n:CodeScopeNode)
WHERE n.node_id <> root.node_id
RETURN DISTINCT n
LIMIT $limit
"""
        edge_cypher = f"""
MATCH (root:CodeScopeNode {{node_id: $node_id}})
MATCH (root){dir_pat}(n:CodeScopeNode)
WHERE n.node_id <> root.node_id
MATCH (src:CodeScopeNode {{repository_id: root.repository_id}})-[r]->(tgt:CodeScopeNode {{repository_id: root.repository_id}})
WHERE src.node_id IN [root.node_id, n.node_id] AND tgt.node_id IN [root.node_id, n.node_id]
RETURN DISTINCT r, src.node_id AS src_id, tgt.node_id AS tgt_id
LIMIT $limit
"""
        with neo4j_session() as session:
            root = _fetch_root_node(session, node_id)
            if root is None:
                raise APIError("Node not found in knowledge graph", 404)

            node_records = session.run(
                subgraph_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP
            ).data()
            edge_records = session.run(
                edge_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP * 3
            ).data()

        # Build node map and adjacency list
        node_map: dict[str, GraphNodeOut] = {root.node_id: root}
        for r in node_records:
            n = neo4j_record_to_node(dict(r["n"]))
            node_map[n.node_id] = n

        adjacency: dict[str, list[str]] = defaultdict(list)
        for r in edge_records:
            adjacency[r["src_id"]].append(r["tgt_id"])

        # Iterative DFS
        dfs_order = self._python_dfs(node_id, adjacency)

        # Reconstruct ordered node list from DFS traversal (skip root)
        nodes = [node_map[nid] for nid in dfs_order if nid != node_id and nid in node_map]
        if entity_types:
            nodes = [n for n in nodes if n.entity_type in entity_types]

        edges = [
            _edge_from_record(r["r"], r["src_id"], r["tgt_id"])
            for r in edge_records
        ]

        return TraversalResult(
            mode="dfs",
            root=root,
            nodes=nodes,
            edges=edges,
            depth_reached=depth,
            direction=direction,
            relationship_types_filter=safe_rel_types,
            entity_types_filter=entity_types or [],
            total_nodes=len(nodes),
            total_edges=len(edges),
        )

    @staticmethod
    def _python_dfs(start_id: str, adjacency: dict[str, list[str]]) -> list[str]:
        """
        Iterative depth-first traversal on an adjacency list.
        Returns node IDs in DFS discovery order (start_id first).
        Uses a stack; neighbors are pushed in reverse order to preserve
        left-to-right (alphabetical) child expansion order.
        """
        visited: set[str] = set()
        stack: list[str] = [start_id]
        order: list[str] = []

        while stack:
            current = stack.pop()
            if current in visited:
                continue
            visited.add(current)
            order.append(current)
            for neighbor in reversed(adjacency.get(current, [])):
                if neighbor not in visited:
                    stack.append(neighbor)

        return order


# ─────────────────────────────────────────────────────────────────────────────
# 3. PathFindingService
# ─────────────────────────────────────────────────────────────────────────────

class PathFindingService:
    """
    Path queries between two nodes.

    shortest_path: Uses Neo4j shortestPath() — O(E + V) BFS.
    all_paths:     Variable-length pattern with LIMIT to cap result size.
                   Returns all simple paths up to max_depth and max_paths.
    """

    def shortest_path(
        self,
        source_node_id: str,
        target_node_id: str,
        max_depth: int = 6,
    ) -> PathItem | None:
        max_depth = min(max_depth, settings.GRAPH_MAX_DEPTH)
        cypher = f"""
MATCH p = shortestPath(
  (src:CodeScopeNode {{node_id: $src}})-[*1..{max_depth}]->(tgt:CodeScopeNode {{node_id: $tgt}})
)
RETURN [n IN nodes(p) | n] AS path_nodes,
       [r IN relationships(p) | r] AS path_rels
LIMIT 1
"""
        with neo4j_session() as session:
            result = session.run(cypher, src=source_node_id, tgt=target_node_id)
            record = result.single()

        if not record:
            return None

        path_nodes = [neo4j_record_to_node(dict(n)) for n in record["path_nodes"]]
        path_edges: list[GraphEdgeOut] = []
        neo4j_nodes = record["path_nodes"]
        for idx, rel in enumerate(record["path_rels"]):
            src_id = dict(neo4j_nodes[idx]).get("node_id", "")
            tgt_id = dict(neo4j_nodes[idx + 1]).get("node_id", "")
            path_edges.append(_edge_from_record(rel, src_id, tgt_id))

        return PathItem(length=len(path_edges), nodes=path_nodes, edges=path_edges)

    def all_paths(
        self,
        source_node_id: str,
        target_node_id: str,
        max_depth: int = 5,
        max_paths: int = _MAX_PATHS,
    ) -> AllPathsOut:
        """
        Returns all simple directed paths from source to target.
        Capped at max_paths (default 50) and max_depth (default 5).
        """
        max_depth = min(max_depth, settings.GRAPH_MAX_DEPTH)
        max_paths = min(max_paths, _MAX_PATHS)
        cypher = f"""
MATCH p = (src:CodeScopeNode {{node_id: $src}})-[*1..{max_depth}]->(tgt:CodeScopeNode {{node_id: $tgt}})
RETURN [n IN nodes(p) | n] AS path_nodes,
       [r IN relationships(p) | r] AS path_rels
LIMIT {max_paths}
"""
        with neo4j_session() as session:
            source_node = _fetch_root_node(session, source_node_id)
            target_node = _fetch_root_node(session, target_node_id)

            if source_node is None:
                raise APIError(f"Source node not found: {source_node_id}", 404)
            if target_node is None:
                raise APIError(f"Target node not found: {target_node_id}", 404)

            result = session.run(cypher, src=source_node_id, tgt=target_node_id)
            raw_paths = result.data()

        paths: list[PathItem] = []
        for row in raw_paths:
            path_nodes = [neo4j_record_to_node(dict(n)) for n in row["path_nodes"]]
            path_edges: list[GraphEdgeOut] = []
            neo4j_nodes = row["path_nodes"]
            for idx, rel in enumerate(row["path_rels"]):
                src_id = dict(neo4j_nodes[idx]).get("node_id", "")
                tgt_id = dict(neo4j_nodes[idx + 1]).get("node_id", "")
                path_edges.append(_edge_from_record(rel, src_id, tgt_id))
            paths.append(PathItem(length=len(path_edges), nodes=path_nodes, edges=path_edges))

        shortest_len = min((p.length for p in paths), default=None)

        return AllPathsOut(
            source=source_node,
            target=target_node,
            found=len(paths) > 0,
            paths=paths,
            total_paths=len(paths),
            shortest_length=shortest_len,
            max_paths_cap=max_paths,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 4. NeighborhoodService
# ─────────────────────────────────────────────────────────────────────────────

class NeighborhoodService:
    """
    N-hop neighborhood queries with relationship type and entity type filters.

    This is the primary "explore from a node" service consumed by the
    Knowledge Graph Explorer and Dependency Explorer frontends.
    Delegates traversal to GraphTraversalService (BFS by default).
    """

    def __init__(self, traversal: GraphTraversalService | None = None):
        self._traversal = traversal or GraphTraversalService()

    def get_neighborhood(
        self,
        node_id: str,
        depth: int = 2,
        direction: str = "both",
        rel_types: list[str] | None = None,
        entity_types: list[str] | None = None,
        traversal_mode: str = "bfs",
    ) -> RelatedNodesOut:
        depth = min(depth, settings.GRAPH_MAX_DEPTH)
        safe_rel_types = _validate_rel_types(rel_types)

        if traversal_mode == "dfs":
            result = self._traversal.dfs(node_id, depth, direction, safe_rel_types or None, entity_types)
        else:
            result = self._traversal.bfs(node_id, depth, direction, safe_rel_types or None, entity_types)

        return RelatedNodesOut(
            root=result.root,
            nodes=result.nodes,
            edges=result.edges,
            depth=depth,
            direction=direction,
            relationship_types=safe_rel_types,
            entity_types=entity_types or [],
            total_nodes=result.total_nodes,
            total_edges=result.total_edges,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 5. DependencyQueryService
# ─────────────────────────────────────────────────────────────────────────────

class DependencyQueryService:
    """
    Dependency chain queries using IMPORTS, DEPENDS_ON, and USES relationships.

    direct_dependencies  → outgoing dep edges, depth=1
    transitive_deps      → outgoing dep edges, depth=max_depth (all reachable)
    reverse_dependencies → incoming dep edges (who depends on this node)

    Neo4j is the single source of truth for all queries.
    """

    _DEP_REL_TYPES = sorted(_DEPENDENCY_REL_TYPES)  # stable order

    def _dep_rel_pattern(self) -> str:
        return _rel_pattern(self._DEP_REL_TYPES)

    def get_dependencies(
        self,
        node_id: str,
        max_depth: int = settings.GRAPH_MAX_DEPTH,
        transitive: bool = True,
    ) -> DependencyChainOut:
        max_depth = min(max_depth, settings.GRAPH_MAX_DEPTH)
        dep_rel = self._dep_rel_pattern()

        direct_cypher = f"""
MATCH (n:CodeScopeNode {{node_id: $node_id}})-[r{dep_rel}]->(dep:CodeScopeNode)
RETURN DISTINCT dep
LIMIT $limit
"""
        transitive_cypher = f"""
MATCH (n:CodeScopeNode {{node_id: $node_id}})-[r{dep_rel}*2..{max_depth}]->(dep:CodeScopeNode)
WHERE dep.node_id <> $node_id
RETURN DISTINCT dep
LIMIT $limit
"""
        reverse_cypher = f"""
MATCH (n:CodeScopeNode {{node_id: $node_id}})<-[r{dep_rel}]-(dependent:CodeScopeNode)
RETURN DISTINCT dependent
LIMIT $limit
"""

        with neo4j_session() as session:
            root = _fetch_root_node(session, node_id)
            if root is None:
                raise APIError("Node not found in knowledge graph", 404)

            direct = [
                neo4j_record_to_node(dict(r["dep"]))
                for r in session.run(direct_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
            ]
            transitive_nodes: list[GraphNodeOut] = []
            if transitive and max_depth > 1:
                transitive_nodes = [
                    neo4j_record_to_node(dict(r["dep"]))
                    for r in session.run(transitive_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
                ]
            reverse = [
                neo4j_record_to_node(dict(r["dependent"]))
                for r in session.run(reverse_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
            ]

        return DependencyChainOut(
            node=root,
            direct_dependencies=direct,
            transitive_dependencies=transitive_nodes,
            reverse_dependencies=reverse,
            direct_count=len(direct),
            transitive_count=len(transitive_nodes),
            reverse_count=len(reverse),
            max_depth_reached=max_depth,
            relationship_types=self._DEP_REL_TYPES,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 6. CallChainService
# ─────────────────────────────────────────────────────────────────────────────

class CallChainService:
    """
    Call relationship analysis using CALLS relationships.

    callers           → incoming CALLS edges (depth=1)
    callees           → outgoing CALLS edges (depth=1)
    transitive_callers → all upstream callers (full call tree)
    transitive_callees → all downstream callees (full call tree)

    Answers:
      "Which functions call this function?"    → callers
      "What functions does this function call?" → callees
      "What is the full upstream call tree?"    → transitive_callers
    """

    def get_call_chain(
        self,
        node_id: str,
        max_depth: int = settings.GRAPH_MAX_DEPTH,
        include_transitive: bool = True,
    ) -> CallChainOut:
        max_depth = min(max_depth, settings.GRAPH_MAX_DEPTH)

        direct_callers_cypher = """
MATCH (n:CodeScopeNode {node_id: $node_id})<-[r:CALLS]-(caller:CodeScopeNode)
RETURN DISTINCT caller
LIMIT $limit
"""
        direct_callees_cypher = """
MATCH (n:CodeScopeNode {node_id: $node_id})-[r:CALLS]->(callee:CodeScopeNode)
RETURN DISTINCT callee
LIMIT $limit
"""
        transitive_callers_cypher = f"""
MATCH (n:CodeScopeNode {{node_id: $node_id}})<-[r:CALLS*2..{max_depth}]-(caller:CodeScopeNode)
WHERE caller.node_id <> $node_id
RETURN DISTINCT caller
LIMIT $limit
"""
        transitive_callees_cypher = f"""
MATCH (n:CodeScopeNode {{node_id: $node_id}})-[r:CALLS*2..{max_depth}]->(callee:CodeScopeNode)
WHERE callee.node_id <> $node_id
RETURN DISTINCT callee
LIMIT $limit
"""

        with neo4j_session() as session:
            root = _fetch_root_node(session, node_id)
            if root is None:
                raise APIError("Node not found in knowledge graph", 404)

            callers = [
                neo4j_record_to_node(dict(r["caller"]))
                for r in session.run(direct_callers_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
            ]
            callees = [
                neo4j_record_to_node(dict(r["callee"]))
                for r in session.run(direct_callees_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
            ]
            transitive_callers: list[GraphNodeOut] = []
            transitive_callees: list[GraphNodeOut] = []

            if include_transitive and max_depth > 1:
                transitive_callers = [
                    neo4j_record_to_node(dict(r["caller"]))
                    for r in session.run(transitive_callers_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
                ]
                transitive_callees = [
                    neo4j_record_to_node(dict(r["callee"]))
                    for r in session.run(transitive_callees_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
                ]

        return CallChainOut(
            node=root,
            callers=callers,
            callees=callees,
            transitive_callers=transitive_callers,
            transitive_callees=transitive_callees,
            caller_count=len(callers),
            callee_count=len(callees),
            transitive_caller_count=len(transitive_callers),
            transitive_callee_count=len(transitive_callees),
            max_depth=max_depth,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 7. ImportChainService
# ─────────────────────────────────────────────────────────────────────────────

class ImportChainService:
    """
    Import relationship analysis using IMPORTS relationships.

    importers          → incoming IMPORTS edges (who imports this file/module)
    importees          → outgoing IMPORTS edges (what this file/module imports)
    transitive_importers → full upstream import tree
    transitive_importees → full downstream import tree

    Answers:
      "Which files import this module?"       → importers
      "What modules does this file import?"   → importees
      "What is the full import fan-out?"      → transitive_importees
    """

    def get_import_chain(
        self,
        node_id: str,
        max_depth: int = settings.GRAPH_MAX_DEPTH,
        include_transitive: bool = True,
    ) -> ImportChainOut:
        max_depth = min(max_depth, settings.GRAPH_MAX_DEPTH)

        importers_cypher = """
MATCH (n:CodeScopeNode {node_id: $node_id})<-[r:IMPORTS]-(importer:CodeScopeNode)
RETURN DISTINCT importer
LIMIT $limit
"""
        importees_cypher = """
MATCH (n:CodeScopeNode {node_id: $node_id})-[r:IMPORTS]->(importee:CodeScopeNode)
RETURN DISTINCT importee
LIMIT $limit
"""
        transitive_importers_cypher = f"""
MATCH (n:CodeScopeNode {{node_id: $node_id}})<-[r:IMPORTS*2..{max_depth}]-(importer:CodeScopeNode)
WHERE importer.node_id <> $node_id
RETURN DISTINCT importer
LIMIT $limit
"""
        transitive_importees_cypher = f"""
MATCH (n:CodeScopeNode {{node_id: $node_id}})-[r:IMPORTS*2..{max_depth}]->(importee:CodeScopeNode)
WHERE importee.node_id <> $node_id
RETURN DISTINCT importee
LIMIT $limit
"""

        with neo4j_session() as session:
            root = _fetch_root_node(session, node_id)
            if root is None:
                raise APIError("Node not found in knowledge graph", 404)

            importers = [
                neo4j_record_to_node(dict(r["importer"]))
                for r in session.run(importers_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
            ]
            importees = [
                neo4j_record_to_node(dict(r["importee"]))
                for r in session.run(importees_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
            ]
            transitive_importers: list[GraphNodeOut] = []
            transitive_importees: list[GraphNodeOut] = []

            if include_transitive and max_depth > 1:
                transitive_importers = [
                    neo4j_record_to_node(dict(r["importer"]))
                    for r in session.run(transitive_importers_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
                ]
                transitive_importees = [
                    neo4j_record_to_node(dict(r["importee"]))
                    for r in session.run(transitive_importees_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
                ]

        return ImportChainOut(
            node=root,
            importers=importers,
            importees=importees,
            transitive_importers=transitive_importers,
            transitive_importees=transitive_importees,
            importer_count=len(importers),
            importee_count=len(importees),
            transitive_importer_count=len(transitive_importers),
            transitive_importee_count=len(transitive_importees),
            max_depth=max_depth,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 7.5. InheritanceChainService
# ─────────────────────────────────────────────────────────────────────────────

class InheritanceChainService:
    """
    Inheritance relationship analysis using INHERITS relationships.

    superclasses           → outgoing INHERITS edges (what this class inherits from)
    subclasses             → incoming INHERITS edges (who inherits from this class)
    transitive_superclasses → full upstream inheritance tree
    transitive_subclasses   → full downstream inheritance tree

    Answers:
      "Which classes inherit this class?"     → subclasses
      "What classes does this inherit from?"  → superclasses
    """

    def get_inheritance_chain(
        self,
        node_id: str,
        max_depth: int = settings.GRAPH_MAX_DEPTH,
        include_transitive: bool = True,
    ) -> InheritanceChainOut:
        max_depth = min(max_depth, settings.GRAPH_MAX_DEPTH)

        subclasses_cypher = """
MATCH (n:CodeScopeNode {node_id: $node_id})<-[r:INHERITS]-(subclass:CodeScopeNode)
RETURN DISTINCT subclass
LIMIT $limit
"""
        superclasses_cypher = """
MATCH (n:CodeScopeNode {node_id: $node_id})-[r:INHERITS]->(superclass:CodeScopeNode)
RETURN DISTINCT superclass
LIMIT $limit
"""
        transitive_subclasses_cypher = f"""
MATCH (n:CodeScopeNode {{node_id: $node_id}})<-[r:INHERITS*2..{max_depth}]-(subclass:CodeScopeNode)
WHERE subclass.node_id <> $node_id
RETURN DISTINCT subclass
LIMIT $limit
"""
        transitive_superclasses_cypher = f"""
MATCH (n:CodeScopeNode {{node_id: $node_id}})-[r:INHERITS*2..{max_depth}]->(superclass:CodeScopeNode)
WHERE superclass.node_id <> $node_id
RETURN DISTINCT superclass
LIMIT $limit
"""

        with neo4j_session() as session:
            root = _fetch_root_node(session, node_id)
            if root is None:
                raise APIError("Node not found in knowledge graph", 404)

            subclasses = [
                neo4j_record_to_node(dict(r["subclass"]))
                for r in session.run(subclasses_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
            ]
            superclasses = [
                neo4j_record_to_node(dict(r["superclass"]))
                for r in session.run(superclasses_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
            ]
            transitive_subclasses: list[GraphNodeOut] = []
            transitive_superclasses: list[GraphNodeOut] = []

            if include_transitive and max_depth > 1:
                transitive_subclasses = [
                    neo4j_record_to_node(dict(r["subclass"]))
                    for r in session.run(transitive_subclasses_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
                ]
                transitive_superclasses = [
                    neo4j_record_to_node(dict(r["superclass"]))
                    for r in session.run(transitive_superclasses_cypher, node_id=node_id, limit=_NEIGHBORHOOD_NODE_CAP).data()
                ]

        return InheritanceChainOut(
            node=root,
            superclasses=superclasses,
            subclasses=subclasses,
            transitive_superclasses=transitive_superclasses,
            transitive_subclasses=transitive_subclasses,
            superclass_count=len(superclasses),
            subclass_count=len(subclasses),
            transitive_superclass_count=len(transitive_superclasses),
            transitive_subclass_count=len(transitive_subclasses),
            max_depth=max_depth,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 8. GraphSummaryService
# ─────────────────────────────────────────────────────────────────────────────

class GraphSummaryService:
    """
    Repository-level intelligence overview.

    Runs five parallel Cypher queries against Neo4j and aggregates results
    into a GraphSummaryOut suitable for dashboard widgets, AI context
    builders, and the Architecture Explorer entry-point view.

    Queries:
      1. Hotspot nodes — top 10 nodes by total degree (coupling risk)
      2. Orphan nodes  — nodes with degree 0 (dead code candidates)
      3. Entry points  — nodes with no incoming edges (roots/initializers)
      4. Sink nodes    — nodes with no outgoing edges (leaves/utilities)
      5. Most imported — top 5 nodes by incoming IMPORTS edge count
      6. Most called   — top 5 nodes by incoming CALLS edge count
    """

    def summarize(self, repository_id: str) -> GraphSummaryOut:
        hotspot_cypher = """
MATCH (n:CodeScopeNode {repository_id: $repo})
WITH n,
     size((n)<--()) AS in_deg,
     size((n)-->()) AS out_deg,
     size((n)--()) AS total_deg
ORDER BY total_deg DESC
LIMIT 10
RETURN n, in_deg, out_deg, total_deg
"""
        orphan_cypher = """
MATCH (n:CodeScopeNode {repository_id: $repo})
WHERE size((n)--()) = 0
RETURN n
LIMIT 100
"""
        entry_cypher = """
MATCH (n:CodeScopeNode {repository_id: $repo})
WHERE size((n)<--()) = 0 AND size((n)-->()) > 0
RETURN n
LIMIT 50
"""
        sink_cypher = """
MATCH (n:CodeScopeNode {repository_id: $repo})
WHERE size((n)-->()) = 0 AND size((n)<--()) > 0
RETURN n
LIMIT 50
"""
        most_imported_cypher = """
MATCH (n:CodeScopeNode {repository_id: $repo})<-[r:IMPORTS]-()
WITH n, count(r) AS import_count
ORDER BY import_count DESC
LIMIT 5
RETURN n
"""
        most_called_cypher = """
MATCH (n:CodeScopeNode {repository_id: $repo})<-[r:CALLS]-()
WITH n, count(r) AS call_count
ORDER BY call_count DESC
LIMIT 5
RETURN n
"""
        count_cypher = """
MATCH (n:CodeScopeNode {repository_id: $repo})
OPTIONAL MATCH (n)-[r]->(:CodeScopeNode {repository_id: $repo})
RETURN count(DISTINCT n) AS total_nodes, count(r) AS total_edges
"""

        with neo4j_session() as session:
            counts = session.run(count_cypher, repo=repository_id).single()
            total_nodes = counts["total_nodes"] if counts else 0
            total_edges = counts["total_edges"] if counts else 0

            hotspot_records = session.run(hotspot_cypher, repo=repository_id).data()
            orphan_records = session.run(orphan_cypher, repo=repository_id).data()
            entry_records = session.run(entry_cypher, repo=repository_id).data()
            sink_records = session.run(sink_cypher, repo=repository_id).data()
            most_imported_records = session.run(most_imported_cypher, repo=repository_id).data()
            most_called_records = session.run(most_called_cypher, repo=repository_id).data()

        hotspots = [
            HotspotNode(
                node=neo4j_record_to_node(dict(r["n"])),
                in_degree=r["in_deg"],
                out_degree=r["out_deg"],
                total_degree=r["total_deg"],
            )
            for r in hotspot_records
        ]
        orphan_nodes = [neo4j_record_to_node(dict(r["n"])) for r in orphan_records]
        entry_points = [neo4j_record_to_node(dict(r["n"])) for r in entry_records]
        sink_nodes = [neo4j_record_to_node(dict(r["n"])) for r in sink_records]
        most_imported = [neo4j_record_to_node(dict(r["n"])) for r in most_imported_records]
        most_called = [neo4j_record_to_node(dict(r["n"])) for r in most_called_records]

        return GraphSummaryOut(
            repository_id=repository_id,
            total_nodes=total_nodes,
            total_edges=total_edges,
            hotspot_nodes=hotspots,
            orphan_count=len(orphan_nodes),
            orphan_nodes=orphan_nodes,
            entry_points=entry_points,
            sink_nodes=sink_nodes,
            most_imported=most_imported,
            most_called=most_called,
            entry_point_count=len(entry_points),
            sink_count=len(sink_nodes),
        )
