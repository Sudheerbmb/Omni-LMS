from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ResourceCreate(BaseModel):
    resource_type: str = Field(pattern=r"^(video|article|pdf|document|audio|quiz|assignment|live_class|link)$")
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    position: int = Field(default=0, ge=0)
    external_url: str | None = None


class ResourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_version_id: UUID
    resource_type: str
    title: str
    description: str | None
    position: int
    external_url: str | None
