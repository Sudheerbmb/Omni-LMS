from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Language = Literal["python", "javascript", "typescript", "java", "cpp"]


class ExerciseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    prompt: str = Field(min_length=1)
    language: Language
    starter_code: str | None = None


class ExerciseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    prompt: str | None = Field(default=None, min_length=1)
    language: Language | None = None
    starter_code: str | None = None
    status: str | None = None


class ExerciseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID
    title: str
    prompt: str
    language: str
    starter_code: str | None
    status: str


class CodeSubmissionCreate(BaseModel):
    source_code: str = Field(min_length=1, max_length=100000)


class CodeSubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    exercise_id: UUID
    user_id: UUID
    language: str
    status: str
    result: dict | None


class SubmissionResultUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=32)
    result: dict | None = None

