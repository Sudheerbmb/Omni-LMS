import uuid
from typing import Any

from sqlalchemy import ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.models import Base, TimestampMixin, UUIDMixin


class Assessment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "assessments"

    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    passing_score: Mapped[int] = mapped_column(Integer, default=70, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)


class AssessmentQuestion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "assessment_questions"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(32), default="multiple_choice", nullable=False)
    options: Mapped[list[Any]] = mapped_column(JSON, nullable=False)
    correct_answer: Mapped[str] = mapped_column(String(500), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class AssessmentAttempt(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "assessment_attempts"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    answers: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    passed: Mapped[bool] = mapped_column(nullable=False)
