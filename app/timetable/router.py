from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.platform.database import get_session
from app.timetable.models import (
    SchoolGrade,
    SchoolSection,
    Subject,
    TeacherClassRestriction,
    TeacherFeedback,
    TeacherProfile,
)
from app.timetable.schemas import (
    SchoolGradeRead,
    SubjectRead,
    TeacherFeedbackCreate,
    TeacherFeedbackRead,
    TeacherProfileRead,
    TimetableGenerationResult,
    TimetableSlotRead,
)
from app.timetable.service import (
    generate_school_timetable,
    get_all_teachers_with_feedback,
    get_timetable_grid,
    seed_school_defaults,
)

router = APIRouter(prefix="/api/v1/timetable", tags=["timetable"])


@router.post("/seed-defaults", response_model=Dict[str, Any])
async def seed_defaults_endpoint(
    session: AsyncSession = Depends(get_session),
):
    """Initializes Grades 1 to 10, subjects, curricula, teacher profiles, and sample reviews in Neon DB."""
    result = await seed_school_defaults(session)
    return {
        "status": "success",
        "message": "Initialized Grades 1-10, CBSE-aligned subjects, teacher faculty, and sample feedback restrictions.",
        "data": result,
    }


@router.post("/generate", response_model=TimetableGenerationResult)
async def generate_timetable_endpoint(
    session: AsyncSession = Depends(get_session),
):
    """Triggers the LangGraph Autonomous Timetable Agent to schedule all classes (8:00 AM - 5:00 PM)."""
    result = await generate_school_timetable(session)
    return result


@router.get("/grid", response_model=List[TimetableSlotRead])
async def get_grid_endpoint(
    section_id: Optional[UUID] = Query(None, description="Filter by section ID"),
    grade_id: Optional[UUID] = Query(None, description="Filter by grade ID"),
    teacher_id: Optional[UUID] = Query(None, description="Filter by teacher profile ID"),
    day_of_week: Optional[str] = Query(None, description="Filter by weekday (Monday - Friday)"),
    session: AsyncSession = Depends(get_session),
):
    """Retrieves timetable slots formatted for weekly display."""
    return await get_timetable_grid(
        session,
        section_id=section_id,
        grade_id=grade_id,
        teacher_id=teacher_id,
        day_of_week=day_of_week,
    )


@router.get("/grades", response_model=List[SchoolGradeRead])
async def get_grades_endpoint(
    session: AsyncSession = Depends(get_session),
):
    """Retrieves all school grades with their respective sections."""
    grades = (
        await session.scalars(
            select(SchoolGrade)
            .options(selectinload(SchoolGrade.sections))
            .order_by(SchoolGrade.grade_number)
        )
    ).all()
    return grades


@router.get("/subjects", response_model=List[SubjectRead])
async def get_subjects_endpoint(
    session: AsyncSession = Depends(get_session),
):
    """Retrieves all school subjects."""
    subjects = (await session.scalars(select(Subject).order_by(Subject.name))).all()
    return subjects


@router.get("/teachers", response_model=List[TeacherProfileRead])
async def get_teachers_endpoint(
    session: AsyncSession = Depends(get_session),
):
    """Retrieves all teacher profiles with their subject skills, ratings, and active restrictions."""
    return await get_all_teachers_with_feedback(session)


@router.post("/feedback", response_model=TeacherFeedbackRead)
async def submit_teacher_feedback(
    payload: TeacherFeedbackCreate,
    session: AsyncSession = Depends(get_session),
):
    """Submits student feedback or complaint. If rating is low (<= 2), automatically creates a class restriction."""
    teacher = await session.get(TeacherProfile, payload.teacher_id)
    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")

    feedback = TeacherFeedback(
        teacher_id=payload.teacher_id,
        section_id=payload.section_id,
        subject_id=payload.subject_id,
        rating=payload.rating,
        category=payload.category,
        comments=payload.comments,
        is_active_complaint=payload.rating <= 2,
    )
    session.add(feedback)

    # Recalculate teacher rating average and complaint count
    if payload.rating <= 2:
        teacher.complaint_count += 1
        # Check if restriction already exists
        existing_res = await session.scalar(
            select(TeacherClassRestriction).where(
                TeacherClassRestriction.teacher_id == payload.teacher_id,
                TeacherClassRestriction.section_id == payload.section_id,
                TeacherClassRestriction.subject_id == payload.subject_id,
            )
        )
        if not existing_res:
            session.add(
                TeacherClassRestriction(
                    teacher_id=payload.teacher_id,
                    section_id=payload.section_id,
                    subject_id=payload.subject_id,
                    reason=f"Student Complaint: {payload.comments} (Rating: {payload.rating}/5)",
                    is_active=True,
                )
            )

    await session.commit()
    await session.refresh(feedback)
    return feedback


@router.post("/restrictions/{restriction_id}/toggle", response_model=Dict[str, Any])
async def toggle_restriction_endpoint(
    restriction_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """Allows administrators to manually activate or deactivate a teacher class restriction."""
    restriction = await session.get(TeacherClassRestriction, restriction_id)
    if not restriction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restriction not found")

    restriction.is_active = not restriction.is_active
    await session.commit()
    return {
        "status": "success",
        "restriction_id": str(restriction.id),
        "is_active": restriction.is_active,
    }
