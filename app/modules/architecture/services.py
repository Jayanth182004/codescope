from __future__ import annotations

import json
import logging
import re
import time
import uuid
from collections import Counter, defaultdict, deque
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.exceptions import APIError
from app.modules.architecture.models import (
    ArchitectureAntiPattern,
    ArchitectureBuild,
    ArchitectureComponent,
    ArchitectureMetric,
    ArchitectureRequestFlow,
)
from app.modules.architecture.repository import ArchitectureRepository
from app.modules.dependencies.models import DependencyEdge, DependencyNode
from app.modules.dependencies.repository import DependencyRepository
from app.modules.graph.repository import GraphRepository
from app.modules.repository.services import RepositoryValidationService

logger = logging.getLogger(__name__)


def new_id() -> str:
    return str(uuid.uuid4())


def dump(value) -> str:
    return json.dumps(value, separators=(",", ":"), sort_keys=True)


class FrameworkDetectionService:
    FRAMEWORK_HINTS = {
        "FastAPI": [r"\bfastapi\b", r"api[/\\].*\.py", r"routers?[/\\]", r"main\.py"],
        "Flask": [r"\bflask\b", r"app\.py"],
        "Django": [r"manage\.py$", r"settings\.py$", r"urls\.py$", r"models\.py$"],
        "Express": [r"express", r"routes?[/\\].*\.(js|ts)$", r"server\.(js|ts)$"],
        "NestJS": [r"\.controller\.ts$", r"\.service\.ts$", r"\.module\.ts$"],
        "React": [r"\.(jsx|tsx)$", r"components?[/\\]", r"src[/\\]main\.(jsx|tsx)$"],
        "Next.js": [r"next\.config\.", r"pages[/\\].*\.(js|jsx|ts|tsx)$", r"app[/\\].*page\.(js|jsx|ts|tsx)$"],
        "Spring Boot": [r"Application\.java", r"controller[/\\].*\.java", r"service[/\\].*\.java"],
    }

    def detect(self, nodes: list[DependencyNode]) -> list[str]:
        text = "\n".join(filter(None, [node.file_path or node.entity_key or node.name for node in nodes])).lower()
        detected = []
        for framework, patterns in self.FRAMEWORK_HINTS.items():
            if any(re.search(pattern.lower(), text) for pattern in patterns):
                detected.append(framework)
        return detected or ["Unknown"]


class LayerDetectionService:
    RULES = [
        ("configuration", "configuration", [r"(^|[/\\])(\.env|config|settings|constants)([/\\.]|$)", r"dockerfile$", r"compose\.ya?ml$"]),
        ("api_endpoint", "api", [r"routes?[/\\]", r"api[/\\]", r"urls\.py$", r"\.controller\.ts$"]),
        ("controller", "controller", [r"controllers?[/\\]", r"views\.py$", r"handlers?[/\\]"]),
        ("service", "service", [r"services?[/\\]", r"\.service\.", r"service\.py"]),
        ("repository", "repository", [r"repositories?[/\\]", r"repository\.py", r"dao[/\\]"]),
        ("database", "data", [r"models\.py", r"database[/\\]", r"migrations?[/\\]", r"schema\.sql"]),
        ("model", "domain", [r"domain[/\\]", r"entities[/\\]", r"models?[/\\]"]),
        ("schema", "domain", [r"schemas?[/\\]", r"serializers?[/\\]"]),
        ("worker", "infrastructure", [r"workers?[/\\]", r"jobs?[/\\]", r"tasks?[/\\]", r"schedulers?[/\\]"]),
        ("middleware", "infrastructure", [r"middlewares?[/\\]"]),
        ("component", "presentation", [r"components?[/\\]", r"pages?[/\\]", r"views?[/\\]", r"\.(jsx|tsx)$"]),
    ]

    def classify(self, node: DependencyNode) -> tuple[str, str, float]:
        haystack = f"{node.entity_type} {node.name} {node.label} {node.file_path or ''} {node.module or ''}".lower()
        for component_type, layer, patterns in self.RULES:
            if any(re.search(pattern, haystack) for pattern in patterns):
                return component_type, layer, 0.9
        if node.entity_type == "function":
            return "function", "domain", 0.55
        if node.entity_type == "class":
            return "class", "domain", 0.6
        if node.entity_type == "module":
            return "module", "domain", 0.5
        if node.entity_type == "file":
            return "file", "domain", 0.45
        return node.entity_type, "infrastructure", 0.4


class ServiceDetectionService:
    def __init__(self, layer_detector: LayerDetectionService | None = None):
        self.layer_detector = layer_detector or LayerDetectionService()

    def detect(self, build: ArchitectureBuild, nodes: list[DependencyNode], frameworks: list[str]) -> list[ArchitectureComponent]:
        primary_framework = next((fw for fw in frameworks if fw != "Unknown"), None)
        components = []
        for node in nodes:
            if node.entity_type not in {"file", "module", "class", "function", "api_endpoint", "service", "database"}:
                continue
            component_type, layer, confidence = self.layer_detector.classify(node)
            if node.entity_type in {"class", "function"} and component_type in {"class", "function"}:
                name_lower = node.name.lower()
                if "service" in name_lower:
                    component_type, layer, confidence = "service", "service", 0.85
                elif "repository" in name_lower or name_lower.endswith("repo"):
                    component_type, layer, confidence = "repository", "repository", 0.85
                elif "controller" in name_lower or "handler" in name_lower:
                    component_type, layer, confidence = "controller", "controller", 0.85
            components.append(
                ArchitectureComponent(
                    id=new_id(),
                    architecture_build_id=build.id,
                    repository_id=build.repository_id,
                    dependency_node_id=node.id,
                    name=node.label or node.name,
                    component_type=component_type,
                    layer=layer,
                    path=node.file_path,
                    framework=primary_framework,
                    confidence=confidence,
                    metadata_json=dump({"entity_type": node.entity_type, "entity_key": node.entity_key, "module": node.module}),
                )
            )
        return components


class RequestFlowService:
    ORDER = ["presentation", "api", "controller", "service", "repository", "data", "infrastructure"]

    def infer(self, build: ArchitectureBuild, components: list[ArchitectureComponent], edges: list[DependencyEdge]) -> list[ArchitectureRequestFlow]:
        by_node = {component.dependency_node_id: component for component in components if component.dependency_node_id}
        adjacency: dict[str, list[str]] = defaultdict(list)
        for edge in edges:
            if edge.source_node_id in by_node and edge.target_node_id in by_node:
                adjacency[edge.source_node_id].append(edge.target_node_id)

        entries = [c for c in components if c.layer in {"api", "controller", "presentation"}]
        flows = []
        for entry in entries[:25]:
            visited = {entry.dependency_node_id}
            queue = deque([(entry.dependency_node_id, [entry.dependency_node_id])])
            best_path = [entry.dependency_node_id]
            while queue:
                node_id, path = queue.popleft()
                if len(path) > len(best_path):
                    best_path = path
                if len(path) >= 6:
                    continue
                for next_id in adjacency.get(node_id, []):
                    if next_id not in visited:
                        visited.add(next_id)
                        queue.append((next_id, path + [next_id]))

            path_components = [by_node[node_id] for node_id in best_path if node_id in by_node]
            layers = []
            for layer in [c.layer for c in path_components]:
                if layer not in layers:
                    layers.append(layer)
            if len(layers) < 2 and entry.layer != "api":
                continue
            flows.append(
                ArchitectureRequestFlow(
                    id=new_id(),
                    architecture_build_id=build.id,
                    repository_id=build.repository_id,
                    name=f"{entry.name} request flow",
                    entry_component_id=entry.id,
                    component_ids_json=dump([c.id for c in path_components]),
                    layers_json=dump(layers),
                    confidence=0.7 if len(layers) >= 3 else 0.5,
                    metadata_json=dump({"inferred_from": "dependency_edges"}),
                )
            )
        return flows


class ArchitectureMetricsService:
    def calculate(self, build: ArchitectureBuild, components: list[ArchitectureComponent], edges: list[DependencyEdge]) -> ArchitectureMetric:
        layer_by_node = {c.dependency_node_id: c.layer for c in components if c.dependency_node_id}
        layer_counts = Counter(c.layer for c in components)
        cross_layer_edges = 0
        internal_edges = 0
        for edge in edges:
            source_layer = layer_by_node.get(edge.source_node_id)
            target_layer = layer_by_node.get(edge.target_node_id)
            if not source_layer or not target_layer:
                continue
            if source_layer == target_layer:
                internal_edges += 1
            else:
                cross_layer_edges += 1
        considered = cross_layer_edges + internal_edges
        coupling = round(cross_layer_edges / considered, 3) if considered else 0.0
        cohesion = round(internal_edges / considered, 3) if considered else 1.0
        complexity = round(len(layer_counts) * 2 + coupling * 30 + len(components) / 25, 2)
        health = max(0, min(100, int(100 - coupling * 35 - max(0, complexity - 20))))
        return ArchitectureMetric(
            id=new_id(),
            architecture_build_id=build.id,
            repository_id=build.repository_id,
            layer_count=len(layer_counts),
            layer_coupling=coupling,
            layer_cohesion=cohesion,
            service_count=sum(1 for c in components if c.component_type == "service"),
            controller_count=sum(1 for c in components if c.component_type == "controller"),
            repository_count=sum(1 for c in components if c.component_type == "repository"),
            api_count=sum(1 for c in components if c.layer == "api"),
            database_count=sum(1 for c in components if c.layer == "data"),
            architecture_complexity=complexity,
            health_score=health,
        )


class ArchitectureRecommendationService:
    def detect(self, build: ArchitectureBuild, components: list[ArchitectureComponent], edges: list[DependencyEdge], metric: ArchitectureMetric) -> list[ArchitectureAntiPattern]:
        findings = []
        layer_by_node = {c.dependency_node_id: c for c in components if c.dependency_node_id}
        illegal = []
        for edge in edges:
            source = layer_by_node.get(edge.source_node_id)
            target = layer_by_node.get(edge.target_node_id)
            if source and target and source.layer in {"presentation", "api", "controller"} and target.layer == "data":
                illegal.append({"source": source.name, "target": target.name, "relationship": edge.relationship_type})
        if illegal:
            findings.append(self._finding(build, "direct_database_access", "high", "Direct database access from upper layers", "Routes or controllers appear to depend directly on data-layer components.", "Introduce a service/repository boundary and route database access through it.", illegal[:10]))
        if metric.repository_count == 0 and metric.database_count > 0:
            findings.append(self._finding(build, "missing_repository_pattern", "medium", "Missing repository boundary", "Data-layer components exist but no repository components were detected.", "Add repository/DAO components to isolate persistence access.", []))
        if metric.layer_coupling > 0.65:
            findings.append(self._finding(build, "high_coupling", "high", "High cross-layer coupling", "Most relationships cross architecture layer boundaries.", "Reduce direct cross-layer dependencies and introduce stable interfaces.", [{"layer_coupling": metric.layer_coupling}]))
        for layer, count in Counter(c.layer for c in components).items():
            if count > 50:
                findings.append(self._finding(build, "large_layer", "medium", f"Large {layer} layer", f"The {layer} layer contains {count} inferred components.", "Split large areas into cohesive subsystems.", [{"layer": layer, "count": count}]))
        return findings

    def _finding(self, build: ArchitectureBuild, pattern_type: str, severity: str, title: str, description: str, recommendation: str, evidence: list) -> ArchitectureAntiPattern:
        return ArchitectureAntiPattern(
            id=new_id(),
            architecture_build_id=build.id,
            repository_id=build.repository_id,
            pattern_type=pattern_type,
            severity=severity,
            title=title,
            description=description,
            recommendation=recommendation,
            evidence_json=dump(evidence),
        )


class ArchitectureHealthService:
    def health(self, metric: ArchitectureMetric, anti_patterns: list[ArchitectureAntiPattern]) -> dict:
        penalties = {"critical": 20, "high": 12, "medium": 7, "low": 3}
        score = metric.health_score - sum(penalties.get(item.severity, 5) for item in anti_patterns)
        score = max(0, min(100, score))
        if score >= 85:
            risk = "low"
        elif score >= 65:
            risk = "medium"
        elif score >= 40:
            risk = "high"
        else:
            risk = "critical"
        return {"score": score, "risk": risk, "reasons": [item.title for item in anti_patterns] or ["No major architecture anti-patterns detected."]}


class ArchitectureInferenceService:
    def __init__(self, db: Session):
        self.db = db
        self.frameworks = FrameworkDetectionService()
        self.components = ServiceDetectionService()
        self.flows = RequestFlowService()
        self.metrics = ArchitectureMetricsService()
        self.recommendations = ArchitectureRecommendationService()

    def build(self, repository_id: str, user_id: str) -> ArchitectureBuild:
        RepositoryValidationService.repository_access(self.db, repository_id, user_id, write=True)
        dependency_build = GraphRepository.latest_dependency_build(self.db, repository_id)
        if dependency_build is None:
            raise APIError("No completed dependency graph is available for architecture inference", 404)

        started = time.perf_counter()
        build = ArchitectureBuild(
            id=new_id(),
            repository_id=repository_id,
            dependency_build_id=dependency_build.id,
            analysis_run_id=dependency_build.analysis_run_id,
            requested_by=user_id,
            status="running",
        )
        self.db.add(build)
        self.db.flush()
        logger.info("Architecture Build Started repository_id=%s build_id=%s", repository_id, build.id)
        try:
            nodes = DependencyRepository.nodes(self.db, dependency_build.id, limit=50_000)
            edges = DependencyRepository.edges(self.db, dependency_build.id, limit=200_000)
            if not nodes:
                raise APIError("Dependency graph has no nodes to infer architecture from", 422)

            frameworks = self.frameworks.detect(nodes)
            components = self.components.detect(build, nodes, frameworks)
            flows = self.flows.infer(build, components, edges)
            metric = self.metrics.calculate(build, components, edges)
            anti_patterns = self.recommendations.detect(build, components, edges, metric)

            build.frameworks_json = dump(frameworks)
            build.warnings_json = dump([] if frameworks != ["Unknown"] else ["No supported framework was confidently detected."])
            build.status = "completed_with_warnings" if frameworks == ["Unknown"] else "completed"
            build.completed_at = datetime.now(UTC)
            build.duration_ms = int((time.perf_counter() - started) * 1000)
            ArchitectureRepository.add_all(self.db, [*components, *flows, metric, *anti_patterns])
            self.db.commit()
            logger.info("Architecture Completed repository_id=%s build_id=%s duration_ms=%s", repository_id, build.id, build.duration_ms)
            return build
        except APIError:
            build.status = "failed"
            build.completed_at = datetime.now(UTC)
            build.duration_ms = int((time.perf_counter() - started) * 1000)
            self.db.commit()
            raise
        except Exception as exc:
            build.status = "failed"
            build.error_message = str(exc)
            build.completed_at = datetime.now(UTC)
            build.duration_ms = int((time.perf_counter() - started) * 1000)
            self.db.commit()
            logger.exception("Architecture inference failed repository_id=%s", repository_id)
            raise APIError("Architecture inference failed", 500, [str(exc)]) from exc
