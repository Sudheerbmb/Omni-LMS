from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.identity.models import OrganizationMembership, User
from app.identity.security import generate_token, hash_token
from app.platform.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.tenancy.models import OrgInvitation, Organization
from app.tenancy.schemas import InviteCreate, OrgCreate, OrgUpdate


async def create_organization(session: AsyncSession, data: OrgCreate, owner: User) -> Organization:
    existing = await session.scalar(select(Organization).where(Organization.slug == data.slug))
    if existing:
        raise ConflictError("An organization with this slug already exists")

    org = Organization(**data.model_dump())
    session.add(org)
    await session.flush()

    session.add(OrganizationMembership(
        organization_id=org.id,
        user_id=owner.id,
        role="organization_admin",
    ))
    await session.commit()
    await session.refresh(org)
    return org


async def get_organization(session: AsyncSession, org_id: UUID, user: User) -> Organization:
    org = await session.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise NotFoundError("Organization not found")
    await _require_membership(session, org_id, user.id)
    return org


async def list_organizations(session: AsyncSession, user: User) -> list[Organization]:
    member_of = select(OrganizationMembership.organization_id).where(
        OrganizationMembership.user_id == user.id
    )
    rows = await session.scalars(
        select(Organization).where(Organization.id.in_(member_of)).order_by(Organization.name)
    )
    return list(rows.all())


async def update_organization(
    session: AsyncSession, org_id: UUID, data: OrgUpdate, user: User
) -> Organization:
    org = await session.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise NotFoundError("Organization not found")
    await _require_admin(session, org_id, user.id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(org, field, value)
    await session.commit()
    await session.refresh(org)
    return org


async def upload_org_logo(session: AsyncSession, org_id: UUID, url: str, user: User) -> Organization:
    org = await session.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise NotFoundError("Organization not found")
    await _require_admin(session, org_id, user.id)
    org.logo_url = url
    await session.commit()
    await session.refresh(org)
    return org


async def list_members(session: AsyncSession, org_id: UUID, user: User) -> list[dict]:
    await _require_membership(session, org_id, user.id)
    rows = await session.scalars(
        select(OrganizationMembership).where(OrganizationMembership.organization_id == org_id)
    )
    members = list(rows.all())
    result = []
    for m in members:
        u = await session.scalar(select(User).where(User.id == m.user_id))
        result.append({
            "id": m.id,
            "user_id": m.user_id,
            "organization_id": m.organization_id,
            "role": m.role,
            "created_at": m.created_at,
            "display_name": u.display_name if u else None,
            "email": u.email if u else None,
            "avatar_url": u.avatar_url if u else None,
        })
    return result


async def remove_member(session: AsyncSession, org_id: UUID, user_id: UUID, actor: User) -> None:
    await _require_admin(session, org_id, actor.id)
    if user_id == actor.id:
        raise ValidationError("Cannot remove yourself from the organization")
    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org_id,
            OrganizationMembership.user_id == user_id,
        )
    )
    if not membership:
        raise NotFoundError("Member not found")
    await session.delete(membership)
    await session.commit()


async def update_member_role(
    session: AsyncSession, org_id: UUID, user_id: UUID, role: str, actor: User
) -> OrganizationMembership:
    await _require_admin(session, org_id, actor.id)
    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org_id,
            OrganizationMembership.user_id == user_id,
        )
    )
    if not membership:
        raise NotFoundError("Member not found")
    membership.role = role
    await session.commit()
    await session.refresh(membership)
    return membership


async def create_invitation(
    session: AsyncSession, org_id: UUID, data: InviteCreate, inviter: User
) -> OrgInvitation:
    await _require_admin(session, org_id, inviter.id)
    org = await session.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise NotFoundError("Organization not found")

    raw_token = generate_token(32)
    invite = OrgInvitation(
        organization_id=org_id,
        inviter_id=inviter.id,
        email=data.email.lower(),
        role=data.role,
        token=raw_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    session.add(invite)
    await session.commit()
    await session.refresh(invite)
    # TODO: dispatch invite email
    return invite


async def accept_invitation(session: AsyncSession, token: str, user: User) -> OrganizationMembership:
    invite = await session.scalar(select(OrgInvitation).where(OrgInvitation.token == token))
    if not invite:
        raise NotFoundError("Invitation not found or already used")
    now = datetime.now(timezone.utc)
    if invite.expires_at < now:
        raise ValidationError("Invitation has expired")
    if invite.accepted_at:
        raise ConflictError("Invitation already accepted")

    # Check already a member
    existing = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == invite.organization_id,
            OrganizationMembership.user_id == user.id,
        )
    )
    if existing:
        raise ConflictError("Already a member of this organization")

    membership = OrganizationMembership(
        organization_id=invite.organization_id,
        user_id=user.id,
        role=invite.role,
    )
    session.add(membership)
    invite.accepted_at = now
    await session.commit()
    await session.refresh(membership)
    return membership


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _require_membership(session: AsyncSession, org_id: UUID, user_id: UUID) -> OrganizationMembership:
    m = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org_id,
            OrganizationMembership.user_id == user_id,
        )
    )
    if not m:
        raise ForbiddenError("You are not a member of this organization")
    return m


async def _require_admin(session: AsyncSession, org_id: UUID, user_id: UUID) -> OrganizationMembership:
    m = await _require_membership(session, org_id, user_id)
    if m.role not in ("organization_admin", "admin"):
        raise ForbiddenError("Organization admin role required")
    return m
