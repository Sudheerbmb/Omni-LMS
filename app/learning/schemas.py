from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProgressUpdate(BaseModel):
    completed: bool = False
    position_seconds: int = Field(default=0, ge=0)


class ProgressRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    resource_id: UUID
    completed: bool
    position_seconds: int
