from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.classroom.schemas import LiveClassCreate, LiveClassRead
from app.classroom.service import ClassroomAccessError, CourseNotFoundError, ScheduleConflictError, get_schedule, schedule_class
from app.identity.auth import get_current_user
from app.identity.models import User
from app.identity.permissions import require_permission
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/classroom", tags=["classroom"])


@router.post("/courses/{course_id}/classes", response_model=LiveClassRead, status_code=status.HTTP_201_CREATED)
async def create_class(
    course_id: UUID,
    data: LiveClassCreate,
    teacher: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> LiveClassRead:
    try:
        return await schedule_class(session, course_id, data, teacher)
    except CourseNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ClassroomAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ScheduleConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.get("/schedule", response_model=list[LiveClassRead])
async def schedule(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[LiveClassRead]:
    return await get_schedule(session, current_user)
