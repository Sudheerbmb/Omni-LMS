from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_teacher_schedule_and_conflict_detection() -> None:
    email = f"teacher-class-{uuid4()}@example.com"
    starts = datetime.now(timezone.utc) + timedelta(days=1)
    with TestClient(app) as client:
        client.post(
            "/api/v1/identity/register",
            json={"email": email, "display_name": "Teacher", "password": "abc12345", "role": "teacher"},
        )
        approve_email(email)
        token = client.post(
            "/api/v1/identity/login", json={"email": email, "password": "abc12345"}
        ).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        organization = client.post(
            "/api/v1/tenants", headers=headers,
            json={"name": "Class Academy", "slug": f"class-{uuid4().hex}"},
        ).json()
        course = client.post(
            "/api/v1/courses", headers=headers,
            json={"organization_id": organization["id"], "slug": f"live-{uuid4().hex}", "title": "Live Course"},
        ).json()
        payload = {"title": "Live session", "starts_at": starts.isoformat(), "ends_at": (starts + timedelta(hours=1)).isoformat()}
        created = client.post(f"/api/v1/classroom/courses/{course['id']}/classes", headers=headers, json=payload)
        conflict = client.post(f"/api/v1/classroom/courses/{course['id']}/classes", headers=headers, json=payload)
        schedule = client.get("/api/v1/classroom/schedule", headers=headers)

    assert created.status_code == 201
    assert conflict.status_code == 409
    assert len(schedule.json()) == 1
