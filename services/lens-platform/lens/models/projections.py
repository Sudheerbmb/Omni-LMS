import uuid
from typing import Optional
from sqlalchemy import Integer, String, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column
from lens.database import LensBase, LensTimestampMixin, LensUUIDMixin


class StudentProjection(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Read-only projection of student entities synchronized from LMS."""
    __tablename__ = "lens_students_projection"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    grade_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class CourseProjection(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Read-only projection of course curricula synchronized from LMS."""
    __tablename__ = "lens_courses_projection"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    course_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    subject_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    grade_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class ConceptProjection(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Read-only projection of concept graph & dependencies synchronized from LMS."""
    __tablename__ = "lens_concepts_projection"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    concept_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), unique=True, index=True)
    course_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True)
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(64), index=True)
    parent_concept_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)
    prerequisites_json: Mapped[list] = mapped_column(JSON, default=list)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
