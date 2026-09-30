from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_coding_submission_is_queued_safely() -> None:
    email = f"coder-{uuid4()}@example.com"
    with TestClient(app) as client:
        client.post(
            "/api/v1/identity/register",
            json={"email": email, "display_name": "Coder", "password": "abc12345", "role": "teacher"},
        )
        approve_email(email)
        token = client.post(
            "/api/v1/identity/login",
            json={"email": email, "password": "abc12345"},
        ).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        organization = client.post(
            "/api/v1/tenants",
            headers=headers,
            json={"name": "Code Academy", "slug": f"code-{uuid4().hex}"},
        ).json()
        course = client.post(
            "/api/v1/courses",
            headers=headers,
            json={"organization_id": organization["id"], "slug": f"python-{uuid4().hex}", "title": "Python"},
        ).json()
        client.post(f"/api/v1/courses/{course['id']}/publish", headers=headers)
        exercise = client.post(
            f"/api/v1/coding/courses/{course['id']}/exercises",
            headers=headers,
            json={"title": "Loops", "prompt": "Write a loop", "language": "python"},
        ).json()
        client.post(f"/api/v1/enrollments/{course['id']}", headers=headers)
        response = client.post(
            f"/api/v1/coding/exercises/{exercise['id']}/submissions",
            headers=headers,
            json={"source_code": "for i in range(3): print(i)"},
        )

    assert response.status_code == 201
    assert response.json()["status"] == "queued"


def test_coding_exercise_and_submission_lifecycle() -> None:
    teacher_email = f"teacher-{uuid4()}@example.com"
    student_email = f"student-{uuid4()}@example.com"

    with TestClient(app) as client:
        # Register and approve teacher
        client.post(
            "/api/v1/identity/register",
            json={"email": teacher_email, "display_name": "Teacher T", "password": "abc12345", "role": "teacher"},
        )
        approve_email(teacher_email)
        teacher_token = client.post(
            "/api/v1/identity/login",
            json={"email": teacher_email, "password": "abc12345"},
        ).json()["access_token"]
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

        # Teacher creates org & course
        organization = client.post(
            "/api/v1/tenants",
            headers=teacher_headers,
            json={"name": "Coding High", "slug": f"coding-{uuid4().hex}"},
        ).json()
        course = client.post(
            "/api/v1/courses",
            headers=teacher_headers,
            json={"organization_id": organization["id"], "slug": f"algo-{uuid4().hex}", "title": "Algorithms"},
        ).json()
        client.post(f"/api/v1/courses/{course['id']}/publish", headers=teacher_headers)

        # Teacher creates coding exercise
        exercise = client.post(
            f"/api/v1/coding/courses/{course['id']}/exercises",
            headers=teacher_headers,
            json={
                "title": "Sum Two Numbers",
                "prompt": "Return a + b",
                "language": "python",
                "starter_code": "def solve(a, b):\n    pass\n",
            },
        ).json()
        assert exercise["title"] == "Sum Two Numbers"

        # Register and approve student
        client.post(
            "/api/v1/identity/register",
            json={"email": student_email, "display_name": "Student S", "password": "abc12345", "role": "student"},
        )
        approve_email(student_email)
        student_token = client.post(
            "/api/v1/identity/login",
            json={"email": student_email, "password": "abc12345"},
        ).json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # Student cannot view exercises prior to enrollment
        forbidden_list = client.get(
            f"/api/v1/coding/courses/{course['id']}/exercises",
            headers=student_headers,
        )
        assert forbidden_list.status_code == 403

        # Student enrolls
        client.post(f"/api/v1/enrollments/{course['id']}", headers=student_headers)

        # Student lists exercises
        list_resp = client.get(
            f"/api/v1/coding/courses/{course['id']}/exercises",
            headers=student_headers,
        )
        assert list_resp.status_code == 200
        assert len(list_resp.json()) == 1

        # Student views exercise
        get_resp = client.get(
            f"/api/v1/coding/exercises/{exercise['id']}",
            headers=student_headers,
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["starter_code"] == "def solve(a, b):\n    pass\n"

        # Teacher updates exercise
        patch_resp = client.patch(
            f"/api/v1/coding/exercises/{exercise['id']}",
            headers=teacher_headers,
            json={"title": "Sum Two Numbers v2", "starter_code": "def add(x, y):\n    return 0"},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["title"] == "Sum Two Numbers v2"

        # Student cannot update exercise
        forbidden_patch = client.patch(
            f"/api/v1/coding/exercises/{exercise['id']}",
            headers=student_headers,
            json={"title": "Hacked"},
        )
        assert forbidden_patch.status_code == 403

        # Student submits code
        sub_resp = client.post(
            f"/api/v1/coding/exercises/{exercise['id']}/submissions",
            headers=student_headers,
            json={"source_code": "def add(x, y):\n    return x + y"},
        )
        assert sub_resp.status_code == 201
        submission = sub_resp.json()
        assert submission["status"] == "queued"

        # Student checks latest submission
        latest_resp = client.get(
            f"/api/v1/coding/exercises/{exercise['id']}/submissions/latest",
            headers=student_headers,
        )
        assert latest_resp.status_code == 200
        assert latest_resp.json()["id"] == submission["id"]

        # Student lists submissions
        subs_list = client.get(
            f"/api/v1/coding/exercises/{exercise['id']}/submissions",
            headers=student_headers,
        )
        assert subs_list.status_code == 200
        assert len(subs_list.json()) == 1

        # Student gets submission detail
        sub_detail = client.get(
            f"/api/v1/coding/submissions/{submission['id']}",
            headers=student_headers,
        )
        assert sub_detail.status_code == 200
        assert sub_detail.json()["id"] == submission["id"]

        # Teacher updates submission evaluation result
        result_payload = {
            "status": "passed",
            "result": {"passed_tests": 5, "total_tests": 5, "execution_ms": 12},
        }
        res_update = client.patch(
            f"/api/v1/coding/submissions/{submission['id']}/result",
            headers=teacher_headers,
            json=result_payload,
        )
        assert res_update.status_code == 200
        assert res_update.json()["status"] == "passed"
        assert res_update.json()["result"]["passed_tests"] == 5

        # Teacher deletes exercise
        delete_resp = client.delete(
            f"/api/v1/coding/exercises/{exercise['id']}",
            headers=teacher_headers,
        )
        assert delete_resp.status_code == 204

        # Exercise is no longer found
        not_found_resp = client.get(
            f"/api/v1/coding/exercises/{exercise['id']}",
            headers=teacher_headers,
        )
        assert not_found_resp.status_code == 404
