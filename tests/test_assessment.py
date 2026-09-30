from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_assessment_attempt_is_graded() -> None:
    email = f"assessor-{uuid4()}@example.com"
    with TestClient(app) as client:
        client.post(
            "/api/v1/identity/register",
            json={"email": email, "display_name": "Assessor", "password": "a-strong-password", "role": "teacher"},
        )
        approve_email(email)
        token = client.post(
            "/api/v1/identity/login",
            json={"email": email, "password": "a-strong-password"},
        ).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        organization = client.post(
            "/api/v1/tenants",
            headers=headers,
            json={"name": "Assessment Academy", "slug": f"assessment-{uuid4().hex}"},
        ).json()
        course = client.post(
            "/api/v1/courses",
            headers=headers,
            json={"organization_id": organization["id"], "slug": f"exam-{uuid4().hex}", "title": "Exam Course"},
        ).json()
        client.post(f"/api/v1/courses/{course['id']}/publish", headers=headers)
        assessment = client.post(
            f"/api/v1/assessment/courses/{course['id']}",
            headers=headers,
            json={"title": "Quiz", "passing_score": 50},
        ).json()
        question = client.post(
            f"/api/v1/assessment/{assessment['id']}/questions",
            headers=headers,
            json={"prompt": "2 + 2?", "options": ["3", "4"], "correct_answer": "4"},
        ).json()
        client.post(f"/api/v1/enrollments/{course['id']}", headers=headers)
        response = client.post(
            f"/api/v1/assessment/{assessment['id']}/attempts",
            headers=headers,
            json={"answers": {question["id"]: "4"}},
        )

    assert response.status_code == 200
    assert response.json()["score"] == 100
    assert response.json()["passed"] is True
