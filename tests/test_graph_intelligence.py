import pytest

from app.modules.graph.intelligence_services import (
    GraphTraversalService,
    _direction_pattern,
    _rel_pattern,
    _validate_rel_types,
)

# ── 1. Unit Tests for Cypher Query Helpers ────────────────────────────────────

def test_validate_rel_types():
    assert _validate_rel_types(None) == []
    assert _validate_rel_types([]) == []
    # Valid types get uppercase normalized
    assert set(_validate_rel_types(["imports", "CALLS"])) == {"IMPORTS", "CALLS"}
    # Invalid types get stripped out
    assert _validate_rel_types(["IMPORTS", "HACK_DROP_TABLE"]) == ["IMPORTS"]


def test_rel_pattern():
    assert _rel_pattern([]) == ""
    assert _rel_pattern(["CALLS"]) == ":CALLS"
    assert _rel_pattern(["CALLS", "IMPORTS"]) == ":CALLS|IMPORTS"


def test_direction_pattern():
    assert _direction_pattern("outgoing", ":CALLS", 3) == "-[r:CALLS*1..3]->"
    assert _direction_pattern("incoming", ":CALLS", 3) == "<-[r:CALLS*1..3]-"
    assert _direction_pattern("both", ":CALLS", 3) == "-[r:CALLS*1..3]-"
    assert _direction_pattern("outgoing", "", 5) == "-[r*1..5]->"


# ── 2. Unit Tests for Python Iterative DFS ────────────────────────────────────

class TestPythonDFS:
    """
    Test the iterative DFS algorithm used when traversal_mode='dfs'.
    Uses a static dictionary as the adjacency list.
    """

    def test_dfs_single_node(self):
        adjacency = {}
        order = GraphTraversalService._python_dfs("n1", adjacency)
        assert order == ["n1"]

    def test_dfs_linear_chain(self):
        # n1 -> n2 -> n3 -> n4
        adjacency = {
            "n1": ["n2"],
            "n2": ["n3"],
            "n3": ["n4"],
            "n4": [],
        }
        order = GraphTraversalService._python_dfs("n1", adjacency)
        assert order == ["n1", "n2", "n3", "n4"]

    def test_dfs_tree_ordering(self):
        # n1 -> n2, n3
        # n2 -> n4, n5
        # n3 -> n6
        adjacency = {
            "n1": ["n2", "n3"],
            "n2": ["n4", "n5"],
            "n3": ["n6"],
            "n4": [],
            "n5": [],
            "n6": [],
        }
        order = GraphTraversalService._python_dfs("n1", adjacency)
        # Expected DFS: n1, n2, n4, n5, n3, n6
        assert order == ["n1", "n2", "n4", "n5", "n3", "n6"]

    def test_dfs_with_cycle(self):
        # n1 -> n2 -> n3 -> n1 (cycle)
        # n2 -> n4
        adjacency = {
            "n1": ["n2"],
            "n2": ["n3", "n4"],
            "n3": ["n1"],
            "n4": [],
        }
        order = GraphTraversalService._python_dfs("n1", adjacency)
        # Should visit n1, n2, n3, then n4, avoiding infinite loop
        assert order == ["n1", "n2", "n3", "n4"]

    def test_dfs_disconnected_components(self):
        # Even if adjacency has other components, it only explores reachable ones
        adjacency = {
            "n1": ["n2"],
            "n2": [],
            "n3": ["n4"], # n3 is not reachable from n1
        }
        order = GraphTraversalService._python_dfs("n1", adjacency)
        assert order == ["n1", "n2"]
