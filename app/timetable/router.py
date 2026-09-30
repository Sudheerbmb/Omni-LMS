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
    TeacherLeave,
    TeacherProfile,
    TimetableRule,
    TimetableSlot,
)
from app.timetable.schemas import (
    SchoolGradeRead,
    SlotSwapRequest,
    SlotUpdateRequest,
    SubjectRead,
    SubstituteTeacherRead,
    TeacherFeedbackCreate,
    TeacherFeedbackRead,
    TeacherLeaveCreate,
    TeacherLeaveRead,
    TeacherProfileRead,
    TimetableGenerationResult,
    TimetableRuleCreate,
    TimetableRuleRead,
    TimetableRuleUpdate,
    TimetableSlotRead,
)
from app.timetable.service import (
    create_timetable_rule,
    delete_timetable_rule,
    find_available_substitutes,
    generate_school_timetable,
    get_all_teachers_with_feedback,
    get_all_timetable_rules,
    get_timetable_grid,
    seed_school_defaults,
    swap_slots,
    toggle_timetable_rule,
    update_slot,
    update_timetable_rule,
)

router = APIRouter(prefix="/api/v1/timetable", tags=["timetable"])


@router.post("/seed-defaults", response_model=Dict[str, Any])
async def seed_defaults_endpoint(
    session: AsyncSession = Depends(get_session),
):
    """Initializes Grades 1 to 10, subjects, curricula, teacher profiles, dynamic policy rules, and sample reviews."""
    result = await seed_school_defaults(session)
    return {
        "status": "success",
        "message": "Initialized Grades 1-10, CBSE-aligned subjects, teacher faculty, dynamic rules, and sample feedback restrictions.",
        "data": result,
    }


@router.post("/generate", response_model=TimetableGenerationResult)
async def generate_timetable_endpoint(
    session: AsyncSession = Depends(get_session),
):
    """Triggers the LangGraph Autonomous Timetable Agent using live Neon DB policy rules."""
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


# ── Dynamic Policy Rules Endpoints ──────────────────────────────────────────

@router.get("/rules", response_model=List[TimetableRuleRead])
async def get_rules_endpoint(
    session: AsyncSession = Depends(get_session),
):
    """Retrieves all dynamic school timetable policy rules."""
    return await get_all_timetable_rules(session)


@router.post("/rules", response_model=TimetableRuleRead)
async def create_rule_endpoint(
    payload: TimetableRuleCreate,
    session: AsyncSession = Depends(get_session),
):
    """Creates a new dynamic policy rule (e.g. custom capacity, specialized break, etc.)."""
    return await create_timetable_rule(session, payload.model_dump())


@router.put("/rules/{rule_id}", response_model=TimetableRuleRead)
async def update_rule_endpoint(
    rule_id: UUID,
    payload: TimetableRuleUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Modifies an existing policy rule (e.g. changing ground capacity from 2 to 3)."""
    rule = await update_timetable_rule(session, rule_id, payload.model_dump(exclude_unset=True))
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return rule


@router.delete("/rules/{rule_id}", response_model=Dict[str, Any])
async def delete_rule_endpoint(
    rule_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """Deletes a dynamic policy rule."""
    success = await delete_timetable_rule(session, rule_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return {"status": "success", "message": "Rule removed successfully"}


@router.post("/rules/{rule_id}/toggle", response_model=TimetableRuleRead)
async def toggle_rule_endpoint(
    rule_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """Toggles a dynamic policy rule ON or OFF."""
    rule = await toggle_timetable_rule(session, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return rule


# ── Interactive Substitutions, Drag-and-Drop Swap & Editing ─────────────────

@router.get("/substitutes", response_model=List[SubstituteTeacherRead])
async def find_substitutes_endpoint(
    slot_id: UUID = Query(..., description="ID of the timetable slot requiring substitution"),
    session: AsyncSession = Depends(get_session),
):
    """Smart Substitute Finder: Returns all qualified teachers with matching skills, zero-conflict schedule, and match score."""
    return await find_available_substitutes(session, slot_id)


@router.post("/slots/swap", response_model=Dict[str, Any])
async def swap_slots_endpoint(
    payload: SlotSwapRequest,
    session: AsyncSession = Depends(get_session),
):
    """Drag-and-Drop Support: Swaps subjects and teachers between two timetable periods."""
    result = await swap_slots(session, payload.slot_id_1, payload.slot_id_2)
    if result["status"] == "error":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
    return result


@router.put("/slots/{slot_id}", response_model=TimetableSlotRead)
async def update_slot_endpoint(
    slot_id: UUID,
    payload: SlotUpdateRequest,
    session: AsyncSession = Depends(get_session),
):
    """Directly updates a timetable slot (teacher assignment, subject, room)."""
    slot = await update_slot(session, slot_id, payload.model_dump(exclude_unset=True))
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found")
    return slot


# ── Teacher Absence / Leave Simulation ──────────────────────────────────────

@router.post("/leaves", response_model=TeacherLeaveRead)
async def record_teacher_leave_endpoint(
    payload: TeacherLeaveCreate,
    session: AsyncSession = Depends(get_session),
):
    """Records a teacher leave for a specific weekday. The LangGraph agent automatically substitutes them."""
    teacher = await session.get(TeacherProfile, payload.teacher_id)
    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")

    leave = TeacherLeave(
        teacher_id=payload.teacher_id,
        day_of_week=payload.day_of_week,
        reason=payload.reason,
        is_active=True,
    )
    session.add(leave)
    await session.commit()
    await session.refresh(leave)
    return leave


@router.get("/leaves", response_model=List[TeacherLeaveRead])
async def list_teacher_leaves_endpoint(
    session: AsyncSession = Depends(get_session),
):
    """Lists all active teacher leaves."""
    leaves = (await session.scalars(select(TeacherLeave).where(TeacherLeave.is_active == True))).all()
    return leaves


# ── Faculty & Feedback Endpoints ────────────────────────────────────────────

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

    if payload.rating <= 2:
        teacher.complaint_count += 1
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
