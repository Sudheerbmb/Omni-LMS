from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.identity.auth import get_current_user
from app.identity.models import User
from app.platform.database import get_session
from app.platform.errors import LMSError
from app.platform.storage import upload_file
from app.tenancy.schemas import (
    InviteCreate,
    InviteRead,
    MemberRead,
    MemberRoleUpdate,
    OrgCreate,
    OrgRead,
    OrgUpdate,
)
from app.tenancy.service import (
    accept_invitation,
    create_invitation,
    create_organization,
    get_organization,
    list_members,
    list_organizations,
    remove_member,
    update_member_role,
    update_organization,
    upload_org_logo,
)

router = APIRouter(prefix="/api/v1/organizations", tags=["organizations"])


def _handle(exc: LMSError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post("", response_model=OrgRead, status_code=status.HTTP_201_CREATED)
async def create_org(
    data: OrgCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrgRead:
    try:
        org = await create_organization(session, data, current_user)
        return OrgRead.model_validate(org)
    except LMSError as exc:
        raise _handle(exc) from exc


@router.get("", response_model=list[OrgRead])
async def list_orgs(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[OrgRead]:
    orgs = await list_organizations(session, current_user)
    return [OrgRead.model_validate(o) for o in orgs]


@router.get("/{org_id}", response_model=OrgRead)
async def get_org(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrgRead:
    try:
        org = await get_organization(session, org_id, current_user)
        return OrgRead.model_validate(org)
    except LMSError as exc:
        raise _handle(exc) from exc


@router.patch("/{org_id}", response_model=OrgRead)
async def update_org(
    org_id: UUID,
    data: OrgUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrgRead:
    try:
        org = await update_organization(session, org_id, data, current_user)
        return OrgRead.model_validate(org)
    except LMSError as exc:
        raise _handle(exc) from exc


@router.post("/{org_id}/logo", response_model=OrgRead)
async def upload_logo(
    org_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrgRead:
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WEBP images allowed")
    data_bytes = await file.read()
    url = await upload_file(data_bytes, file.filename or "logo.jpg", prefix="org-logos")
    try:
        org = await upload_org_logo(session, org_id, url, current_user)
        return OrgRead.model_validate(org)
    except LMSError as exc:
        raise _handle(exc) from exc


@router.get("/{org_id}/members", response_model=list[MemberRead])
async def get_members(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[MemberRead]:
    try:
        members = await list_members(session, org_id, current_user)
        return [MemberRead.model_validate(m) for m in members]
    except LMSError as exc:
        raise _handle(exc) from exc


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_org_member(
    org_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    try:
        await remove_member(session, org_id, user_id, current_user)
    except LMSError as exc:
        raise _handle(exc) from exc


@router.patch("/{org_id}/members/{user_id}/role", response_model=MemberRead)
async def update_role(
    org_id: UUID,
    user_id: UUID,
    data: MemberRoleUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MemberRead:
    try:
        m = await update_member_role(session, org_id, user_id, data.role, current_user)
        return MemberRead.model_validate(m)
    except LMSError as exc:
        raise _handle(exc) from exc


@router.post("/{org_id}/invitations", response_model=InviteRead, status_code=status.HTTP_201_CREATED)
async def invite_member(
    org_id: UUID,
    data: InviteCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InviteRead:
    try:
        invite = await create_invitation(session, org_id, data, current_user)
        return InviteRead.model_validate(invite)
    except LMSError as exc:
        raise _handle(exc) from exc


@router.post("/invitations/{token}/accept")
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        await accept_invitation(session, token, current_user)
        return {"detail": "Invitation accepted"}
    except LMSError as exc:
        raise _handle(exc) from exc
