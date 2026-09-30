from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_certificate_requires_course_completion() -> None:
    email = f"graduate-{uuid4()}@example.com"
    with TestClient(app) as client:
        client.post(
            "/api/v1/identity/register",
            json={"email": email, "display_name": "Graduate", "password": "a-strong-password", "role": "teacher"},
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
            json={"name": "Certificate Academy", "slug": f"cert-{uuid4().hex}"},
        ).json()
        course = client.post(
            "/api/v1/courses",
            headers=headers,
            json={"organization_id": organization["id"], "slug": f"complete-{uuid4().hex}", "title": "Complete Course"},
        ).json()
        client.post(f"/api/v1/courses/{course['id']}/publish", headers=headers)
        resource = client.post(
            f"/api/v1/courses/{course['id']}/resources",
            headers=headers,
            json={"resource_type": "article", "title": "Final Lesson"},
        ).json()
        client.post(f"/api/v1/enrollments/{course['id']}", headers=headers)
        client.post(
            f"/api/v1/learning/resources/{resource['id']}/progress",
            headers=headers,
            json={"completed": True},
        )
        certificate = client.post(f"/api/v1/certificates/courses/{course['id']}", headers=headers)
        verification = client.get(
            f"/api/v1/certificates/verify/{certificate.json()['certificate_number']}"
        )

    assert certificate.status_code == 201
    assert verification.status_code == 200
