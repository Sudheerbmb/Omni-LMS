from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.models import LearningEvent, LearningRecommendation, StudentLearningProfile
from app.ai.schemas import LearningEventCreate
from app.assessment.models import AssessmentAttempt
from app.coding.models import CodeSubmission
from app.enrollment.models import Enrollment
from app.identity.models import User
from app.learning.models import ResourceProgress


async def record_learning_event(
    session: AsyncSession, user: User, data: LearningEventCreate
) -> LearningEvent:
    event = LearningEvent(
        user_id=user.id,
        event_type=data.event_type,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        evidence=data.evidence,
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event


async def build_learning_profile(session: AsyncSession, user: User) -> StudentLearningProfile:
    event_count = await session.scalar(select(func.count(LearningEvent.id)).where(LearningEvent.user_id == user.id)) or 0
    completed_resources = await session.scalar(select(func.count(ResourceProgress.id)).where(
        ResourceProgress.user_id == user.id, ResourceProgress.completed.is_(True)
    )) or 0
    attempts = await session.scalar(select(func.count(AssessmentAttempt.id)).where(AssessmentAttempt.user_id == user.id)) or 0
    submissions = await session.scalar(select(func.count(CodeSubmission.id)).where(CodeSubmission.user_id == user.id)) or 0
    enrollments = await session.scalar(select(func.count(Enrollment.id)).where(Enrollment.user_id == user.id)) or 0

    evidence_count = int(event_count + completed_resources + attempts + submissions)
    profile = await session.scalar(select(StudentLearningProfile).where(StudentLearningProfile.user_id == user.id))
    if not profile:
        profile = StudentLearningProfile(user_id=user.id)
        session.add(profile)

    profile.knowledge_state = {
        "completed_resources": completed_resources,
        "assessment_attempts": attempts,
        "coding_submissions": submissions,
        "enrollments": enrollments,
    }
    profile.skill_profile = {
        "learning_activity": evidence_count,
        "assessment_evidence": attempts,
        "coding_evidence": submissions,
    }
    profile.evidence_count = evidence_count
    profile.learning_velocity = round(evidence_count / max(enrollments, 1), 2)
    profile.last_activity = datetime.now(timezone.utc) if evidence_count else None
    profile.risk_status = "ON_TRACK" if evidence_count or not enrollments else "NEEDS_ATTENTION"
    await session.commit()
    await session.refresh(profile)
    return profile


async def get_recommendations(session: AsyncSession, user: User) -> list[LearningRecommendation]:
    return list((await session.scalars(
        select(LearningRecommendation).where(LearningRecommendation.user_id == user.id)
        .order_by(LearningRecommendation.created_at.desc())
    )).all())
