import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class DomainEvent:
    event_type: str
    aggregate_type: str
    aggregate_id: uuid.UUID
    payload: dict[str, Any] = field(default_factory=dict)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    event_id: uuid.UUID = field(default_factory=uuid.uuid4)
