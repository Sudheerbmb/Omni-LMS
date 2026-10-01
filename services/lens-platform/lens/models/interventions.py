import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column
from lens.database import LensBase, LensTimestampMixin, LensUUIDMixin


class InterventionItem(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Dynamic intervention catalog item (Section 24)."""
    __tablename__ = "lens_interventions"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    course_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    concept_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(String(64), index=True, nullable=False) # MICRO_LESSON, WORKED_EXAMPLE, PRACTICE, RETRIEVAL, TRANSFER_PROBLEM, CODING_CHALLENGE, REMEDIATION, DIAGNOSTIC, TEACHER_REVIEW, AI_TUTOR_SESSION, PROJECT, CHALLENGE
    
    difficulty: Mapped[float] = mapped_column(Float, default=0.50)
    estimated_duration_minutes: Mapped[int] = mapped_column(Integer, default=20)
    required_prerequisites: Mapped[list] = mapped_column(JSON, default=list)
    expected_dimensions: Mapped[dict] = mapped_column(JSON, default=lambda: {"M": 0.15, "R": 0.10, "T": 0.10})
    content_source: Mapped[Optional[str]] = mapped_column(String(500), nullable=True) # LMS activity URL or resource ID
    cost: Mapped[float] = mapped_column(Float, default=1.0)
    risk_level: Mapped[str] = mapped_column(String(32), default="LOW") # LOW, MEDIUM, HIGH
    validation_status: Mapped[str] = mapped_column(String(32), default="VALIDATED")
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)


class InterventionOutcome(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Execution and verified outcome of an assigned intervention (Section 25, 31)."""
    __tablename__ = "lens_intervention_outcomes"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    student_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    intervention_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("lens_interventions.id", ondelete="CASCADE"), index=True)
    concept_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="assigned") # assigned, in_progress, completed, failed, expired
    
    pre_state_json: Mapped[dict] = mapped_column(JSON, default=dict)
    post_state_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    gain_delta_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    observed_performance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
