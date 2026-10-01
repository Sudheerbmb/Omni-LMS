import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class LMSEventContract(BaseModel):
    """
    Section 45: Strict event contract for all incoming learning events.
    """
    event_id: str = Field(description="Unique idempotency identifier")
    event_type: str = Field(description="quiz.completed, assignment.graded, coding.tested, classroom.attended, etc.")
    event_version: int = Field(default=1)
    source: str = Field(default="lms")
    student_id: uuid.UUID
    course_id: uuid.UUID
    concept_id: Optional[uuid.UUID] = None
    occurred_at: datetime = Field(default_factory=datetime.utcnow)
    correlation_id: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)


class EvidenceNormalizedContract(BaseModel):
    """Normalized evidence structure after ingestion (Section 8, 9)."""
    student_id: uuid.UUID
    course_id: uuid.UUID
    concept_id: uuid.UUID
    activity_id: Optional[str] = None
    assessment_id: Optional[str] = None
    question_id: Optional[str] = None
    event_type: str
    correct: bool
    score: float
    difficulty: float = 0.50
    discrimination: float = 1.00
    cognitive_level: str = "APPLICATION"
    response_time_seconds: Optional[float] = None
    attempt_number: int = 1
    confidence: Optional[float] = None
    hint_used: bool = False
    assistance_used: bool = False
    misconception_signal: Optional[str] = None
    transfer_context: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)
