import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.models import Base, TimestampMixin, UUIDMixin


class ResourceProgress(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "resource_progress"
    __table_args__ = (UniqueConstraint("user_id", "resource_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("learning_resources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class LearningEvidence(UUIDMixin, TimestampMixin, Base):
    """Immutable observation consumed by the adaptive learning engine."""
    __tablename__ = "learning_evidence"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    concept: Mapped[str] = mapped_column(String(200), index=True)
    evidence_type: Mapped[str] = mapped_column(String(40), index=True)
    score: Mapped[float] = mapped_column(Float)
    difficulty: Mapped[float] = mapped_column(Float, default=0.5)
    attempts: Mapped[int] = mapped_column(Integer, default=1)
    transfer_distance: Mapped[float] = mapped_column(Float, default=0.0)
    misconception_code: Mapped[str | None] = mapped_column(String(160))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)


class LearnerConceptState(UUIDMixin, TimestampMixin, Base):
    """Versioned LENS-Omega learner state for one learner/concept pair."""
    __tablename__ = "learner_concept_states"
    __table_args__ = (UniqueConstraint("user_id", "course_id", "concept", name="uq_learner_course_concept"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    concept: Mapped[str] = mapped_column(String(200), index=True)
    mastery: Mapped[float] = mapped_column(Float, default=0.25)
    retention: Mapped[float] = mapped_column(Float, default=0.5)
    transfer: Mapped[float] = mapped_column(Float, default=0.25)
    misconception: Mapped[float] = mapped_column(Float, default=0.0)
    uncertainty: Mapped[float] = mapped_column(Float, default=1.0)
    evidence_adequacy: Mapped[float] = mapped_column(Float, default=0.0)
    velocity: Mapped[float] = mapped_column(Float, default=0.5)
    evidence_count: Mapped[int] = mapped_column(Integer, default=0)
    evidence_types: Mapped[list[str]] = mapped_column(JSON, default=list)
    last_evidence_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    model_version: Mapped[str] = mapped_column(String(32), default="lens-omega-0.1")
