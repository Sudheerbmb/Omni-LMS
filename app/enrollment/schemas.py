from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EnrollmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    course_id: UUID
    status: str
    progress_percent: int
