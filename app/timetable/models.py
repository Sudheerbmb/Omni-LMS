import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.platform.models import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.identity.models import User


class SchoolGrade(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "school_grades"

    grade_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(32), nullable=False)
    academic_year: Mapped[str] = mapped_column(String(16), default="2026-2027", nullable=False)

    sections: Mapped[list["SchoolSection"]] = relationship("SchoolSection", back_populates="grade", cascade="all, delete-orphan")
    curriculum: Mapped[list["GradeCurriculum"]] = relationship("GradeCurriculum", back_populates="grade", cascade="all, delete-orphan")


class SchoolSection(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "school_sections"

    grade_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_grades.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(8), nullable=False)
    room_number: Mapped[str] = mapped_column(String(32), nullable=False)

    grade: Mapped["SchoolGrade"] = relationship("SchoolGrade", back_populates="sections")
    slots: Mapped[list["TimetableSlot"]] = relationship("TimetableSlot", back_populates="section", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("grade_id", "name", name="uq_grade_section"),)


class Subject(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "school_subjects"

    code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    requires_ground: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_lab: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    color: Mapped[str] = mapped_column(String(16), default="#06b6d4", nullable=False)


class GradeCurriculum(UUIDMixin, Base):
    __tablename__ = "grade_curricula"

    grade_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_grades.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    periods_per_week: Mapped[int] = mapped_column(Integer, default=5, nullable=False)

    grade: Mapped["SchoolGrade"] = relationship("SchoolGrade", back_populates="curriculum")
    subject: Mapped["Subject"] = relationship("Subject")


class TeacherProfile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "teacher_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    employee_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    qualification: Mapped[str] = mapped_column(String(128), default="B.Ed / M.Sc", nullable=False)
    max_daily_periods: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    rating_avg: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    complaint_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    skills: Mapped[list["TeacherSubjectSkill"]] = relationship("TeacherSubjectSkill", back_populates="teacher", cascade="all, delete-orphan")
    feedback: Mapped[list["TeacherFeedback"]] = relationship("TeacherFeedback", back_populates="teacher", cascade="all, delete-orphan")
    restrictions: Mapped[list["TeacherClassRestriction"]] = relationship("TeacherClassRestriction", back_populates="teacher", cascade="all, delete-orphan")
    slots: Mapped[list["TimetableSlot"]] = relationship("TimetableSlot", back_populates="teacher")


class TeacherSubjectSkill(Base):
    __tablename__ = "teacher_subject_skills"

    teacher_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teacher_profiles.id", ondelete="CASCADE"), primary_key=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_subjects.id", ondelete="CASCADE"), primary_key=True)

    teacher: Mapped["TeacherProfile"] = relationship("TeacherProfile", back_populates="skills")
    subject: Mapped["Subject"] = relationship("Subject")


class TeacherFeedback(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "teacher_feedback"

    teacher_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teacher_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="general", nullable=False)
    comments: Mapped[str] = mapped_column(Text, nullable=False)
    is_active_complaint: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    teacher: Mapped["TeacherProfile"] = relationship("TeacherProfile", back_populates="feedback")
    section: Mapped["SchoolSection"] = relationship("SchoolSection")
    subject: Mapped["Subject"] = relationship("Subject")


class TeacherClassRestriction(UUIDMixin, Base):
    __tablename__ = "teacher_class_restrictions"

    teacher_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teacher_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    teacher: Mapped["TeacherProfile"] = relationship("TeacherProfile", back_populates="restrictions")
    section: Mapped["SchoolSection"] = relationship("SchoolSection")
    subject: Mapped["Subject"] = relationship("Subject")

    __table_args__ = (UniqueConstraint("teacher_id", "section_id", "subject_id", name="uq_teacher_section_subject_restriction"),)


class TimetableSlot(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "timetable_slots"

    day_of_week: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    period_number: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[str] = mapped_column(String(8), nullable=False)
    end_time: Mapped[str] = mapped_column(String(8), nullable=False)
    slot_type: Mapped[str] = mapped_column(String(24), nullable=False)
    room_or_venue: Mapped[str] = mapped_column(String(64), nullable=False)

    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("school_subjects.id", ondelete="SET NULL"), nullable=True, index=True)
    teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("teacher_profiles.id", ondelete="SET NULL"), nullable=True, index=True)

    section: Mapped["SchoolSection"] = relationship("SchoolSection", back_populates="slots")
    subject: Mapped[Optional["Subject"]] = relationship("Subject")
    teacher: Mapped[Optional["TeacherProfile"]] = relationship("TeacherProfile", back_populates="slots")

    __table_args__ = (
        UniqueConstraint("day_of_week", "period_number", "section_id", name="uq_section_period"),
    )
