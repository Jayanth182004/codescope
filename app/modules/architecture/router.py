from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.exceptions import APIError
from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.architecture.repository import ArchitectureRepository
from app.modules.architecture.schemas import (
    ArchitectureOverviewOut,
    anti_pattern_out,
    build_out,
    component_out,
    flow_out,
    metrics_out,
)
from app.modules.architecture.services import ArchitectureHealthService, ArchitectureInferenceService
from app.modules.auth.models import User
from app.modules.repository.services import RepositoryValidationService
from app.shared_schemas import APIEnvelope

router = APIRouter(prefix="/architecture", tags=["Architecture"])


def latest_authorized_build(db: Session, repository_id: str, user_id: str):
    RepositoryValidationService.repository_access(db, repository_id, user_id, write=False)
    build = ArchitectureRepository.latest_build(db, repository_id)
    if build is None:
        raise APIError("No architecture inference has been built for this repository", 404)
    return build


@router.post("/build/{repository_id}", response_model=APIEnvelope[dict])
def build_architecture(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = ArchitectureInferenceService(db).build(repository_id, user.id)
    return APIEnvelope(success=True, message="Architecture inferred", data=build_out(build).model_dump(mode="json"))


@router.get("/repository/{repository_id}", response_model=APIEnvelope[ArchitectureOverviewOut])
def architecture_overview(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    components = ArchitectureRepository.components(db, build.id)
    flows = ArchitectureRepository.flows(db, build.id)
    metrics = ArchitectureRepository.metrics(db, build.id)
    if metrics is None:
        raise APIError("Architecture metrics are unavailable", 404)
    anti_patterns = ArchitectureRepository.anti_patterns(db, build.id)
    layers = Counter(component.layer for component in components)
    return APIEnvelope(
        success=True,
        message="Architecture retrieved",
        data=ArchitectureOverviewOut(
            build=build_out(build),
            frameworks=build_out(build).frameworks,
            layers=dict(layers),
            components=[component_out(row) for row in components],
            request_flows=[flow_out(row) for row in flows],
            metrics=metrics_out(metrics),
            anti_patterns=[anti_pattern_out(row) for row in anti_patterns],
        ),
    )


@router.get("/layers/{repository_id}", response_model=APIEnvelope[dict])
def architecture_layers(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    components = ArchitectureRepository.components(db, build.id)
    grouped: dict[str, list] = {}
    for component in components:
        grouped.setdefault(component.layer, []).append(component_out(component).model_dump())
    return APIEnvelope(success=True, message="Architecture layers retrieved", data=grouped)


@router.get("/services/{repository_id}", response_model=APIEnvelope[list])
def architecture_services(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    rows = ArchitectureRepository.components(db, build.id, component_type="service")
    return APIEnvelope(success=True, message="Architecture services retrieved", data=[component_out(row) for row in rows])


@router.get("/routes/{repository_id}", response_model=APIEnvelope[list])
def architecture_routes(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    rows = [*ArchitectureRepository.components(db, build.id, layer="api"), *ArchitectureRepository.components(db, build.id, component_type="controller")]
    return APIEnvelope(success=True, message="Architecture routes retrieved", data=[component_out(row) for row in rows])


@router.get("/request-flows/{repository_id}", response_model=APIEnvelope[list])
def architecture_request_flows(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    rows = ArchitectureRepository.flows(db, build.id)
    return APIEnvelope(success=True, message="Architecture request flows retrieved", data=[flow_out(row) for row in rows])


@router.get("/metrics/{repository_id}", response_model=APIEnvelope[dict])
def architecture_metrics(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    metrics = ArchitectureRepository.metrics(db, build.id)
    if metrics is None:
        raise APIError("Architecture metrics are unavailable", 404)
    return APIEnvelope(success=True, message="Architecture metrics retrieved", data=metrics_out(metrics).model_dump())


@router.get("/health/{repository_id}", response_model=APIEnvelope[dict])
def architecture_health(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    metrics = ArchitectureRepository.metrics(db, build.id)
    if metrics is None:
        raise APIError("Architecture metrics are unavailable", 404)
    anti_patterns = ArchitectureRepository.anti_patterns(db, build.id)
    return APIEnvelope(success=True, message="Architecture health retrieved", data=ArchitectureHealthService().health(metrics, anti_patterns))


@router.get("/anti-patterns/{repository_id}", response_model=APIEnvelope[list])
def architecture_anti_patterns(repository_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = latest_authorized_build(db, repository_id, user.id)
    rows = ArchitectureRepository.anti_patterns(db, build.id)
    return APIEnvelope(success=True, message="Architecture anti-patterns retrieved", data=[anti_pattern_out(row) for row in rows])


router.add_api_route(
    "/{repository_id}",
    architecture_overview,
    methods=["GET"],
    response_model=APIEnvelope[ArchitectureOverviewOut],
)
