from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_teacher_can_announce_and_users_can_message() -> None:
    sender_email = f"sender-{uuid4()}@example.com"
    recipient_email = f"recipient-{uuid4()}@example.com"
    with TestClient(app) as client:
        client.post(
            "/api/v1/identity/register",
            json={"email": sender_email, "display_name": "Teacher", "password": "abc12345", "role": "teacher"},
        )
        approve_email(sender_email)
        sender_login = client.post(
            "/api/v1/identity/login", json={"email": sender_email, "password": "abc12345"}
        ).json()
        client.post(
            "/api/v1/identity/register",
            json={"email": recipient_email, "display_name": "Student", "password": "abc12345", "role": "student"},
        )
        approve_email(recipient_email)
        recipient_login = client.post(
            "/api/v1/identity/login", json={"email": recipient_email, "password": "abc12345"}
        ).json()
        headers = {"Authorization": f"Bearer {sender_login['access_token']}"}
        organization = client.post(
            "/api/v1/tenants",
            headers=headers,
            json={"name": "Message Academy", "slug": f"messages-{uuid4().hex}"},
        ).json()
        announcement = client.post(
            f"/api/v1/communication/organizations/{organization['id']}/announcements",
            headers=headers,
            json={"title": "Welcome", "body": "Class starts Monday", "audience_role": "all"},
        )
        message = client.post(
            "/api/v1/communication/messages",
            headers=headers,
            json={"recipient_id": recipient_login["user"]["id"], "body": "Welcome to class"},
        )

    assert announcement.status_code == 201
    assert message.status_code == 201
