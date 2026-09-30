from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LiveClassCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    starts_at: datetime
    ends_at: datetime
    meeting_url: Optional[str] = None
    recording_url: Optional[str] = None
    course_id: Optional[UUID] = None
    grade_number: Optional[int] = None
    section_name: Optional[str] = "A"
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    period_number: Optional[int] = None
    room_number: Optional[str] = None
    status: Optional[str] = "scheduled"


class LiveClassRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: Optional[UUID] = None
    teacher_id: UUID
    teacher_name: Optional[str] = None
    title: str
    starts_at: datetime
    ends_at: datetime
    meeting_url: Optional[str] = None
    recording_url: Optional[str] = None
    status: str
    grade_number: Optional[int] = None
    section_name: Optional[str] = None
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    period_number: Optional[int] = None
    room_number: Optional[str] = None


class TeacherTimetableSlotRead(BaseModel):
    grade_number: int
    grade_name: str
    section_name: str
    subject_code: str
    subject_name: str
    period_number: int
    day_of_week: str
    start_time: str
    end_time: str
    room_or_venue: str
