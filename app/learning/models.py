import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.models import Base, TimestampMixin, UUIDMixin


class ResourceProgress(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "resource_progress"
    __table_args__ = (UniqueConstraint("user_id", "resource_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("learning_resources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
