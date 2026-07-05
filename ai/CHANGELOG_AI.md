# Changelog - AI-Assisted Development

## Phase 7 - Architecture Inference Engine
**Date:** 2026-07-04

### Added
- `app/modules/architecture/` - deterministic architecture inference module.
- SQLAlchemy models for architecture builds, components, request flows, metrics, and anti-patterns.
- Pydantic schemas and converters for overview, layers, services, routes, request flows, metrics, health, and anti-patterns.
- Services for framework detection, layer detection, component detection, request flow inference, metrics, health scoring, and recommendations.
- REST endpoints under `/api/v1/architecture`: build, overview, layers, services, routes, request flows, metrics, health, and anti-patterns.
- Alembic migration `20260704_02_architecture_inference.py`.
- `tests/test_architecture.py` covering heuristics and the full upload/analyze/dependencies/build/architecture flow.

### Architecture Decisions
- ADR 17: Architecture inference is deterministic and does not use AI/LLMs.
- ADR 18: Architecture snapshots live in PostgreSQL while Neo4j remains the graph traversal layer.

---

## Phase 6 - Graph Query & Intelligence Layer
**Date:** 2026-07-04

### Added
- `app/modules/graph/intelligence_schemas.py` - Semantic API schemas for dependency chains, call chains, import chains, related nodes, traversal results, all paths, and graph summaries.
- `app/modules/graph/intelligence_services.py` - Graph intelligence services for traversal, path finding, dependency queries, call chains, import chains, related nodes, summaries, and future caching.
- Graph intelligence endpoints under `/api/v1/graph`.
- Tests for graph intelligence, traversal behavior, integration, and performance.

### Architecture Decisions
- ADR 15: Intelligence services are decoupled from graph infrastructure services.
- ADR 16: All graph traversals run against Neo4j.

---

## Phase 5 - Neo4j Knowledge Graph Engine
**Date:** 2026-07-04

### Added
- `app/database/neo4j.py` - Neo4j driver singleton, startup indexes, and health probe.
- `app/modules/graph/` - Graph synchronization models, schemas, repository, services, and router.
- Neo4j-backed graph APIs for build, graph read, node read, neighbors, path, subgraph, search, statistics, and health.
- Docker Compose Neo4j service and graph environment configuration.
- Graph builder/API tests.

### Architecture Decisions
- ADR 13: Neo4j is a query-acceleration layer; PostgreSQL remains source of truth.
- ADR 14: Dependency builds trigger best-effort graph sync.
