from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_learning_intelligence_profile_uses_evidence() -> None:
    email = f"intelligence-{uuid4()}@example.com"
    with TestClient(app) as client:
        client.post(
            "/api/v1/identity/register",
            json={"email": email, "display_name": "Learner", "password": "abc12345", "role": "student"},
        )
        approve_email(email)
        token = client.post(
            "/api/v1/identity/login", json={"email": email, "password": "abc12345"}
        ).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        event = client.post(
            "/api/v1/intelligence/events",
            headers=headers,
            json={"event_type": "quiz_completed", "entity_type": "assessment", "evidence": {"score": 80}},
        )
        profile = client.get("/api/v1/intelligence/profile", headers=headers)

    assert event.status_code == 201
    assert profile.status_code == 200
    assert profile.json()["evidence_count"] == 1
    assert profile.json()["knowledge_state"]["assessment_attempts"] == 0
