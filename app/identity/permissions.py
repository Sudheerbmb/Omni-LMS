from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.identity.auth import get_current_user
from app.identity.models import User

# ── Role-permission map ───────────────────────────────────────────────────────

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "admin": frozenset({"*"}),
    "teacher": frozenset({
        "course:view",
        "course:manage",
        "content:manage",
        "content:view",
        "assessment:manage",
        "assessment:attempt",
        "assignment:manage",
        "assignment:grade",
        "assignment:submit",
        "recording:view",
        "analytics:view",
        "announcement:manage",
        "learning:use",
        "certificate:view",
        "coding:manage",
        "classroom:manage",
        "communication:manage",
        "org:view",
    }),
    "student": frozenset({
        "course:view",
        "content:view",
        "learning:use",
        "assessment:attempt",
        "assignment:submit",
        "certificate:view",
        "coding:submit",
        "classroom:view",
        "communication:send",
        "org:view",
    }),
}


def has_permission(user: User, permission: str) -> bool:
    perms = ROLE_PERMISSIONS.get(user.role, frozenset())
    return "*" in perms or permission in perms


def require_permission(permission: str) -> Callable:
    async def dependency(user: User = Depends(get_current_user)) -> User:
        if not has_permission(user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission}",
            )
        return user
    return dependency


def require_roles(*roles: str) -> Callable:
    async def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these roles required: {', '.join(roles)}",
            )
        return user
    return dependency
