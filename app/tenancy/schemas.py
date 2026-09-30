from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OrgCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = None
    website: str | None = None
    industry: str | None = None
    country: str | None = None
    is_public: bool = True


class OrgUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = None
    website: str | None = None
    industry: str | None = None
    country: str | None = None
    is_public: bool | None = None
    max_members: int | None = None


class OrgRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    description: str | None = None
    logo_url: str | None = None
    website: str | None = None
    industry: str | None = None
    country: str | None = None
    status: str
    is_public: bool
    max_members: int | None = None
    created_at: datetime
    updated_at: datetime


class MemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    organization_id: UUID
    role: str
    created_at: datetime
    display_name: str | None = None
    email: str | None = None
    avatar_url: str | None = None


class InviteCreate(BaseModel):
    email: EmailStr
    role: str = "member"


class InviteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    email: str
    role: str
    expires_at: datetime
    accepted_at: datetime | None = None
    created_at: datetime


class MemberRoleUpdate(BaseModel):
    role: str = Field(min_length=1, max_length=64)
