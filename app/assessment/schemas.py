from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AssessmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    passing_score: int = Field(default=70, ge=1, le=100)


class AssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID
    title: str
    passing_score: int
    status: str


class QuestionCreate(BaseModel):
    prompt: str = Field(min_length=1)
    options: list[str] = Field(min_length=2)
    correct_answer: str
    position: int = Field(default=0, ge=0)


class QuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assessment_id: UUID
    prompt: str
    question_type: str
    options: list[str]
    position: int


class AttemptCreate(BaseModel):
    answers: dict[UUID, str]


class AttemptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assessment_id: UUID
    user_id: UUID
    score: int
    passed: bool
