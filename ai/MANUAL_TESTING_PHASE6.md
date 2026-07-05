# Phase 6 Manual Testing Checklist

To manually verify the Graph Query & Intelligence Layer, start the backend and follow these steps against a valid knowledge graph.

## 1. Dependency Chain Verification
- [ ] `GET /api/v1/graph/dependencies/{node_id}`
- [ ] Verify `direct_dependencies` returns immediate outbound dependencies.
- [ ] Verify `transitive_dependencies` returns the full deep dependency tree.
- [ ] Verify `reverse_dependencies` returns nodes depending on this node.

## 2. Call Chain Verification
- [ ] `GET /api/v1/graph/call-chain/{node_id}`
- [ ] Verify `callers` array shows functions calling the target function.
- [ ] Verify `callees` array shows functions called by the target function.
- [ ] Confirm transitive trees correctly capture deep calls.

## 3. Import Chain Verification
- [ ] `GET /api/v1/graph/import-chain/{node_id}`
- [ ] Ensure `importers` array shows modules that import the target file/module.
- [ ] Ensure `importees` array shows modules imported by the target.

## 4. Inheritance Chain Verification
- [ ] `GET /api/v1/graph/inheritance-chain/{node_id}`
- [ ] Pick a class node and verify `subclasses` and `superclasses`.
- [ ] Ensure depth limits cap the tree accurately.

## 5. Path Finding
- [ ] `GET /api/v1/graph/path?source_node_id=X&target_node_id=Y`
- [ ] Ensure the shortest path accurately matches graph visualization.
- [ ] `GET /api/v1/graph/paths?source_node_id=X&target_node_id=Y`
- [ ] Ensure multiple paths are returned, up to the max_paths cap.

## 6. Neighborhood Traversal
- [ ] `GET /api/v1/graph/related/{node_id}?depth=2&traversal_mode=bfs`
- [ ] `GET /api/v1/graph/related/{node_id}?depth=2&traversal_mode=dfs`
- [ ] Compare the two. Ensure DFS ordering matches a true depth-first expansion visually.
- [ ] Pass `rel_types=CALLS` and ensure no other edge types are returned.

## 7. Graph Summary
- [ ] `GET /api/v1/graph/summary/{repository_id}`
- [ ] Verify `hotspot_nodes` correctly identify high-degree nodes.
- [ ] Verify `orphan_nodes` identifies isolated code blocks.
- [ ] Verify `entry_points` and `sink_nodes` counts make sense for the repository.

## 8. Error Handling
- [ ] Pass an invalid `node_id`. Confirm 404 response.
- [ ] Pass an invalid `repository_id` to summary. Confirm 404 response.
- [ ] Test a path between completely disconnected nodes. Confirm `found: false` in response.
