from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.identity.auth import get_current_user
from app.identity.models import User
from app.learning.schemas import ActionFeedbackCreate, CohortLearnerRead, EvidenceCreate, LearnerDashboard, LearnerStateRead, ProgressRead, ProgressUpdate
from app.learning.adaptive import cohort_dashboard, ensure_adaptive_schema, learner_dashboard, record_evidence, serialize_state, visible_student_ids
from app.learning.models import LearnerConceptState, LearningActionFeedback
from sqlalchemy import select
from app.identity.permissions import require_roles
from app.learning.service import ProgressAccessError, ResourceNotFoundError, update_progress
from app.platform.database import get_session
from app.platform.models import OutboxEvent


router = APIRouter(prefix="/api/v1/learning", tags=["learning"])


@router.post("/adaptive/evidence", response_model=LearnerStateRead)
async def add_adaptive_evidence(data: EvidenceCreate, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    try:
        return serialize_state(await record_evidence(session, current_user, data))
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/adaptive/me", response_model=LearnerDashboard)
async def my_adaptive_dashboard(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    return await learner_dashboard(session, current_user.id)


@router.get("/adaptive/students/{student_id}", response_model=LearnerDashboard)
async def student_adaptive_dashboard(student_id: UUID, _current_user: User = Depends(require_roles("admin", "teacher")), session: AsyncSession = Depends(get_session)):
    allowed = await visible_student_ids(session, _current_user)
    if allowed is not None and student_id not in allowed:
        raise HTTPException(status_code=403, detail="This learner is outside your teaching organizations")
    return await learner_dashboard(session, student_id)


@router.get("/adaptive/cohort", response_model=list[CohortLearnerRead])
async def adaptive_cohort(_current_user: User = Depends(require_roles("admin", "teacher")), session: AsyncSession = Depends(get_session)):
    return await cohort_dashboard(session, _current_user)


@router.post("/adaptive/states/{state_id}/feedback", status_code=201)
async def adaptive_action_feedback(state_id: UUID, data: ActionFeedbackCreate, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    schema_available = await ensure_adaptive_schema(session)
    state = await session.scalar(select(LearnerConceptState).where(LearnerConceptState.id == state_id)) if schema_available else None
    if not schema_available:
        dashboard = await learner_dashboard(session, current_user.id)
        state_read = next((item for item in dashboard.states if item.id == state_id), None)
        if not state_read:
            raise HTTPException(status_code=404, detail="Learner state not found")
        feedback = OutboxEvent(event_type="lens.action.feedback", aggregate_type="learner", aggregate_id=current_user.id,
            payload={"state_id": str(state_id), **data.model_dump(mode="json")})
        session.add(feedback)
        await session.commit()
        return {"id": str(feedback.id), "status": "recorded"}
    if not state:
        raise HTTPException(status_code=404, detail="Learner state not found")
    if state.user_id != current_user.id:
        if current_user.role not in {"admin", "teacher"}:
            raise HTTPException(status_code=403, detail="You cannot review this learner action")
        allowed = await visible_student_ids(session, current_user)
        if allowed is not None and state.user_id not in allowed:
            raise HTTPException(status_code=403, detail="This learner is outside your teaching organizations")
    feedback = LearningActionFeedback(user_id=state.user_id, state_id=state.id, **data.model_dump())
    session.add(feedback)
    await session.commit()
    return {"id": str(feedback.id), "status": "recorded"}


@router.post("/resources/{resource_id}/progress", response_model=ProgressRead)
async def update_resource_progress(
    resource_id: UUID,
    data: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProgressRead:
    try:
        return await update_progress(
            session, resource_id, current_user, data.completed, data.position_seconds
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProgressAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
