from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_diagnostic_evidence_builds_transparent_learner_state() -> None:
    email = f"adaptive-{uuid4()}@example.com"
    with TestClient(app) as client:
        response = client.post("/api/v1/identity/register", json={
            "email": email, "display_name": "Adaptive Learner",
            "password": "a-strong-password", "role": "student",
        })
        assert response.status_code == 201
        approve_email(email)
        token = client.post("/api/v1/identity/login", json={
            "email": email, "password": "a-strong-password",
        }).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        state = client.post("/api/v1/learning/adaptive/evidence", headers=headers, json={
            "concept": "Fractions", "evidence_type": "diagnostic",
            "score": 0.8, "difficulty": 0.6,
        })
        dashboard = client.get("/api/v1/learning/adaptive/me", headers=headers)

    assert state.status_code == 200
    assert state.json()["mastery"] > 0.25
    assert state.json()["recommendation"]["action"]
    assert dashboard.status_code == 200
    assert dashboard.json()["states"][0]["concept"] == "Fractions"
    assert dashboard.json()["states"][0]["model_version"] == "lens-omega-0.1"


def test_student_cannot_write_evidence_for_another_user() -> None:
    email = f"privacy-{uuid4()}@example.com"
    with TestClient(app) as client:
        client.post("/api/v1/identity/register", json={
            "email": email, "display_name": "Private Learner",
            "password": "a-strong-password", "role": "student",
        })
        approve_email(email)
        token = client.post("/api/v1/identity/login", json={
            "email": email, "password": "a-strong-password",
        }).json()["access_token"]
        response = client.post("/api/v1/learning/adaptive/evidence", headers={"Authorization": f"Bearer {token}"}, json={
            "user_id": str(uuid4()), "concept": "Algebra",
            "evidence_type": "teacher_observation", "score": 0.7,
        })

    assert response.status_code == 403
