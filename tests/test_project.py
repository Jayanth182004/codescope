import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database.session import Base, get_db
from app.modules.workspace.models import Workspace, workspace_members
from app.modules.project.models import Project, Favorite

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    import app.modules.auth.models
    import app.modules.workspace.models
    import app.modules.project.models
    import app.modules.dashboard.models
    import app.modules.repository.models

    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="module")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_project_endpoints(client, db_session):
    # 1. Register a user and login to get JWT
    reg_payload = {
        "email": "owner@codescope.ai",
        "name": "Project Owner",
        "password": "secure_password_hash_1"
    }
    resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert resp.status_code == 200
    access_token = resp.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Retrieve current user
    me_resp = client.get("/api/v1/users/me", headers=headers)
    user_id = me_resp.json()["data"]["id"]

    # 2. Setup mock workspace for owner role
    ws_id = "test-ws-1"
    db_ws = Workspace(id=ws_id, name="Test Workspace")
    db_session.add(db_ws)
    db_session.flush()

    db_session.execute(
        workspace_members.insert().values(
            workspace_id=ws_id,
            user_id=user_id,
            role="owner"
        )
    )
    db_session.commit()

    # 3. Create a Project
    proj_payload = {
        "workspace_id": ws_id,
        "name": "New Project",
        "description": "Initial Setup Description",
        "icon": "🚀",
        "color": "#FF5733",
        "visibility": "Public"
    }
    create_resp = client.post("/api/v1/projects", json=proj_payload, headers=headers)
    assert create_resp.status_code == 200
    proj_data = create_resp.json()["data"]
    assert proj_data["name"] == "New Project"
    proj_id = proj_data["id"]

    # 4. Get Project details
    get_resp = client.get(f"/api/v1/projects/{proj_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["favorite"] is False

    # 5. Favorite the project
    fav_payload = {"favorite": True}
    fav_resp = client.post(f"/api/v1/projects/{proj_id}/favorite", json=fav_payload, headers=headers)
    assert fav_resp.status_code == 200

    # Verify updated favorite status
    get_resp = client.get(f"/api/v1/projects/{proj_id}", headers=headers)
    assert get_resp.json()["data"]["favorite"] is True

    # 6. Update the project
    update_payload = {
        "name": "Updated Project Name",
        "description": "Updated Description"
    }
    update_resp = client.patch(f"/api/v1/projects/{proj_id}", json=update_payload, headers=headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["data"]["name"] == "Updated Project Name"

    # 7. List Projects in workspace
    list_resp = client.get(f"/api/v1/projects?workspace_id={ws_id}", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()["data"]) == 1

    # 7b. A user outside the workspace cannot list or mutate projects
    outsider_payload = {
        "email": "outsider@codescope.ai",
        "name": "Outside User",
        "password": "secure_password_hash_2"
    }
    outsider_resp = client.post("/api/v1/auth/register", json=outsider_payload)
    assert outsider_resp.status_code == 200
    outsider_headers = {"Authorization": f"Bearer {outsider_resp.json()['data']['access_token']}"}

    denied_list_resp = client.get(f"/api/v1/projects?workspace_id={ws_id}", headers=outsider_headers)
    assert denied_list_resp.status_code == 403

    denied_patch_resp = client.patch(
        f"/api/v1/projects/{proj_id}",
        json={"name": "Unauthorized Rename"},
        headers=outsider_headers
    )
    assert denied_patch_resp.status_code == 403

    # 8. Delete the project
    del_resp = client.delete(f"/api/v1/projects/{proj_id}", headers=headers)
    assert del_resp.status_code == 200

    # Ensure it's deleted
    get_gone_resp = client.get(f"/api/v1/projects/{proj_id}", headers=headers)
    assert get_gone_resp.status_code == 404
