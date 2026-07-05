import io
import zipfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.database.session import Base, get_db
from app.main import app
from app.modules.project.models import Project
from app.modules.workspace.models import Workspace, workspace_members


@pytest.fixture()
def dependency_context(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'dependencies.db'}", connect_args={"check_same_thread": False})
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(engine)
    db = session_factory()
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setattr(settings, "MAX_ANALYSIS_FILES", 1000)
    monkeypatch.setattr(settings, "MAX_ANALYZED_FILE_SIZE_BYTES", 1024 * 1024)

    def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as client:
        yield client, db
    app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(engine)


def register(client, email):
    response = client.post("/api/v1/auth/register", json={"email": email, "name": "Dependency User", "password": "secure_password_123"})
    assert response.status_code == 200
    return response.json()["data"]


def setup_project(db, user_id):
    suffix = user_id[:8]
    workspace = Workspace(id=f"dependency-workspace-{suffix}", name="Dependency Workspace")
    project = Project(id=f"dependency-project-{suffix}", workspace_id=workspace.id, name="Dependency Project", owner="Dependency User")
    db.add_all([workspace, project])
    db.flush()
    db.execute(workspace_members.insert().values(workspace_id=workspace.id, user_id=user_id, role="owner"))
    db.commit()
    return project


def zip_bytes(entries):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
    return output.getvalue()


def upload_repository(client, project_id, headers, entries):
    response = client.post(
        "/api/v1/repositories/upload",
        data={"project_id": project_id, "name": "Dependency API", "visibility": "Internal", "tags": '["dependencies"]'},
        files={"file": ("source.zip", zip_bytes(entries), "application/zip")},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def analyzed_repository(client, db):
    owner = register(client, "dependency-owner@codescope.ai")
    project = setup_project(db, owner["user"]["id"])
    headers = {"Authorization": f"Bearer {owner['access_token']}"}
    repository_id = upload_repository(client, project.id, headers, {
        "src/__init__.py": "",
        "src/a.py": (
            "import src.b\n"
            "class Service(src.b.Base):\n"
            "    def build(self, value: src.b.Base) -> src.b.Base:\n"
            "        return value\n"
        ),
        "src/b.py": (
            "import src.a\n"
            "class Base:\n"
            "    pass\n"
        ),
    })
    assert client.post(f"/api/v1/analysis/start/{repository_id}", headers=headers).status_code == 200
    return repository_id, headers


def test_dependency_build_graph_metrics_cycles_and_blast_radius(dependency_context):
    client, db = dependency_context
    repository_id, headers = analyzed_repository(client, db)

    built = client.post(f"/api/v1/dependencies/build/{repository_id}", headers=headers)
    assert built.status_code == 200
    build = built.json()["data"]
    assert build["status"] in {"completed", "completed_with_warnings"}
    assert build["nodes_count"] >= 8
    assert build["edges_count"] >= 8

    report = client.get(f"/api/v1/dependencies/{repository_id}", headers=headers)
    assert report.status_code == 200
    assert report.json()["data"]["metrics"]["total_edges"] == build["edges_count"]

    graph = client.get(f"/api/v1/dependencies/graph/{repository_id}", headers=headers).json()["data"]
    relationships = {edge["relationship_type"] for edge in graph["edges"]}
    assert {"imports", "contains", "belongs_to"} <= relationships
    assert any(edge["relationship_type"] == "inherits" for edge in graph["edges"])

    cycles = client.get(f"/api/v1/dependencies/cycles/{repository_id}", headers=headers)
    assert cycles.status_code == 200
    assert cycles.json()["data"]

    file_node = next(node for node in graph["nodes"] if node["entity_type"] == "file" and node["label"] == "src/b.py")
    detail = client.get(f"/api/v1/dependencies/node/{file_node['id']}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["data"]["incoming"] or detail.json()["data"]["outgoing"]

    tree = client.get(f"/api/v1/dependencies/tree/{file_node['id']}", headers=headers)
    assert tree.status_code == 200
    assert tree.json()["data"]["node"]["id"] == file_node["id"]

    blast = client.get(f"/api/v1/dependencies/blast-radius/{file_node['id']}", headers=headers)
    assert blast.status_code == 200
    assert blast.json()["data"]["total_affected"] >= 1


def test_dependency_permissions_and_missing_analysis(dependency_context):
    client, db = dependency_context
    repository_id, headers = analyzed_repository(client, db)
    outsider = register(client, "dependency-outsider@codescope.ai")
    outsider_headers = {"Authorization": f"Bearer {outsider['access_token']}"}

    assert client.post(f"/api/v1/dependencies/build/{repository_id}", headers=outsider_headers).status_code == 403
    assert client.get(f"/api/v1/dependencies/{repository_id}", headers=outsider_headers).status_code == 403

    owner = register(client, "dependency-empty-owner@codescope.ai")
    project = setup_project(db, owner["user"]["id"])
    empty_headers = {"Authorization": f"Bearer {owner['access_token']}"}
    empty_repository_id = upload_repository(client, project.id, empty_headers, {"README.md": "# No analysis yet\n"})
    assert client.post(f"/api/v1/dependencies/build/{empty_repository_id}", headers=empty_headers).status_code == 404
