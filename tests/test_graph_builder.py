"""
tests/test_graph_builder.py
────────────────────────────
Unit tests for NodeBuilderService and RelationshipBuilderService.

These tests do NOT require a real Neo4j connection — they validate the
dict-building logic that produces the MERGE payloads.
"""

import json
import pytest

from app.modules.graph.services import (
    NodeBuilderService,
    RelationshipBuilderService,
    ENTITY_TYPE_TO_LABEL,
    RELATIONSHIP_MAP,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

class FakeDependencyNode:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class FakeDependencyEdge:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


def make_node(entity_type="file", entity_key="file:src/main.py", **kwargs):
    defaults = dict(
        id="node-001",
        entity_type=entity_type,
        entity_key=entity_key,
        name="main.py",
        label="src/main.py",
        file_path="src/main.py",
        module="app.main",
        package="app",
        source_entity_id="src-001",
        repository_id="repo-001",
        analysis_run_id="run-001",
        dependency_id="dep-001",
        metadata_json=json.dumps({"language": "Python", "lines": 100}),
    )
    defaults.update(kwargs)
    return FakeDependencyNode(**defaults)


def make_edge(rel_type="imports", **kwargs):
    defaults = dict(
        id="edge-001",
        source_node_id="node-001",
        target_node_id="node-002",
        relationship_type=rel_type,
        source_type="file",
        target_type="module",
        weight=1.0,
        depth=1,
        repository_id="repo-001",
        analysis_run_id="run-001",
        metadata_json="{}",
    )
    defaults.update(kwargs)
    return FakeDependencyEdge(**defaults)


# ── NodeBuilderService ────────────────────────────────────────────────────────

class TestNodeBuilderService:
    def test_label_for_known_type(self):
        assert NodeBuilderService.label_for("file") == "File"
        assert NodeBuilderService.label_for("class") == "Class"
        assert NodeBuilderService.label_for("function") == "Function"
        assert NodeBuilderService.label_for("repository") == "Repository"

    def test_label_for_unknown_type_returns_unknown(self):
        assert NodeBuilderService.label_for("mystery_type") == "Unknown"

    def test_to_neo4j_dict_contains_required_keys(self):
        node = make_node()
        result = NodeBuilderService.to_neo4j_dict(node)

        assert result["node_id"] == "node-001"
        assert result["entity_key"] == "file:src/main.py"
        assert result["entity_type"] == "file"
        assert result["neo4j_label"] == "File"
        assert result["repository_id"] == "repo-001"
        assert result["analysis_run_id"] == "run-001"
        assert result["language"] == "Python"

    def test_to_neo4j_dict_handles_empty_metadata(self):
        node = make_node(metadata_json="{}")
        result = NodeBuilderService.to_neo4j_dict(node)
        assert result["language"] == ""
        assert result["is_async"] is False

    def test_build_batch_returns_correct_length(self):
        nodes = [make_node(entity_key=f"file:src/{i}.py", id=f"node-{i}") for i in range(10)]
        batch = NodeBuilderService.build_batch(nodes)
        assert len(batch) == 10

    def test_all_entity_types_have_labels(self):
        for entity_type in ENTITY_TYPE_TO_LABEL:
            label = NodeBuilderService.label_for(entity_type)
            assert label != "Unknown", f"entity_type={entity_type} should have a label"


# ── RelationshipBuilderService ────────────────────────────────────────────────

class TestRelationshipBuilderService:
    def test_neo4j_rel_type_known(self):
        assert RelationshipBuilderService.neo4j_rel_type("imports") == "IMPORTS"
        assert RelationshipBuilderService.neo4j_rel_type("inherits") == "INHERITS"
        assert RelationshipBuilderService.neo4j_rel_type("contains") == "CONTAINS"

    def test_neo4j_rel_type_unknown_uppercases(self):
        result = RelationshipBuilderService.neo4j_rel_type("custom_rel")
        assert result == "CUSTOM_REL"

    def test_to_neo4j_dict_contains_required_keys(self):
        edge = make_edge()
        result = RelationshipBuilderService.to_neo4j_dict(
            edge,
            source_key="file:src/a.py",
            target_key="module:app.main",
        )
        assert result["edge_id"] == "edge-001"
        assert result["source_key"] == "file:src/a.py"
        assert result["target_key"] == "module:app.main"
        assert result["neo4j_rel_type"] == "IMPORTS"
        assert result["weight"] == 1.0

    def test_build_batch_skips_edges_with_missing_nodes(self):
        edge = make_edge(source_node_id="missing-node")
        node_id_to_key = {"node-002": "module:app.main"}  # source not present
        batch = RelationshipBuilderService.build_batch([edge], node_id_to_key)
        assert len(batch) == 0

    def test_build_batch_includes_valid_edges(self):
        edge = make_edge()
        node_id_to_key = {
            "node-001": "file:src/a.py",
            "node-002": "module:app.main",
        }
        batch = RelationshipBuilderService.build_batch([edge], node_id_to_key)
        assert len(batch) == 1
        assert batch[0]["neo4j_rel_type"] == "IMPORTS"

    def test_all_relationship_types_are_mapped(self):
        for rel_type in RELATIONSHIP_MAP:
            result = RelationshipBuilderService.neo4j_rel_type(rel_type)
            assert result.isupper(), f"rel_type={rel_type} result={result} should be uppercase"


# ── LCC Algorithm ─────────────────────────────────────────────────────────────

from app.modules.graph.services import GraphStatisticsService  # noqa: E402


class TestLCCAlgorithm:
    """
    Tests for GraphStatisticsService._compute_lcc.
    These are pure algorithm tests — no database or Neo4j connection required.
    The method is static so it can be called directly.
    """

    def test_empty_graph_returns_zero(self):
        assert GraphStatisticsService._compute_lcc([], []) == 0

    def test_single_node_no_edges(self):
        assert GraphStatisticsService._compute_lcc(["n1"], []) == 1

    def test_two_disconnected_nodes(self):
        # Both nodes isolated — each is its own component of size 1
        result = GraphStatisticsService._compute_lcc(["n1", "n2"], [])
        assert result == 1

    def test_two_connected_nodes(self):
        result = GraphStatisticsService._compute_lcc(["n1", "n2"], [("n1", "n2")])
        assert result == 2

    def test_two_components_returns_largest(self):
        # Component A: n1-n2-n3 (size 3)
        # Component B: n4-n5 (size 2)
        # LCC = 3
        nodes = ["n1", "n2", "n3", "n4", "n5"]
        edges = [("n1", "n2"), ("n2", "n3"), ("n4", "n5")]
        assert GraphStatisticsService._compute_lcc(nodes, edges) == 3

    def test_fully_connected_graph(self):
        # All 5 nodes connected — LCC = 5
        nodes = ["n1", "n2", "n3", "n4", "n5"]
        edges = [
            ("n1", "n2"), ("n2", "n3"), ("n3", "n4"), ("n4", "n5"), ("n5", "n1"),
        ]
        assert GraphStatisticsService._compute_lcc(nodes, edges) == 5

    def test_linear_chain(self):
        # n1 → n2 → n3 → n4 → n5 — treated as undirected so all in one component
        nodes = ["n1", "n2", "n3", "n4", "n5"]
        edges = [("n1", "n2"), ("n2", "n3"), ("n3", "n4"), ("n4", "n5")]
        assert GraphStatisticsService._compute_lcc(nodes, edges) == 5

    def test_star_graph(self):
        # Centre n1 connected to n2..n5 — one component of size 5
        nodes = ["n1", "n2", "n3", "n4", "n5"]
        edges = [("n1", "n2"), ("n1", "n3"), ("n1", "n4"), ("n1", "n5")]
        assert GraphStatisticsService._compute_lcc(nodes, edges) == 5

    def test_isolated_node_plus_large_component(self):
        # n5 is completely isolated — LCC should still be 4 (n1-n4)
        nodes = ["n1", "n2", "n3", "n4", "n5"]
        edges = [("n1", "n2"), ("n2", "n3"), ("n3", "n4")]
        assert GraphStatisticsService._compute_lcc(nodes, edges) == 4

    def test_self_loops_ignored(self):
        # Self-loop (n1, n1) — node references itself; should still count n1 once
        nodes = ["n1", "n2"]
        edges = [("n1", "n1"), ("n1", "n2")]
        result = GraphStatisticsService._compute_lcc(nodes, edges)
        assert result == 2

    def test_edges_with_unknown_node_ids_skipped(self):
        # Edge references a node not in the node list — should be silently skipped
        nodes = ["n1", "n2"]
        edges = [("n1", "n2"), ("n1", "ghost_node")]
        result = GraphStatisticsService._compute_lcc(nodes, edges)
        assert result == 2

