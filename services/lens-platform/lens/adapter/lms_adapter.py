import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import httpx

from lens.config import settings
from lens.events.contracts import LMSEventContract


class LMSIntegrationAdapter:
    """
    Section 3 & 36: Non-invasive LMS Integration Adapter
    Dispatches asynchronous learning events to LENS-Ω without blocking core LMS request cycles.
    """

    def __init__(self, lens_base_url: Optional[str] = None):
        self.lens_base_url = lens_base_url or "http://localhost:8001"

    async def emit_event(
        self,
        event_type: str,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
        payload: Dict[str, Any],
        concept_id: Optional[uuid.UUID] = None,
        correlation_id: Optional[str] = None,
    ) -> bool:
        event = LMSEventContract(
            event_id=f"evt_{uuid.uuid4()}",
            event_type=event_type,
            event_version=1,
            source="lms",
            student_id=student_id,
            course_id=course_id,
            concept_id=concept_id,
            occurred_at=datetime.now(timezone.utc),
            correlation_id=correlation_id,
            payload=payload,
        )

        try:
            # Send non-blocking HTTP event to LENS-Ω service
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.post(
                    f"{self.lens_base_url}/api/v1/events",
                    json=event.model_dump(mode="json"),
                )
                return resp.status_code == 200
        except Exception:
            # Fallback: existing LMS continues uninterrupted even if LENS-Ω is offline (Section 47)
            return False

    def emit_event_background(
        self,
        event_type: str,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
        payload: Dict[str, Any],
        concept_id: Optional[uuid.UUID] = None,
    ):
        """Dispatches fire-and-forget event in background async task."""
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.emit_event(event_type, student_id, course_id, payload, concept_id))
        except RuntimeError:
            pass


lms_adapter = LMSIntegrationAdapter()
