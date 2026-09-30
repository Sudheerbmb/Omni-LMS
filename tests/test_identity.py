from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.identity.security import hash_password, verify_password


client = TestClient(app)


def test_password_hashing() -> None:
    encoded = hash_password("a-strong-password")
    assert encoded != "a-strong-password"
    assert verify_password("a-strong-password", encoded)
    assert not verify_password("wrong-password", encoded)


def test_register_user() -> None:
    email = f"student-{uuid4()}@example.com"
    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/v1/identity/register",
            json={
                "email": email,
                "display_name": "Student",
                "password": "a-strong-password",
            },
        )

    assert response.status_code == 201
    assert response.json()["email"] == email
    assert "password_hash" not in response.json()


def test_pending_user_cannot_login() -> None:
    email = f"login-{uuid4()}@example.com"
    with TestClient(app) as test_client:
        registration = test_client.post(
            "/api/v1/identity/register",
            json={
                "email": email,
                "display_name": "Login User",
                "password": "a-strong-password",
            },
        )
        assert registration.status_code == 201

        response = test_client.post(
            "/api/v1/identity/login",
            json={"email": email, "password": "a-strong-password"},
        )

    assert response.status_code == 403
    assert "approval" in response.json()["detail"].lower()
