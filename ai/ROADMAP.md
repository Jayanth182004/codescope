# Roadmap

- **Completed:** Auth, Dashboard, Repositories, Knowledge Graph, Dependency Intelligence.
- **Upcoming (Prompt 11+):**
  - Architecture Explorer frontend wired to architecture APIs
  - Change Impact Prediction
  - Git Intelligence
  - Frontend monolith splitting when explicitly requested

## Backend

- **Completed:** Phase 1 authentication, workspaces, projects, dashboard.
- **Completed:** Phase 2 repository management, secure ZIP upload/storage, Git registration metadata, audit, and settings.
- **Completed:** Phase 3 repository analysis over uploaded repositories, including scanner, language detection, Python AST extraction, persisted analysis snapshots, REST endpoints, tests, migration, and docs.
- **Completed:** Phase 4 dependency extraction engine, dependency build snapshots, graph nodes/edges, cycle detection, metrics, blast radius traversal, REST APIs, migration, tests, and docs.
- **Completed:** Phase 5 Neo4j Knowledge Graph Engine, graph sync tracking, graph services, graph APIs, Docker Compose Neo4j integration, environment docs, and ADR 13/14.
- **Completed:** Phase 6 Graph Query & Intelligence Layer, semantic dependency/call/import/path/summary APIs, separate intelligence services, and ADR 15/16.
- **Completed:** Phase 7 Architecture Inference Engine, deterministic architecture build snapshots, framework/layer/component detection, request flow inference, architecture metrics, health scoring, anti-pattern recommendations, secured `/api/v1/architecture/*` APIs, migration, and tests.
- **Next:** Backend Phase 8 options include Change Impact Prediction, Git Intelligence ingestion, or Celery/Redis async worker infrastructure. Await dedicated prompt before starting.
