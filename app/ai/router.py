from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.schemas import LearningEventCreate, LearningProfileRead, RecommendationRead
from app.ai.service import build_learning_profile, get_recommendations, record_learning_event
from app.identity.auth import get_current_user
from app.identity.models import User
from app.identity.permissions import require_permission
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/intelligence", tags=["learning intelligence"])


@router.post("/events", status_code=201)
async def record_event(
    data: LearningEventCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    event = await record_learning_event(session, current_user, data)
    return {"id": str(event.id), "event_type": event.event_type, "status": "recorded"}


@router.get("/profile", response_model=LearningProfileRead)
async def profile(
    current_user: User = Depends(require_permission("learning:use")),
    session: AsyncSession = Depends(get_session),
) -> LearningProfileRead:
    return await build_learning_profile(session, current_user)


@router.get("/recommendations", response_model=list[RecommendationRead])
async def recommendations(
    current_user: User = Depends(require_permission("learning:use")),
    session: AsyncSession = Depends(get_session),
) -> list[RecommendationRead]:
    return await get_recommendations(session, current_user)
