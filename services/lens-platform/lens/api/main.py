import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from lens.config import settings
from lens.database import get_lens_session, init_lens_database
from lens.events.contracts import LMSEventContract
from lens.events.processor import process_learning_event
from lens.models.benchmarks import (
    BenchmarkAttempt,
    BenchmarkDefinition,
    BenchmarkItem,
    BenchmarkResponse,
)
from lens.models.bottlenecks import BottleneckEvent, LearnerRecommendation
from lens.models.evidence import LearnerEvidence
from lens.models.interventions import InterventionItem, InterventionOutcome
from lens.models.projections import ConceptProjection, CourseProjection, StudentProjection
from lens.models.sn1_audit import SN1DecisionAudit, SN1Run, TeacherEscalationAlert
from lens.models.state import LearnerState
from lens.sn1.agent import SN1AgentOrchestrator
from lens.sn1.chat_engine import answer_student_query
from lens.sn1.daily_planner import generate_student_daily_plan

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Autonomous Evidence-Driven Adaptive Learning Intelligence Layer API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    await init_lens_database()


# ── Health & Observability (Section 81) ───────────────────────────────────────

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.app_version,
        "database": "connected",
        "model_provider": settings.llm_provider,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/metrics")
async def get_metrics(session: AsyncSession = Depends(get_lens_session)):
    states_count = len((await session.scalars(select(LearnerState))).all())
    evidence_count = len((await session.scalars(select(LearnerEvidence))).all())
    recs_count = len((await session.scalars(select(LearnerRecommendation))).all())
    alerts_count = len((await session.scalars(select(TeacherEscalationAlert).where(TeacherEscalationAlert.status == "OPEN"))).all())
    return {
        "tracked_learner_states": states_count,
        "collected_evidence_events": evidence_count,
        "active_recommendations": recs_count,
        "open_teacher_escalations": alerts_count,
    }


# ── Event Gateway (Section 45, 60) ──────────────────────────────────────────

@app.post("/api/v1/events")
async def receive_lms_event(
    event: LMSEventContract,
    session: AsyncSession = Depends(get_lens_session),
):
    """
    Ingests and processes raw LMS learning events idempotently.
    """
    success, state, trigger_reason = await process_learning_event(session, event)
    if not success:
        raise HTTPException(status_code=400, detail="Event processing failed.")
    
    # Trigger SN1 autonomously if state changed or bottleneck shifted
    sn1_result = None
    if trigger_reason and state:
        orchestrator = SN1AgentOrchestrator(session)
        sn1_result = await orchestrator.run(
            student_id=state.student_id,
            course_id=state.course_id,
            concept_id=state.concept_id,
            trigger=trigger_reason,
        )

    return {
        "status": "success",
        "event_id": event.event_id,
        "processed": True,
        "state": {
            "mastery": state.mastery if state else None,
            "competency": state.competency if state else None,
            "bottleneck": state.current_bottleneck if state else None,
            "learning_mode": state.current_learning_mode if state else None,
        } if state else None,
        "sn1_triggered": bool(sn1_result),
    }


# ── Benchmark Engine Endpoints (Section 12, 13, 61) ──────────────────────────

@app.post("/api/v1/benchmark/start")
async def start_benchmark(
    course_id: uuid.UUID,
    student_id: uuid.UUID,
    session: AsyncSession = Depends(get_lens_session),
):
    # Fetch or generate benchmark definition
    b_stmt = select(BenchmarkDefinition).where(
        BenchmarkDefinition.course_id == course_id,
        BenchmarkDefinition.is_active == True,
    )
    b_def = await session.scalar(b_stmt)
    if not b_def:
        b_def = BenchmarkDefinition(
            course_id=course_id,
            title="Comprehensive Diagnostic Benchmark",
            blueprint_json={"total_items": 10},
        )
        session.add(b_def)
        await session.commit()
        await session.refresh(b_def)

    attempt = BenchmarkAttempt(
        benchmark_id=b_def.id,
        student_id=student_id,
        status="in_progress",
    )
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)

    # Fetch items
    i_stmt = select(BenchmarkItem).where(BenchmarkItem.benchmark_id == b_def.id)
    items = (await session.scalars(i_stmt)).all()
    if not items:
        # Seed initial validated diagnostic questions if empty
        item1 = BenchmarkItem(
            benchmark_id=b_def.id,
            concept_id=course_id,
            prompt="What is the primary characteristic of an algorithmic time complexity O(log N)?",
            question_type="MCQ",
            options_json=["Linear growth with input", "Halving the search space at each step", "Exponential growth", "Constant time execution"],
            correct_answer="Halving the search space at each step",
            difficulty=0.45,
            cognitive_level="FOUNDATION",
        )
        item2 = BenchmarkItem(
            benchmark_id=b_def.id,
            concept_id=course_id,
            prompt="Given a directed acyclic graph (DAG), which algorithm produces a valid linear ordering of vertices?",
            question_type="MCQ",
            options_json=["Topological Sort", "Dijkstra's Algorithm", "Binary Search", "Depth-Limited Search"],
            correct_answer="Topological Sort",
            difficulty=0.60,
            cognitive_level="APPLICATION",
        )
        session.add_all([item1, item2])
        await session.commit()
        items = [item1, item2]

    return {
        "attempt_id": str(attempt.id),
        "benchmark_id": str(b_def.id),
        "title": b_def.title,
        "items": [
            {
                "id": str(i.id),
                "concept_id": str(i.concept_id),
                "prompt": i.prompt,
                "question_type": i.question_type,
                "options": i.options_json,
                "difficulty": i.difficulty,
                "cognitive_level": i.cognitive_level,
            }
            for i in items
        ]
    }


@app.post("/api/v1/benchmark/{attempt_id}/response")
async def submit_benchmark_response(
    attempt_id: uuid.UUID,
    item_id: uuid.UUID,
    student_answer: str,
    response_time_seconds: Optional[float] = None,
    session: AsyncSession = Depends(get_lens_session),
):
    item = await session.scalar(select(BenchmarkItem).where(BenchmarkItem.id == item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Benchmark item not found.")
    
    is_correct = (student_answer.strip().lower() == item.correct_answer.strip().lower())
    score = 1.0 if is_correct else 0.0

    resp = BenchmarkResponse(
        attempt_id=attempt_id,
        item_id=item_id,
        student_answer=student_answer,
        is_correct=is_correct,
        score=score,
        response_time_seconds=response_time_seconds,
    )
    session.add(resp)
    await session.commit()
    return {"status": "saved", "is_correct": is_correct, "score": score}


@app.post("/api/v1/benchmark/{attempt_id}/complete")
async def complete_benchmark(
    attempt_id: uuid.UUID,
    session: AsyncSession = Depends(get_lens_session),
):
    attempt = await session.scalar(select(BenchmarkAttempt).where(BenchmarkAttempt.id == attempt_id))
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    responses = (await session.scalars(select(BenchmarkResponse).where(BenchmarkResponse.attempt_id == attempt_id))).all()
    total_score = sum(r.score for r in responses) / max(1, len(responses))
    
    attempt.status = "completed"
    attempt.completed_at = datetime.now(timezone.utc)
    attempt.total_score = total_score
    await session.commit()

    # Emit benchmark completed event to update LENS state
    event = LMSEventContract(
        event_id=f"benchmark_completed_{attempt_id}",
        event_type="benchmark.completed",
        student_id=attempt.student_id,
        course_id=attempt.benchmark_id,
        payload={"score": total_score, "attempt_id": str(attempt_id), "passed": total_score >= 0.70},
    )
    await process_learning_event(session, event)

    return {
        "status": "completed",
        "total_score": total_score,
        "completed_at": attempt.completed_at.isoformat(),
    }


# ── Student Learner State & Analytics (Section 38, 59) ───────────────────────

@app.get("/api/v1/students/{student_id}/state")
async def get_student_overall_state(
    student_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = None,
    session: AsyncSession = Depends(get_lens_session),
):
    stmt = select(LearnerState).where(LearnerState.student_id == student_id)
    if course_id:
        stmt = stmt.where(LearnerState.course_id == course_id)
    states = (await session.scalars(stmt)).all()

    if not states:
        return {
            "student_id": str(student_id),
            "mastery": 0.10,
            "retention": 1.00,
            "transfer": 0.00,
            "misconception": 0.00,
            "competency": 0.00,
            "uncertainty": 0.90,
            "identifiability": 0.00,
            "learning_velocity": 0.00,
            "current_bottleneck": "INSUFFICIENT_EVIDENCE",
            "current_learning_mode": "DIAGNOSTIC",
            "tracked_concepts_count": 0,
        }

    avg_m = sum(s.mastery for s in states) / len(states)
    avg_r = sum(s.retention for s in states) / len(states)
    avg_t = sum(s.transfer for s in states) / len(states)
    avg_ms = sum(s.misconception for s in states) / len(states)
    avg_c = sum(s.competency for s in states) / len(states)
    avg_u = sum(s.uncertainty for s in states) / len(states)
    avg_i = sum(s.identifiability for s in states) / len(states)
    avg_v = sum(s.learning_velocity for s in states) / len(states)

    primary_bottleneck = max(states, key=lambda s: s.uncertainty if s.identifiability < 0.5 else (1.0 - s.competency)).current_bottleneck

    return {
        "student_id": str(student_id),
        "mastery": round(avg_m, 4),
        "retention": round(avg_r, 4),
        "transfer": round(avg_t, 4),
        "misconception": round(avg_ms, 4),
        "competency": round(avg_c, 4),
        "uncertainty": round(avg_u, 4),
        "identifiability": round(avg_i, 4),
        "learning_velocity": round(avg_v, 4),
        "current_bottleneck": primary_bottleneck,
        "current_learning_mode": states[0].current_learning_mode,
        "tracked_concepts_count": len(states),
    }


@app.get("/api/v1/students/{student_id}/concepts")
async def get_student_concepts_breakdown(
    student_id: uuid.UUID,
    session: AsyncSession = Depends(get_lens_session),
):
    stmt = select(LearnerState).where(LearnerState.student_id == student_id)
    states = (await session.scalars(stmt)).all()
    
    c_stmt = select(ConceptProjection)
    concepts_map = {c.concept_id: c.name for c in (await session.scalars(c_stmt)).all()}

    return [
        {
            "concept_id": str(s.concept_id),
            "concept_name": concepts_map.get(s.concept_id, "Academic Concept"),
            "mastery": s.mastery,
            "retention": s.retention,
            "transfer": s.transfer,
            "misconception": s.misconception,
            "competency": s.competency,
            "uncertainty": s.uncertainty,
            "identifiability": s.identifiability,
            "learning_velocity": s.learning_velocity,
            "bottleneck": s.current_bottleneck,
            "learning_mode": s.current_learning_mode,
            "evidence_count": s.evidence_count,
        }
        for s in states
    ]


@app.get("/api/v1/students/{student_id}/recommendations")
async def get_student_recommendations(
    student_id: uuid.UUID,
    session: AsyncSession = Depends(get_lens_session),
):
    stmt = (
        select(LearnerRecommendation)
        .where(LearnerRecommendation.student_id == student_id)
        .order_by(desc(LearnerRecommendation.created_at))
        .limit(10)
    )
    recs = (await session.scalars(stmt)).all()
    return [
        {
            "id": str(r.id),
            "concept_id": str(r.concept_id),
            "action_type": r.recommended_action_type,
            "priority": r.priority,
            "reason": r.reason,
            "payload": r.action_payload_json,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in recs
    ]


@app.get("/api/v1/students/{student_id}/daily-plan")
async def get_student_daily_plan_endpoint(
    student_id: uuid.UUID,
    session: AsyncSession = Depends(get_lens_session),
):
    plan = await generate_student_daily_plan(session, student_id)
    return plan


@app.get("/api/v1/students/{student_id}/exam-readiness")
async def get_student_exam_readiness(
    student_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = None,
    session: AsyncSession = Depends(get_lens_session),
):
    """Section 40: Multi-dimensional exam readiness calculation."""
    stmt = select(LearnerState).where(LearnerState.student_id == student_id)
    if course_id:
        stmt = stmt.where(LearnerState.course_id == course_id)
    states = (await session.scalars(stmt)).all()

    if not states:
        return {
            "readiness_score": 0.20,
            "status": "INITIAL_DIAGNOSTIC_REQUIRED",
            "coverage": 0.0,
            "mastery": 0.10,
            "retention": 1.00,
            "transfer": 0.00,
            "confidence_level": "LOW",
        }

    avg_m = sum(s.mastery for s in states) / len(states)
    avg_r = sum(s.retention for s in states) / len(states)
    avg_t = sum(s.transfer for s in states) / len(states)
    avg_u = sum(s.uncertainty for s in states) / len(states)

    # Readiness combines Mastery (40%), Retention (30%), Transfer (30%) discounted by uncertainty
    raw_readiness = (0.40 * avg_m + 0.30 * avg_r + 0.30 * avg_t) * (1.0 - 0.5 * avg_u)
    
    return {
        "readiness_score": round(raw_readiness, 4),
        "status": "READY" if raw_readiness >= 0.75 else "NEEDS_REVISION" if raw_readiness >= 0.50 else "NOT_READY",
        "coverage": len(states) / 10.0,
        "mastery": round(avg_m, 4),
        "retention": round(avg_r, 4),
        "transfer": round(avg_t, 4),
        "uncertainty": round(avg_u, 4),
    }


# ── SN1 Autonomous Agent Endpoints (Section 59) ──────────────────────────────

@app.post("/api/v1/sn1/run")
async def run_sn1_agent(
    student_id: uuid.UUID,
    concept_id: uuid.UUID,
    course_id: uuid.UUID,
    trigger: str = "manual_execution",
    session: AsyncSession = Depends(get_lens_session),
):
    orchestrator = SN1AgentOrchestrator(session)
    result = await orchestrator.run(
        student_id=student_id,
        course_id=course_id,
        concept_id=concept_id,
        trigger=trigger,
    )
    return {
        "status": "completed",
        "step_history": result.get("step_history", []),
        "bottleneck": result.get("bottleneck"),
        "learning_mode": result.get("learning_mode"),
        "selected_action": result.get("selected_action"),
        "execution_plan": result.get("execution_plan"),
        "output_message": result.get("output_message"),
        "escalation_alert": result.get("escalation_alert"),
    }


@app.post("/api/v1/sn1/chat")
async def sn1_chat_interface(
    student_id: uuid.UUID,
    query: str,
    course_id: Optional[uuid.UUID] = None,
    session: AsyncSession = Depends(get_lens_session),
):
    """Section 39: Student natural language Q&A and reasoning."""
    resp = await answer_student_query(session, student_id, query, course_id)
    return resp


# ── Teacher View & Escalations (Section 41, 42) ──────────────────────────────

@app.get("/api/v1/teacher/escalations")
async def get_teacher_escalations(
    session: AsyncSession = Depends(get_lens_session),
):
    stmt = (
        select(TeacherEscalationAlert)
        .order_by(desc(TeacherEscalationAlert.created_at))
        .limit(20)
    )
    alerts = (await session.scalars(stmt)).all()
    return [
        {
            "id": str(a.id),
            "student_id": str(a.student_id),
            "concept_id": str(a.concept_id) if a.concept_id else None,
            "reason": a.escalation_reason,
            "severity": a.severity,
            "details": a.details_json,
            "status": a.status,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]
