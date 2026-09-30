from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.enrollment.schemas import EnrollmentRead
from app.enrollment.service import AlreadyEnrolledError, CourseNotFoundError, enroll_user
from app.identity.auth import get_current_user
from app.identity.models import User
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/enrollments", tags=["enrollment"])


@router.post("/{course_id}", response_model=EnrollmentRead, status_code=status.HTTP_201_CREATED)
async def enroll(
    course_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EnrollmentRead:
    try:
        return await enroll_user(session, course_id, current_user)
    except CourseNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AlreadyEnrolledError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
