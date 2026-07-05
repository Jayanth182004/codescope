# Next Task

## Backend Phase 8 Options

Phase 7, Architecture Inference Engine, is complete. The following options are available for Phase 8. Await a dedicated prompt before starting any of these.

---

### Option A: Change Impact Prediction
Simulate the blast radius of changing specific files or functions.

Deliverables:
- `app/modules/impact/` module
- Endpoints that accept changed nodes and return risk, affected layers, affected services, and suggested tests
- Uses `DependencyQueryService`, `CallChainService`, and architecture snapshots

Best for: showing users what a PR may break before they merge it.

---

### Option B: Git Intelligence Ingestion
Ingest commit-level metadata from repository ZIP git history or Git REST APIs.

Deliverables:
- `app/modules/git_intelligence/` module
- `git_commits`, `git_file_changes`, `git_authors` PostgreSQL tables
- Commit parsing from `.git` directories inside ZIP uploads
- REST endpoints for commit history, churn, author attribution, and hotspot scoring
- Optional Neo4j node annotation for churn and ownership metadata

Best for: enabling the Git Intelligence frontend feature.

---

### Option C: Celery + Redis Async Worker
Move Neo4j graph sync and heavy analysis off the synchronous request thread.

Deliverables:
- Redis service in `docker-compose.yml`
- Celery worker container
- Concrete `RedisCacheService` fulfilling the `GraphCachingService` Protocol
- Queue analysis, dependency, graph, and architecture builds

Best for: large repositories where synchronous analysis may time out.

---

## Constraints
- Do NOT clone Git repositories without credential isolation, host allowlisting, and resource limits.
- Do NOT add AI inference, LLM calls, or embedding models yet.
- Continue to leverage the Phase 6 graph intelligence layer and Phase 7 architecture snapshots.
