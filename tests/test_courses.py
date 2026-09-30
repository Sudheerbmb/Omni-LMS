from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_member_can_create_course() -> None:
    email = f"teacher-{uuid4()}@example.com"
    with TestClient(app) as client:
        client.post(
            "/api/v1/identity/register",
            json={
                "email": email,
                "display_name": "Teacher",
                "password": "a-strong-password",
                "role": "teacher",
            },
        )
        approve_email(email)
        token = client.post(
            "/api/v1/identity/login",
            json={"email": email, "password": "a-strong-password"},
        ).json()["access_token"]
        organization = client.post(
            "/api/v1/tenants",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Course Academy", "slug": f"academy-{uuid4().hex}"},
        ).json()
        response = client.post(
            "/api/v1/courses",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "organization_id": organization["id"],
                "slug": f"python-{uuid4().hex}",
                "title": "Python Foundations",
                "description": "A first course.",
            },
        )

    assert response.status_code == 201
    assert response.json()["status"] == "draft"
    assert response.json()["current_version"] == 1

    published = client.post(
        f"/api/v1/courses/{response.json()['id']}/publish",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"
