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
def repository_context(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'repository.db'}", connect_args={"check_same_thread": False})
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(engine)
    db = session_factory()
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path / "uploads"))

    def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as client:
        yield client, db, tmp_path
    app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(engine)


def register(client, email):
    response = client.post("/api/v1/auth/register", json={"email": email, "name": "Repository User", "password": "secure_password_123"})
    assert response.status_code == 200
    return response.json()["data"]


def setup_project(db, user_id):
    workspace = Workspace(id="repository-workspace", name="Repository Workspace")
    project = Project(id="repository-project", workspace_id=workspace.id, name="Repository Project", owner="Repository User")
    db.add_all([workspace, project]); db.flush()
    db.execute(workspace_members.insert().values(workspace_id=workspace.id, user_id=user_id, role="owner")); db.commit()
    return project


def zip_bytes(entries):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
    return output.getvalue()


def test_repository_crud_search_git_and_permissions(repository_context):
    client, db, _ = repository_context
    owner = register(client, "repository-owner@codescope.ai")
    outsider = register(client, "repository-outsider@codescope.ai")
    project = setup_project(db, owner["user"]["id"])
    headers = {"Authorization": f"Bearer {owner['access_token']}"}
    outsider_headers = {"Authorization": f"Bearer {outsider['access_token']}"}

    payload = {"project_id": project.id, "name": "Core API", "visibility": "Private", "tags": ["python", "api"]}
    created = client.post("/api/v1/repositories", json=payload, headers=headers)
    assert created.status_code == 201
    repository_id = created.json()["data"]["id"]
    assert created.json()["data"]["tags"] == ["python", "api"]
    assert client.post("/api/v1/repositories", json=payload, headers=headers).status_code == 409

    listed = client.get(f"/api/v1/repositories/search?project_id={project.id}&search=Core&tag=python", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["data"]["pagination"]["total"] == 1
    assert client.get(f"/api/v1/repositories?project_id={project.id}", headers=outsider_headers).status_code == 403
    assert client.patch(f"/api/v1/repositories/{repository_id}", json={"name": "Nope"}, headers=outsider_headers).status_code == 403

    favorite = client.post(f"/api/v1/repositories/{repository_id}/favorite", json={"favorite": True}, headers=headers)
    assert favorite.status_code == 200
    filtered = client.get(f"/api/v1/repositories?project_id={project.id}&favorite=true", headers=headers)
    assert filtered.json()["data"]["pagination"]["total"] == 1

    connected = client.post("/api/v1/repositories/connect", json={
        "project_id": project.id, "name": "Remote API", "git_url": "https://github.com/example/example.git", "git_branch": "develop"
    }, headers=headers)
    assert connected.status_code == 201
    assert connected.json()["data"]["status"] == "connected"
    assert client.post("/api/v1/repositories/connect", json={
        "project_id": project.id, "name": "Unsafe Remote", "git_url": "https://user:secret@example.com/repo.git"
    }, headers=headers).status_code == 422

    assert client.post(f"/api/v1/repositories/{repository_id}/archive", json={"archive": True}, headers=headers).json()["data"]["status"] == "archived"
    assert client.delete(f"/api/v1/repositories/{repository_id}", headers=headers).status_code == 200


def test_zip_upload_metadata_and_validation(repository_context):
    client, db, tmp_path = repository_context
    owner = register(client, "upload-owner@codescope.ai")
    project = setup_project(db, owner["user"]["id"])
    headers = {"Authorization": f"Bearer {owner['access_token']}"}
    form = {"project_id": project.id, "name": "Uploaded API", "visibility": "Internal", "tags": '["python","fastapi"]'}
    valid_zip = zip_bytes({"src/main.py": "print('ok')", "README.md": "# API"})
    response = client.post("/api/v1/repositories/upload", data=form, files={"file": ("source.zip", valid_zip, "application/zip")}, headers=headers)
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["metadata"]["total_files"] == 2
    assert data["metadata"]["archive_sha256"]
    assert data["tags"] == ["python", "fastapi"]
    assert len(client.get(f"/api/v1/repositories/{data['id']}/uploads", headers=headers).json()["data"]) == 1
    assert len(client.get(f"/api/v1/repositories/{data['id']}/activity", headers=headers).json()["data"]) >= 1

    corrupt = client.post("/api/v1/repositories/upload", data={**form, "name": "Corrupt API"}, files={"file": ("bad.zip", b"not a zip", "application/zip")}, headers=headers)
    assert corrupt.status_code == 422
    traversal = zip_bytes({"../outside.txt": "unsafe"})
    unsafe = client.post("/api/v1/repositories/upload", data={**form, "name": "Unsafe API"}, files={"file": ("unsafe.zip", traversal, "application/zip")}, headers=headers)
    assert unsafe.status_code == 422
    assert not (tmp_path / "outside.txt").exists()
