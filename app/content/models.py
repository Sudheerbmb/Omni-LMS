import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.platform.models import Base, TimestampMixin, UUIDMixin


class LearningResource(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "learning_resources"

    course_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("course_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("course_sections.id", ondelete="SET NULL"), nullable=True
    )
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False)
    # Types: video, document, quiz_link, article, audio, interactive, file
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Source
    external_url: Mapped[str | None] = mapped_column(String(1000))
    file_url: Mapped[str | None] = mapped_column(String(1000))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    mime_type: Mapped[str | None] = mapped_column(String(100))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)  # for video/audio

    # Settings
    is_preview: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    downloadable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # For article/text content
    content_body: Mapped[str | None] = mapped_column(Text)

    # Extra metadata (captions, attachments, etc.)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON)

    section: Mapped["CourseSection | None"] = relationship(back_populates="resources")


class CourseSection(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "course_sections"

    course_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("course_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    resources: Mapped[list[LearningResource]] = relationship(
        back_populates="section", order_by=LearningResource.position
    )
