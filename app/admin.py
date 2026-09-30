from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.identity.models import User
from app.identity.permissions import require_permission
from app.identity.security import hash_password
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class ApprovalUpdate(BaseModel):
    role: Literal["student", "teacher", "admin"]


class StatusUpdate(BaseModel):
    status: Literal["active", "suspended", "rejected", "pending"]


class RoleUpdate(BaseModel):
    role: Literal["admin", "teacher", "student"]


class AdminUserCreate(BaseModel):
    email: EmailStr
    display_name: str
    password: str
    role: Literal["admin", "teacher", "student"] = "student"
    phone_number: str | None = None
    status: Literal["active", "pending", "suspended"] = "active"


@router.get("/users")
async def list_users(
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    users = (await session.scalars(select(User).order_by(User.created_at.desc()))).all()
    return [
        {
            "id": str(user.id),
            "email": user.email,
            "phone_number": user.phone_number,
            "display_name": user.display_name,
            "role": user.role,
            "status": user.status,
            "created_at": user.created_at.isoformat(),
        }
        for user in users
    ]


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    data: AdminUserCreate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    normalized_email = str(data.email).strip().lower()
    existing = await session.scalar(select(User).where(User.email == normalized_email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    phone = data.phone_number.strip() if data.phone_number and data.phone_number.strip() else None
    if phone:
        existing_phone = await session.scalar(select(User).where(User.phone_number == phone))
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this phone number already exists",
            )

    user = User(
        email=normalized_email,
        phone_number=phone,
        display_name=data.display_name.strip(),
        password_hash=hash_password(data.password),
        role=data.role,
        status=data.status,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return {
        "id": str(user.id),
        "email": user.email,
        "phone_number": user.phone_number,
        "display_name": user.display_name,
        "role": user.role,
        "status": user.status,
        "created_at": user.created_at.isoformat(),
    }


@router.post("/users/{user_id}/approve")
async def approve_user(
    user_id: UUID,
    data: ApprovalUpdate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = data.role
    user.status = "active"
    await session.commit()
    return {"id": str(user.id), "role": user.role, "status": user.status}


@router.post("/users/{user_id}/reject")
async def reject_user(
    user_id: UUID,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == _admin.id:
        raise HTTPException(status_code=400, detail="You cannot reject your own account")
    user.status = "rejected"
    await session.commit()
    return {"id": str(user.id), "status": user.status}


@router.post("/users/{user_id}/status")
async def update_user_status(
    user_id: UUID,
    data: StatusUpdate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == _admin.id and data.status != "active":
        raise HTTPException(status_code=400, detail="You cannot revoke access from your own account")
    user.status = data.status
    await session.commit()
    return {"id": str(user.id), "status": user.status, "role": user.role}


@router.post("/users/{user_id}/role")
async def update_user_role(
    user_id: UUID,
    data: RoleUpdate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == _admin.id and data.role != "admin":
        raise HTTPException(status_code=400, detail="You cannot change the role of your own admin account")
    user.role = data.role
    await session.commit()
    return {"id": str(user.id), "role": user.role, "status": user.status}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == _admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    await session.delete(user)
    await session.commit()
    return {"id": str(user_id), "deleted": True}

