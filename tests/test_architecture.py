import io
import zipfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.database.session import Base, get_db
from app.main import app
from app.modules.architecture.services import FrameworkDetectionService, LayerDetectionService
from app.modules.dependencies.models import DependencyNode
from app.modules.project.models import Project
from app.modules.workspace.models import Workspace, workspace_members


@pytest.fixture()
def architecture_context(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'architecture.db'}", connect_args={"check_same_thread": False})
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
    response = client.post("/api/v1/auth/register", json={"email": email, "name": "Architecture User", "password": "secure_password_123"})
    assert response.status_code == 200
    return response.json()["data"]


def setup_project(db, user_id):
    suffix = user_id[:8]
    workspace = Workspace(id=f"architecture-workspace-{suffix}", name="Architecture Workspace")
    project = Project(id=f"architecture-project-{suffix}", workspace_id=workspace.id, name="Architecture Project", owner="Architecture User")
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
        data={"project_id": project_id, "name": "Architecture API", "visibility": "Internal", "tags": '["architecture"]'},
        files={"file": ("source.zip", zip_bytes(entries), "application/zip")},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def test_framework_and_layer_detection_heuristics():
    nodes = [
        DependencyNode(id="1", dependency_id="d", repository_id="r", analysis_run_id="a", entity_type="file", entity_key="api/main.py", name="main.py", label="api/main.py", file_path="api/main.py"),
        DependencyNode(id="2", dependency_id="d", repository_id="r", analysis_run_id="a", entity_type="file", entity_key="src/components/App.tsx", name="App.tsx", label="src/components/App.tsx", file_path="src/components/App.tsx"),
        DependencyNode(id="3", dependency_id="d", repository_id="r", analysis_run_id="a", entity_type="file", entity_key="app/repository.py", name="repository.py", label="app/repository.py", file_path="app/repository.py"),
    ]
    frameworks = FrameworkDetectionService().detect(nodes)
    assert "FastAPI" in frameworks
    assert "React" in frameworks
    assert LayerDetectionService().classify(nodes[2])[:2] == ("repository", "repository")


def test_architecture_build_and_read_endpoints(architecture_context):
    client, db = architecture_context
    owner = register(client, "architecture-owner@example.com")
    project = setup_project(db, owner["user"]["id"])
    headers = {"Authorization": f"Bearer {owner['access_token']}"}
    repository_id = upload_repository(
        client,
        project.id,
        headers,
        {
            "app/main.py": "from fastapi import FastAPI\nfrom app.routes.users import router\napp = FastAPI()\napp.include_router(router)\n",
            "app/routes/users.py": "from app.services.user_service import UserService\n\ndef list_users():\n    return UserService().list_users()\n",
            "app/services/user_service.py": "from app.repositories.user_repository import UserRepository\n\nclass UserService:\n    def list_users(self):\n        return UserRepository().all()\n",
            "app/repositories/user_repository.py": "from app.models.user import User\n\nclass UserRepository:\n    def all(self):\n        return []\n",
            "app/models/user.py": "class User:\n    pass\n",
        },
    )
    assert client.post(f"/api/v1/analysis/start/{repository_id}", headers=headers).status_code == 200
    assert client.post(f"/api/v1/dependencies/build/{repository_id}", headers=headers).status_code == 200

    built = client.post(f"/api/v1/architecture/build/{repository_id}", headers=headers)
    assert built.status_code == 200
    assert built.json()["data"]["status"] in {"completed", "completed_with_warnings"}

    overview = client.get(f"/api/v1/architecture/{repository_id}", headers=headers)
    assert overview.status_code == 200
    data = overview.json()["data"]
    assert data["metrics"]["layer_count"] >= 3
    assert data["components"]

    for path in ["layers", "services", "routes", "request-flows", "metrics", "health", "anti-patterns"]:
        response = client.get(f"/api/v1/architecture/{path}/{repository_id}", headers=headers)
        assert response.status_code == 200, response.text

    outsider = register(client, "architecture-outsider@example.com")
    outsider_headers = {"Authorization": f"Bearer {outsider['access_token']}"}
    assert client.get(f"/api/v1/architecture/{repository_id}", headers=outsider_headers).status_code == 403
