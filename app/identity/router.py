from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.identity.auth import get_current_user
from app.identity.models import User
from app.identity.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    ProfileUpdate,
    RefreshRequest,
    TokenResponse,
    UserCreate,
    UserPublicRead,
    UserRead,
)
from app.identity.service import (
    authenticate_user,
    change_password,
    confirm_password_reset,
    logout,
    logout_all,
    refresh_tokens,
    register_user,
    request_password_reset,
    update_avatar,
    update_profile,
    verify_email,
)
from app.platform.config import settings
from app.platform.database import get_session
from app.platform.errors import LMSError
from app.platform.storage import upload_file

router = APIRouter(prefix="/api/v1/identity", tags=["identity"])


def _token_response(user: User, access: str, refresh: str) -> TokenResponse:
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        token_type="bearer",
        expires_in=settings.access_token_minutes * 60,
        user=UserRead.model_validate(user),
    )


# ── Auth ──────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, session: AsyncSession = Depends(get_session)) -> UserRead:
    try:
        user = await register_user(session, data)
        return UserRead.model_validate(user)
    except LMSError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    try:
        user, access, refresh = await authenticate_user(
            session, str(data.email), data.password, ip_address=ip, user_agent=ua
        )
        return _token_response(user, access, refresh)
    except LMSError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    data: RefreshRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    try:
        user, access, new_refresh = await refresh_tokens(session, data.refresh_token, ip, ua)
        return _token_response(user, access, new_refresh)
    except LMSError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_endpoint(
    data: LogoutRequest,
    session: AsyncSession = Depends(get_session),
) -> None:
    await logout(session, data.refresh_token)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    await logout_all(session, current_user.id)


# ── Email verification ────────────────────────────────────────────────────────

@router.get("/verify-email/{token}", response_model=UserRead)
async def verify_email_endpoint(
    token: str,
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    try:
        user = await verify_email(session, token)
        return UserRead.model_validate(user)
    except LMSError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ── Password reset ────────────────────────────────────────────────────────────

@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
async def password_reset_request(
    data: PasswordResetRequest,
    session: AsyncSession = Depends(get_session),
) -> dict:
    # Always return 202 to avoid leaking email existence
    await request_password_reset(session, str(data.email))
    return {"detail": "If that email exists, a reset link has been sent"}


@router.post("/password-reset/confirm", response_model=UserRead)
async def password_reset_confirm(
    data: PasswordResetConfirm,
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    try:
        user = await confirm_password_reset(session, data)
        return UserRead.model_validate(user)
    except LMSError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch("/me", response_model=UserRead)
async def update_me(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    user = await update_profile(session, current_user, data)
    return UserRead.model_validate(user)


@router.post("/me/avatar", response_model=UserRead)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WEBP, and GIF images are allowed")
    data_bytes = await file.read()
    url = await upload_file(data_bytes, file.filename or "avatar.jpg", prefix="avatars")
    user = await update_avatar(session, current_user, url)
    return UserRead.model_validate(user)


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password_endpoint(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    try:
        await change_password(session, current_user, data)
    except LMSError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/users/{user_id}/profile", response_model=UserPublicRead)
async def public_profile(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> UserPublicRead:
    from uuid import UUID
    from sqlalchemy import select
    from app.identity.models import User as UserModel
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user = await session.scalar(select(UserModel).where(UserModel.id == uid))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublicRead.model_validate(user)
