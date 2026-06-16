import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database.session import Base, get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    # Import modular schema maps to make metadata declaration aware of tests
    import app.modules.auth.models
    import app.modules.workspace.models
    import app.modules.project.models
    import app.modules.dashboard.models
    
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

def test_auth_workflow(client):
    payload = {
        "email": "developer@codescope.ai",
        "name": "Arjun Mehta",
        "password": "secure_password_hash_1"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert "access_token" in res_data["data"]
    assert res_data["data"]["user"]["email"] == "developer@codescope.ai"
    
    access_token = res_data["data"]["access_token"]

    login_payload = {
        "email": "developer@codescope.ai",
        "password": "secure_password_hash_1"
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True

    headers = {"Authorization": f"Bearer {access_token}"}
    response = client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "Arjun Mehta"

    response = client.get("/api/v1/users/me")
    assert response.status_code == 401
