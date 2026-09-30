from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_assignment_submission_and_grading() -> None:
    email = f"teacher-{uuid4()}@example.com"
    with TestClient(app) as client:
        client.post(
            "/api/v1/identity/register",
            json={"email": email, "display_name": "Teacher", "password": "a-strong-password", "role": "teacher"},
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
            json={"name": "Assignments Academy", "slug": f"assignments-{uuid4().hex}"},
        ).json()
        course = client.post(
            "/api/v1/courses",
            headers=headers,
            json={"organization_id": organization["id"], "slug": f"work-{uuid4().hex}", "title": "Work Course"},
        ).json()
        client.post(f"/api/v1/courses/{course['id']}/publish", headers=headers)
        assignment = client.post(
            f"/api/v1/assignments/courses/{course['id']}",
            headers=headers,
            json={"title": "Project", "max_score": 100},
        ).json()
        client.post(f"/api/v1/enrollments/{course['id']}", headers=headers)
        submission = client.post(
            f"/api/v1/assignments/{assignment['id']}/submissions",
            headers=headers,
            json={"content": "My completed project"},
        ).json()
        response = client.post(
            f"/api/v1/assignments/submissions/{submission['id']}/grade",
            headers=headers,
            json={"score": 95, "feedback": "Excellent work"},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "graded"
    assert response.json()["score"] == 95
