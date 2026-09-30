from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl


# ── Registration / Login ──────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=8, max_length=128)
    phone_number: str | None = Field(default=None, max_length=32)
    timezone: str = "UTC"
    locale: str = "en"
    role: str = "student"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: "UserRead"


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# ── Password management ────────────────────────────────────────────────────────

class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ── Profile ────────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    phone_number: str | None = Field(default=None, max_length=32)
    bio: str | None = Field(default=None, max_length=2000)
    headline: str | None = Field(default=None, max_length=200)
    timezone: str | None = None
    locale: str | None = None
    website_url: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    notify_email: bool | None = None
    notify_inapp: bool | None = None


# ── Read schemas ───────────────────────────────────────────────────────────────

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: str
    status: str
    phone_number: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    headline: str | None = None
    timezone: str
    locale: str
    website_url: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    email_verified: bool
    notify_email: bool
    notify_inapp: bool
    last_login_at: datetime | None = None
    login_count: int
    created_at: datetime
    updated_at: datetime


class UserPublicRead(BaseModel):
    """Public-facing profile (no sensitive fields)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    avatar_url: str | None = None
    headline: str | None = None
    bio: str | None = None
    role: str
