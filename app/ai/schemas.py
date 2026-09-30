from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

LearningEventType = Literal[
    "lesson_started", "lesson_completed", "video_started", "video_completed",
    "quiz_started", "quiz_completed", "assignment_submitted", "assignment_graded",
    "coding_started", "coding_submitted", "coding_completed", "resource_opened",
    "recommendation_opened", "recommendation_completed",
]


class LearningEventCreate(BaseModel):
    event_type: LearningEventType
    entity_type: str = Field(min_length=1, max_length=80)
    entity_id: UUID | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)


class LearningProfileRead(BaseModel):
    user_id: UUID
    goals: list[Any]
    skill_profile: dict[str, Any]
    knowledge_state: dict[str, Any]
    risk_status: str
    learning_velocity: float
    evidence_count: int
    last_activity: datetime | None


class RecommendationRead(BaseModel):
    id: UUID
    recommendation_type: str
    skill: str
    reason: str
    evidence: dict[str, Any]
    status: str
