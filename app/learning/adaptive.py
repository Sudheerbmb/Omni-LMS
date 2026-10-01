"""LENS-Omega v0.1 evidence-to-action engine.

The coefficients are explicitly configurable prototype policy parameters. They
must be calibrated from real outcomes before being interpreted scientifically.
"""
from __future__ import annotations

import math
from collections import Counter
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.identity.models import User
from app.identity.models import OrganizationMembership
from app.courses.models import Course
from app.enrollment.models import Enrollment
from app.learning.models import LearnerConceptState, LearningEvidence
from app.learning.schemas import CohortLearnerRead, EvidenceCreate, LearnerDashboard, LearnerStateRead

WEIGHTS = {"diagnostic": 1.25, "quiz": 1.0, "retrieval": 1.15, "practice": 0.8,
           "transfer": 1.25, "project": 1.2, "teacher_observation": 0.65}


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
    return {"action": action, "reason": reason, "concept": state.concept, "mode": mode,
            "priority": round(max(1 - competency(state), state.uncertainty), 3)}


async def record_evidence(session: AsyncSession, actor: User, data: EvidenceCreate) -> LearnerConceptState:
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
    state = await session.scalar(select(LearnerConceptState).where(
        LearnerConceptState.user_id == target_id,
        LearnerConceptState.course_id == data.course_id,
        LearnerConceptState.concept == data.concept,
    ))
    if not state:
        state = LearnerConceptState(user_id=target_id, course_id=data.course_id, concept=data.concept)
        session.add(state)

    previous_mastery = state.mastery
    elapsed_days = 0.0
    if state.last_evidence_at:
        previous_time = state.last_evidence_at
        if previous_time.tzinfo is None:
            previous_time = previous_time.replace(tzinfo=timezone.utc)
        elapsed_days = max(0, (now - previous_time).total_seconds() / 86400)

    # Harder correct items add more evidence; harder incorrect items are less punitive.
    signed = (2 * data.score - 1)
    difficulty_factor = (0.7 + 0.6 * data.difficulty) if signed >= 0 else (1.3 - 0.6 * data.difficulty)
    attempt_factor = 1 / math.sqrt(data.attempts)
    delta = 0.85 * WEIGHTS[data.evidence_type] * signed * difficulty_factor * attempt_factor
    state.mastery = _clamp(_sigmoid(_logit(state.mastery) + delta))

    # Time-based retrievability with evidence-dependent retrieval strength.
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
    diversity = min(1.0, len(kinds) / 4)
    state.evidence_adequacy = _clamp((1 - state.uncertainty) * (0.45 + 0.55 * diversity))
    change = state.mastery - previous_mastery
    state.velocity = _clamp(0.7 * state.velocity + 0.3 * _sigmoid(8 * change))
    state.last_evidence_at = now

    session.add(LearningEvidence(
        user_id=target_id, course_id=data.course_id, concept=data.concept,
        evidence_type=data.evidence_type, score=data.score, difficulty=data.difficulty,
        attempts=data.attempts, transfer_distance=data.transfer_distance,
        misconception_code=data.misconception_code, occurred_at=now, metadata_json=data.metadata,
    ))
    await session.commit()
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
    states = list((await session.scalars(select(LearnerConceptState).where(
        LearnerConceptState.user_id == user_id).order_by(LearnerConceptState.updated_at.desc()))).all())
    output = [serialize_state(state) for state in states]
    overall = sum(item.competency for item in output) / len(output) if output else 0.0
    return LearnerDashboard(user_id=user_id, states=output, overall_competency=overall,
                            needs_diagnostic=not output or all(s.evidence_adequacy < .35 for s in output))


async def visible_student_ids(session: AsyncSession, viewer: User) -> set[UUID] | None:
    if viewer.role == "admin":
        return None
    organizations = select(OrganizationMembership.organization_id).where(OrganizationMembership.user_id == viewer.id)
    courses = select(Course.id).where(Course.organization_id.in_(organizations))
    return set((await session.scalars(select(Enrollment.user_id).where(Enrollment.course_id.in_(courses)))).all())


async def cohort_dashboard(session: AsyncSession, viewer: User) -> list[CohortLearnerRead]:
    allowed = await visible_student_ids(session, viewer)
    query = select(User).where(User.role == "student")
    if allowed is not None:
        query = query.where(User.id.in_(allowed))
    users = list((await session.scalars(query)).all())
    result = []
    for user in users:
        states = list((await session.scalars(select(LearnerConceptState).where(LearnerConceptState.user_id == user.id))).all())
        bottlenecks = [classify(s)[0] for s in states]
        result.append(CohortLearnerRead(
            user_id=user.id, display_name=user.display_name, email=user.email,
            concept_count=len(states), average_competency=(sum(competency(s) for s in states) / len(states) if states else 0),
            high_risk_concepts=sum(competency(s) < .45 for s in states),
            primary_bottleneck=Counter(bottlenecks).most_common(1)[0][0] if bottlenecks else "insufficient_evidence",
        ))
    return result
