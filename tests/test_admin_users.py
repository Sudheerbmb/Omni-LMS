from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def get_admin_token(client: TestClient) -> str:
    login_res = client.post(
        "/api/v1/identity/login",
        json={"email": "admin@lms-platform.com", "password": "OrbitAdmin!2026X7"},
    )
    assert login_res.status_code == 200
    return login_res.json()["access_token"]


def test_admin_user_management_lifecycle() -> None:
    with TestClient(app) as client:
        admin_token = get_admin_token(client)
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Admin lists users
        list_res = client.get("/api/v1/admin/users", headers=headers)
        assert list_res.status_code == 200
        assert isinstance(list_res.json(), list)

        # 2. Admin adds a new member directly
        new_email = f"new-member-{uuid4()}@example.com"
        create_res = client.post(
            "/api/v1/admin/users",
            headers=headers,
            json={
                "email": new_email,
                "display_name": "New Team Member",
                "password": "Password123!",
                "role": "teacher",
                "status": "active",
            },
        )
        assert create_res.status_code == 201
        user_data = create_res.json()
        assert user_data["email"] == new_email
        assert user_data["role"] == "teacher"
        assert user_data["status"] == "active"
        user_id = user_data["id"]

        # 3. New member can log in immediately
        member_login = client.post(
            "/api/v1/identity/login",
            json={"email": new_email, "password": "Password123!"},
        )
        assert member_login.status_code == 200
        member_token = member_login.json()["access_token"]

        # Verify member can query /me
        me_res = client.get("/api/v1/identity/me", headers={"Authorization": f"Bearer {member_token}"})
        assert me_res.status_code == 200

        # 4. Admin revokes access (status = suspended)
        revoke_res = client.post(
            f"/api/v1/admin/users/{user_id}/status",
            headers=headers,
            json={"status": "suspended"},
        )
        assert revoke_res.status_code == 200
        assert revoke_res.json()["status"] == "suspended"

        # 5. Member's existing token is now rejected and member cannot log in
        me_after_revoke = client.get("/api/v1/identity/me", headers={"Authorization": f"Bearer {member_token}"})
        assert me_after_revoke.status_code == 401

        login_after_revoke = client.post(
            "/api/v1/identity/login",
            json={"email": new_email, "password": "Password123!"},
        )
        assert login_after_revoke.status_code == 403

        # 6. Admin restores access (status = active)
        restore_res = client.post(
            f"/api/v1/admin/users/{user_id}/status",
            headers=headers,
            json={"status": "active"},
        )
        assert restore_res.status_code == 200
        assert restore_res.json()["status"] == "active"

        # Member can log in again
        relogin = client.post(
            "/api/v1/identity/login",
            json={"email": new_email, "password": "Password123!"},
        )
        assert relogin.status_code == 200

        # 7. Admin updates member role
        role_res = client.post(
            f"/api/v1/admin/users/{user_id}/role",
            headers=headers,
            json={"role": "student"},
        )
        assert role_res.status_code == 200
        assert role_res.json()["role"] == "student"

        # 8. Admin permanently removes member
        del_res = client.delete(f"/api/v1/admin/users/{user_id}", headers=headers)
        assert del_res.status_code == 200
        assert del_res.json()["deleted"] is True


def test_admin_cannot_revoke_or_delete_self() -> None:
    with TestClient(app) as client:
        admin_token = get_admin_token(client)
        headers = {"Authorization": f"Bearer {admin_token}"}

        admin_me = client.get("/api/v1/identity/me", headers=headers).json()
        admin_id = admin_me["id"]

        # Attempt to revoke self
        res1 = client.post(
            f"/api/v1/admin/users/{admin_id}/status",
            headers=headers,
            json={"status": "suspended"},
        )
        assert res1.status_code == 400
        assert "own account" in res1.json()["detail"].lower()

        # Attempt to delete self
        res2 = client.delete(f"/api/v1/admin/users/{admin_id}", headers=headers)
        assert res2.status_code == 400
        assert "own account" in res2.json()["detail"].lower()
