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
def analysis_context(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'analysis.db'}", connect_args={"check_same_thread": False})
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
    response = client.post("/api/v1/auth/register", json={"email": email, "name": "Analysis User", "password": "secure_password_123"})
    assert response.status_code == 200
    return response.json()["data"]


def setup_project(db, user_id):
    workspace = Workspace(id="analysis-workspace", name="Analysis Workspace")
    project = Project(id="analysis-project", workspace_id=workspace.id, name="Analysis Project", owner="Analysis User")
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


def upload_repository(client, project_id, headers, entries, name="Analyzed API"):
    response = client.post(
        "/api/v1/repositories/upload",
        data={"project_id": project_id, "name": name, "visibility": "Internal", "tags": '["analysis"]'},
        files={"file": ("source.zip", zip_bytes(entries), "application/zip")},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def test_repository_analysis_extracts_files_python_entities_imports_and_metrics(analysis_context):
    client, db = analysis_context
    owner = register(client, "analysis-owner@codescope.ai")
    project = setup_project(db, owner["user"]["id"])
    headers = {"Authorization": f"Bearer {owner['access_token']}"}
    repository_id = upload_repository(client, project.id, headers, {
        "src/__init__.py": '"""Application package."""\n',
        "src/service.py": (
            '"""Service module."""\n'
            "import os\n"
            "from typing import Optional as Maybe\n\n"
            "class UserService(BaseService):\n"
            '    """Coordinates users."""\n'
            "    def __init__(self, repository):\n"
            "        self.repository = repository\n\n"
            "    async def fetch_user(self, user_id: str) -> dict:\n"
            "        return {}\n\n"
            "def normalize_name(name: str = 'guest') -> str:\n"
            "    return name.strip()\n"
        ),
        "package.json": '{"name":"codescope-fixture"}',
        "README.md": "# Fixture\n",
        "Dockerfile": "FROM python:3.12-slim\n",
    })

    started = client.post(f"/api/v1/analysis/start/{repository_id}", headers=headers)
    assert started.status_code == 200
    run = started.json()["data"]
    assert run["status"] == "completed"
    assert run["files_discovered"] == 5
    assert run["files_parsed"] == 2

    report = client.get(f"/api/v1/analysis/{repository_id}", headers=headers).json()["data"]
    assert report["metrics"]["total_files"] == 5
    assert report["metrics"]["functions"] == 3
    assert report["metrics"]["classes"] == 1
    assert report["metrics"]["imports"] == 2
    assert {language["language"] for language in report["languages"]} >= {"Python", "JSON", "Markdown", "Dockerfile"}

    files = client.get(f"/api/v1/analysis/files?repository_id={repository_id}&search=service", headers=headers).json()["data"]
    assert files["total"] == 1
    assert files["items"][0]["path"] == "src/service.py"
    assert files["items"][0]["parse_status"] == "parsed"

    functions = client.get(f"/api/v1/analysis/functions?repository_id={repository_id}", headers=headers).json()["data"]["items"]
    function_names = {function["qualified_name"]: function for function in functions}
    assert "src.service.UserService.fetch_user" in function_names
    assert function_names["src.service.UserService.fetch_user"]["is_async"] is True
    assert function_names["src.service.normalize_name"]["parameters"][0]["name"] == "name"

    classes = client.get(f"/api/v1/analysis/classes?repository_id={repository_id}", headers=headers).json()["data"]["items"]
    assert classes[0]["name"] == "UserService"
    assert classes[0]["bases"] == ["BaseService"]

    modules = client.get(f"/api/v1/analysis/modules?repository_id={repository_id}", headers=headers).json()["data"]["items"]
    assert {module["name"] for module in modules} == {"src", "src.service"}

    imports = client.get(f"/api/v1/analysis/imports?repository_id={repository_id}", headers=headers).json()["data"]["items"]
    assert {item["module"] for item in imports} == {"os", "typing"}

    assert client.get(f"/api/v1/analysis/status/{repository_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/analysis/metrics/{repository_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/analysis/files/{repository_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/analysis/functions/{repository_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/analysis/classes/{repository_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/analysis/modules/{repository_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/analysis/imports/{repository_id}", headers=headers).status_code == 200


def test_analysis_permissions_and_warning_states(analysis_context, monkeypatch):
    client, db = analysis_context
    owner = register(client, "analysis-warning-owner@codescope.ai")
    outsider = register(client, "analysis-warning-outsider@codescope.ai")
    project = setup_project(db, owner["user"]["id"])
    headers = {"Authorization": f"Bearer {owner['access_token']}"}
    outsider_headers = {"Authorization": f"Bearer {outsider['access_token']}"}
    monkeypatch.setattr(settings, "MAX_ANALYZED_FILE_SIZE_BYTES", 20)
    repository_id = upload_repository(client, project.id, headers, {
        "bad.py": "def broken(:\n",
        "large.py": "x = 'this file is intentionally too large for the test parser limit'\n",
        "notes.txt": "ignored",
    }, name="Warning API")

    assert client.post(f"/api/v1/analysis/start/{repository_id}", headers=outsider_headers).status_code == 403
    started = client.post(f"/api/v1/analysis/start/{repository_id}", headers=headers)
    assert started.status_code == 200
    run = started.json()["data"]
    assert run["status"] == "completed_with_warnings"
    assert run["errors_count"] >= 1
    assert run["warnings"]

    files = client.get(f"/api/v1/analysis/files?repository_id={repository_id}", headers=headers).json()["data"]["items"]
    statuses = {file["path"]: file["parse_status"] for file in files}
    assert statuses["bad.py"] == "failed"
    assert statuses["large.py"] == "skipped"
    assert client.get(f"/api/v1/analysis/{repository_id}", headers=outsider_headers).status_code == 403
