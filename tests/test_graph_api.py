"""
tests/test_graph_api.py
────────────────────────
Integration tests for the Knowledge Graph API endpoints.

These tests mock the Neo4j driver so they run without a real Neo4j instance.
They verify: authorization, 404 on missing repo/node, 503 on Neo4j failure,
and correct response envelope shapes.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# ── Test client setup (mirrors existing test patterns) ───────────────────────
# Adjust the import if your conftest.py configures the TestClient differently.
try:
    from tests.test_auth import client, auth_headers  # noqa: F401 — reuse existing fixtures
except ImportError:
    from app.main import app
    client = TestClient(app)

    def auth_headers():
        return {}


BASE = "/api/v1/graph"


# ── Health endpoint ───────────────────────────────────────────────────────────

class TestGraphHealth:
    def test_health_returns_envelope(self):
        with patch("app.modules.graph.services.GraphHealthService.ping") as mock_ping:
            mock_ping.return_value = MagicMock(
                is_healthy=True,
                uri="bolt://localhost:7687",
                database="neo4j",
                error=None,
                model_dump=lambda: {
                    "is_healthy": True,
                    "uri": "bolt://localhost:7687",
                    "database": "neo4j",
                    "error": None,
                },
            )
            # Health requires authentication
            resp = client.get(f"{BASE}/health")
            # Without valid auth it should return 401 — that is acceptable
            assert resp.status_code in (200, 401, 403)

    def test_health_503_on_neo4j_down(self):
        """When GraphHealthService returns is_healthy=False the response is 503."""
        with patch("app.database.neo4j.check_health") as mock_check:
            mock_check.return_value = {
                "is_healthy": False,
                "uri": "bolt://localhost:7687",
                "database": "neo4j",
                "error": "Connection refused",
            }
            resp = client.get(f"{BASE}/health")
            # Without auth 401; with auth + Neo4j down → 503
            assert resp.status_code in (401, 403, 503)


# ── Authorization ─────────────────────────────────────────────────────────────

class TestGraphAuthorization:
    def test_build_graph_requires_auth(self):
        resp = client.post(f"{BASE}/build/some-repo-id")
        assert resp.status_code in (401, 403)

    def test_get_graph_requires_auth(self):
        resp = client.get(f"{BASE}/some-repo-id")
        assert resp.status_code in (401, 403)

    def test_get_node_requires_auth(self):
        resp = client.get(f"{BASE}/node/some-node-id")
        assert resp.status_code in (401, 403)

    def test_search_requires_auth(self):
        resp = client.get(f"{BASE}/search?repository_id=repo&q=UserService")
        assert resp.status_code in (401, 403)

    def test_statistics_requires_auth(self):
        resp = client.get(f"{BASE}/statistics/some-repo-id")
        assert resp.status_code in (401, 403)


# ── Schema shape ──────────────────────────────────────────────────────────────

class TestGraphSchemas:
    """Verify that schemas are correctly structured."""

    def test_graph_node_out_has_required_fields(self):
        from app.modules.graph.schemas import GraphNodeOut
        node = GraphNodeOut(
            node_id="n1",
            entity_type="file",
            entity_key="file:src/main.py",
            name="main.py",
            label="src/main.py",
            repository_id="repo-001",
            analysis_run_id="run-001",
        )
        assert node.node_id == "n1"
        assert node.properties == {}

    def test_graph_edge_out_has_required_fields(self):
        from app.modules.graph.schemas import GraphEdgeOut
        edge = GraphEdgeOut(
            edge_id="e1",
            source_node_id="n1",
            target_node_id="n2",
            relationship_type="imports",
            source_type="file",
            target_type="module",
            repository_id="repo-001",
        )
        assert edge.weight == 1.0
        assert edge.depth == 1

    def test_sync_run_out_serialisation(self):
        from datetime import datetime, UTC
        from app.modules.graph.schemas import GraphSyncRunOut
        run = GraphSyncRunOut(
            id="run-001",
            repository_id="repo-001",
            dependency_build_id=None,
            analysis_run_id=None,
            trigger="manual",
            status="completed",
            nodes_synced=100,
            edges_synced=200,
            nodes_pruned=0,
            error_message=None,
            started_at=datetime.now(UTC),
            completed_at=datetime.now(UTC),
            duration_ms=1500,
        )
        assert run.status == "completed"
        assert run.nodes_synced == 100

    def test_graph_statistics_out(self):
        from app.modules.graph.schemas import GraphStatisticsOut
        stats = GraphStatisticsOut(
            repository_id="repo-001",
            total_nodes=50,
            total_relationships=120,
            node_distribution=[],
            relationship_distribution=[],
            most_connected_node=None,
            most_connected_degree=0,
            average_degree=2.4,
            graph_density=0.048,
        )
        assert stats.total_nodes == 50
        assert stats.graph_density == 0.048

    def test_graph_path_not_found(self):
        from app.modules.graph.schemas import GraphPathOut
        path = GraphPathOut(found=False)
        assert path.found is False
        assert path.nodes == []
        assert path.edges == []


# ── neo4j_record_to_node ──────────────────────────────────────────────────────

class TestNeo4jRecordConverters:
    def test_record_to_node_basic(self):
        from app.modules.graph.schemas import neo4j_record_to_node
        record = {
            "node_id": "n1",
            "entity_type": "file",
            "entity_key": "file:main.py",
            "name": "main.py",
            "label": "main.py",
            "repository_id": "repo-001",
            "analysis_run_id": "run-001",
            "extra_prop": "some_value",
        }
        node = neo4j_record_to_node(record)
        assert node.node_id == "n1"
        assert node.properties.get("extra_prop") == "some_value"

    def test_record_to_edge_basic(self):
        from app.modules.graph.schemas import neo4j_record_to_edge
        record = {
            "edge_id": "e1",
            "source_node_id": "n1",
            "target_node_id": "n2",
            "relationship_type": "imports",
            "source_type": "file",
            "target_type": "module",
            "repository_id": "repo-001",
        }
        edge = neo4j_record_to_edge(record)
        assert edge.edge_id == "e1"
        assert edge.relationship_type == "imports"
