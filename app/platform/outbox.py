from sqlalchemy.ext.asyncio import AsyncSession

from app.platform.events import DomainEvent
from app.platform.models import OutboxEvent


async def add_to_outbox(session: AsyncSession, event: DomainEvent) -> None:
    """Write a domain event to the transactional outbox."""
    outbox_event = OutboxEvent(
        event_type=event.event_type,
        aggregate_type=event.aggregate_type,
        aggregate_id=event.aggregate_id,
        payload=event.payload,
    )
    session.add(outbox_event)
    # NOTE: caller must commit the session
