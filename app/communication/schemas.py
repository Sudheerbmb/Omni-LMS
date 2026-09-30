from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    audience_role: Literal["all", "admin", "teacher", "student"] = "all"


class AnnouncementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    author_id: UUID
    title: str
    body: str
    audience_role: str
    created_at: datetime


class MessageCreate(BaseModel):
    recipient_id: UUID
    body: str = Field(min_length=1, max_length=10000)


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sender_id: UUID
    recipient_id: UUID
    body: str
    read_at: datetime | None
    created_at: datetime
