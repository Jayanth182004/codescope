# Architecture Decision Records (ADRs)

**ADR 1: Monolithic Frontend File**
- *Decision:* Maintain the entire application within `CodeScopeApp.jsx`.
- *Reasoning:* Simplifies AI context windows and rapid prototyping during the early prompt phases.
- *Status:* Active.

**ADR 2: Bespoke Design System over Tailwind**
- *Decision:* Use a JavaScript `T` token object for all styling.
- *Reasoning:* Ensures absolute consistency and avoids className string soup in the massive monolith file.
- *Status:* Active.

**ADR 3: React Flow for Visualizations**
- *Decision:* Standardize on `@xyflow/react` for all graph, architecture, and dependency visualizations.
- *Reasoning:* Highly performant, extensible, and visually customizable.
- *Status:* Active.

**ADR 4: Repository Module Services**
- *Decision:* Keep repository persistence in `repository.py`, orchestration and validation in `services.py`, transport contracts in `schemas.py`, and HTTP concerns in `router.py`.
- *Reasoning:* ZIP storage, authorization, metadata, and audit behavior require transactional workflows that should not leak into the query layer.
- *Status:* Active.

**ADR 5: Secure Local Repository Storage**
- *Decision:* Stream ZIPs to a repository-scoped local volume, validate compressed and expanded limits, reject traversal and symbolic links, extract to an opaque UUID path, and store SHA-256 metadata.
- *Reasoning:* This gives the MVP deterministic storage while reducing archive extraction and filename risks. The storage service boundary can later target object storage.
- *Status:* Active.

**ADR 6: Git Registration Without Cloning**
- *Decision:* Store validated HTTP(S) Git metadata and branch only. Reject embedded credentials and private-network targets; do not clone.
- *Reasoning:* Cloning and credential-provider integration require a separate execution-security model and remain out of scope until explicitly approved.
- *Status:* Active.

**ADR 7: Analysis Runs Are Snapshot Records**
- *Decision:* Store each repository analysis as a distinct `analysis_runs` snapshot with child rows keyed by `analysis_run_id`.
- *Reasoning:* Future graph, dependency, and impact features need stable historical snapshots instead of mutating a single current-state table during long-running scans.
- *Status:* Active.

**ADR 8: Bounded Synchronous Analysis for MVP**
- *Decision:* Run Phase 3 analysis synchronously behind authenticated API calls with file-count, file-size, upload-root, ignored-directory, and warning boundaries.
- *Reasoning:* This keeps the backend deterministic for local development and tests while preserving a clean seam for a future queue worker.
- *Status:* Active.

**ADR 9: Python AST First, Parser Registry Later**
- *Decision:* Extract rich symbol metadata from Python with the standard `ast` module while detecting TypeScript, JavaScript, JSON, YAML, Markdown, and Dockerfiles at file level.
- *Reasoning:* Python AST gives safe, dependency-free production value now; Tree-sitter or language-specific parsers can be introduced later behind the same metadata tables.
- *Status:* Active.

**ADR 10: Dependency Builds Are Analysis-Derived Snapshots**
- *Decision:* Build dependencies only from completed Phase 3 analysis rows and store each build against `analysis_run_id`.
- *Reasoning:* This prevents filesystem rescans, preserves reproducibility, and gives later graph systems a stable snapshot contract.
- *Status:* Active.

**ADR 11: Relational Graph Schema Before Neo4j**
- *Decision:* Store dependency nodes, edges, metrics, and cycles in relational tables first.
- *Reasoning:* The API can support Knowledge Graph and Dependency Intelligence immediately while keeping Neo4j as a later exporter/persistence layer.
- *Status:* Active.

**ADR 13: Neo4j as Query-Acceleration Layer, Not Source of Truth**
- *Decision:* PostgreSQL holds all graph data in relational form (dependency_nodes, dependency_edges). Neo4j is populated by syncing from those tables and used only for complex graph traversal queries (shortest path, subgraph expansion, centrality). PostgreSQL remains the single source of truth.
- *Reasoning:* This allows the API to serve Knowledge Graph and Dependency Intelligence immediately from relational tables while Neo4j provides millisecond graph queries at scale. If Neo4j is unavailable, only the /graph/* endpoints degrade — the rest of the application is unaffected.
- *Status:* Active.

**ADR 14: Automatic Graph Sync After Dependency Build**
- *Decision:* After every successful DependencyCoordinatorService.build() call, a Neo4j sync is triggered synchronously as a best-effort step. A Neo4j failure logs a warning and returns without rolling back the dependency build.
- *Reasoning:* The user should never manually trigger graph generation. Synchronous execution is acceptable for the MVP. The code is structured so the sync call can be moved to a Celery task later without changing the service interface — only the caller changes.
- *Status:* Active.

**ADR 15: Separate Infrastructure and Intelligence Services**
- *Decision:* Intelligence services (like GraphTraversalService and CallChainService in `intelligence_services.py`) are kept separate from infrastructure services (`services.py`). Future features (Architecture Engine, AI Assistant) must import from intelligence services only.
- *Reasoning:* Preserves a clean seam. The infrastructure layer handles raw Neo4j read/write and synchronization. The intelligence layer provides stable semantic API contracts (like DependencyChainOut or TraversalResult) so higher-level logic doesn't couple directly to Cypher.
- *Status:* Active.

**ADR 16: Neo4j as Single Source of Truth for Graph Traversal**
- *Decision:* All graph intelligence queries (BFS, DFS, shortest path) run strictly against Neo4j. There is no fallback to PostgreSQL for graph traversal. PostgreSQL holds relational metadata; Neo4j holds graph relationships.
- *Reasoning:* Separation of concerns. If we duplicate traversal logic (like DFS or N-hop subgraph expansion) in PostgreSQL, we negate the purpose of having Neo4j. DFS is implemented as Python application-level traversal on Neo4j-fetched subgraph data to guarantee ordering without APOC.
- *Status:* Active.

**ADR 17: Deterministic Architecture Inference**
- *Decision:* Architecture inference uses deterministic heuristics over completed dependency builds. It does not call LLMs, embeddings, or AI services.
- *Reasoning:* Architecture Explorer needs repeatable, testable backend output before probabilistic AI analysis is introduced. Deterministic snapshots also support comparison across future repository analyses.
- *Status:* Active.

**ADR 18: PostgreSQL Stores Architecture Snapshots**
- *Decision:* Architecture builds, components, request flows, metrics, and anti-patterns are stored in PostgreSQL. Neo4j remains responsible for graph traversal and query acceleration.
- *Reasoning:* Architecture metadata is a derived snapshot that must be auditable, secure, and easy to paginate/filter. Graph relationships stay in Neo4j; inferred architecture records stay relational.
- *Status:* Active.
