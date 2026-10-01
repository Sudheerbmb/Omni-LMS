import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from lens.models.bottlenecks import LearnerRecommendation
from lens.models.evidence import LearnerEvidence
from lens.models.interventions import InterventionItem, InterventionOutcome
from lens.models.projections import StudentProjection
from lens.models.sn1_audit import TeacherEscalationAlert
from lens.models.state import LearnerState


async def tool_get_student_profile(session: AsyncSession, student_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    stmt = select(StudentProjection).where(StudentProjection.user_id == student_id)
    student = await session.scalar(stmt)
    if not student:
        return {"student_id": str(student_id), "display_name": "Student", "grade_number": 9}
    return {
        "student_id": str(student.user_id),
        "display_name": student.display_name,
        "email": student.email,
        "grade_number": student.grade_number,
    }


async def tool_get_learner_state(session: AsyncSession, student_id: uuid.UUID, concept_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    stmt = select(LearnerState).where(
        LearnerState.student_id == student_id,
        LearnerState.concept_id == concept_id,
    )
    state = await session.scalar(stmt)
    if not state:
        return None
    return {
        "mastery": state.mastery,
        "retention": state.retention,
        "transfer": state.transfer,
        "misconception": state.misconception,
        "competency": state.competency,
        "uncertainty": state.uncertainty,
        "identifiability": state.identifiability,
        "learning_velocity": state.learning_velocity,
        "current_bottleneck": state.current_bottleneck,
        "current_learning_mode": state.current_learning_mode,
        "evidence_count": state.evidence_count,
        "last_learning_timestamp": state.last_learning_timestamp.isoformat() if state.last_learning_timestamp else None,
    }


async def tool_get_recent_evidence(session: AsyncSession, student_id: uuid.UUID, limit: int = 5) -> List[Dict[str, Any]]:
    stmt = (
        select(LearnerEvidence)
        .where(LearnerEvidence.student_id == student_id)
        .order_by(desc(LearnerEvidence.timestamp))
        .limit(limit)
    )
    results = (await session.scalars(stmt)).all()
    return [
        {
            "event_type": e.event_type,
            "correct": e.correct,
            "score": e.score,
            "difficulty": e.difficulty,
            "cognitive_level": e.cognitive_level,
            "timestamp": e.timestamp.isoformat(),
        }
        for e in results
    ]


async def tool_get_available_interventions(
    session: AsyncSession, concept_id: uuid.UUID, mode: str
) -> List[Dict[str, Any]]:
    stmt = select(InterventionItem).where(
        InterventionItem.concept_id == concept_id,
        InterventionItem.is_available == True,
    )
    items = (await session.scalars(stmt)).all()
    if not items:
        # Generate canonical fallback intervention templates if catalog is sparse
        return [
            {
                "id": str(uuid.uuid4()),
                "title": f"{mode.title()} Module Exercise",
                "type": f"{mode.upper()}_PRACTICE",
                "difficulty": 0.50,
                "estimated_duration_minutes": 20,
                "cost": 1.0,
                "expected_dimensions": {"M": 0.15, "R": 0.10},
            },
            {
                "id": str(uuid.uuid4()),
                "title": f"Targeted Concept Review ({mode.title()})",
                "type": "MICRO_LESSON",
                "difficulty": 0.40,
                "estimated_duration_minutes": 15,
                "cost": 0.8,
                "expected_dimensions": {"M": 0.20, "MS": -0.20},
            }
        ]
    return [
        {
            "id": str(i.id),
            "title": i.title,
            "type": i.type,
            "difficulty": i.difficulty,
            "estimated_duration_minutes": i.estimated_duration_minutes,
            "cost": i.cost,
            "expected_dimensions": i.expected_dimensions,
        }
        for i in items
    ]


async def tool_create_recommendation(
    session: AsyncSession,
    tenant_id: str,
    student_id: uuid.UUID,
    concept_id: uuid.UUID,
    action_type: str,
    reason: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    rec = LearnerRecommendation(
        tenant_id=tenant_id,
        student_id=student_id,
        concept_id=concept_id,
        recommended_action_type=action_type,
        reason=reason,
        action_payload_json=payload,
        status="pending",
    )
    session.add(rec)
    await session.commit()
    await session.refresh(rec)
    return {"recommendation_id": str(rec.id), "status": rec.status}


async def tool_create_teacher_escalation(
    session: AsyncSession,
    tenant_id: str,
    student_id: uuid.UUID,
    concept_id: uuid.UUID,
    reason: str,
    severity: str = "MEDIUM",
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    alert = TeacherEscalationAlert(
        tenant_id=tenant_id,
        student_id=student_id,
        concept_id=concept_id,
        escalation_reason=reason,
        severity=severity,
        details_json=details or {},
        status="OPEN",
    )
    session.add(alert)
    await session.commit()
    await session.refresh(alert)
    return {"escalation_id": str(alert.id), "status": alert.status}
