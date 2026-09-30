from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.courses.models import Course
from app.enrollment.models import Enrollment
from app.identity.models import User


class CourseNotFoundError(ValueError):
    pass


class AlreadyEnrolledError(ValueError):
    pass


async def enroll_user(session: AsyncSession, course_id: UUID, user: User) -> Enrollment:
    course = await session.scalar(select(Course).where(Course.id == course_id, Course.status == "published"))
    if not course:
        raise CourseNotFoundError("Published course not found")

    existing = await session.scalar(
        select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.user_id == user.id)
    )
    if existing:
        raise AlreadyEnrolledError("User is already enrolled in this course")

    enrollment = Enrollment(user_id=user.id, course_id=course_id)
    session.add(enrollment)
    await session.commit()
    await session.refresh(enrollment)
    return enrollment
