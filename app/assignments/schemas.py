from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AssignmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    instructions: str | None = None
    max_score: int = Field(default=100, ge=1, le=1000)


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID
    title: str
    instructions: str | None
    max_score: int
    status: str


class SubmissionCreate(BaseModel):
    content: str = Field(min_length=1)


class SubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assignment_id: UUID
    user_id: UUID
    content: str
    status: str
    score: int | None
    feedback: str | None


class GradeRequest(BaseModel):
    score: int = Field(ge=0)
    feedback: str | None = None
