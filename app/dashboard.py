from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.assessment.models import Assessment
from app.assignments.models import AssignmentSubmission
from app.classroom.models import LiveClass
from app.communication.models import Announcement
from app.coding.models import CodingExercise
from app.courses.models import Course
from app.enrollment.models import Enrollment
from app.identity.auth import get_current_user
from app.identity.models import User, OrganizationMembership
from app.platform.database import get_session
from app.platform.models import OutboxEvent
from app.certification.models import Certificate
from app.timetable.models import TimetableSlot, TimetableRule


router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/summary")
async def summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user_id: UUID = current_user.id
    managed_organizations = select(OrganizationMembership.organization_id).where(
        OrganizationMembership.user_id == user_id
    )
    courses_created = await session.scalar(
        select(func.count(Course.id)).where(Course.organization_id.in_(managed_organizations))
    )
    enrolled_courses = await session.scalar(
        select(func.count(Enrollment.id)).where(Enrollment.user_id == user_id)
    )
    submissions = await session.scalar(
        select(func.count(AssignmentSubmission.id)).where(AssignmentSubmission.user_id == user_id)
    )
    certificates = await session.scalar(
        select(func.count(Certificate.id)).where(Certificate.user_id == user_id)
    )
    assessments = await session.scalar(select(func.count(Assessment.id))) or 0
    coding_exercises = await session.scalar(select(func.count(CodingExercise.id))) or 0
    events = await session.scalar(select(func.count(OutboxEvent.id))) or 0
    users_total = await session.scalar(select(func.count(User.id))) or 0
    students_total = await session.scalar(select(func.count(User.id)).where(User.role == "student")) or 0
    teachers_total = await session.scalar(select(func.count(User.id)).where(User.role == "teacher")) or 0
    pending_users = await session.scalar(select(func.count(User.id)).where(User.status != "active")) or 0
    active_users = await session.scalar(select(func.count(User.id)).where(User.status == "active")) or 0
    courses_total = await session.scalar(select(func.count(Course.id))) or 0
    published_courses = await session.scalar(select(func.count(Course.id)).where(Course.status == "published")) or 0
    enrollments_total = await session.scalar(select(func.count(Enrollment.id))) or 0
    live_classes = await session.scalar(select(func.count(LiveClass.id)).where(LiveClass.status == "scheduled")) or 0
    live_classes_active = await session.scalar(select(func.count(LiveClass.id)).where(LiveClass.status == "live")) or 0
    announcements = await session.scalar(select(func.count(Announcement.id))) or 0
    timetable_slots_total = await session.scalar(select(func.count(TimetableSlot.id))) or 0
    timetable_rules_active = await session.scalar(select(func.count(TimetableRule.id)).where(TimetableRule.is_enabled == True)) or 0

    return {
        "role": current_user.role,
        "user": {
            "id": str(current_user.id),
            "display_name": current_user.display_name,
            "email": current_user.email,
        },
        "stats": {
            "courses_created": courses_created or 0,
            "courses_enrolled": enrolled_courses or 0,
            "submissions": submissions or 0,
            "certificates": certificates or 0,
            "assessments": assessments,
            "coding_exercises": coding_exercises,
            "platform_events": events,
            "users_total": users_total,
            "students_total": students_total,
            "teachers_total": teachers_total,
            "pending_users": pending_users,
            "active_users": active_users,
            "courses_total": courses_total,
            "published_courses": published_courses,
            "enrollments_total": enrollments_total,
            "live_classes": live_classes,
            "live_classes_active": live_classes_active,
            "announcements": announcements,
            "timetable_slots_total": timetable_slots_total,
            "timetable_rules_active": timetable_rules_active,
        },
    }
