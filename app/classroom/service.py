from datetime import datetime
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.classroom.models import LiveClass
from app.classroom.schemas import LiveClassCreate
from app.courses.models import Course
from app.enrollment.models import Enrollment
from app.identity.models import OrganizationMembership, User


class ClassroomAccessError(ValueError):
    pass


class CourseNotFoundError(ValueError):
    pass


class ScheduleConflictError(ValueError):
    pass


async def schedule_class(
    session: AsyncSession, course_id: UUID, data: LiveClassCreate, teacher: User
) -> LiveClass:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise CourseNotFoundError("Course not found")
    membership = await session.scalar(select(OrganizationMembership).where(
        OrganizationMembership.organization_id == course.organization_id,
        OrganizationMembership.user_id == teacher.id,
    ))
    if not membership:
        raise ClassroomAccessError("Teacher is not a member of this organization")
    conflict = await session.scalar(select(LiveClass).where(
        LiveClass.teacher_id == teacher.id,
        LiveClass.status == "scheduled",
        LiveClass.starts_at < data.ends_at,
        LiveClass.ends_at > data.starts_at,
    ))
    if conflict:
        raise ScheduleConflictError("Teacher already has a class during this time")
    live_class = LiveClass(course_id=course_id, teacher_id=teacher.id, **data.model_dump())
    session.add(live_class)
    await session.commit()
    await session.refresh(live_class)
    return live_class


async def get_schedule(session: AsyncSession, user: User) -> list[LiveClass]:
    if user.role in {"admin", "teacher"}:
        query = select(LiveClass).where(LiveClass.teacher_id == user.id)
    else:
        enrolled_courses = select(Enrollment.course_id).where(Enrollment.user_id == user.id)
        query = select(LiveClass).where(LiveClass.course_id.in_(enrolled_courses))
    return list((await session.scalars(query.order_by(LiveClass.starts_at))).all())
