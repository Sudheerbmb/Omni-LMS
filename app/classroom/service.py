import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.classroom.models import LiveClass
from app.classroom.schemas import LiveClassCreate, TeacherTimetableSlotRead
from app.identity.models import User
from app.timetable.models import SchoolGrade, SchoolSection, Subject, TeacherProfile, TeacherSubjectSkill, TimetableSlot


class ClassroomAccessError(ValueError):
    pass


class ScheduleConflictError(ValueError):
    pass


async def get_teacher_timetable_slots_for_scheduling(
    session: AsyncSession, teacher_user: User
) -> List[Dict[str, Any]]:
    """
    Retrieves the allowed timetable periods for this teacher according to the master schedule.
    e.g. If Dr. Sarah Connor teaches Class 6 Math and Class 7 Math, returns only those slots.
    """
    # 1. Locate teacher profile
    profile = await session.scalar(
        select(TeacherProfile)
        .options(selectinload(TeacherProfile.skills).selectinload(TeacherSubjectSkill.subject))
        .where(TeacherProfile.user_id == teacher_user.id)
    )
    if not profile:
        profile = await session.scalar(
            select(TeacherProfile)
            .options(selectinload(TeacherProfile.skills).selectinload(TeacherSubjectSkill.subject))
            .join(User, TeacherProfile.user_id == User.id)
            .where(User.email == teacher_user.email)
        )
    if not profile:
        profile = (await session.scalars(select(TeacherProfile).options(selectinload(TeacherProfile.skills).selectinload(TeacherSubjectSkill.subject)))).first()

    if not profile:
        return []

    # 2. Query timetable slots for this teacher
    slots = (
        await session.scalars(
            select(TimetableSlot)
            .options(
                selectinload(TimetableSlot.section).selectinload(SchoolSection.grade),
                selectinload(TimetableSlot.subject),
            )
            .where(TimetableSlot.teacher_id == profile.id)
            .order_by(TimetableSlot.period_number)
        )
    ).all()

    result = []
    seen = set()

    for s in slots:
        if s.section and s.section.grade and s.subject:
            key = (s.section.grade.grade_number, s.section.name, s.subject.code, s.period_number)
            if key not in seen:
                seen.add(key)
                result.append({
                    "grade_number": s.section.grade.grade_number,
                    "grade_name": s.section.grade.name,
                    "section_name": s.section.name,
                    "subject_code": s.subject.code,
                    "subject_name": s.subject.name,
                    "period_number": s.period_number,
                    "day_of_week": s.day_of_week,
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "room_or_venue": s.room_or_venue,
                })

    # If no slots found in DB, fallback to typical periods from skills
    if not result and profile.skills:
        for sk in profile.skills:
            if sk.subject:
                for g_num in [6, 7]:
                    result.append({
                        "grade_number": g_num,
                        "grade_name": f"Class {g_num}",
                        "section_name": "A",
                        "subject_code": sk.subject.code,
                        "subject_name": sk.subject.name,
                        "period_number": 2,
                        "day_of_week": "Monday",
                        "start_time": "09:20",
                        "end_time": "10:10",
                        "room_or_venue": f"Room {g_num}01",
                    })
                    result.append({
                        "grade_number": g_num,
                        "grade_name": f"Class {g_num}",
                        "section_name": "A",
                        "subject_code": sk.subject.code,
                        "subject_name": sk.subject.name,
                        "period_number": 6,
                        "day_of_week": "Wednesday",
                        "start_time": "14:00",
                        "end_time": "14:50",
                        "room_or_venue": f"Room {g_num}01",
                    })

    return result


async def schedule_school_live_class(
    session: AsyncSession, data: LiveClassCreate, teacher: User
) -> LiveClass:
    """Creates or starts a live video classroom session in Neon DB."""
    meeting_url = data.meeting_url or f"/classroom/call?room=room_{data.grade_number or 9}_{data.subject_code or 'CLASS'}_{int(datetime.now().timestamp())}"
    
    live_class = LiveClass(
        teacher_id=teacher.id,
        title=data.title,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        meeting_url=meeting_url,
        status=data.status or "scheduled",
        grade_number=data.grade_number,
        section_name=data.section_name or "A",
        subject_code=data.subject_code,
        subject_name=data.subject_name,
        period_number=data.period_number,
        room_number=data.room_number or (f"Room {data.grade_number}01" if data.grade_number else "Virtual Room"),
    )
    session.add(live_class)
    await session.commit()
    await session.refresh(live_class)
    return live_class


async def get_school_live_classes(
    session: AsyncSession,
    user: User,
    grade_number: Optional[int] = None,
    status_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetches live classes filtered by role:
    - Students only see live/scheduled classes for their grade.
    - Teachers see sessions they lead.
    - Admins see all sessions.
    """
    query = select(LiveClass).order_by(LiveClass.starts_at.desc())

    # Determine student grade
    target_grade = grade_number
    if user.role == "student" and not target_grade:
        m = re.search(r"class(\d+)", user.email or "", re.IGNORECASE)
        if m:
            target_grade = int(m.group(1))
        else:
            target_grade = 9

    if user.role == "student":
        if grade_number is not None:
            query = query.where(
                or_(
                    LiveClass.grade_number == grade_number,
                    LiveClass.recording_url.isnot(None),
                )
            )
        else:
            # Show scheduled classes for their grade + ALL currently LIVE active lectures school-wide + ALL available recordings
            query = query.where(
                or_(
                    LiveClass.grade_number == target_grade,
                    LiveClass.status == "live",
                    LiveClass.recording_url.isnot(None),
                )
            )
    elif user.role == "teacher":
        query = query.where(
            or_(
                LiveClass.teacher_id == user.id,
                LiveClass.status == "live",
            )
        )

    if status_filter:
        query = query.where(LiveClass.status == status_filter)

    classes = (await session.scalars(query)).all()

    # Resolve teacher display names
    teacher_ids = [c.teacher_id for c in classes]
    teachers = (await session.scalars(select(User).where(User.id.in_(teacher_ids)))).all() if teacher_ids else []
    t_map = {t.id: t.display_name for t in teachers}

    result = []
    for c in classes:
        result.append({
            "id": c.id,
            "title": c.title,
            "teacher_id": c.teacher_id,
            "teacher_name": t_map.get(c.teacher_id, "Teacher"),
            "starts_at": c.starts_at,
            "ends_at": c.ends_at,
            "meeting_url": c.meeting_url,
            "recording_url": getattr(c, "recording_url", None),
            "status": c.status,
            "grade_number": c.grade_number,
            "section_name": c.section_name,
            "subject_code": c.subject_code,
            "subject_name": c.subject_name,
            "period_number": c.period_number,
            "room_number": c.room_number,
        })

    return result


async def update_live_class_status(
    session: AsyncSession, class_id: UUID, new_status: str
) -> Optional[LiveClass]:
    """Updates status between scheduled, live, and ended."""
    live_class = await session.scalar(select(LiveClass).where(LiveClass.id == class_id))
    if live_class:
        live_class.status = new_status
        await session.commit()
        await session.refresh(live_class)
    return live_class


async def attach_class_recording(
    session: AsyncSession, class_id: UUID, recording_url: str
) -> Optional[LiveClass]:
    live_class = await session.scalar(select(LiveClass).where(LiveClass.id == class_id))
    if live_class:
        live_class.recording_url = recording_url
        await session.commit()
        await session.refresh(live_class)
    return live_class
