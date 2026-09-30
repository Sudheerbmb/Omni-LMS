from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.coding.schemas import (
    CodeSubmissionCreate,
    CodeSubmissionRead,
    ExerciseCreate,
    ExerciseRead,
    ExerciseUpdate,
    SubmissionResultUpdate,
)
from app.coding.service import (
    CodingAccessError,
    CodingNotFoundError,
    create_exercise,
    delete_exercise,
    get_exercise,
    get_latest_submission,
    get_submission,
    list_exercises,
    list_submissions,
    submit_code,
    update_exercise,
    update_submission_result,
)
from app.identity.models import User
from app.identity.permissions import require_permission
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/coding", tags=["coding"])


@router.post("/courses/{course_id}/exercises", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
async def create(
    course_id: UUID,
    data: ExerciseCreate,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> ExerciseRead:
    try:
        return await create_exercise(session, course_id, data, current_user)
    except CodingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CodingAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.get("/courses/{course_id}/exercises", response_model=list[ExerciseRead])
async def list_course_exercises(
    course_id: UUID,
    current_user: User = Depends(require_permission("learning:use")),
    session: AsyncSession = Depends(get_session),
) -> list[ExerciseRead]:
    try:
        return await list_exercises(session, course_id, current_user)
    except CodingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CodingAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.get("/exercises/{exercise_id}", response_model=ExerciseRead)
async def get(
    exercise_id: UUID,
    current_user: User = Depends(require_permission("learning:use")),
    session: AsyncSession = Depends(get_session),
) -> ExerciseRead:
    try:
        return await get_exercise(session, exercise_id, current_user)
    except CodingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CodingAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.patch("/exercises/{exercise_id}", response_model=ExerciseRead)
async def update(
    exercise_id: UUID,
    data: ExerciseUpdate,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> ExerciseRead:
    try:
        return await update_exercise(session, exercise_id, data, current_user)
    except CodingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CodingAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.delete("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    exercise_id: UUID,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> None:
    try:
        await delete_exercise(session, exercise_id, current_user)
    except CodingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CodingAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.post("/exercises/{exercise_id}/submissions", response_model=CodeSubmissionRead, status_code=status.HTTP_201_CREATED)
async def submit(
    exercise_id: UUID,
    data: CodeSubmissionCreate,
    current_user: User = Depends(require_permission("learning:use")),
    session: AsyncSession = Depends(get_session),
) -> CodeSubmissionRead:
    try:
        return await submit_code(session, exercise_id, data, current_user)
    except CodingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CodingAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.get("/exercises/{exercise_id}/submissions", response_model=list[CodeSubmissionRead])
async def list_exercise_submissions(
    exercise_id: UUID,
    current_user: User = Depends(require_permission("learning:use")),
    session: AsyncSession = Depends(get_session),
) -> list[CodeSubmissionRead]:
    try:
        return await list_submissions(session, exercise_id, current_user)
    except CodingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CodingAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.get("/exercises/{exercise_id}/submissions/latest", response_model=CodeSubmissionRead | None)
async def get_latest(
    exercise_id: UUID,
    current_user: User = Depends(require_permission("learning:use")),
    session: AsyncSession = Depends(get_session),
) -> CodeSubmissionRead | None:
    try:
        return await get_latest_submission(session, exercise_id, current_user)
    except CodingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CodingAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.get("/submissions/{submission_id}", response_model=CodeSubmissionRead)
async def get_submission_detail(
    submission_id: UUID,
    current_user: User = Depends(require_permission("learning:use")),
    session: AsyncSession = Depends(get_session),
) -> CodeSubmissionRead:
    try:
        return await get_submission(session, submission_id, current_user)
    except CodingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CodingAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.patch("/submissions/{submission_id}/result", response_model=CodeSubmissionRead)
async def update_result(
    submission_id: UUID,
    data: SubmissionResultUpdate,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CodeSubmissionRead:
    try:
        return await update_submission_result(session, submission_id, data.status, data.result, current_user)
    except CodingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CodingAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
