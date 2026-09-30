from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.communication.models import Announcement, DirectMessage
from app.communication.schemas import AnnouncementCreate, AnnouncementRead, MessageCreate, MessageRead
from app.identity.auth import get_current_user
from app.identity.models import Organization, OrganizationMembership, User
from app.identity.permissions import require_permission
from app.notifications.models import Notification
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/communication", tags=["communication"])


@router.get("/announcements", response_model=list[AnnouncementRead])
async def list_announcements(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[AnnouncementRead]:
    query = select(Announcement)
    if current_user.role != "admin":
        query = query.where(or_(Announcement.audience_role == "all", Announcement.audience_role == current_user.role))
    query = query.order_by(Announcement.created_at.desc()).limit(20)
    announcements = (await session.scalars(query)).all()
    return list(announcements)


@router.post("/announcements", response_model=AnnouncementRead, status_code=status.HTTP_201_CREATED)
async def create_school_announcement(
    data: AnnouncementCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AnnouncementRead:
    if current_user.role not in ("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Only faculty and administrators can broadcast announcements")

    # Find organization membership or default org
    membership = await session.scalar(select(OrganizationMembership).where(
        OrganizationMembership.user_id == current_user.id
    ))
    org_id = membership.organization_id if membership else None
    if not org_id:
        org = await session.scalar(select(Organization).limit(1))
        if org:
            org_id = org.id
        else:
            new_org = Organization(name="Omni International Academy", slug="omni-academy")
            session.add(new_org)
            await session.flush()
            org_id = new_org.id

    announcement = Announcement(organization_id=org_id, author_id=current_user.id, **data.model_dump())
    session.add(announcement)

    # Broadcast notification to users
    users = (await session.scalars(select(User))).all()
    for user in users:
        if data.audience_role != "all" and user.role != data.audience_role:
            continue
        session.add(Notification(
            user_id=user.id,
            notification_type="announcement",
            title=data.title,
            body=data.body,
        ))
    await session.commit()
    await session.refresh(announcement)
    return announcement


@router.post("/organizations/{organization_id}/announcements", response_model=AnnouncementRead, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    organization_id: UUID,
    data: AnnouncementCreate,
    current_user: User = Depends(require_permission("announcement:manage")),
    session: AsyncSession = Depends(get_session),
) -> AnnouncementRead:
    membership = await session.scalar(select(OrganizationMembership).where(
        OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.user_id == current_user.id,
    ))
    if not membership:
        raise HTTPException(status_code=403, detail="Organization membership required")
    announcement = Announcement(organization_id=organization_id, author_id=current_user.id, **data.model_dump())
    session.add(announcement)
    members = (await session.scalars(select(OrganizationMembership).where(
        OrganizationMembership.organization_id == organization_id
    ))).all()
    users = (await session.scalars(select(User).where(User.id.in_([member.user_id for member in members])))).all()
    for user in users:
        if data.audience_role != "all" and user.role != data.audience_role:
            continue
        session.add(Notification(
            user_id=user.id,
            notification_type="announcement",
            title=data.title,
            body=data.body,
        ))
    await session.commit()
    await session.refresh(announcement)
    return announcement


@router.get("/users/{user_id}/messages", response_model=list[MessageRead])
async def inbox(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[MessageRead]:
    if user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot read another user's inbox")
    messages = (await session.scalars(select(DirectMessage).where(
        or_(DirectMessage.sender_id == user_id, DirectMessage.recipient_id == user_id)
    ).order_by(DirectMessage.created_at.desc()))).all()
    return list(messages)


@router.post("/messages", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def send_message(
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MessageRead:
    recipient = await session.get(User, data.recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    message = DirectMessage(sender_id=current_user.id, **data.model_dump())
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return message
