"""LENS-Omega v0.1 evidence-to-action engine.

The coefficients are explicitly configurable prototype policy parameters. They
must be calibrated from real outcomes before being interpreted scientifically.
"""
from __future__ import annotations

import math
from collections import Counter
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.identity.models import User
from app.identity.models import OrganizationMembership
from app.courses.models import Course
from app.enrollment.models import Enrollment
from app.learning.models import LearnerConceptState, LearningActionFeedback, LearningEvidence
from app.learning.schemas import CohortLearnerRead, EvidenceCreate, LearnerDashboard, LearnerStateRead
from app.platform.models import OutboxEvent

WEIGHTS = {"diagnostic": 1.25, "quiz": 1.0, "retrieval": 1.15, "practice": 0.8,
           "transfer": 1.25, "project": 1.2, "teacher_observation": 0.65}

ACTION_EFFECTS = {
    "diagnostic_check": {"mastery": .01, "retention": .00, "transfer": .00, "uncertainty": -.25, "cost": .12},
    "worked_example": {"mastery": .14, "retention": .05, "transfer": .03, "misconception": -.22, "cost": .28},
    "spaced_retrieval": {"mastery": .04, "retention": .22, "transfer": .03, "misconception": -.02, "cost": .18},
    "novel_application": {"mastery": .05, "retention": .05, "transfer": .23, "misconception": -.04, "cost": .30},
    "guided_practice": {"mastery": .19, "retention": .08, "transfer": .04, "misconception": -.05, "cost": .24},
}
_schema_available: bool | None = None


async def ensure_adaptive_schema(session: AsyncSession) -> bool:
    """Create additive adaptive tables when a host skipped its release migration."""
    global _schema_available
    if _schema_available is not None:
        return _schema_available
    try:
        connection = await session.connection()
        for table in (LearningEvidence.__table__, LearnerConceptState.__table__, LearningActionFeedback.__table__):
            await connection.run_sync(
                lambda sync_connection, target=table: target.create(sync_connection, checkfirst=True)
            )
        await session.commit()
        _schema_available = True
        return True
    except SQLAlchemyError:
        # Managed production databases may disallow application-time DDL. The
        # existing transactional outbox is the durable event-store fallback.
        await session.rollback()
        _schema_available = False
        return False


def _new_state(user_id: UUID, course_id: UUID | None, concept: str) -> LearnerConceptState:
    state = LearnerConceptState(user_id=user_id, course_id=course_id, concept=concept)
    state.id = uuid5(NAMESPACE_URL, f"lens:{user_id}:{course_id}:{concept}")
    state.mastery, state.retention, state.transfer = .25, .5, .25
    state.misconception, state.uncertainty, state.evidence_adequacy, state.velocity = 0, 1, 0, .5
    state.evidence_count, state.evidence_types, state.model_version = 0, [], "lens-omega-0.1"
    return state


def _apply_evidence(state: LearnerConceptState, data: EvidenceCreate, now: datetime) -> None:
    previous_mastery = state.mastery
    elapsed_days = 0.0
    if state.last_evidence_at:
        previous_time = state.last_evidence_at
        if previous_time.tzinfo is None:
            previous_time = previous_time.replace(tzinfo=timezone.utc)
        elapsed_days = max(0, (now - previous_time).total_seconds() / 86400)
    signed = 2 * data.score - 1
    difficulty_factor = (0.7 + 0.6 * data.difficulty) if signed >= 0 else (1.3 - 0.6 * data.difficulty)
    delta = 0.85 * WEIGHTS[data.evidence_type] * signed * difficulty_factor / math.sqrt(data.attempts)
    state.mastery = _clamp(_sigmoid(_logit(state.mastery) + delta))
    state.retention = _clamp(state.retention * math.exp(-0.035 * elapsed_days))
    if data.evidence_type in {"retrieval", "quiz", "diagnostic"}:
        state.retention = _clamp(state.retention + 0.22 * data.score * (1 - state.retention))
    elif data.evidence_type in {"practice", "project"}:
        state.retention = _clamp(state.retention + 0.08 * data.score * (1 - state.retention))
    if data.evidence_type in {"transfer", "project"}:
        observed_transfer = data.score * (0.65 + 0.35 * data.transfer_distance)
        state.transfer = _clamp(0.7 * state.transfer + 0.3 * observed_transfer)
    signal = 1.0 if data.misconception_code else max(0.0, 0.55 - data.score)
    state.misconception = _clamp(0.72 * state.misconception + 0.28 * signal)
    state.evidence_count += 1
    kinds = set(state.evidence_types or [])
    kinds.add(data.evidence_type)
    state.evidence_types = sorted(kinds)
    state.uncertainty = _clamp(1 / math.sqrt(1 + 0.35 * state.evidence_count))
    state.evidence_adequacy = _clamp((1 - state.uncertainty) * (0.45 + 0.55 * min(1.0, len(kinds) / 4)))
    state.velocity = _clamp(0.7 * state.velocity + 0.3 * _sigmoid(8 * (state.mastery - previous_mastery)))
    state.last_evidence_at = now


async def _outbox_states(session: AsyncSession, user_id: UUID) -> tuple[list[LearnerConceptState], list[dict[str, Any]]]:
    events = list((await session.scalars(select(OutboxEvent).where(
        OutboxEvent.event_type == "lens.evidence.recorded", OutboxEvent.aggregate_id == user_id
    ).order_by(OutboxEvent.created_at.asc()))).all())
    states: dict[tuple[str, str | None], LearnerConceptState] = {}
    evidence_payloads = []
    for event in events:
        payload = event.payload
        evidence_payloads.append(payload)
        course_id = UUID(payload["course_id"]) if payload.get("course_id") else None
        key = (payload["concept"], payload.get("course_id"))
        state = states.setdefault(key, _new_state(user_id, course_id, payload["concept"]))
        occurred = datetime.fromisoformat(payload["occurred_at"])
        _apply_evidence(state, EvidenceCreate(**payload["evidence"]), occurred)
    return list(states.values()), evidence_payloads


def _clamp(value: float) -> float:
    return max(0.001, min(0.999, value))


def _logit(value: float) -> float:
    value = _clamp(value)
    return math.log(value / (1 - value))


def _sigmoid(value: float) -> float:
    return 1 / (1 + math.exp(-max(-20, min(20, value))))


def competency(state: LearnerConceptState) -> float:
    # Derived, not separately persisted, to avoid double-counting state.
    return (state.mastery * state.retention * state.transfer * (1 - state.misconception)) ** 0.25


def classify(state: LearnerConceptState) -> tuple[str, str]:
    deficits = {
        "insufficient_evidence": 1 - state.evidence_adequacy,
        "misconception": state.misconception,
        "retention": 1 - state.retention,
        "transfer": 1 - state.transfer,
        "mastery": 1 - state.mastery,
    }
    bottleneck = max(deficits, key=deficits.get)
    modes = {
        "insufficient_evidence": "diagnose", "misconception": "repair",
        "retention": "retrieve", "transfer": "generalize", "mastery": "build",
    }
    return bottleneck, modes[bottleneck]


def recommend(state: LearnerConceptState) -> dict[str, Any]:
    bottleneck, mode = classify(state)
    actions = {
        "diagnose": ("diagnostic_check", "Take a short adaptive diagnostic to establish a reliable baseline."),
        "repair": ("worked_example", "Review a contrasting worked example, then explain why the tempting answer is wrong."),
        "retrieve": ("spaced_retrieval", "Complete a no-notes retrieval check now and revisit it after a delay."),
        "generalize": ("novel_application", "Apply this concept in a new context with fewer hints."),
        "build": ("guided_practice", "Study one focused explanation and complete scaffolded practice."),
    }
    action, reason = actions[mode]
    candidates = []
    for candidate, effects in ACTION_EFFECTS.items():
        predicted = (
            .30 * effects.get("mastery", 0) + .24 * effects.get("retention", 0)
            + .22 * effects.get("transfer", 0) - .14 * effects.get("misconception", 0)
            - .10 * effects.get("uncertainty", 0) - .18 * effects["cost"]
        )
        if candidate == action:
            predicted += .18
        candidates.append({"action": candidate, "utility": round(predicted, 3), "estimated_minutes": round(5 + effects["cost"] * 35)})
    candidates.sort(key=lambda item: item["utility"], reverse=True)
    return {"action": action, "reason": reason, "concept": state.concept, "mode": mode,
            "priority": round(max(1 - competency(state), state.uncertainty), 3),
            "candidates": candidates}


async def record_evidence(session: AsyncSession, actor: User, data: EvidenceCreate) -> LearnerConceptState:
    schema_available = await ensure_adaptive_schema(session)
    target_id = data.user_id or actor.id
    if target_id != actor.id and actor.role not in {"admin", "teacher"}:
        raise PermissionError("Students may only record their own learning evidence")
    if target_id != actor.id and actor.role == "teacher":
        allowed = await visible_student_ids(session, actor)
        if allowed is not None and target_id not in allowed:
            raise PermissionError("This learner is outside your teaching organizations")
    target = await session.get(User, target_id)
    if not target:
        raise LookupError("Learner not found")
    now = data.occurred_at or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    if schema_available:
        state = await session.scalar(select(LearnerConceptState).where(
            LearnerConceptState.user_id == target_id, LearnerConceptState.course_id == data.course_id,
            LearnerConceptState.concept == data.concept))
        if not state:
            state = _new_state(target_id, data.course_id, data.concept)
            session.add(state)
        _apply_evidence(state, data, now)
        session.add(LearningEvidence(user_id=target_id, course_id=data.course_id, concept=data.concept,
            evidence_type=data.evidence_type, score=data.score, difficulty=data.difficulty, attempts=data.attempts,
            transfer_distance=data.transfer_distance, misconception_code=data.misconception_code,
            occurred_at=now, metadata_json=data.metadata))
    else:
        existing_states, _ = await _outbox_states(session, target_id)
        state = next((item for item in existing_states if item.course_id == data.course_id and item.concept == data.concept),
                     _new_state(target_id, data.course_id, data.concept))
        _apply_evidence(state, data, now)
        session.add(OutboxEvent(event_type="lens.evidence.recorded", aggregate_type="learner", aggregate_id=target_id,
            payload={"course_id": str(data.course_id) if data.course_id else None, "concept": data.concept,
                     "occurred_at": now.isoformat(), "evidence": data.model_dump(mode="json")}))
    await session.commit()
    if schema_available:
        await session.refresh(state)
    return state


def serialize_state(state: LearnerConceptState) -> LearnerStateRead:
    bottleneck, mode = classify(state)
    return LearnerStateRead(
        id=state.id, user_id=state.user_id, course_id=state.course_id, concept=state.concept,
        mastery=state.mastery, retention=state.retention, transfer=state.transfer,
        competency=competency(state), misconception=state.misconception,
        uncertainty=state.uncertainty, evidence_adequacy=state.evidence_adequacy,
        velocity=state.velocity, evidence_count=state.evidence_count,
        evidence_types=state.evidence_types or [], bottleneck=bottleneck, learning_mode=mode,
        recommendation=recommend(state), model_version=state.model_version,
    )


async def learner_dashboard(session: AsyncSession, user_id: UUID) -> LearnerDashboard:
    schema_available = await ensure_adaptive_schema(session)
    outbox_payloads: list[dict[str, Any]] = []
    if schema_available:
        states = list((await session.scalars(select(LearnerConceptState).where(
            LearnerConceptState.user_id == user_id).order_by(LearnerConceptState.updated_at.desc()))).all())
    else:
        states, outbox_payloads = await _outbox_states(session, user_id)
    output = [serialize_state(state) for state in states]
    overall = sum(item.competency for item in output) / len(output) if output else 0.0
    evidence = list((await session.scalars(select(LearningEvidence).where(
        LearningEvidence.user_id == user_id).order_by(LearningEvidence.occurred_at.desc()).limit(250))).all()) if schema_available else []
    by_type: dict[str, list[float]] = {}
    by_hour: dict[int, list[float]] = {}
    misconceptions: Counter[str] = Counter()
    for item in evidence:
        by_type.setdefault(item.evidence_type, []).append(item.score)
        by_hour.setdefault(item.occurred_at.hour, []).append(item.score)
        if item.misconception_code:
            misconceptions[item.misconception_code] += 1
    for payload in outbox_payloads[-250:]:
        item = payload["evidence"]
        by_type.setdefault(item["evidence_type"], []).append(float(item["score"]))
        hour = datetime.fromisoformat(payload["occurred_at"]).hour
        by_hour.setdefault(hour, []).append(float(item["score"]))
        if item.get("misconception_code"):
            misconceptions[item["misconception_code"]] += 1
    type_performance = {key: round(sum(values) / len(values), 3) for key, values in by_type.items()}
    best_type = max(type_performance, key=type_performance.get) if type_performance else None
    best_hour = max(by_hour, key=lambda hour: sum(by_hour[hour]) / len(by_hour[hour])) if by_hour else None
    plan = [item.recommendation for item in sorted(output, key=lambda row: row.recommendation["priority"], reverse=True)[:5]]
    return LearnerDashboard(user_id=user_id, states=output, overall_competency=overall,
                            needs_diagnostic=not output or all(s.evidence_adequacy < .35 for s in output),
                            learning_patterns={
                                "observations": len(evidence) + len(outbox_payloads), "performance_by_evidence": type_performance,
                                "strongest_evidence_context": best_type, "best_observed_hour": best_hour,
                                "recurring_misconceptions": dict(misconceptions.most_common(5)),
                                "notice": "Patterns describe observed platform behavior, not fixed learning styles.",
                            }, agent_plan=plan)


async def visible_student_ids(session: AsyncSession, viewer: User) -> set[UUID] | None:
    if viewer.role == "admin":
        return None
    organizations = select(OrganizationMembership.organization_id).where(OrganizationMembership.user_id == viewer.id)
    courses = select(Course.id).where(Course.organization_id.in_(organizations))
    return set((await session.scalars(select(Enrollment.user_id).where(Enrollment.course_id.in_(courses)))).all())


async def cohort_dashboard(session: AsyncSession, viewer: User) -> list[CohortLearnerRead]:
    schema_available = await ensure_adaptive_schema(session)
    allowed = await visible_student_ids(session, viewer)
    query = select(User).where(User.role == "student")
    if allowed is not None:
        query = query.where(User.id.in_(allowed))
    users = list((await session.scalars(query)).all())
    result = []
    for user in users:
        if schema_available:
            states = list((await session.scalars(select(LearnerConceptState).where(LearnerConceptState.user_id == user.id))).all())
        else:
            states, _ = await _outbox_states(session, user.id)
        bottlenecks = [classify(s)[0] for s in states]
        result.append(CohortLearnerRead(
            user_id=user.id, display_name=user.display_name, email=user.email,
            concept_count=len(states), average_competency=(sum(competency(s) for s in states) / len(states) if states else 0),
            high_risk_concepts=sum(competency(s) < .45 for s in states),
            primary_bottleneck=Counter(bottlenecks).most_common(1)[0][0] if bottlenecks else "insufficient_evidence",
        ))
    return result
