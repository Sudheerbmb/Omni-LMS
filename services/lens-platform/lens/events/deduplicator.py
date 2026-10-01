from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from lens.models.evidence import RawEventArchive


async def is_event_processed(session: AsyncSession, event_id: str) -> bool:
    """
    Section 46: Mandatory idempotency check before applying state updates.
    """
    stmt = select(RawEventArchive).where(RawEventArchive.event_id == event_id)
    result = await session.scalar(stmt)
    return result is not None and result.processed
