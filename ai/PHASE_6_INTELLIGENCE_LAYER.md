# Phase 6: Graph Query & Intelligence Layer

## 1. Why this shared layer exists
The Intelligence Layer acts as a semantic bridge between raw Neo4j infrastructure (Phase 5) and future feature modules like the Architecture Engine and AI Assistant. By decoupling the graph queries from feature-specific business logic, we ensure that complex Cypher queries are written, optimized, and tested in one place. It provides stable API contracts (e.g., `DependencyChainOut`, `TraversalResult`) so downstream consumers never need to know we use Neo4j under the hood.

## 2. How it reduces duplication
Before this layer, any feature needing to understand "What calls this function?" or "What does this module depend on?" would have to write its own Cypher query, manage Neo4j sessions, handle edge extraction, and map records to Pydantic models. Now, all modules simply inject `CallChainService` or `DependencyQueryService`. It centralizes error handling, depth limiting, and type conversion.

## 3. Service responsibilities
Each service strictly follows the Single Responsibility Principle:
- **`GraphCachingService` (Protocol)**: Interface for caching graph results to avoid DB roundtrips (prepared for Redis).
- **`GraphTraversalService`**: Core BFS and DFS logic. DFS is implemented iteratively in Python on top of Neo4j subgraphs to guarantee ordering.
- **`PathFindingService`**: Extracts shortest paths and all simple paths between two nodes.
- **`NeighborhoodService`**: Extracts an N-hop filtered subgraph around a node.
- **`DependencyQueryService`**: Traces `IMPORTS`, `DEPENDS_ON`, and `USES` edges (direct, transitive, and reverse).
- **`CallChainService`**: Traces `CALLS` edges upstream and downstream.
- **`ImportChainService`**: Traces `IMPORTS` edges specifically for file/module relationships.
- **`InheritanceChainService`**: Traces `INHERITS` edges to extract class hierarchies (superclasses/subclasses).
- **`GraphSummaryService`**: Aggregates repository-wide metrics (hotspots, orphans, entry/sink nodes).
- **`GraphSearchService`**: (Integrated from Phase 5) Provides full-text entity search.

## 4. API flow
1. **Client Request**: Frontend (or AI Assistant) calls `/api/v1/graph/call-chain/{node_id}`.
2. **Router**: `router.py` validates repository access (`_authorize_node`) and calls `CallChainService`.
3. **Intelligence Service**: `CallChainService` injects safe Cypher strings, bounds depth via `settings.GRAPH_MAX_DEPTH`, and executes the query via `neo4j_session`.
4. **Data Mapping**: Raw Neo4j records are parsed into `GraphNodeOut` and `GraphEdgeOut` objects.
5. **Response**: Data is wrapped in `APIEnvelope[CallChainOut]` and returned to the client.

## 5. Performance strategy
- **No PostgreSQL Fallback (ADR 16)**: Graph traversals use Neo4j exclusively, preventing N+1 relational queries.
- **Bounded Traversal**: All queries have strict `max_depth` limits (capped globally at 15) and node limits (`GRAPH_MAX_SUBGRAPH_NODES`) to prevent runaway queries on highly connected nodes.
- **Projection Queries**: Cypher queries use `RETURN DISTINCT n` to avoid returning Cartesian products of relationships and nodes over the network.
- **DFS Optimization**: Instead of using heavy APOC path expanders, DFS fetches a bounded subgraph in a single Cypher query and applies an iterative Python stack-based traversal in memory.
- **Caching Ready**: `GraphCachingService` defines the seam for integrating Redis in Phase 7 to cache expensive traversal results for 5 minutes.
