"""
app/modules/graph/router.py
────────────────────────────
FastAPI endpoints for the Knowledge Graph API.

All mutating routes validate repository ownership against PostgreSQL
before touching Neo4j, so multi-tenant isolation is never dependent on
Neo4j ACLs alone.

Neo4j 503 handling
──────────────────
Every endpoint catches neo4j driver errors and converts them into clean
503 responses so frontend clients can display a "Graph unavailable"
state without crashing.

Route prefix: /graph
"""

import logging

from fastapi import APIRouter, Depends, Query
from neo4j.exceptions import Neo4jError, ServiceUnavailable
from sqlalchemy.orm import Session

from app.core.exceptions import APIError
from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.auth.models import User
from app.modules.graph.repository import GraphRepository
from app.modules.graph.schemas import (
    GraphHealthOut,
    GraphNeighborsOut,
    GraphOut,
    GraphPathOut,
    GraphPathRequest,
    GraphSearchOut,
    GraphStatisticsOut,
    GraphSubgraphOut,
    GraphSyncRunOut,
    neo4j_record_to_node,
    sync_run_out,
)
from app.modules.graph.intelligence_schemas import (
    CallChainOut,
    DependencyChainOut,
    GraphSummaryOut,
    ImportChainOut,
    InheritanceChainOut,
    RelatedNodesOut,
    AllPathsOut,
)
from app.modules.graph.services import (
    GraphBuilderService,
    GraphHealthService,
    GraphQueryService,
    GraphSearchService,
    GraphStatisticsService,
)
from app.modules.graph.intelligence_services import (
    CallChainService,
    DependencyQueryService,
    GraphSummaryService,
    ImportChainService,
    InheritanceChainService,
    NeighborhoodService,
    PathFindingService,
)
from app.modules.repository.services import RepositoryValidationService
from app.shared_schemas import APIEnvelope

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/graph", tags=["Knowledge Graph"])


def _neo4j_unavailable(exc: Exception) -> APIError:
    logger.warning("Neo4j unavailable: %s", exc)
    return APIError("Knowledge graph is temporarily unavailable", 503, [str(exc)])


def _authorize_repo(db: Session, repository_id: str, user_id: str, write: bool = False):
    return RepositoryValidationService.repository_access(db, repository_id, user_id, write=write)


def _authorize_node(db: Session, node_id: str, user_id: str):
    node = GraphRepository.node_by_id(db, node_id)
    if node is None:
        raise APIError("Node not found", 404)
    _authorize_repo(db, node.repository_id, user_id)
    return node


# ─────────────────────────────────────────────────────────────────────────────
# POST /graph/build/{repository_id}
# Triggered manually; also called internally after each dependency build.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/build/{repository_id}", response_model=APIEnvelope[GraphSyncRunOut])
def build_graph(
    repository_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Sync the latest dependency build for a repository into Neo4j.
    Idempotent — safe to call multiple times.
    """
    _authorize_repo(db, repository_id, user.id, write=True)
    try:
        run = GraphBuilderService(db).build(repository_id, user.id, trigger="manual")
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    return APIEnvelope(success=True, message="Graph synchronised", data=sync_run_out(run))


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/{repository_id}
# Returns a paginated view of nodes and edges from Neo4j.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/repository/{repository_id}", response_model=APIEnvelope[GraphOut])
def get_graph(
    repository_id: str,
    limit_nodes: int = Query(2000, ge=1, le=10000),
    limit_edges: int = Query(5000, ge=1, le=50000),
    entity_type: str | None = Query(None, description="Filter nodes by entity_type"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_repo(db, repository_id, user.id)
    sync_run = GraphRepository.latest_sync_run(db, repository_id)

    type_filter = f"AND n.entity_type = '{entity_type}'" if entity_type else ""
    node_cypher = f"""
MATCH (n:CodeScopeNode {{repository_id: $repo}})
WHERE true {type_filter}
RETURN n
LIMIT $limit
"""
    edge_cypher = """
MATCH (src:CodeScopeNode {repository_id: $repo})-[r]->(tgt:CodeScopeNode {repository_id: $repo})
RETURN r, src.node_id AS src_id, tgt.node_id AS tgt_id
LIMIT $limit
"""
    try:
        from app.database.neo4j import neo4j_session
        from app.modules.graph.schemas import GraphEdgeOut, neo4j_record_to_node

        with neo4j_session() as session:
            node_result = session.run(node_cypher, repo=repository_id, limit=limit_nodes)
            nodes = [neo4j_record_to_node(dict(r["n"])) for r in node_result.data()]

            edge_result = session.run(edge_cypher, repo=repository_id, limit=limit_edges)
            edges = []
            for r in edge_result.data():
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
                        repository_id=props.get("repository_id", repository_id),
                    )
                )
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)

    return APIEnvelope(
        success=True,
        message="Graph retrieved",
        data=GraphOut(
            sync_run=sync_run_out(sync_run) if sync_run else None,
            nodes=nodes,
            edges=edges,
            total_nodes=len(nodes),
            total_edges=len(edges),
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/node/{node_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/node/{node_id}", response_model=APIEnvelope[dict])
def get_node(
    node_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_node(db, node_id, user.id)
    try:
        node = GraphQueryService().get_node(node_id)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    if node is None:
        raise APIError("Node not found in knowledge graph", 404)
    return APIEnvelope(success=True, message="Node retrieved", data=node.model_dump())


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/neighbors/{node_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/neighbors/{node_id}", response_model=APIEnvelope[GraphNeighborsOut])
def get_neighbors(
    node_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_node(db, node_id, user.id)
    try:
        result = GraphQueryService().get_neighbors(node_id)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    if result is None:
        raise APIError("Node not found in knowledge graph", 404)
    return APIEnvelope(success=True, message="Neighbors retrieved", data=result)


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/path
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/path", response_model=APIEnvelope[GraphPathOut])
def shortest_path(
    source_node_id: str = Query(...),
    target_node_id: str = Query(...),
    max_depth: int = Query(6, ge=1, le=15),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_node(db, source_node_id, user.id)
    _authorize_node(db, target_node_id, user.id)
    try:
        result = PathFindingService().shortest_path(source_node_id, target_node_id, max_depth)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
        
    if not result:
        return APIEnvelope(success=True, message="No path found", data=GraphPathOut(found=False))
        
    out = GraphPathOut(found=True, length=result.length, nodes=result.nodes, edges=result.edges)
    return APIEnvelope(success=True, message="Path found", data=out)


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/paths
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/paths", response_model=APIEnvelope[AllPathsOut])
def all_paths(
    source_node_id: str = Query(...),
    target_node_id: str = Query(...),
    max_depth: int = Query(5, ge=1, le=10),
    max_paths: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_node(db, source_node_id, user.id)
    _authorize_node(db, target_node_id, user.id)
    try:
        result = PathFindingService().all_paths(source_node_id, target_node_id, max_depth, max_paths)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    return APIEnvelope(success=True, message=f"{result.total_paths} paths found", data=result)


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/subgraph/{node_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/subgraph/{node_id}", response_model=APIEnvelope[GraphSubgraphOut])
def get_subgraph(
    node_id: str,
    depth: int = Query(2, ge=1, le=8),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_node(db, node_id, user.id)
    try:
        result = GraphQueryService().get_subgraph(node_id, depth)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    if result is None:
        raise APIError("Node not found in knowledge graph", 404)
    return APIEnvelope(success=True, message="Subgraph retrieved", data=result)


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/search
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/search", response_model=APIEnvelope[GraphSearchOut])
def search_graph(
    repository_id: str = Query(...),
    q: str = Query(..., min_length=1, max_length=256),
    entity_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_repo(db, repository_id, user.id)
    try:
        result = GraphSearchService().search(repository_id, q, entity_type, limit)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    return APIEnvelope(success=True, message=f"{result.total} result(s) found", data=result)


# ─────────────────────────────────────────────────────────────────────────────
# ── Phase 6 Intelligence Endpoints ───────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/dependencies/{node_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dependencies/{node_id}", response_model=APIEnvelope[DependencyChainOut])
def get_dependencies(
    node_id: str,
    max_depth: int = Query(8, ge=1, le=15),
    transitive: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_node(db, node_id, user.id)
    try:
        result = DependencyQueryService().get_dependencies(node_id, max_depth, transitive)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    return APIEnvelope(success=True, message="Dependencies retrieved", data=result)


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/call-chain/{node_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/call-chain/{node_id}", response_model=APIEnvelope[CallChainOut])
def get_call_chain(
    node_id: str,
    max_depth: int = Query(8, ge=1, le=15),
    include_transitive: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_node(db, node_id, user.id)
    try:
        result = CallChainService().get_call_chain(node_id, max_depth, include_transitive)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    return APIEnvelope(success=True, message="Call chain retrieved", data=result)


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/import-chain/{node_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/import-chain/{node_id}", response_model=APIEnvelope[ImportChainOut])
def get_import_chain(
    node_id: str,
    max_depth: int = Query(8, ge=1, le=15),
    include_transitive: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_node(db, node_id, user.id)
    try:
        result = ImportChainService().get_import_chain(node_id, max_depth, include_transitive)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    return APIEnvelope(success=True, message="Import chain retrieved", data=result)


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/inheritance-chain/{node_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/inheritance-chain/{node_id}", response_model=APIEnvelope[InheritanceChainOut])
def get_inheritance_chain(
    node_id: str,
    max_depth: int = Query(8, ge=1, le=15),
    include_transitive: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_node(db, node_id, user.id)
    try:
        result = InheritanceChainService().get_inheritance_chain(node_id, max_depth, include_transitive)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    return APIEnvelope(success=True, message="Inheritance chain retrieved", data=result)


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/related/{node_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/related/{node_id}", response_model=APIEnvelope[RelatedNodesOut])
def get_related_nodes(
    node_id: str,
    depth: int = Query(2, ge=1, le=8),
    direction: str = Query("both"),
    rel_types: list[str] = Query(default=[]),
    entity_types: list[str] = Query(default=[]),
    traversal_mode: str = Query("bfs"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_node(db, node_id, user.id)
    try:
        result = NeighborhoodService().get_neighborhood(
            node_id=node_id,
            depth=depth,
            direction=direction,
            rel_types=rel_types,
            entity_types=entity_types,
            traversal_mode=traversal_mode,
        )
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    return APIEnvelope(success=True, message="Related nodes retrieved", data=result)


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/summary/{repository_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/summary/{repository_id}", response_model=APIEnvelope[GraphSummaryOut])
def graph_summary(
    repository_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_repo(db, repository_id, user.id)
    try:
        result = GraphSummaryService().summarize(repository_id)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    return APIEnvelope(success=True, message="Graph summary retrieved", data=result)


# ─────────────────────────────────────────────────────────────────────────────
# ── Original Statistics & Health Endpoints ───────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/statistics/{repository_id}", response_model=APIEnvelope[GraphStatisticsOut])
def graph_statistics(
    repository_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _authorize_repo(db, repository_id, user.id)
    try:
        stats = GraphStatisticsService(db=db).calculate(repository_id)
    except (ServiceUnavailable, Neo4jError) as exc:
        raise _neo4j_unavailable(exc)
    return APIEnvelope(success=True, message="Graph statistics retrieved", data=stats)


# ─────────────────────────────────────────────────────────────────────────────
# GET /graph/health
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/health", response_model=APIEnvelope[GraphHealthOut])
def graph_health(user: User = Depends(get_current_user)):
    health = GraphHealthService.ping()
    status_code = 200 if health.is_healthy else 503
    return APIEnvelope(
        success=health.is_healthy,
        message="Neo4j is healthy" if health.is_healthy else "Neo4j is unavailable",
        data=health,
    )


# Keep the original Prompt 5 API shape, but register it last so static routes
# like /graph/health, /graph/search, and /graph/path are not shadowed.
router.add_api_route(
    "/{repository_id}",
    get_graph,
    methods=["GET"],
    response_model=APIEnvelope[GraphOut],
)
