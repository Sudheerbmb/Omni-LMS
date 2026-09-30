from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CertificateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    course_id: UUID
    certificate_number: str
    issued_at: datetime
