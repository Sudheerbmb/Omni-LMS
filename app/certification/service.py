import secrets
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.certification.models import Certificate
from app.courses.models import Course
from app.enrollment.models import Enrollment
from app.identity.models import User


class CompletionRequiredError(ValueError):
    pass


class CourseNotFoundError(ValueError):
    pass


async def issue_certificate(session: AsyncSession, course_id: UUID, user: User) -> Certificate:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise CourseNotFoundError("Course not found")
    enrollment = await session.scalar(
        select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.user_id == user.id)
    )
    if not enrollment or enrollment.progress_percent < 100:
        raise CompletionRequiredError("Complete the course before requesting a certificate")

    existing = await session.scalar(
        select(Certificate).where(Certificate.course_id == course_id, Certificate.user_id == user.id)
    )
    if existing:
        return existing

    certificate = Certificate(
        user_id=user.id,
        course_id=course_id,
        certificate_number=f"LMS-{secrets.token_hex(8).upper()}",
    )
    session.add(certificate)
    await session.commit()
    await session.refresh(certificate)
    return certificate


async def verify_certificate(session: AsyncSession, certificate_number: str) -> Certificate | None:
    return await session.scalar(
        select(Certificate).where(Certificate.certificate_number == certificate_number)
    )
