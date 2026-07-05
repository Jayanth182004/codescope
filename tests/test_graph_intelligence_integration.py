import pytest
from unittest.mock import MagicMock, patch

from app.modules.graph.intelligence_services import PathFindingService, DependencyQueryService
from app.modules.graph.intelligence_schemas import PathItem, GraphNodeOut

# Dummy node for tests
DUMMY_NODE = GraphNodeOut(
    node_id="test_node_1",
    repository_id="repo1",
    entity_key="key",
    label="Function",
    entity_type="Function",
    name="test_func",
    file_path="main.py",
    analysis_run_id="run1"
)

@patch("app.modules.graph.intelligence_services.neo4j_session")
def test_path_finding_shortest_path_integration(mock_session_manager):
    # Setup mock session
    mock_session = MagicMock()
    mock_session_manager.return_value.__enter__.return_value = mock_session
    
    # Mock Neo4j record response
    mock_record = {
        "path_nodes": [{"node_id": "n1"}, {"node_id": "n2"}],
        "path_rels": [{"source_node_id": "n1", "target_node_id": "n2", "relationship_type": "CALLS"}]
    }
    
    mock_result = MagicMock()
    mock_result.single.return_value = mock_record
    mock_session.run.return_value = mock_result
    
    # Run test
    service = PathFindingService()
    path_item = service.shortest_path("n1", "n2", max_depth=3)
    
    # Verify
    assert path_item is not None
    assert path_item.length == 1
    mock_session.run.assert_called_once()
    assert "shortestPath" in mock_session.run.call_args[0][0]

@patch("app.modules.graph.intelligence_services.neo4j_session")
@patch("app.modules.graph.intelligence_services._fetch_root_node")
def test_dependency_query_integration(mock_fetch_root, mock_session_manager):
    mock_session = MagicMock()
    mock_session_manager.return_value.__enter__.return_value = mock_session
    mock_fetch_root.return_value = DUMMY_NODE
    
    # Mock direct, transitive, and reverse dependencies responses
    mock_result = MagicMock()
    # Return empty lists for simplicity in the mock
    mock_result.data.return_value = []
    mock_session.run.return_value = mock_result
    
    service = DependencyQueryService()
    result = service.get_dependencies("test_node_1", max_depth=2, transitive=True)
    
    assert result.node.node_id == "test_node_1"
    assert result.direct_count == 0
    assert result.transitive_count == 0
    assert result.reverse_count == 0
    assert mock_session.run.call_count == 3  # Direct, transitive, reverse
