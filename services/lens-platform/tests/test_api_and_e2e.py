import uuid
from fastapi.testclient import TestClient
from lens.api.main import app
from lens.engine.state_vector import (
    calculate_mastery,
    calculate_retention,
    calculate_transfer,
    calculate_misconception,
    calculate_competency,
    calculate_uncertainty,
    calculate_identifiability,
)
from lens.engine.bottleneck import detect_bottleneck
from lens.engine.learning_mode import resolve_learning_mode


def test_health_and_metrics_endpoints():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

        m_resp = client.get("/metrics")
        assert m_resp.status_code == 200
        assert "tracked_learner_states" in m_resp.json()


def test_full_e2e_benchmark_and_state_loop():
    with TestClient(app) as client:
        student_id = str(uuid.uuid4())
        course_id = str(uuid.uuid4())

        # 1. Start benchmark
        start_resp = client.post(f"/api/v1/benchmark/start?course_id={course_id}&student_id={student_id}")
        assert start_resp.status_code == 200
        data = start_resp.json()
        assert "attempt_id" in data
        assert len(data["items"]) >= 1

        attempt_id = data["attempt_id"]
        item_id = data["items"][0]["id"]

        # 2. Submit response
        resp_res = client.post(
            f"/api/v1/benchmark/{attempt_id}/response?item_id={item_id}&student_answer=Topological Sort&response_time_seconds=15"
        )
        assert resp_res.status_code == 200
        assert resp_res.json()["status"] == "saved"

        # 3. Complete benchmark
        comp_res = client.post(f"/api/v1/benchmark/{attempt_id}/complete")
        assert comp_res.status_code == 200
        assert comp_res.json()["status"] == "completed"

        # 4. Ingest an additional Quiz Event via Event Gateway
        event_payload = {
            "event_id": f"evt_quiz_{uuid.uuid4()}",
            "event_type": "quiz.completed",
            "event_version": 1,
            "source": "lms",
            "student_id": student_id,
            "course_id": course_id,
            "occurred_at": "2026-10-01T12:00:00Z",
            "payload": {
                "score": 0.30,
                "difficulty": 0.4,
                "correct": False,
                "misconception_signal": "recursion_base_case_omission",
            }
        }
        evt_resp = client.post("/api/v1/events", json=event_payload)
        assert evt_resp.status_code == 200
        assert evt_resp.json()["processed"] is True

        # 5. Verify Learner State
        state_resp = client.get(f"/api/v1/students/{student_id}/state")
        assert state_resp.status_code == 200
        s_data = state_resp.json()
        assert s_data["student_id"] == student_id
        assert s_data["mastery"] >= 0.0
        assert s_data["misconception"] >= 0.0

        # 6. Verify Daily Plan Generation
        plan_resp = client.get(f"/api/v1/students/{student_id}/daily-plan")
        assert plan_resp.status_code == 200
        p_data = plan_resp.json()
        assert len(p_data["schedule_blocks"]) >= 2

        # 7. Verify Exam Readiness
        readiness_resp = client.get(f"/api/v1/students/{student_id}/exam-readiness")
        assert readiness_resp.status_code == 200
        assert "readiness_score" in readiness_resp.json()

        # 8. Verify Student Grounded Chat
        chat_resp = client.post(
            f"/api/v1/sn1/chat?student_id={student_id}&query=What should I study today?"
        )
        assert chat_resp.status_code == 200
        assert "response" in chat_resp.json()
