from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_enrollment_and_progress_flow() -> None:
    email = f"learner-{uuid4()}@example.com"
    with TestClient(app) as client:
        client.post(
            "/api/v1/identity/register",
            json={
                "email": email,
                "display_name": "Learner",
                "password": "a-strong-password",
                "role": "teacher",
            },
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
            json={"name": "Learning Academy", "slug": f"learning-{uuid4().hex}"},
        ).json()
        course = client.post(
            "/api/v1/courses",
            headers=headers,
            json={
                "organization_id": organization["id"],
                "slug": f"course-{uuid4().hex}",
                "title": "Learning Course",
            },
        ).json()
        resource = client.post(
            f"/api/v1/courses/{course['id']}/resources",
            headers=headers,
            json={"resource_type": "video", "title": "Lesson 1"},
        )
        assert resource.status_code == 201
        client.post(f"/api/v1/courses/{course['id']}/publish", headers=headers)
        enrollment = client.post(f"/api/v1/enrollments/{course['id']}", headers=headers)
        assert enrollment.status_code == 201

        progress = client.post(
            f"/api/v1/learning/resources/{resource.json()['id']}/progress",
            headers=headers,
            json={"completed": True, "position_seconds": 120},
        )

    assert progress.status_code == 200
    assert progress.json()["completed"] is True
