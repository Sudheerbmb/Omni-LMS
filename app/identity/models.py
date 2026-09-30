import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.platform.models import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.tenancy.models import Organization


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="student", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)

    # Profile
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    bio: Mapped[str | None] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    locale: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    headline: Mapped[str | None] = mapped_column(String(200))
    website_url: Mapped[str | None] = mapped_column(String(500))
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    github_url: Mapped[str | None] = mapped_column(String(500))

    # Security
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verify_token: Mapped[str | None] = mapped_column(String(255))
    email_verify_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_reset_token: Mapped[str | None] = mapped_column(String(255), index=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Notification preferences (stored as flags)
    notify_email: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_inapp: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relations
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    memberships: Mapped[list["OrganizationMembership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    ip_address: Mapped[str | None] = mapped_column(String(64))

    user: Mapped[User] = relationship(back_populates="refresh_tokens")

    @property
    def is_valid(self) -> bool:
        from datetime import timezone
        return self.revoked_at is None and self.expires_at > datetime.now(timezone.utc)


class OrganizationMembership(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "organization_memberships"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(64), nullable=False, default="member")

    organization: Mapped["Organization"] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="memberships")
