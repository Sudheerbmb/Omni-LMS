import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column
from lens.database import LensBase, LensTimestampMixin, LensUUIDMixin


class BenchmarkDefinition(LensUUIDMixin, LensTimestampMixin, LensBase):
    """
    Blueprint-driven multi-dimensional benchmark test definitions (Section 12, 13).
    """
    __tablename__ = "lens_benchmark_definitions"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    course_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: str = "1.0"
    
    # Dynamic Blueprint configuration (Section 13)
    blueprint_json: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "total_items": 20,
        "coverage": {
            "foundation": 6,
            "application": 6,
            "reasoning": 4,
            "coding": 2,
            "transfer": 2
        }
    })
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class BenchmarkItem(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Validated question bank items with cognitive metadata (Section 12, 14)."""
    __tablename__ = "lens_benchmark_items"

    benchmark_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("lens_benchmark_definitions.id", ondelete="CASCADE"), index=True)
    concept_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    subconcept_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(64), default="MCQ") # MCQ, MULTI_SELECT, TRUE_FALSE, SHORT_ANSWER, CODING, NUMERICAL, TRANSFER_PROBLEM, CASE_STUDY
    options_json: Mapped[list] = mapped_column(JSON, default=list)
    correct_answer: Mapped[str] = mapped_column(String(1000), nullable=False)
    
    difficulty: Mapped[float] = mapped_column(Float, default=0.50) # Normalized [0.0, 1.0]
    discrimination: Mapped[float] = mapped_column(Float, default=1.00)
    cognitive_level: Mapped[str] = mapped_column(String(64), default="APPLICATION") # FOUNDATION, APPLICATION, REASONING, PROBLEM_SOLVING, TRANSFER
    transfer_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    misconception_tags: Mapped[list] = mapped_column(JSON, default=list)
    estimated_time_seconds: Mapped[int] = mapped_column(Integer, default=60)
    rubric_json: Mapped[dict] = mapped_column(JSON, default=dict)
    validation_status: Mapped[str] = mapped_column(String(32), default="VALIDATED")


class BenchmarkAttempt(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Student benchmark execution instance."""
    __tablename__ = "lens_benchmark_attempts"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    benchmark_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("lens_benchmark_definitions.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="in_progress") # in_progress, completed, abandoned
    total_score: Mapped[float] = mapped_column(Float, default=0.0)
    raw_results_json: Mapped[dict] = mapped_column(JSON, default=dict)


class BenchmarkResponse(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Individual item responses within a benchmark attempt."""
    __tablename__ = "lens_benchmark_responses"

    attempt_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("lens_benchmark_attempts.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("lens_benchmark_items.id", ondelete="CASCADE"), index=True)
    
    student_answer: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    response_time_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence_level: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    misconceptions_detected: Mapped[list] = mapped_column(JSON, default=list)
