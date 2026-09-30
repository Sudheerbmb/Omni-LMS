import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, JSON, String, Uuid, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.models import Base, TimestampMixin, UUIDMixin


class LearningEvent(UUIDMixin, Base):
    __tablename__ = "learning_events"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    evidence: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StudentLearningProfile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "student_learning_profiles"
    __table_args__ = (UniqueConstraint("user_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    goals: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)
    skill_profile: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    knowledge_state: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    risk_status: Mapped[str] = mapped_column(String(40), default="ON_TRACK", nullable=False)
    learning_velocity: Mapped[float] = mapped_column(default=0, nullable=False)
    evidence_count: Mapped[int] = mapped_column(default=0, nullable=False)
    last_activity: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LearningRecommendation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "learning_recommendations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recommendation_type: Mapped[str] = mapped_column(String(40), nullable=False)
    skill: Mapped[str] = mapped_column(String(120), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="generated", nullable=False)
