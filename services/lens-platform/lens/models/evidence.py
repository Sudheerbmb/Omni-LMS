import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column
from lens.database import LensBase, LensTimestampMixin, LensUUIDMixin


class RawEventArchive(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Immutable archive of all incoming LMS events for deterministic replay (Section 45, 73)."""
    __tablename__ = "lens_raw_events"

    event_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    event_version: Mapped[int] = mapped_column(Integer, default=1)
    source: Mapped[str] = mapped_column(String(64), default="lms")
    student_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    correlation_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class LearnerEvidence(LensUUIDMixin, LensTimestampMixin, LensBase):
    """
    Normalized multidimensional evidence object extracted from learning events (Section 8, 9).
    """
    __tablename__ = "lens_learner_evidence"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    student_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    course_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    concept_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    
    activity_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    assessment_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    question_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    event_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False) # DIAGNOSTIC, BENCHMARK, QUIZ, PRACTICE, ASSIGNMENT, CODING, EXAM, RETRIEVAL, TRANSFER, LIVE_CLASS, TEACHER_FEEDBACK, AI_TUTOR, REASSESSMENT
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False) # Normalized [0.0, 1.0]
    difficulty: Mapped[float] = mapped_column(Float, default=0.50) # Item difficulty parameter [0.0, 1.0]
    discrimination: Mapped[float] = mapped_column(Float, default=1.00) # Item discrimination index
    cognitive_level: Mapped[str] = mapped_column(String(64), default="APPLICATION") # FOUNDATION, APPLICATION, REASONING, PROBLEM_SOLVING, TRANSFER

    response_time_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    hint_used: Mapped[bool] = mapped_column(Boolean, default=False)
    assistance_used: Mapped[bool] = mapped_column(Boolean, default=False)
    misconception_signal: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    transfer_context: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
