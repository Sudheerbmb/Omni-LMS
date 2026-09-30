import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.platform.models import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.tenancy.models import Organization


class Category(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(100))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    courses: Mapped[list["Course"]] = relationship(back_populates="category_rel")


class Course(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "courses"
    __table_args__ = (UniqueConstraint("organization_id", "slug"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    slug: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    current_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Metadata
    level: Mapped[str] = mapped_column(String(32), default="beginner", nullable=False)
    language: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500))
    promo_video_url: Mapped[str | None] = mapped_column(String(500))
    tags: Mapped[list[str] | None] = mapped_column(JSON)
    estimated_hours: Mapped[float | None] = mapped_column(Float)
    max_students: Mapped[int | None] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_free: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    certificate_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Stats (denormalized for performance)
    rating_avg: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rating_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    enrolled_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    versions: Mapped[list["CourseVersion"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", order_by="CourseVersion.version_number"
    )
    reviews: Mapped[list["CourseReview"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    category_rel: Mapped[Category | None] = relationship(back_populates="courses")


class CourseVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "course_versions"
    __table_args__ = (UniqueConstraint("course_id", "version_number"),)

    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    what_you_learn: Mapped[list[str] | None] = mapped_column(JSON)
    requirements: Mapped[list[str] | None] = mapped_column(JSON)
    target_audience: Mapped[str | None] = mapped_column(Text)

    course: Mapped[Course] = relationship(back_populates="versions")


class CourseReview(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "course_reviews"
    __table_args__ = (UniqueConstraint("course_id", "user_id"),)

    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    title: Mapped[str | None] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    course: Mapped[Course] = relationship(back_populates="reviews")
