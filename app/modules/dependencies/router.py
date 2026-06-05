from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import APIError
from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.auth.models import User
from app.modules.dependencies.repository import DependencyRepository
from app.modules.dependencies.schemas import (
    BlastRadiusOut,
    DependencyBuildOut,
    DependencyGraphOut,
    DependencyMetricsOut,
    DependencyReportOut,
    DependencyTreeNode,
    build_out,
    cycle_out,
    edge_out,
    node_out,
)
from app.modules.dependencies.services import BlastRadiusService, DependencyCoordinatorService
from app.modules.repository.services import RepositoryValidationService
from app.shared_schemas import APIEnvelope

router = APIRouter(prefix="/dependencies", tags=["Dependencies"])


def latest_authorized_build(db: Session, repository_id: str, user_id: str):
    RepositoryValidationService.repository_access(db, repository_id, user_id, write=False)
    build = DependencyRepository.latest_build(db, repository_id)
    if build is None:
        raise APIError("No dependency graph has been built for this repository", 404)
    return build


def authorize_node(db: Session, node_id: str, user_id: str):
    node = DependencyRepository.node(db, node_id)
    if node is None:
        raise APIError("Dependency node not found", 404)
    RepositoryValidationService.repository_access(db, node.repository_id, user_id, write=False)
    return node


@router.post("/build/{repository_id}", response_model=APIEnvelope[DependencyBuildOut])
def build_dependencies(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = DependencyCoordinatorService(db).build(repository_id, user.id)
    return APIEnvelope(success=True, message="Dependency graph built", data=build_out(build))


@router.get("/node/{node_id}", response_model=APIEnvelope[dict])
def dependency_node(node_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    node = authorize_node(db, node_id, user.id)
    edges = DependencyRepository.node_edges(db, node.dependency_id, node.id)
    return APIEnvelope(
        success=True,
        message="Dependency node retrieved",
        data={
            "node": node_out(node),
            "incoming": [edge_out(edge) for edge in edges if edge.target_node_id == node.id],
            "outgoing": [edge_out(edge) for edge in edges if edge.source_node_id == node.id],
        },
    )


@router.get("/tree/{node_id}", response_model=APIEnvelope[DependencyTreeNode])
def dependency_tree(node_id: str, depth: int = Query(3, ge=1, le=8), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    root = authorize_node(db, node_id, user.id)

    def build_tree(node, remaining: int, seen: set[str]) -> DependencyTreeNode:
        if remaining == 0:
            return DependencyTreeNode(node=node_out(node))
        children = []
        edges = DependencyRepository.outgoing_edges(db, node.dependency_id, node.id)
        for edge in edges:
            if edge.target_node_id in seen:
                continue
            target = DependencyRepository.node(db, edge.target_node_id)
            if target:
                children.append(build_tree(target, remaining - 1, seen | {target.id}))
        return DependencyTreeNode(node=node_out(node), edges=[edge_out(edge) for edge in edges], children=children)

    return APIEnvelope(success=True, message="Dependency tree retrieved", data=build_tree(root, depth, {root.id}))


@router.get("/graph/{repository_id}", response_model=APIEnvelope[DependencyGraphOut])
def dependency_graph(repository_id: str, limit_nodes: int = Query(5000, ge=1, le=20000), limit_edges: int = Query(10000, ge=1, le=50000), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    nodes = DependencyRepository.nodes(db, build.id, limit_nodes)
    edges = DependencyRepository.edges(db, build.id, limit_edges)
    return APIEnvelope(
        success=True,
        message="Dependency graph retrieved",
        data=DependencyGraphOut(build=build_out(build), nodes=[node_out(row) for row in nodes], edges=[edge_out(row) for row in edges]),
    )


@router.get("/blast-radius/{node_id}", response_model=APIEnvelope[BlastRadiusOut])
def blast_radius(node_id: str, depth: int = Query(4, ge=1, le=8), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    root = authorize_node(db, node_id, user.id)
    result = BlastRadiusService(db).calculate(root.id, depth)
    affected = result["affected"]
    return APIEnvelope(
        success=True,
        message="Blast radius calculated",
        data=BlastRadiusOut(
            root=node_out(result["root"]),
            direct_dependencies=[node_out(row) for row in result["direct"]],
            indirect_dependencies=[node_out(row) for row in result["indirect"]],
            levels=result["levels"],
            affected_files=[node_out(row) for row in affected if row.entity_type == "file"],
            affected_classes=[node_out(row) for row in affected if row.entity_type == "class"],
            affected_functions=[node_out(row) for row in affected if row.entity_type == "function"],
            total_affected=len(affected),
        ),
    )


@router.get("/metrics/{repository_id}", response_model=APIEnvelope[DependencyMetricsOut])
def dependency_metrics(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    metrics = DependencyRepository.metrics(db, build.id)
    if metrics is None:
        raise APIError("Dependency metrics are unavailable", 404)
    return APIEnvelope(success=True, message="Dependency metrics retrieved", data=DependencyMetricsOut.model_validate(metrics))


@router.get("/cycles/{repository_id}", response_model=APIEnvelope[list])
def dependency_cycles(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    return APIEnvelope(success=True, message="Dependency cycles retrieved", data=[cycle_out(row) for row in DependencyRepository.cycles(db, build.id)])


@router.get("/{repository_id}", response_model=APIEnvelope[DependencyReportOut])
def dependency_report(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    metrics = DependencyRepository.metrics(db, build.id)
    cycles = DependencyRepository.cycles(db, build.id)
    return APIEnvelope(
        success=True,
        message="Dependency report retrieved",
        data=DependencyReportOut(
            build=build_out(build),
            metrics=DependencyMetricsOut.model_validate(metrics) if metrics else None,
            cycles=[cycle_out(row) for row in cycles],
        ),
    )
