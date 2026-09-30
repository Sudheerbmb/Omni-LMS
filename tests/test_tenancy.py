from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_authenticated_user_can_create_tenant() -> None:
    email = f"owner-{uuid4()}@example.com"
    with TestClient(app) as client:
        registration = client.post(
            "/api/v1/identity/register",
            json={
                "email": email,
                "display_name": "Owner",
                "password": "a-strong-password",
            },
        )
        approve_email(email)
        token = client.post(
            "/api/v1/identity/login",
            json={"email": email, "password": "a-strong-password"},
        ).json()["access_token"]

        response = client.post(
            "/api/v1/tenants",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Example Academy", "slug": f"academy-{uuid4().hex}"},
        )

    assert registration.status_code == 201
    assert response.status_code == 201
    assert response.json()["status"] == "active"
