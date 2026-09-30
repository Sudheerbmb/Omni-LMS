from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.identity.auth import get_current_user
from app.identity.models import User
from app.learning.schemas import ProgressRead, ProgressUpdate
from app.learning.service import ProgressAccessError, ResourceNotFoundError, update_progress
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/learning", tags=["learning"])


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
