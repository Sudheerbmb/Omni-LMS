import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.platform.config import settings


class InvalidTokenError(Exception):
    pass


def create_access_token(user_id: uuid.UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("type") != "access":
            raise InvalidTokenError("Invalid token type")
        return uuid.UUID(payload["sub"])
    except jwt.ExpiredSignatureError as exc:
        raise InvalidTokenError("Token has expired") from exc
    except (jwt.InvalidTokenError, KeyError, ValueError) as exc:
        raise InvalidTokenError("Invalid token") from exc


def create_email_verify_token() -> tuple[str, datetime]:
    """Returns (raw_token, expires_at)."""
    from app.identity.security import generate_token
    raw = generate_token(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=settings.email_verification_token_hours)
    return raw, expires


def create_password_reset_token() -> tuple[str, datetime]:
    """Returns (raw_token, expires_at)."""
    from app.identity.security import generate_token
    raw = generate_token(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_token_minutes)
    return raw, expires


def create_refresh_token_value() -> tuple[str, datetime]:
    """Returns (raw_token, expires_at). Store hash_token(raw) in DB."""
    from app.identity.security import generate_token
    raw = generate_token(48)
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days)
    return raw, expires
