from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.models import LearningResource
from app.courses.models import Course, CourseVersion
from app.enrollment.models import Enrollment
from app.identity.models import User
from app.learning.models import ResourceProgress
from app.learning.adaptive import record_evidence
from app.learning.schemas import EvidenceCreate


class ProgressAccessError(ValueError):
    pass


class ResourceNotFoundError(ValueError):
    pass


async def update_progress(
    session: AsyncSession,
    resource_id: UUID,
    user: User,
    completed: bool,
    position_seconds: int,
) -> ResourceProgress:
    resource = await session.scalar(select(LearningResource).where(LearningResource.id == resource_id))
    if not resource:
        raise ResourceNotFoundError("Learning resource not found")

    version = await session.scalar(select(CourseVersion).where(CourseVersion.id == resource.course_version_id))
    course = await session.scalar(select(Course).where(Course.id == version.course_id))
    enrollment = await session.scalar(
        select(Enrollment).where(Enrollment.course_id == course.id, Enrollment.user_id == user.id)
    )
    if not enrollment:
        raise ProgressAccessError("User is not enrolled in this course")

    progress = await session.scalar(
        select(ResourceProgress).where(
            ResourceProgress.resource_id == resource_id,
            ResourceProgress.user_id == user.id,
        )
    )
    was_completed = progress.completed if progress else False
    if not progress:
        progress = ResourceProgress(user_id=user.id, resource_id=resource_id)
        session.add(progress)

    progress.completed = completed
    progress.position_seconds = position_seconds
    total = await session.scalar(
        select(func.count(LearningResource.id)).where(LearningResource.course_version_id == version.id)
    )
    completed_count = await session.scalar(
        select(func.count(ResourceProgress.id))
        .join(LearningResource, LearningResource.id == ResourceProgress.resource_id)
        .where(
            ResourceProgress.user_id == user.id,
            ResourceProgress.completed.is_(True),
            LearningResource.course_version_id == version.id,
        )
    )
    enrollment.progress_percent = round((completed_count / total) * 100) if total else 0
    if completed and not was_completed:
        await record_evidence(session, user, EvidenceCreate(
            course_id=course.id,
            concept=resource.title,
            evidence_type="practice",
            score=1.0,
            metadata={"resource_id": str(resource.id), "resource_type": resource.resource_type},
        ))
    await session.commit()
    await session.refresh(progress)
    return progress
