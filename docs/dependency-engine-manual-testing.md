# Dependency Engine Manual Testing

## Prerequisites

1. Start backend.
2. Register or sign in.
3. Upload a ZIP repository.
4. Run repository analysis:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/analysis/start/<repository_id> \
  -H "Authorization: Bearer <token>"
```

## Build Dependencies

```bash
curl -X POST http://127.0.0.1:8000/api/v1/dependencies/build/<repository_id> \
  -H "Authorization: Bearer <token>"
```

Expected:

- `status` is `completed` or `completed_with_warnings`
- `nodes_count` is greater than zero
- `edges_count` is greater than zero

## Inspect Graph

```bash
curl http://127.0.0.1:8000/api/v1/dependencies/graph/<repository_id> \
  -H "Authorization: Bearer <token>"
```

Check:

- nodes include files, modules, packages, classes, and functions
- edges include `contains`, `belongs_to`, and `imports`
- no Neo4j dependency is required

## Inspect Metrics

```bash
curl http://127.0.0.1:8000/api/v1/dependencies/metrics/<repository_id> \
  -H "Authorization: Bearer <token>"
```

Check fan-in, fan-out, density, depth, and most referenced entities.

## Inspect Cycles

```bash
curl http://127.0.0.1:8000/api/v1/dependencies/cycles/<repository_id> \
  -H "Authorization: Bearer <token>"
```

Create two Python modules that import each other to confirm cycles are detected.

## Blast Radius

1. Get a node id from the graph endpoint.
2. Run:

```bash
curl http://127.0.0.1:8000/api/v1/dependencies/blast-radius/<node_id> \
  -H "Authorization: Bearer <token>"
```

Check direct dependencies, indirect dependencies, levels, affected files, affected classes, and affected functions.

## Edge Cases

- Missing analysis returns a clear error.
- Unauthorized users receive `403`.
- Missing node returns `404`.
- Rebuilding dependencies replaces the prior dependency child rows for the same analysis snapshot.
- Circular dependencies are stored separately for visualization.
