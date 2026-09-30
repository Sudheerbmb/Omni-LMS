import asyncio

from sqlalchemy import select

from app.identity.models import User
from app.platform.database import SessionFactory


async def _approve(email: str) -> None:
    async with SessionFactory() as session:
        user = await session.scalar(select(User).where(User.email == email))
        if user:
            user.status = "active"
            await session.commit()


def approve_email(email: str) -> None:
    asyncio.run(_approve(email))
