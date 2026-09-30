from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.identity.models import RefreshToken, User
from app.identity.schemas import ChangePasswordRequest, PasswordResetConfirm, ProfileUpdate, UserCreate
from app.identity.security import generate_token, hash_password, hash_token, verify_password
from app.identity.tokens import (
    create_access_token,
    create_email_verify_token,
    create_password_reset_token,
    create_refresh_token_value,
)
from app.platform.config import settings
from app.platform.errors import ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError


# ── Registration ──────────────────────────────────────────────────────────────

async def register_user(session: AsyncSession, data: UserCreate) -> User:
    existing = await session.scalar(select(User).where(User.email == data.email.lower()))
    if existing:
        raise ConflictError("An account with this email already exists")

    raw_token, expires = create_email_verify_token()

    user = User(
        email=data.email.lower(),
        display_name=data.display_name,
        password_hash=hash_password(data.password),
        phone_number=data.phone_number,
        timezone=data.timezone,
        locale=data.locale,
        role="student",
        status="pending",
        email_verify_token=hash_token(raw_token),
        email_verify_expires=expires,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    # TODO: send verification email with raw_token
    return user


# ── Email verification ────────────────────────────────────────────────────────

async def verify_email(session: AsyncSession, token: str) -> User:
    hashed = hash_token(token)
    user = await session.scalar(
        select(User).where(User.email_verify_token == hashed)
    )
    if not user:
        raise NotFoundError("Invalid or expired verification token")

    now = datetime.now(timezone.utc)
    if user.email_verify_expires and user.email_verify_expires < now:
        raise ValidationError("Verification token has expired")

    user.email_verified = True
    user.email_verify_token = None
    user.email_verify_expires = None
    # Auto-activate if email verified (admin can change policy)
    if user.status == "pending":
        user.status = "active"
    await session.commit()
    await session.refresh(user)
    return user


# ── Authentication ─────────────────────────────────────────────────────────────

async def authenticate_user(
    session: AsyncSession,
    email: str,
    password: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[User, str, str]:
    """Returns (user, access_token, refresh_token_raw)."""
    user = await session.scalar(select(User).where(User.email == email.lower()))
    if not user:
        raise UnauthorizedError("Invalid email or password")

    # Check account lock
    now = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until > now:
        remaining = int((user.locked_until - now).total_seconds() / 60)
        raise ForbiddenError(f"Account locked. Try again in {remaining} minutes")

    if not verify_password(password, user.password_hash):
        user.failed_login_count += 1
        if user.failed_login_count >= settings.max_login_attempts:
            from datetime import timedelta
            user.locked_until = now + timedelta(minutes=settings.lockout_minutes)
            user.failed_login_count = 0
        await session.commit()
        raise UnauthorizedError("Invalid email or password")

    if user.status == "pending":
        raise ForbiddenError("Account pending approval. Please wait for admin activation or verify your email.")

    if user.status == "suspended":
        raise ForbiddenError("Account suspended. Contact support.")

    if user.status not in ("active",):
        raise ForbiddenError("Account is not active")

    # Reset failed attempts, update login stats
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    user.login_count = (user.login_count or 0) + 1

    # Create refresh token
    raw_refresh, expires = create_refresh_token_value()
    session.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        expires_at=expires,
        ip_address=ip_address,
        user_agent=user_agent,
    ))

    await session.commit()
    await session.refresh(user)

    access = create_access_token(user.id)
    return user, access, raw_refresh


# ── Token refresh ──────────────────────────────────────────────────────────────

async def refresh_tokens(
    session: AsyncSession,
    raw_refresh: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[User, str, str]:
    """Rotate refresh token and return new access + refresh tokens."""
    hashed = hash_token(raw_refresh)
    token_row = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hashed)
    )
    if not token_row or not token_row.is_valid:
        raise UnauthorizedError("Invalid or expired refresh token")

    user = await session.scalar(
        select(User).where(User.id == token_row.user_id, User.status == "active")
    )
    if not user:
        raise UnauthorizedError("User not found or inactive")

    # Revoke old token
    token_row.revoked_at = datetime.now(timezone.utc)

    # Issue new refresh token
    new_raw, new_expires = create_refresh_token_value()
    session.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(new_raw),
        expires_at=new_expires,
        ip_address=ip_address,
        user_agent=user_agent,
    ))
    await session.commit()
    await session.refresh(user)

    new_access = create_access_token(user.id)
    return user, new_access, new_raw


# ── Logout ────────────────────────────────────────────────────────────────────

async def logout(session: AsyncSession, raw_refresh: str) -> None:
    hashed = hash_token(raw_refresh)
    token_row = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hashed)
    )
    if token_row:
        token_row.revoked_at = datetime.now(timezone.utc)
        await session.commit()


async def logout_all(session: AsyncSession, user_id: UUID) -> None:
    """Revoke all refresh tokens for a user (logout from all devices)."""
    from sqlalchemy import update
    now = datetime.now(timezone.utc)
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    await session.commit()


# ── Password reset ────────────────────────────────────────────────────────────

async def request_password_reset(session: AsyncSession, email: str) -> str | None:
    """Returns raw token (for email dispatch). Returns None if email not found (silent)."""
    user = await session.scalar(select(User).where(User.email == email.lower()))
    if not user:
        return None

    raw, expires = create_password_reset_token()
    user.password_reset_token = hash_token(raw)
    user.password_reset_expires = expires
    await session.commit()
    # TODO: dispatch password reset email with raw
    return raw


async def confirm_password_reset(session: AsyncSession, data: PasswordResetConfirm) -> User:
    hashed = hash_token(data.token)
    user = await session.scalar(
        select(User).where(User.password_reset_token == hashed)
    )
    if not user:
        raise NotFoundError("Invalid or expired reset token")
    now = datetime.now(timezone.utc)
    if user.password_reset_expires and user.password_reset_expires < now:
        raise ValidationError("Password reset token has expired")

    user.password_hash = hash_password(data.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await session.commit()
    await session.refresh(user)
    return user


# ── Profile ───────────────────────────────────────────────────────────────────

async def update_profile(session: AsyncSession, user: User, data: ProfileUpdate) -> User:
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await session.commit()
    await session.refresh(user)
    return user


async def change_password(session: AsyncSession, user: User, data: ChangePasswordRequest) -> User:
    if not verify_password(data.current_password, user.password_hash):
        raise UnauthorizedError("Current password is incorrect")
    user.password_hash = hash_password(data.new_password)
    await session.commit()
    await session.refresh(user)
    return user


async def update_avatar(session: AsyncSession, user: User, url: str) -> User:
    user.avatar_url = url
    await session.commit()
    await session.refresh(user)
    return user
