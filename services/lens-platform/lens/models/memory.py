import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Float, LargeBinary, String, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column
from lens.database import LensBase, LensTimestampMixin, LensUUIDMixin


class AgentMemory(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Long-term student memory (preferences, stable goals, milestone summaries) (Section 51)."""
    __tablename__ = "lens_agent_memory"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    student_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    
    memory_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False) # preference, goal, habit, strength, weakness_summary
    key: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    content_json: Mapped[dict] = mapped_column(JSON, default=dict)
    importance_score: Mapped[float] = mapped_column(Float, default=1.0)
    last_accessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class AgentCheckpoint(LensUUIDMixin, LensTimestampMixin, LensBase):
    """PostgreSQL durable checkpointer for LangGraph execution threads (Section 52)."""
    __tablename__ = "lens_agent_checkpoints"

    thread_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    checkpoint_ns: Mapped[str] = mapped_column(String(255), default="")
    checkpoint_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    parent_checkpoint_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    state_blob: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
