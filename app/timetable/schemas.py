from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class SubjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    category: str
    requires_ground: bool
    requires_lab: bool
    color: str


class CurriculumChapterUpdate(BaseModel):
    num: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=250)
    duration_weeks: int = Field(ge=1, le=52)
    topics: list[str] = []
    outcomes: str = ""


class CurriculumCourseUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    subject_name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    category: Optional[str] = Field(default=None, min_length=1, max_length=32)
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    academic_year: str = Field(default="2026-2027", min_length=4, max_length=16)
    periods_per_week: int = Field(ge=1, le=20)
    chapters: list[CurriculumChapterUpdate]


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
    reviews: list[dict] = []
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


class TimetableRuleBase(BaseModel):
    name: str
    rule_type: str
    category: str = "policy"
    description: str
    parameters: dict = {}
    is_enabled: bool = True
    priority: int = 1


class TimetableRuleCreate(TimetableRuleBase):
    pass


class TimetableRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parameters: Optional[dict] = None
    is_enabled: Optional[bool] = None
    priority: Optional[int] = None


class TimetableRuleRead(TimetableRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


class SlotSwapRequest(BaseModel):
    slot_id_1: UUID
    slot_id_2: UUID


class SlotUpdateRequest(BaseModel):
    subject_id: Optional[UUID] = None
    teacher_id: Optional[UUID] = None
    room_or_venue: Optional[str] = None
    slot_type: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None


class SubstituteTeacherRead(BaseModel):
    teacher_id: UUID
    display_name: str
    employee_id: str
    qualification: str
    rating_avg: float
    current_day_load: int
    max_daily_periods: int
    is_free: bool
    is_restricted_for_class: bool
    match_score: float
    conflict_notes: Optional[str] = None


class TeacherLeaveCreate(BaseModel):
    teacher_id: UUID
    day_of_week: str
    reason: str


class TeacherLeaveRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    teacher_id: UUID
    teacher_name: Optional[str] = None
    day_of_week: str
    reason: str
    is_active: bool

