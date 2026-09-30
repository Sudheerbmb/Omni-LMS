from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.assessment.schemas import (
    AssessmentCreate,
    AssessmentRead,
    AttemptCreate,
    AttemptRead,
    QuestionCreate,
    QuestionRead,
)
from app.assessment.service import (
    AssessmentAccessError,
    AssessmentNotFoundError,
    add_question,
    create_assessment,
    submit_attempt,
)
from app.identity.models import User
from app.identity.permissions import require_permission
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/assessment", tags=["assessment"])


@router.post("/courses/{course_id}", response_model=AssessmentRead, status_code=status.HTTP_201_CREATED)
async def create(
    course_id: UUID,
    data: AssessmentCreate,
    current_user: User = Depends(require_permission("assessment:manage")),
    session: AsyncSession = Depends(get_session),
) -> AssessmentRead:
    try:
        return await create_assessment(session, course_id, data, current_user)
    except AssessmentAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.post("/{assessment_id}/questions", response_model=QuestionRead, status_code=status.HTTP_201_CREATED)
async def question(
    assessment_id: UUID,
    data: QuestionCreate,
    current_user: User = Depends(require_permission("assessment:manage")),
    session: AsyncSession = Depends(get_session),
) -> QuestionRead:
    try:
        return await add_question(session, assessment_id, data, current_user)
    except AssessmentNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssessmentAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.post("/{assessment_id}/attempts", response_model=AttemptRead)
async def attempt(
    assessment_id: UUID,
    data: AttemptCreate,
    current_user: User = Depends(require_permission("assessment:attempt")),
    session: AsyncSession = Depends(get_session),
) -> AttemptRead:
    try:
        return await submit_attempt(session, assessment_id, data, current_user)
    except AssessmentNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssessmentAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
