# Current Phase

Backend Phase 7, Architecture Inference Engine, is complete.

This phase adds deterministic architecture inference on top of completed dependency builds. It classifies dependency nodes into architecture components and layers, detects frameworks, infers request flows, calculates architecture metrics, and reports anti-patterns through `/api/v1/architecture/*`.

PostgreSQL stores architecture build snapshots, components, request flows, metrics, and anti-patterns. Neo4j remains the graph traversal and query-acceleration layer; no LLM, embedding, or AI inference is used.

Key services include `ArchitectureInferenceService`, `FrameworkDetectionService`, `LayerDetectionService`, `ServiceDetectionService`, `RequestFlowService`, `ArchitectureMetricsService`, `ArchitectureHealthService`, and `ArchitectureRecommendationService`.

The next backend phase can implement Change Impact Prediction, Git Intelligence ingestion, or async worker infrastructure. Do not add AI inference or LLM integration until a dedicated prompt authorizes it.
