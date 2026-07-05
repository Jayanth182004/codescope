# Dependency Extraction Engine

Backend Phase 4 converts Phase 3 repository analysis metadata into graph-ready dependency relationships.

## Scope

This phase does:

- Consume completed analysis snapshots.
- Create dependency build snapshots.
- Normalize repository, file, package, module, class, and function nodes.
- Create explicit directed dependency edges.
- Detect circular dependencies.
- Calculate dependency metrics.
- Calculate backend blast radius.
- Expose REST APIs for graph, tree, node, metrics, cycles, and blast radius.

This phase does not:

- Rescan repositories.
- Clone Git repositories.
- Implement Neo4j.
- Implement the Architecture Engine.
- Run AI inference.

## Pipeline

1. **Analysis Results**
   The coordinator loads the latest completed or completed-with-warnings analysis run.

2. **Relationship Extractor**
   `DependencyExtractionService` loads Phase 3 files, modules, classes, functions, and imports.

3. **Dependency Builder**
   `RelationshipBuilder` creates graph nodes and relationships such as `contains`, `belongs_to`, `imports`, `imported_by`, `inherits`, `decorates`, `uses`, and `used_by`.

4. **Relationship Validator**
   Invalid, unsupported, missing-node, and self-loop relationships are discarded before persistence.

5. **Dependency Database**
   A dependency build snapshot is written to `dependencies`, `dependency_nodes`, and `dependency_edges`.

6. **Dependency Metrics**
   `DependencyMetricsService` computes fan-in, fan-out, dependency depth, density, most referenced file/function, and placeholders for unused files/functions.

7. **API**
   FastAPI routes expose graph-ready structures for future frontend and Neo4j layers.

## Schema

- `dependencies`: one dependency build per repository analysis snapshot.
- `dependency_nodes`: normalized graph entities.
- `dependency_edges`: directed typed relationships.
- `dependency_metrics`: aggregate graph metrics.
- `dependency_cycles`: circular dependency records.

## APIs

- `POST /api/v1/dependencies/build/{repository_id}`
- `GET /api/v1/dependencies/{repository_id}`
- `GET /api/v1/dependencies/node/{node_id}`
- `GET /api/v1/dependencies/tree/{node_id}`
- `GET /api/v1/dependencies/graph/{repository_id}`
- `GET /api/v1/dependencies/blast-radius/{node_id}`
- `GET /api/v1/dependencies/metrics/{repository_id}`
- `GET /api/v1/dependencies/cycles/{repository_id}`

## Performance Strategy

- Uses dictionaries for module, class, and node lookup.
- Avoids pairwise entity scans.
- Uses adjacency lists for traversal, cycle detection, metrics, and blast radius.
- Keeps builds snapshot-based, allowing future incremental rebuilds by analysis run.
- Limits graph response sizes through query parameters.

## Future Path

The next backend phase can build a Neo4j exporter or graph persistence layer from these nodes and edges. Architecture inference should consume dependency snapshots rather than raw AST metadata.
