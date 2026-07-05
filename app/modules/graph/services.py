"""
app/modules/graph/services.py
──────────────────────────────
All eight graph services for CodeScope AI's Knowledge Graph Engine.

Service boundaries
──────────────────
GraphBuilderService         Orchestrates the full sync pipeline.
NodeBuilderService          Maps DependencyNode rows → Neo4j MERGE dicts.
RelationshipBuilderService  Maps DependencyEdge rows → Neo4j MERGE dicts.
GraphSynchronizationService Handles batch writes and stale node cleanup.
GraphQueryService           Cypher read queries (node, neighbors, path, subgraph).
GraphSearchService          Full-text + label-type node search.
GraphStatisticsService      Aggregation queries (counts, degree, density).
GraphHealthService          Driver ping.

Architecture notes
──────────────────
• All Neo4j writes use MERGE + SET — fully idempotent.
• Nodes and edges are pushed in batches of GRAPH_BATCH_SIZE (default 500)
  using Cypher UNWIND to minimise round-trips.
• The entity_key field is used as the stable Neo4j merge key — it is
  derived from the dependency build and is stable across re-syncs.
• Stale nodes (belonging to superseded analysis_run_ids) are pruned after
  every successful sync to prevent unbounded graph growth.
• All Cypher labels include :CodeScopeNode as a base label so we can
  index shared properties across all node types (see neo4j.py indexes).
• This module does NOT own PostgreSQL transactions — the caller (router or
  DependencyCoordinatorService) manages the SQLAlchemy session lifecycle.
"""

import json
import logging
import time
from collections import defaultdict

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import APIError
from app.database.neo4j import check_health, neo4j_session
from app.modules.dependencies.models import DependencyEdge, DependencyNode
from app.modules.graph.models import GraphSyncRun
from app.modules.graph.repository import GraphRepository
from app.modules.graph.schemas import (
    GraphEdgeOut,
    GraphHealthOut,
    GraphNeighborsOut,
    GraphNodeOut,
    GraphPathOut,
    GraphSearchOut,
    GraphStatisticsOut,
    GraphSubgraphOut,
    NodeDistributionItem,
    RelationshipDistributionItem,
    neo4j_record_to_edge,
    neo4j_record_to_node,
)
from app.modules.repository.repository import new_id
from app.modules.repository.services import RepositoryValidationService

logger = logging.getLogger(__name__)

# ── Entity type → Neo4j label mapping ────────────────────────────────────────
# Each node receives TWO labels: :CodeScopeNode (base) + its specific label.
# This allows generic index scans AND type-specific queries simultaneously.

ENTITY_TYPE_TO_LABEL: dict[str, str] = {
    "repository": "Repository",
    "workspace": "Workspace",
    "project": "Project",
    "folder": "Folder",
    "file": "File",
    "package": "Package",
    "module": "Module",
    "class": "Class",
    "function": "Function",
    "method": "Method",
    "import": "Import",
    "api_endpoint": "APIEndpoint",
    "service": "Service",
    "controller": "Controller",
    "repository_layer": "RepositoryLayer",
    "database": "Database",
    "external_service": "ExternalService",
    "configuration": "Configuration",
    "env_var": "EnvironmentVariable",
}

# Relationship type → Neo4j relationship type (upper-snake-case per convention)
RELATIONSHIP_MAP: dict[str, str] = {
    "imports": "IMPORTS",
    "imported_by": "IMPORTED_BY",
    "calls": "CALLS",
    "called_by": "CALLED_BY",
    "uses": "USES",
    "used_by": "USED_BY",
    "contains": "CONTAINS",
    "belongs_to": "BELONGS_TO",
    "creates": "CREATES",
    "instantiates": "CREATES",       # treat as CREATES semantically
    "inherits": "INHERITS",
    "implements": "IMPLEMENTS",
    "decorates": "DECORATES",
    "references": "REFERENCES",
    "exports": "EXPOSES",
    "depends_on": "DEPENDS_ON",
    "reads": "READS",
    "writes": "WRITES",
    "authenticates": "AUTHENTICATES",
    "exposes": "EXPOSES",
}


# ─────────────────────────────────────────────────────────────────────────────
# 1. NodeBuilderService
# ─────────────────────────────────────────────────────────────────────────────

class NodeBuilderService:
    """
    Converts DependencyNode ORM rows into dicts suitable for Neo4j MERGE.
    Each dict is one element in an UNWIND batch.
    """

    @staticmethod
    def label_for(entity_type: str) -> str:
        return ENTITY_TYPE_TO_LABEL.get(entity_type, "Unknown")

    @staticmethod
    def to_neo4j_dict(node: DependencyNode) -> dict:
        meta: dict = json.loads(node.metadata_json or "{}")
        return {
            # Merge key — must be stable across re-syncs
            "entity_key": node.entity_key,
            # Identity
            "node_id": node.id,
            "entity_type": node.entity_type,
            "neo4j_label": NodeBuilderService.label_for(node.entity_type),
            # Display
            "name": node.name,
            "label": node.label,
            # Location
            "file_path": node.file_path or "",
            "module": node.module or "",
            "package": node.package or "",
            # Context
            "repository_id": node.repository_id,
            "analysis_run_id": node.analysis_run_id,
            "dependency_id": node.dependency_id,
            # Extra metadata
            "language": meta.get("language", ""),
            "is_async": meta.get("is_async", False),
            "is_package": meta.get("is_package", False),
            "internal": meta.get("internal", True),
            "synced_at": int(time.time()),
        }

    @classmethod
    def build_batch(cls, nodes: list[DependencyNode]) -> list[dict]:
        return [cls.to_neo4j_dict(node) for node in nodes]


# ─────────────────────────────────────────────────────────────────────────────
# 2. RelationshipBuilderService
# ─────────────────────────────────────────────────────────────────────────────

class RelationshipBuilderService:
    """
    Converts DependencyEdge ORM rows into dicts suitable for Neo4j MERGE.
    Relationships are matched by their source/target entity_key values so
    they remain stable across incremental re-syncs.
    """

    @staticmethod
    def neo4j_rel_type(relationship_type: str) -> str:
        return RELATIONSHIP_MAP.get(relationship_type, relationship_type.upper())

    @staticmethod
    def to_neo4j_dict(
        edge: DependencyEdge,
        source_key: str,
        target_key: str,
    ) -> dict:
        return {
            "edge_id": edge.id,
            "source_key": source_key,
            "target_key": target_key,
            "neo4j_rel_type": RelationshipBuilderService.neo4j_rel_type(edge.relationship_type),
            "relationship_type": edge.relationship_type,
            "source_type": edge.source_type,
            "target_type": edge.target_type,
            "weight": edge.weight,
            "depth": edge.depth,
            "repository_id": edge.repository_id,
            "analysis_run_id": edge.analysis_run_id,
            "synced_at": int(time.time()),
        }

    @classmethod
    def build_batch(
        cls,
        edges: list[DependencyEdge],
        node_id_to_key: dict[str, str],
    ) -> list[dict]:
        result = []
        for edge in edges:
            source_key = node_id_to_key.get(edge.source_node_id)
            target_key = node_id_to_key.get(edge.target_node_id)
            if source_key and target_key:
                result.append(cls.to_neo4j_dict(edge, source_key, target_key))
        return result


# ─────────────────────────────────────────────────────────────────────────────
# 3. GraphSynchronizationService
# ─────────────────────────────────────────────────────────────────────────────

class GraphSynchronizationService:
    """
    Pushes nodes and edges into Neo4j in batches.

    Node MERGE strategy
    ───────────────────
    MERGE on (entity_key, repository_id) — the stable composite key.
    On match: overwrite mutable properties (name, label, synced_at, …).
    On create: set all properties.

    Relationship MERGE strategy
    ───────────────────────────
    MERGE on (source entity_key) -[rel_type]-> (target entity_key).
    On match: overwrite weight, depth, synced_at.

    Stale cleanup
    ─────────────
    After a successful sync, nodes whose analysis_run_id differs from the
    current run are pruned with DETACH DELETE — this handles repository
    re-analysis correctly.
    """

    # Cypher template for node batch upsert
    _NODE_MERGE_CYPHER = """
UNWIND $batch AS props
MERGE (n:CodeScopeNode {entity_key: props.entity_key, repository_id: props.repository_id})
  ON CREATE SET
    n.node_id            = props.node_id,
    n.entity_type        = props.entity_type,
    n.name               = props.name,
    n.label              = props.label,
    n.file_path          = props.file_path,
    n.module             = props.module,
    n.package            = props.package,
    n.language           = props.language,
    n.is_async           = props.is_async,
    n.is_package         = props.is_package,
    n.internal           = props.internal,
    n.analysis_run_id    = props.analysis_run_id,
    n.dependency_id      = props.dependency_id,
    n.synced_at          = props.synced_at
  ON MATCH SET
    n.node_id            = props.node_id,
    n.name               = props.name,
    n.label              = props.label,
    n.file_path          = props.file_path,
    n.language           = props.language,
    n.analysis_run_id    = props.analysis_run_id,
    n.dependency_id      = props.dependency_id,
    n.synced_at          = props.synced_at
"""

    # Dynamic relationship MERGE — relationship type is injected per batch
    # grouped by rel type to keep Cypher simple and avoid APOC dependency.
    _REL_MERGE_CYPHER_TEMPLATE = """
UNWIND $batch AS props
MATCH (src:CodeScopeNode {{entity_key: props.source_key, repository_id: props.repository_id}})
MATCH (tgt:CodeScopeNode {{entity_key: props.target_key, repository_id: props.repository_id}})
MERGE (src)-[r:{rel_type}]->(tgt)
  ON CREATE SET
    r.edge_id            = props.edge_id,
    r.relationship_type  = props.relationship_type,
    r.source_type        = props.source_type,
    r.target_type        = props.target_type,
    r.weight             = props.weight,
    r.depth              = props.depth,
    r.repository_id      = props.repository_id,
    r.analysis_run_id    = props.analysis_run_id,
    r.synced_at          = props.synced_at
  ON MATCH SET
    r.weight             = props.weight,
    r.depth              = props.depth,
    r.analysis_run_id    = props.analysis_run_id,
    r.synced_at          = props.synced_at
"""

    _STALE_CLEANUP_CYPHER = """
MATCH (n:CodeScopeNode {repository_id: $repository_id})
WHERE n.analysis_run_id <> $current_analysis_run_id
DETACH DELETE n
RETURN count(n) AS pruned
"""

    def __init__(self, batch_size: int = settings.GRAPH_BATCH_SIZE):
        self.batch_size = batch_size

    def sync_nodes(self, node_dicts: list[dict]) -> int:
        """Push all nodes to Neo4j in batches. Returns total nodes synced."""
        total = 0
        with neo4j_session() as session:
            for i in range(0, len(node_dicts), self.batch_size):
                chunk = node_dicts[i : i + self.batch_size]
                session.run(self._NODE_MERGE_CYPHER, batch=chunk)
                total += len(chunk)
                logger.debug("Nodes synced batch offset=%d count=%d", i, len(chunk))
        return total

    def sync_relationships(self, edge_dicts: list[dict]) -> int:
        """
        Push edges grouped by relationship type (one UNWIND per type).
        Returns total edges synced.
        """
        # Group edges by their Neo4j relationship type
        grouped: dict[str, list[dict]] = defaultdict(list)
        for edge_dict in edge_dicts:
            grouped[edge_dict["neo4j_rel_type"]].append(edge_dict)

        total = 0
        with neo4j_session() as session:
            for rel_type, edges in grouped.items():
                cypher = self._REL_MERGE_CYPHER_TEMPLATE.format(rel_type=rel_type)
                for i in range(0, len(edges), self.batch_size):
                    chunk = edges[i : i + self.batch_size]
                    session.run(cypher, batch=chunk)
                    total += len(chunk)
        return total

    def prune_stale_nodes(self, repository_id: str, current_analysis_run_id: str) -> int:
        """
        Remove nodes from superseded analysis runs for this repository.
        Returns count of pruned nodes.
        """
        try:
            with neo4j_session() as session:
                result = session.run(
                    self._STALE_CLEANUP_CYPHER,
                    repository_id=repository_id,
                    current_analysis_run_id=current_analysis_run_id,
                )
                record = result.single()
                pruned = record["pruned"] if record else 0
                if pruned:
                    logger.info(
                        "Stale nodes pruned repository_id=%s pruned=%d", repository_id, pruned
                    )
                return pruned
        except Exception as exc:
            logger.warning("Stale node pruning failed (non-fatal): %s", exc)
            return 0


# ─────────────────────────────────────────────────────────────────────────────
# 4. GraphBuilderService (orchestrator)
# ─────────────────────────────────────────────────────────────────────────────

class GraphBuilderService:
    """
    Orchestrates the full sync pipeline for one repository:
      1. Resolve latest dependency build from PostgreSQL.
      2. Fetch nodes + edges in pages.
      3. Convert to Neo4j dicts via NodeBuilderService / RelationshipBuilderService.
      4. Push via GraphSynchronizationService.
      5. Prune stale nodes.
      6. Persist GraphSyncRun outcome in PostgreSQL.

    Designed to run synchronously for the MVP. When Celery is introduced,
    only the caller changes — this service has no async or transport concerns.
    """

    def __init__(self, db: Session):
        self.db = db
        self.sync_svc = GraphSynchronizationService()

    def build(
        self,
        repository_id: str,
        user_id: str,
        trigger: str = "dependency_build",
    ) -> GraphSyncRun:
        # ── 1. Resolve dependency build ──────────────────────────────────────
        dep_build = GraphRepository.latest_dependency_build(self.db, repository_id)
        if dep_build is None:
            raise APIError(
                "No completed dependency build found. Run dependency extraction first.", 404
            )

        run = GraphRepository.create_sync_run(
            self.db,
            sync_run_id=new_id(),
            repository_id=repository_id,
            dependency_build_id=dep_build.id,
            analysis_run_id=dep_build.analysis_run_id,
            requested_by=user_id,
            trigger=trigger,
        )
        self.db.commit()

        started = time.perf_counter()
        logger.info(
            "Graph Sync Started repository_id=%s dependency_build_id=%s",
            repository_id,
            dep_build.id,
        )

        try:
            # ── 2. Fetch nodes ───────────────────────────────────────────────
            all_nodes = GraphRepository.nodes_for_build(self.db, dep_build.id, limit=200_000)
            all_edges = GraphRepository.edges_for_build(self.db, dep_build.id, limit=1_000_000)

            # ── 3. Build Neo4j dicts ─────────────────────────────────────────
            node_dicts = NodeBuilderService.build_batch(all_nodes)
            node_id_to_key = {n.id: n.entity_key for n in all_nodes}
            edge_dicts = RelationshipBuilderService.build_batch(all_edges, node_id_to_key)

            # ── 4. Sync to Neo4j ─────────────────────────────────────────────
            nodes_synced = self.sync_svc.sync_nodes(node_dicts)
            edges_synced = self.sync_svc.sync_relationships(edge_dicts)

            # ── 5. Prune stale ───────────────────────────────────────────────
            pruned = self.sync_svc.prune_stale_nodes(repository_id, dep_build.analysis_run_id)
            status = "completed_stale" if pruned else "completed"

            # ── 6. Persist outcome ───────────────────────────────────────────
            duration_ms = int((time.perf_counter() - started) * 1000)
            run = GraphRepository.complete_sync_run(
                self.db,
                run,
                status=status,
                nodes_synced=nodes_synced,
                edges_synced=edges_synced,
                nodes_pruned=pruned,
                duration_ms=duration_ms,
            )
            self.db.commit()
            self.db.refresh(run)

            logger.info(
                "Graph Sync Completed repository_id=%s nodes=%d edges=%d pruned=%d duration_ms=%d",
                repository_id,
                nodes_synced,
                edges_synced,
                pruned,
                duration_ms,
            )
            return run

        except Exception as exc:
            self.db.rollback()
            duration_ms = int((time.perf_counter() - started) * 1000)
            try:
                run = self.db.get(GraphSyncRun, run.id)
                if run:
                    GraphRepository.complete_sync_run(
                        self.db,
                        run,
                        status="failed",
                        error_message=str(exc),
                        duration_ms=duration_ms,
                    )
                    self.db.commit()
            except Exception:
                pass
            logger.exception("Graph Sync Failed repository_id=%s", repository_id)
            if isinstance(exc, APIError):
                raise
            raise APIError("Graph synchronisation failed", 500, [str(exc)]) from exc


# ─────────────────────────────────────────────────────────────────────────────
# 5. GraphQueryService
# ─────────────────────────────────────────────────────────────────────────────

class GraphQueryService:
    """Cypher read queries: node, neighbors, subgraph, shortest path."""

    @staticmethod
    def _node_from_neo4j(record) -> GraphNodeOut:
        node = record["n"]
        return neo4j_record_to_node(dict(node))

    def get_node(self, node_id: str) -> GraphNodeOut | None:
        """Fetch a single node by its internal node_id."""
        with neo4j_session() as session:
            result = session.run(
                "MATCH (n:CodeScopeNode {node_id: $node_id}) RETURN n LIMIT 1",
                node_id=node_id,
            )
            record = result.single()
            return neo4j_record_to_node(dict(record["n"])) if record else None

    def get_neighbors(self, node_id: str) -> GraphNeighborsOut | None:
        with neo4j_session() as session:
            # Outgoing
            out_result = session.run(
                """
                MATCH (src:CodeScopeNode {node_id: $node_id})-[r]->(tgt:CodeScopeNode)
                RETURN tgt AS n, r AS rel, src.node_id AS src_id
                LIMIT 500
                """,
                node_id=node_id,
            )
            out_records = out_result.data()

            # Incoming
            in_result = session.run(
                """
                MATCH (src:CodeScopeNode)-[r]->(tgt:CodeScopeNode {node_id: $node_id})
                RETURN src AS n, r AS rel, tgt.node_id AS tgt_id
                LIMIT 500
                """,
                node_id=node_id,
            )
            in_records = in_result.data()

            # Root
            root_result = session.run(
                "MATCH (n:CodeScopeNode {node_id: $node_id}) RETURN n LIMIT 1",
                node_id=node_id,
            )
            root_record = root_result.single()
            if not root_record:
                return None

        root = neo4j_record_to_node(dict(root_record["n"]))

        def _edge(rec, src_id: str, tgt_id: str) -> GraphEdgeOut:
            rel = rec["rel"]
            props = dict(rel)
            return GraphEdgeOut(
                edge_id=props.get("edge_id", ""),
                source_node_id=src_id,
                target_node_id=tgt_id,
                relationship_type=props.get("relationship_type", rel.type),
                source_type=props.get("source_type", ""),
                target_type=props.get("target_type", ""),
                weight=float(props.get("weight", 1.0)),
                depth=int(props.get("depth", 1)),
                repository_id=props.get("repository_id", ""),
                properties=props,
            )

        outgoing_nodes = [neo4j_record_to_node(dict(r["n"])) for r in out_records]
        incoming_nodes = [neo4j_record_to_node(dict(r["n"])) for r in in_records]
        outgoing_edges = [_edge(r, node_id, dict(r["n"])["node_id"]) for r in out_records]
        incoming_edges = [_edge(r, dict(r["n"])["node_id"], node_id) for r in in_records]

        return GraphNeighborsOut(
            root=root,
            incoming=incoming_nodes,
            outgoing=outgoing_nodes,
            incoming_edges=incoming_edges,
            outgoing_edges=outgoing_edges,
        )

    def shortest_path(
        self,
        source_node_id: str,
        target_node_id: str,
        max_depth: int = 6,
    ) -> GraphPathOut:
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
            return GraphPathOut(found=False)

        path_nodes = [neo4j_record_to_node(dict(n)) for n in record["path_nodes"]]
        path_rels: list[GraphEdgeOut] = []
        nodes_list = record["path_nodes"]
        for idx, rel in enumerate(record["path_rels"]):
            props = dict(rel)
            src_id = dict(nodes_list[idx]).get("node_id", "")
            tgt_id = dict(nodes_list[idx + 1]).get("node_id", "")
            path_rels.append(
                GraphEdgeOut(
                    edge_id=props.get("edge_id", ""),
                    source_node_id=src_id,
                    target_node_id=tgt_id,
                    relationship_type=props.get("relationship_type", rel.type),
                    source_type=props.get("source_type", ""),
                    target_type=props.get("target_type", ""),
                    weight=float(props.get("weight", 1.0)),
                    depth=int(props.get("depth", 1)),
                    repository_id=props.get("repository_id", ""),
                )
            )

        return GraphPathOut(found=True, length=len(path_rels), nodes=path_nodes, edges=path_rels)

    def get_subgraph(
        self,
        node_id: str,
        depth: int = 2,
    ) -> GraphSubgraphOut | None:
        depth = min(depth, settings.GRAPH_MAX_DEPTH)
        cypher = f"""
MATCH path = (root:CodeScopeNode {{node_id: $node_id}})-[*0..{depth}]->(n:CodeScopeNode)
WITH collect(DISTINCT n) AS all_nodes
UNWIND all_nodes AS node
RETURN node
LIMIT {settings.GRAPH_MAX_SUBGRAPH_NODES}
"""
        edge_cypher = f"""
MATCH (root:CodeScopeNode {{node_id: $node_id}})-[*0..{depth}]->(src:CodeScopeNode)-[r]->(tgt:CodeScopeNode)
WHERE (root:CodeScopeNode {{node_id: $node_id}})-[*0..{depth}]->(tgt)
RETURN r, src.node_id AS src_id, tgt.node_id AS tgt_id
LIMIT {settings.GRAPH_MAX_SUBGRAPH_NODES * 3}
"""
        with neo4j_session() as session:
            root_result = session.run(
                "MATCH (n:CodeScopeNode {node_id: $node_id}) RETURN n LIMIT 1", node_id=node_id
            )
            root_record = root_result.single()
            if not root_record:
                return None

            node_result = session.run(cypher, node_id=node_id)
            node_records = node_result.data()
            edge_result = session.run(edge_cypher, node_id=node_id)
            edge_records = edge_result.data()

        root = neo4j_record_to_node(dict(root_record["n"]))
        nodes = [neo4j_record_to_node(dict(r["node"])) for r in node_records]
        edges = []
        for r in edge_records:
            rel = r["r"]
            props = dict(rel)
            edges.append(
                GraphEdgeOut(
                    edge_id=props.get("edge_id", ""),
                    source_node_id=r["src_id"],
                    target_node_id=r["tgt_id"],
                    relationship_type=props.get("relationship_type", rel.type),
                    source_type=props.get("source_type", ""),
                    target_type=props.get("target_type", ""),
                    weight=float(props.get("weight", 1.0)),
                    depth=int(props.get("depth", 1)),
                    repository_id=props.get("repository_id", ""),
                )
            )

        return GraphSubgraphOut(
            root=root,
            nodes=nodes,
            edges=edges,
            depth=depth,
            node_count=len(nodes),
            edge_count=len(edges),
        )


# ─────────────────────────────────────────────────────────────────────────────
# 6. GraphSearchService
# ─────────────────────────────────────────────────────────────────────────────

class GraphSearchService:
    """
    Full-text and attribute-based node search using the cs_name_fulltext index.
    Falls back to CONTAINS scan if the full-text index is unavailable.
    """

    _FULLTEXT_CYPHER = """
CALL db.index.fulltext.queryNodes('cs_name_fulltext', $query)
YIELD node, score
WHERE node.repository_id = $repository_id
RETURN node
ORDER BY score DESC
LIMIT $limit
"""

    _FALLBACK_CYPHER = """
MATCH (n:CodeScopeNode)
WHERE n.repository_id = $repository_id
  AND (toLower(n.name) CONTAINS toLower($query)
       OR toLower(n.label) CONTAINS toLower($query)
       OR toLower(n.entity_key) CONTAINS toLower($query))
RETURN n AS node
LIMIT $limit
"""

    def search(
        self,
        repository_id: str,
        query: str,
        entity_type: str | None = None,
        limit: int = 50,
    ) -> GraphSearchOut:
        nodes: list[GraphNodeOut] = []
        try:
            with neo4j_session() as session:
                result = session.run(
                    self._FULLTEXT_CYPHER,
                    query=query,
                    repository_id=repository_id,
                    limit=limit * 2,  # over-fetch for type filtering
                )
                records = result.data()
            nodes = [neo4j_record_to_node(dict(r["node"])) for r in records]
        except Exception:
            # Full-text index not yet created — use CONTAINS fallback
            with neo4j_session() as session:
                result = session.run(
                    self._FALLBACK_CYPHER,
                    query=query,
                    repository_id=repository_id,
                    limit=limit * 2,
                )
                records = result.data()
            nodes = [neo4j_record_to_node(dict(r["node"])) for r in records]

        if entity_type:
            nodes = [n for n in nodes if n.entity_type == entity_type]

        nodes = nodes[:limit]
        return GraphSearchOut(query=query, results=nodes, total=len(nodes))


# ─────────────────────────────────────────────────────────────────────────────
# 7. GraphStatisticsService
# ─────────────────────────────────────────────────────────────────────────────

class GraphStatisticsService:
    """
    Aggregation queries for graph statistics.
    All queries are scoped to a single repository_id so multi-tenant safety
    is preserved at the query level.

    Largest Connected Component (LCC)
    ──────────────────────────────────
    LCC is calculated in Python using a BFS on an undirected adjacency list
    built from the dependency_edges table in PostgreSQL. This avoids the
    Neo4j GDS plugin requirement (not available on Community Edition) while
    still being correct and efficient for graphs up to ~100k nodes.

    The graph is treated as undirected for WCC (Weakly Connected Component)
    analysis — the standard approach for LCC in dependency graphs where
    direction represents flow rather than reachability boundaries.
    """

    def __init__(self, db=None):
        # db is optional: only required for LCC calculation.
        # If not provided, LCC is returned as None gracefully.
        self._db = db

    @staticmethod
    def _compute_lcc(node_ids: list[str], edge_pairs: list[tuple[str, str]]) -> int:
        """
        BFS-based Weakly Connected Components on an undirected adjacency list.
        Returns the size of the largest component.
        Time:  O(N + E)
        Space: O(N + E)
        """
        if not node_ids:
            return 0

        # Build undirected adjacency list
        adjacency: dict[str, list[str]] = {node_id: [] for node_id in node_ids}
        for src, tgt in edge_pairs:
            if src in adjacency and tgt in adjacency:
                adjacency[src].append(tgt)
                adjacency[tgt].append(src)

        visited: set[str] = set()
        largest = 0

        for start in node_ids:
            if start in visited:
                continue
            # BFS from this unvisited node
            component_size = 0
            queue = [start]
            visited.add(start)
            while queue:
                current = queue.pop()
                component_size += 1
                for neighbour in adjacency.get(current, []):
                    if neighbour not in visited:
                        visited.add(neighbour)
                        queue.append(neighbour)
            largest = max(largest, component_size)

        return largest

    def calculate(self, repository_id: str) -> GraphStatisticsOut:
        with neo4j_session() as session:
            # Total counts
            counts = session.run(
                """
                MATCH (n:CodeScopeNode {repository_id: $repo})
                OPTIONAL MATCH (n)-[r]->(:CodeScopeNode {repository_id: $repo})
                RETURN count(DISTINCT n) AS total_nodes, count(r) AS total_rels
                """,
                repo=repository_id,
            ).single()

            total_nodes = counts["total_nodes"] if counts else 0
            total_rels = counts["total_rels"] if counts else 0

            # Node distribution by entity_type
            node_dist_result = session.run(
                """
                MATCH (n:CodeScopeNode {repository_id: $repo})
                RETURN n.entity_type AS entity_type, count(n) AS cnt
                ORDER BY cnt DESC
                """,
                repo=repository_id,
            )
            node_distribution = [
                NodeDistributionItem(entity_type=r["entity_type"], count=r["cnt"])
                for r in node_dist_result.data()
            ]

            # Relationship distribution
            rel_dist_result = session.run(
                """
                MATCH (src:CodeScopeNode {repository_id: $repo})-[r]->(:CodeScopeNode)
                RETURN r.relationship_type AS rel_type, count(r) AS cnt
                ORDER BY cnt DESC
                """,
                repo=repository_id,
            )
            rel_distribution = [
                RelationshipDistributionItem(relationship_type=r["rel_type"], count=r["cnt"])
                for r in rel_dist_result.data()
            ]

            # Most connected node (by total degree)
            most_connected_result = session.run(
                """
                MATCH (n:CodeScopeNode {repository_id: $repo})
                WITH n, size((n)--()) AS degree
                ORDER BY degree DESC
                LIMIT 1
                RETURN n, degree
                """,
                repo=repository_id,
            ).single()

            most_connected: GraphNodeOut | None = None
            most_connected_degree = 0
            if most_connected_result:
                most_connected = neo4j_record_to_node(dict(most_connected_result["n"]))
                most_connected_degree = most_connected_result["degree"]

            # Average degree
            avg_result = session.run(
                """
                MATCH (n:CodeScopeNode {repository_id: $repo})
                WITH n, size((n)--()) AS degree
                RETURN avg(degree) AS avg_degree
                """,
                repo=repository_id,
            ).single()
            avg_degree = float(avg_result["avg_degree"] or 0.0) if avg_result else 0.0

        # Graph density: E / (N * (N-1)) for directed graph
        density = (
            round(total_rels / max(total_nodes * (total_nodes - 1), 1), 6)
            if total_nodes > 1
            else 0.0
        )

        # ── Largest Connected Component (BFS on PostgreSQL data) ─────────────
        # Uses the dependency_edges table from Phase 4 — no GDS plugin needed.
        lcc_size: int | None = None
        if self._db is not None:
            try:
                node_ids = GraphRepository.node_ids_for_repository(self._db, repository_id)
                edge_pairs = GraphRepository.edge_pairs_for_repository(self._db, repository_id)
                lcc_size = self._compute_lcc(node_ids, edge_pairs)
                logger.debug(
                    "LCC calculated repository_id=%s lcc_size=%d total_nodes=%d",
                    repository_id, lcc_size, len(node_ids),
                )
            except Exception as exc:
                logger.warning("LCC calculation failed (non-fatal): %s", exc)
                lcc_size = None

        return GraphStatisticsOut(
            repository_id=repository_id,
            total_nodes=total_nodes,
            total_relationships=total_rels,
            node_distribution=node_distribution,
            relationship_distribution=rel_distribution,
            most_connected_node=most_connected,
            most_connected_degree=most_connected_degree,
            average_degree=avg_degree,
            graph_density=density,
            largest_connected_component_size=lcc_size,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 8. GraphHealthService
# ─────────────────────────────────────────────────────────────────────────────

class GraphHealthService:
    @staticmethod
    def ping() -> GraphHealthOut:
        result = check_health()
        return GraphHealthOut(**result)
