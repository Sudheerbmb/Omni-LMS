from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.schemas import ResourceCreate, ResourceRead
from app.content.service import ContentAccessError, CourseNotFoundError, create_resource
from app.identity.models import User
from app.identity.permissions import require_permission
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/courses", tags=["content"])


@router.post("/{course_id}/resources", response_model=ResourceRead, status_code=status.HTTP_201_CREATED)
async def create(
    course_id: UUID,
    data: ResourceCreate,
    current_user: User = Depends(require_permission("content:manage")),
    session: AsyncSession = Depends(get_session),
) -> ResourceRead:
    try:
        return await create_resource(session, course_id, data, current_user)
    except CourseNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ContentAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
