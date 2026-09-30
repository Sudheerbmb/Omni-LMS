from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = None
    icon: str | None = None
    parent_id: UUID | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    parent_id: UUID | None = None


class CourseCreate(BaseModel):
    organization_id: UUID
    slug: str = Field(min_length=1, max_length=160, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category_id: UUID | None = None
    level: str = "beginner"
    language: str = "en"
    tags: list[str] | None = None
    estimated_hours: float | None = None
    max_students: int | None = None
    price: float = 0.0
    is_free: bool = True
    certificate_enabled: bool = True
    what_you_learn: list[str] | None = None
    requirements: list[str] | None = None
    target_audience: str | None = None


class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category_id: UUID | None = None
    level: str | None = None
    language: str | None = None
    tags: list[str] | None = None
    estimated_hours: float | None = None
    max_students: int | None = None
    price: float | None = None
    is_free: bool | None = None
    certificate_enabled: bool | None = None
    is_featured: bool | None = None
    what_you_learn: list[str] | None = None
    requirements: list[str] | None = None
    target_audience: str | None = None
    promo_video_url: str | None = None


class CourseVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    course_id: UUID
    version_number: int
    title: str
    description: str | None = None
    what_you_learn: list[str] | None = None
    requirements: list[str] | None = None
    target_audience: str | None = None
    created_at: datetime


class CourseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    slug: str
    status: str
    current_version: int
    level: str
    language: str
    thumbnail_url: str | None = None
    promo_video_url: str | None = None
    tags: list[str] | None = None
    estimated_hours: float | None = None
    max_students: int | None = None
    price: float
    is_free: bool
    certificate_enabled: bool
    is_featured: bool
    rating_avg: float
    rating_count: int
    enrolled_count: int
    completion_count: int
    category_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class CourseDetailRead(CourseRead):
    versions: list[CourseVersionRead] = []


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=200)
    body: str | None = None


class ReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    course_id: UUID
    user_id: UUID
    rating: int
    title: str | None = None
    body: str | None = None
    is_verified: bool
    created_at: datetime
