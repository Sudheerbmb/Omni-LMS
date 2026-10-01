import uuid
from typing import Optional
from sqlalchemy import Float, String, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column
from lens.database import LensBase, LensTimestampMixin, LensUUIDMixin


class BottleneckEvent(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Historical record of detected learning bottlenecks and mode shifts (Section 22, 23)."""
    __tablename__ = "lens_bottleneck_events"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    student_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    concept_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    
    bottleneck_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False) # MASTERY, RETENTION, TRANSFER, MISCONCEPTION, UNCERTAINTY, INSUFFICIENT_EVIDENCE
    learning_mode: Mapped[str] = mapped_column(String(64), nullable=False) # ACQUISITION, RETRIEVAL, TRANSFER, REMEDIATION, DIAGNOSTIC
    identifiability: Mapped[float] = mapped_column(Float, nullable=False)
    state_snapshot_json: Mapped[dict] = mapped_column(JSON, default=dict)


class LearnerRecommendation(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Actionable recommendations computed for student and SN1 execution (Section 31)."""
    __tablename__ = "lens_recommendations"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    student_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    concept_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    
    recommended_action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    priority: Mapped[str] = mapped_column(String(32), default="medium") # low, medium, high, critical
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    action_payload_json: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="pending") # pending, executing, accepted, dismissed, verified
