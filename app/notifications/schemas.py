from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    notification_type: str
    title: str
    body: str
    read_at: datetime | None
    created_at: datetime
