import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Float, Index, Integer, String, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column
from lens.database import LensBase, LensTimestampMixin, LensUUIDMixin


class LearnerState(LensUUIDMixin, LensTimestampMixin, LensBase):
    """
    Core LENS-Ω Mathematical State Vector:
    S_t = [M_t, R_t, T_t, MS_t, C_t, U_t, I_t, V_t]
    Indexed by composite primary key: (tenant_id, student_id, course_id, concept_id)
    """
    __tablename__ = "lens_learner_states"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    student_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    course_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    concept_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)

    # State Vector Components (Normalized [0, 1])
    mastery: Mapped[float] = mapped_column(Float, default=0.10, nullable=False)        # M: Probability of mastery
    retention: Mapped[float] = mapped_column(Float, default=1.00, nullable=False)      # R: Ebbinghaus retention
    transfer: Mapped[float] = mapped_column(Float, default=0.00, nullable=False)       # T: Cross-context transfer
    misconception: Mapped[float] = mapped_column(Float, default=0.00, nullable=False)  # MS: Misconception score
    competency: Mapped[float] = mapped_column(Float, default=0.00, nullable=False)     # C: Holistic competency
    uncertainty: Mapped[float] = mapped_column(Float, default=0.90, nullable=False)    # U: Epistemic uncertainty
    identifiability: Mapped[float] = mapped_column(Float, default=0.00, nullable=False)# I: Evidence diversity
    learning_velocity: Mapped[float] = mapped_column(Float, default=0.00, nullable=False)# V: Longitudinal velocity

    # Bottleneck & Mode Derivation
    current_bottleneck: Mapped[str] = mapped_column(String(64), default="INSUFFICIENT_EVIDENCE") # MASTERY, RETENTION, TRANSFER, MISCONCEPTION, UNCERTAINTY, INSUFFICIENT_EVIDENCE
    current_learning_mode: Mapped[str] = mapped_column(String(64), default="DIAGNOSTIC")        # ACQUISITION, RETRIEVAL, TRANSFER, REMEDIATION, DIAGNOSTIC

    # Temporal & Tracking Metadata
    evidence_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    observed_evidence_types: Mapped[list] = mapped_column(JSON, default=list)
    last_learning_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_retrieval_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_scheduled_retrieval: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_scheduled_evaluation: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # State History & Calibration
    model_version: Mapped[str] = mapped_column(String(64), default="lens_model_v1")
    policy_version: Mapped[str] = mapped_column(String(64), default="policy_v1")
    history_json: Mapped[list] = mapped_column(JSON, default=list)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (
        Index("ix_lens_state_composite", "tenant_id", "student_id", "course_id", "concept_id", unique=True),
    )
