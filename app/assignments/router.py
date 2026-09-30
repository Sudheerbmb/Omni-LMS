from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.assignments.schemas import AssignmentCreate, AssignmentRead, GradeRequest, SubmissionCreate, SubmissionRead
from app.assignments.service import (
    AssignmentAccessError,
    AssignmentNotFoundError,
    SubmissionAlreadyExistsError,
    create_assignment,
    grade_submission,
    submit_assignment,
)
from app.identity.models import User
from app.identity.permissions import require_permission
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/assignments", tags=["assignments"])


@router.post("/courses/{course_id}", response_model=AssignmentRead, status_code=status.HTTP_201_CREATED)
async def create(
    course_id: UUID,
    data: AssignmentCreate,
    current_user: User = Depends(require_permission("assignment:manage")),
    session: AsyncSession = Depends(get_session),
) -> AssignmentRead:
    try:
        return await create_assignment(session, course_id, data, current_user)
    except AssignmentAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.post("/{assignment_id}/submissions", response_model=SubmissionRead, status_code=status.HTTP_201_CREATED)
async def submit(
    assignment_id: UUID,
    data: SubmissionCreate,
    current_user: User = Depends(require_permission("assignment:submit")),
    session: AsyncSession = Depends(get_session),
) -> SubmissionRead:
    try:
        return await submit_assignment(session, assignment_id, data, current_user)
    except AssignmentNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except (AssignmentAccessError, SubmissionAlreadyExistsError) as error:
        raise HTTPException(status_code=409 if isinstance(error, SubmissionAlreadyExistsError) else 403, detail=str(error)) from error


@router.post("/submissions/{submission_id}/grade", response_model=SubmissionRead)
async def grade(
    submission_id: UUID,
    data: GradeRequest,
    current_user: User = Depends(require_permission("assignment:grade")),
    session: AsyncSession = Depends(get_session),
) -> SubmissionRead:
    try:
        return await grade_submission(session, submission_id, data, current_user)
    except AssignmentNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssignmentAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
