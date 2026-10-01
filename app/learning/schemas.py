from datetime import datetime
from uuid import UUID
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ProgressUpdate(BaseModel):
    completed: bool = False
    position_seconds: int = Field(default=0, ge=0)


class ProgressRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    resource_id: UUID
    completed: bool
    position_seconds: int


class EvidenceCreate(BaseModel):
    user_id: UUID | None = None
    course_id: UUID | None = None
    concept: str = Field(min_length=1, max_length=200)
    evidence_type: Literal["diagnostic", "quiz", "retrieval", "practice", "transfer", "project", "teacher_observation"]
    score: float = Field(ge=0, le=1)
    difficulty: float = Field(default=0.5, ge=0, le=1)
    attempts: int = Field(default=1, ge=1, le=100)
    transfer_distance: float = Field(default=0, ge=0, le=1)
    misconception_code: str | None = Field(default=None, max_length=160)
    occurred_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class LearnerStateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    course_id: UUID | None
    concept: str
    mastery: float
    retention: float
    transfer: float
    competency: float
    misconception: float
    uncertainty: float
    evidence_adequacy: float
    velocity: float
    evidence_count: int
    evidence_types: list[str]
    bottleneck: str
    learning_mode: str
    recommendation: dict[str, Any]
    model_version: str


class LearnerDashboard(BaseModel):
    user_id: UUID
    states: list[LearnerStateRead]
    overall_competency: float
    needs_diagnostic: bool


class CohortLearnerRead(BaseModel):
    user_id: UUID
    display_name: str
    email: str
    concept_count: int
    average_competency: float
    high_risk_concepts: int
    primary_bottleneck: str
