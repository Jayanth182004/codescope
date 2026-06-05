import json
import logging
import time
from collections import Counter, defaultdict, deque
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.core.exceptions import APIError
from app.modules.analysis.models import (
    AnalysisRun,
    RepositoryClass,
    RepositoryFile,
    RepositoryFunction,
    RepositoryImport,
    RepositoryModule,
)
from app.modules.analysis.repository import AnalysisRepository
from app.modules.dependencies.models import (
    DependencyBuild,
    DependencyCycle,
    DependencyEdge,
    DependencyMetrics,
    DependencyNode,
)
from app.modules.dependencies.repository import DependencyRepository
from app.modules.repository.repository import new_id
from app.modules.repository.services import RepositoryActivityService, RepositoryValidationService

logger = logging.getLogger(__name__)

REL_IMPORTS = "imports"
REL_IMPORTED_BY = "imported_by"
REL_CALLS = "calls"
REL_CALLED_BY = "called_by"
REL_USES = "uses"
REL_USED_BY = "used_by"
REL_CREATES = "creates"
REL_INSTANTIATES = "instantiates"
REL_INHERITS = "inherits"
REL_IMPLEMENTS = "implements"
REL_DECORATES = "decorates"
REL_REFERENCES = "references"
REL_EXPORTS = "exports"
REL_CONTAINS = "contains"
REL_BELONGS_TO = "belongs_to"

SUPPORTED_RELATIONSHIPS = {
    REL_IMPORTS, REL_IMPORTED_BY, REL_CALLS, REL_CALLED_BY, REL_USES, REL_USED_BY,
    REL_CREATES, REL_INSTANTIATES, REL_INHERITS, REL_IMPLEMENTS, REL_DECORATES,
    REL_REFERENCES, REL_EXPORTS, REL_CONTAINS, REL_BELONGS_TO,
}

INVERSE_RELATIONSHIP = {
    REL_IMPORTS: REL_IMPORTED_BY,
    REL_USES: REL_USED_BY,
    REL_CALLS: REL_CALLED_BY,
}


@dataclass
class NodeSeed:
    entity_type: str
    entity_key: str
    name: str
    label: str
    file_path: str | None = None
    module: str | None = None
    package: str | None = None
    source_entity_id: str | None = None
    metadata: dict = field(default_factory=dict)


@dataclass(frozen=True)
class EdgeSeed:
    source_key: str
    target_key: str
    relationship_type: str
    metadata: tuple = field(default_factory=tuple)


class DependencyExtractionService:
    """Creates dependency nodes from Phase 3 analysis metadata."""

    def __init__(self, db: Session, analysis_run: AnalysisRun):
        self.db = db
        self.analysis_run = analysis_run

    def load(self) -> dict:
        run_id = self.analysis_run.id
        repository_id = self.analysis_run.repository_id
        return {
            "files": self.db.query(RepositoryFile).filter_by(repository_id=repository_id, analysis_run_id=run_id).all(),
            "modules": self.db.query(RepositoryModule).filter_by(repository_id=repository_id, analysis_run_id=run_id).all(),
            "classes": self.db.query(RepositoryClass).filter_by(repository_id=repository_id, analysis_run_id=run_id).all(),
            "functions": self.db.query(RepositoryFunction).filter_by(repository_id=repository_id, analysis_run_id=run_id).all(),
            "imports": self.db.query(RepositoryImport).filter_by(repository_id=repository_id, analysis_run_id=run_id).all(),
        }

    def nodes(self, metadata: dict) -> dict[str, NodeSeed]:
        nodes: dict[str, NodeSeed] = {}

        def add(seed: NodeSeed):
            nodes.setdefault(seed.entity_key, seed)

        add(NodeSeed("repository", f"repository:{self.analysis_run.repository_id}", self.analysis_run.repository_id, "Repository"))
        for file in metadata["files"]:
            add(NodeSeed("file", f"file:{file.path}", file.name, file.path, file_path=file.path, source_entity_id=file.id, metadata={"language": file.language, "lines": file.lines_of_code}))
        for module in metadata["modules"]:
            package = module.package or module.name.split(".")[0]
            add(NodeSeed("package", f"package:{package}", package, package, package=package, metadata={"internal": True}))
            add(NodeSeed("module", f"module:{module.name}", module.name, module.name, file_path=module.file_path, module=module.name, package=package, source_entity_id=module.id, metadata={"is_package": module.is_package}))
        for cls in metadata["classes"]:
            add(NodeSeed("class", f"class:{cls.qualified_name}", cls.name, cls.qualified_name, file_path=cls.file_path, module=cls.module, source_entity_id=cls.id))
        for fn in metadata["functions"]:
            add(NodeSeed("function", f"function:{fn.qualified_name}", fn.name, fn.qualified_name, file_path=fn.file_path, module=fn.module, source_entity_id=fn.id, metadata={"is_async": fn.is_async, "class_name": fn.class_name}))
        for imp in metadata["imports"]:
            target = imp.module.split(".")[0] if imp.module else "unknown"
            if f"module:{imp.module}" not in nodes and not any(key.startswith(f"module:{target}") for key in nodes):
                add(NodeSeed("package", f"package:{target}", target, target, package=target, metadata={"internal": False}))
        return nodes


class RelationshipBuilder:
    """Builds normalized directed relationships from loaded metadata."""

    def __init__(self, nodes: dict[str, NodeSeed], metadata: dict):
        self.nodes = nodes
        self.metadata = metadata
        self.edges: set[EdgeSeed] = set()
        self.module_by_file = {module.file_path: module.name for module in metadata["modules"]}
        self.class_by_name = defaultdict(list)
        for cls in metadata["classes"]:
            self.class_by_name[cls.name].append(cls.qualified_name)

    def add(self, source_key: str, target_key: str, relationship_type: str, metadata: dict | None = None, inverse: bool = False):
        if relationship_type not in SUPPORTED_RELATIONSHIPS:
            return
        if source_key == target_key or source_key not in self.nodes or target_key not in self.nodes:
            return
        meta_tuple = tuple(sorted((metadata or {}).items()))
        self.edges.add(EdgeSeed(source_key, target_key, relationship_type, meta_tuple))
        inverse_type = INVERSE_RELATIONSHIP.get(relationship_type)
        if inverse and inverse_type:
            self.edges.add(EdgeSeed(target_key, source_key, inverse_type, meta_tuple))

    def build(self) -> set[EdgeSeed]:
        repository_key = next(key for key in self.nodes if key.startswith("repository:"))
        for file in self.metadata["files"]:
            self.add(repository_key, f"file:{file.path}", REL_CONTAINS)
            if file.folder_path:
                self.add(f"file:{file.path}", repository_key, REL_BELONGS_TO)

        for module in self.metadata["modules"]:
            module_key = f"module:{module.name}"
            file_key = f"file:{module.file_path}"
            package_key = f"package:{module.package or module.name.split('.')[0]}"
            self.add(file_key, module_key, REL_CONTAINS)
            self.add(module_key, file_key, REL_BELONGS_TO)
            self.add(package_key, module_key, REL_CONTAINS)
            self.add(module_key, package_key, REL_BELONGS_TO)

        for cls in self.metadata["classes"]:
            class_key = f"class:{cls.qualified_name}"
            self.add(f"module:{cls.module}", class_key, REL_CONTAINS)
            self.add(class_key, f"module:{cls.module}", REL_BELONGS_TO)
            for base in json.loads(cls.bases_json or "[]"):
                clean_base = str(base).split("[")[0].split(".")[-1]
                for target_qualified in self.class_by_name.get(clean_base, []):
                    self.add(class_key, f"class:{target_qualified}", REL_INHERITS)
            for decorator in json.loads(cls.decorators_json or "[]"):
                target = decorator.split(".")[0]
                self.add(class_key, f"package:{target}", REL_DECORATES)

        for fn in self.metadata["functions"]:
            function_key = f"function:{fn.qualified_name}"
            if fn.class_name:
                class_key = f"class:{fn.module}.{fn.class_name}"
                self.add(class_key, function_key, REL_CONTAINS)
                self.add(function_key, class_key, REL_BELONGS_TO)
            else:
                self.add(f"module:{fn.module}", function_key, REL_CONTAINS)
                self.add(function_key, f"module:{fn.module}", REL_BELONGS_TO)
            self._type_hint_relationships(fn, function_key)
            for decorator in json.loads(fn.decorators_json or "[]"):
                target = decorator.split(".")[0]
                self.add(function_key, f"package:{target}", REL_DECORATES)

        ImportResolverService(self).resolve()
        return self.edges

    def _type_hint_relationships(self, fn: RepositoryFunction, function_key: str):
        hints = []
        if fn.return_type:
            hints.append(fn.return_type)
        for parameter in json.loads(fn.parameters_json or "[]"):
            if parameter.get("annotation") or parameter.get("type"):
                hints.append(parameter.get("annotation") or parameter.get("type"))
        for hint in hints:
            clean = hint.replace("'", "").replace('"', "").split("[")[0].split(".")[-1]
            for target_qualified in self.class_by_name.get(clean, []):
                self.add(function_key, f"class:{target_qualified}", REL_USES, inverse=True)


class ImportResolverService:
    """Resolves import rows into file/module/package relationships."""

    def __init__(self, builder: RelationshipBuilder):
        self.builder = builder

    def resolve(self) -> None:
        module_to_file = {module.name: module.file_path for module in self.builder.metadata["modules"]}
        for imp in self.builder.metadata["imports"]:
            source_file = f"file:{imp.file_path}"
            source_module_name = self.builder.module_by_file.get(imp.file_path)
            source_module = f"module:{source_module_name}" if source_module_name else None
            target_module = self._resolve_module(imp.module, module_to_file)
            package_key = f"package:{imp.module.split('.')[0]}"
            if target_module:
                self.builder.add(source_file, f"file:{module_to_file[target_module]}", REL_IMPORTS, {"line": imp.line_number}, inverse=True)
                if source_module:
                    self.builder.add(source_module, f"module:{target_module}", REL_IMPORTS, {"line": imp.line_number}, inverse=True)
            else:
                self.builder.add(source_file, package_key, REL_IMPORTS, {"line": imp.line_number}, inverse=True)
                if source_module:
                    self.builder.add(source_module, package_key, REL_IMPORTS, {"line": imp.line_number}, inverse=True)

    @staticmethod
    def _resolve_module(imported: str, module_to_file: dict[str, str]) -> str | None:
        if imported in module_to_file:
            return imported
        parts = imported.split(".")
        while len(parts) > 1:
            parts.pop()
            candidate = ".".join(parts)
            if candidate in module_to_file:
                return candidate
        return None


class RelationshipValidator:
    @staticmethod
    def valid(edge: EdgeSeed, nodes: dict[str, NodeSeed]) -> bool:
        return edge.relationship_type in SUPPORTED_RELATIONSHIPS and edge.source_key in nodes and edge.target_key in nodes and edge.source_key != edge.target_key


class CallGraphBuilder:
    """Placeholder service boundary for future AST call-expression metadata."""

    def enrich(self, edges: set[EdgeSeed]) -> set[EdgeSeed]:
        return edges


class CircularDependencyService:
    def detect(self, nodes: dict[str, DependencyNode], edges: list[DependencyEdge]) -> list[dict]:
        graph = defaultdict(list)
        edge_lookup = {}
        allowed = {REL_IMPORTS, REL_INHERITS, REL_USES, REL_CALLS, REL_REFERENCES}
        for edge in edges:
            if edge.relationship_type in allowed:
                graph[edge.source_node_id].append(edge.target_node_id)
                edge_lookup[(edge.source_node_id, edge.target_node_id)] = edge.id

        cycles = []
        seen = set()
        state = defaultdict(int)
        stack: list[str] = []

        def record_cycle(cycle: list[str]):
            key = tuple(sorted(set(cycle)))
            if key in seen or len(cycle) < 3:
                return
            seen.add(key)
            edge_ids = [edge_lookup.get((cycle[i], cycle[i + 1])) for i in range(len(cycle) - 1)]
            cycle_types = {nodes[item].entity_type for item in cycle if item in nodes}
            cycles.append({
                "cycle_type": cycle_types.pop() if len(cycle_types) == 1 else "mixed",
                "node_ids": cycle,
                "edge_ids": [edge_id for edge_id in edge_ids if edge_id],
                "length": len(cycle) - 1,
                "severity": "high" if len(cycle) <= 4 else "medium",
            })

        def visit(node_id: str):
            state[node_id] = 1
            stack.append(node_id)
            for target in graph.get(node_id, []):
                if state[target] == 0:
                    visit(target)
                elif state[target] == 1 and target in stack:
                    start = stack.index(target)
                    record_cycle(stack[start:] + [target])
            stack.pop()
            state[node_id] = 2

        for node_id in list(graph):
            if state[node_id] == 0:
                visit(node_id)
        return cycles[:1000]

class DependencyMetricsService:
    def calculate(self, nodes: list[DependencyNode], edges: list[DependencyEdge]) -> dict:
        incoming = Counter(edge.target_node_id for edge in edges)
        outgoing = Counter(edge.source_node_id for edge in edges)
        node_map = {node.id: node for node in nodes}
        file_refs = [(node_id, count) for node_id, count in incoming.items() if node_map.get(node_id) and node_map[node_id].entity_type == "file"]
        function_refs = [(node_id, count) for node_id, count in incoming.items() if node_map.get(node_id) and node_map[node_id].entity_type == "function"]
        most_file = max(file_refs, key=lambda item: item[1], default=(None, 0))[0]
        most_function = max(function_refs, key=lambda item: item[1], default=(None, 0))[0]
        total_nodes = len(nodes)
        total_edges = len(edges)
        density = round(total_edges / max(total_nodes * (total_nodes - 1), 1), 6)
        return {
            "total_nodes": total_nodes,
            "total_edges": total_edges,
            "incoming_dependency_count": sum(incoming.values()),
            "outgoing_dependency_count": sum(outgoing.values()),
            "fan_in": max(incoming.values(), default=0),
            "fan_out": max(outgoing.values(), default=0),
            "dependency_depth": self._depth(edges),
            "dependency_density": density,
            "most_referenced_file_node_id": most_file,
            "most_referenced_file": node_map[most_file].label if most_file else None,
            "most_referenced_function_node_id": most_function,
            "most_referenced_function": node_map[most_function].label if most_function else None,
            "unused_files": 0,
            "unused_functions": 0,
        }

    @staticmethod
    def _depth(edges: list[DependencyEdge]) -> int:
        graph = defaultdict(list)
        for edge in edges:
            if edge.relationship_type in {REL_IMPORTS, REL_USES, REL_CALLS, REL_INHERITS}:
                graph[edge.source_node_id].append(edge.target_node_id)
        best = 0
        for start in graph:
            queue = deque([(start, 0)])
            seen = {start}
            while queue:
                node, depth = queue.popleft()
                best = max(best, depth)
                for target in graph.get(node, []):
                    if target not in seen:
                        seen.add(target)
                        queue.append((target, depth + 1))
        return best


class BlastRadiusService:
    def __init__(self, db: Session):
        self.db = db

    def calculate(self, node_id: str, max_depth: int = 4) -> dict:
        node = DependencyRepository.node(self.db, node_id)
        if node is None:
            raise APIError("Dependency node not found", 404)
        logger.info("Blast Radius Requests node_id=%s", node_id)
        graph = defaultdict(list)
        all_edges = self.db.query(DependencyEdge).filter_by(dependency_id=node.dependency_id).all()
        for edge in all_edges:
            graph[edge.target_node_id].append(edge.source_node_id)

        levels = []
        visited = {node_id}
        current = [node_id]
        affected_ids = []
        for depth in range(1, max_depth + 1):
            next_ids = []
            for current_id in current:
                for dependent in graph.get(current_id, []):
                    if dependent not in visited:
                        visited.add(dependent)
                        next_ids.append(dependent)
                        affected_ids.append(dependent)
            if not next_ids:
                break
            levels.append({"depth": depth, "node_ids": next_ids, "count": len(next_ids)})
            current = next_ids

        affected = self.db.query(DependencyNode).filter(DependencyNode.id.in_(affected_ids)).all() if affected_ids else []
        return {
            "root": node,
            "direct": [item for item in affected if item.id in (levels[0]["node_ids"] if levels else [])],
            "indirect": [item for item in affected if levels and item.id not in levels[0]["node_ids"]],
            "levels": levels,
            "affected": affected,
        }


class DependencyCoordinatorService:
    def __init__(self, db: Session):
        self.db = db

    def latest_completed_analysis(self, repository_id: str) -> AnalysisRun:
        run = AnalysisRepository.latest_run(self.db, repository_id)
        if run is None:
            raise APIError("Missing analysis. Run repository analysis before building dependencies.", 404)
        if run.status not in {"completed", "completed_with_warnings"}:
            raise APIError("Latest analysis is not complete enough for dependency extraction.", 409)
        return run

    def build(self, repository_id: str, user_id: str) -> DependencyBuild:
        repository = RepositoryValidationService.repository_access(self.db, repository_id, user_id, write=True)
        analysis_run = self.latest_completed_analysis(repository_id)
        started = time.perf_counter()
        build = DependencyRepository.build_for_analysis(self.db, repository_id, analysis_run.id)
        if build is None:
            build = DependencyBuild(id=new_id(), repository_id=repository_id, analysis_run_id=analysis_run.id, requested_by=user_id, status="running")
            self.db.add(build)
            self.db.flush()
        else:
            DependencyRepository.replace_build_children(self.db, build.id)
            build.status = "running"
            build.requested_by = user_id
            build.warnings_json = "[]"
            build.error_message = None
            self.db.flush()

        try:
            logger.info("Dependency Build Started repository_id=%s analysis_run_id=%s", repository_id, analysis_run.id)
            RepositoryActivityService.record(self.db, repository, user_id, "Dependency Build Started", "Dependency extraction started")
            metadata = DependencyExtractionService(self.db, analysis_run).load()
            seeds = DependencyExtractionService(self.db, analysis_run).nodes(metadata)
            edge_seeds = CallGraphBuilder().enrich(RelationshipBuilder(seeds, metadata).build())
            edge_seeds = {edge for edge in edge_seeds if RelationshipValidator.valid(edge, seeds)}
            node_rows = self._node_rows(build, seeds)
            node_by_key = {seed.entity_key: row for seed, row in zip(seeds.values(), node_rows, strict=False)}
            edge_rows = self._edge_rows(build, edge_seeds, seeds, node_by_key)
            DependencyRepository.bulk_add(self.db, node_rows)
            DependencyRepository.bulk_add(self.db, edge_rows)
            self.db.flush()

            node_map = {node.id: node for node in node_rows}
            cycles = CircularDependencyService().detect(node_map, edge_rows)
            cycle_rows = [DependencyCycle(id=new_id(), dependency_id=build.id, repository_id=repository_id, analysis_run_id=analysis_run.id, cycle_type=cycle["cycle_type"], node_ids_json=json.dumps(cycle["node_ids"]), edge_ids_json=json.dumps(cycle["edge_ids"]), length=cycle["length"], severity=cycle["severity"]) for cycle in cycles]
            DependencyRepository.bulk_add(self.db, cycle_rows)
            metrics = DependencyMetricsService().calculate(node_rows, edge_rows)
            self.db.add(DependencyMetrics(id=new_id(), dependency_id=build.id, repository_id=repository_id, analysis_run_id=analysis_run.id, **metrics))
            build.nodes_count = len(node_rows)
            build.edges_count = len(edge_rows)
            build.cycles_count = len(cycle_rows)
            build.status = "completed_with_warnings" if cycles else "completed"
            build.completed_at = utc_completed()
            build.duration_ms = int((time.perf_counter() - started) * 1000)
            RepositoryActivityService.record(self.db, repository, user_id, "Dependency Build Completed", f"{len(edge_rows)} relationships created; {len(cycle_rows)} cycles detected")
            self.db.commit()
            self.db.refresh(build)
            logger.info("Dependency Build Completed repository_id=%s relationships=%s cycles=%s duration_ms=%s", repository_id, len(edge_rows), len(cycle_rows), build.duration_ms)

            # ── Auto-sync to Neo4j Knowledge Graph (best-effort) ────────────
            # Imported locally to avoid circular imports at module load time.
            # A Neo4j failure does NOT roll back the dependency build — the
            # graph can be re-synced via POST /graph/build/{repository_id}.
            try:
                from app.modules.graph.services import GraphBuilderService  # noqa: PLC0415
                GraphBuilderService(self.db).build(repository_id, user_id, trigger="dependency_build")
            except Exception as graph_exc:
                self.db.rollback()
                logger.warning(
                    "Neo4j auto-sync skipped (non-fatal) repository_id=%s reason=%s",
                    repository_id,
                    graph_exc,
                )

            return build
        except Exception as exc:
            self.db.rollback()
            build = self.db.get(DependencyBuild, build.id)
            if build:
                build.status = "failed"
                build.error_message = str(exc)
                build.completed_at = utc_completed()
                build.duration_ms = int((time.perf_counter() - started) * 1000)
                self.db.commit()
            logger.exception("Dependency build failed repository_id=%s", repository_id)
            if isinstance(exc, APIError):
                raise exc
            raise APIError("Dependency extraction failed", 500, [str(exc)]) from exc

    @staticmethod
    def _node_rows(build: DependencyBuild, seeds: dict[str, NodeSeed]) -> list[DependencyNode]:
        return [
            DependencyNode(
                id=new_id(),
                dependency_id=build.id,
                repository_id=build.repository_id,
                analysis_run_id=build.analysis_run_id,
                entity_type=seed.entity_type,
                entity_key=seed.entity_key,
                name=seed.name,
                label=seed.label,
                file_path=seed.file_path,
                module=seed.module,
                package=seed.package,
                source_entity_id=seed.source_entity_id,
                metadata_json=json.dumps(seed.metadata),
            )
            for seed in seeds.values()
        ]

    @staticmethod
    def _edge_rows(build: DependencyBuild, edge_seeds: set[EdgeSeed], seeds: dict[str, NodeSeed], node_by_key: dict[str, DependencyNode]) -> list[DependencyEdge]:
        rows = []
        for seed in edge_seeds:
            source = node_by_key[seed.source_key]
            target = node_by_key[seed.target_key]
            rows.append(DependencyEdge(
                id=new_id(),
                dependency_id=build.id,
                repository_id=build.repository_id,
                analysis_run_id=build.analysis_run_id,
                source_node_id=source.id,
                target_node_id=target.id,
                relationship_type=seed.relationship_type,
                source_type=seeds[seed.source_key].entity_type,
                target_type=seeds[seed.target_key].entity_type,
                depth=1,
                weight=1.0,
                metadata_json=json.dumps(dict(seed.metadata)),
            ))
        return rows


def utc_completed():
    from datetime import UTC, datetime

    return datetime.now(UTC)
