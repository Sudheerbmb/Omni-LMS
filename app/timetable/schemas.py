from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class SubjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    category: str
    requires_ground: bool
    requires_lab: bool
    color: str


class SchoolSectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    grade_id: UUID
    name: str
    room_number: str


class SchoolGradeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    grade_number: int
    name: str
    academic_year: str
    sections: list[SchoolSectionRead] = []


class TeacherSkillRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subject_id: UUID
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None


class TeacherProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    display_name: str
    email: str
    employee_id: str
    qualification: str
    max_daily_periods: int
    rating_avg: float
    complaint_count: int
    skills: list[str] = []
    active_restrictions: list[dict] = []


class TeacherFeedbackCreate(BaseModel):
    teacher_id: UUID
    section_id: UUID
    subject_id: UUID
    rating: int  # 1 to 5
    category: str = "teaching_quality"  # 'pacing', 'clarity', 'conduct', 'teaching_quality'
    comments: str


class TeacherFeedbackRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    teacher_id: UUID
    section_id: UUID
    subject_id: UUID
    rating: int
    category: str
    comments: str
    created_at: datetime


class TimetableSlotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    day_of_week: str
    period_number: int
    start_time: str
    end_time: str
    slot_type: str
    room_or_venue: str
    section_id: UUID
    section_name: Optional[str] = None
    grade_name: Optional[str] = None
    subject_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    subject_color: Optional[str] = None
    teacher_id: Optional[UUID] = None
    teacher_name: Optional[str] = None


class TimetableGenerationResult(BaseModel):
    status: str
    academic_year: str
    total_slots_scheduled: int
    total_sections: int
    ground_capacity_complied: bool
    autonomous_decisions: list[str]
    audit_summary: str
