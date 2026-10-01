import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lens.models.projections import ConceptProjection, StudentProjection
from lens.models.state import LearnerState


async def generate_student_daily_plan(
    session: AsyncSession,
    student_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """
    Section 86: Student Daily Automation
    Generates a dynamic, time-blocked daily learning roadmap grounded in real learner states.
    """
    # Fetch all concept states for student
    stmt = select(LearnerState).where(LearnerState.student_id == student_id)
    if course_id:
        stmt = stmt.where(LearnerState.course_id == course_id)
    states = (await session.scalars(stmt)).all()

    # Fetch concept metadata for readable titles
    c_stmt = select(ConceptProjection)
    concepts = {c.concept_id: c.name for c in (await session.scalars(c_stmt)).all()}

    # Categorize items into time-blocked slots
    retrieval_items = [s for s in states if s.current_bottleneck == "RETENTION"]
    remediation_items = [s for s in states if s.current_bottleneck == "MISCONCEPTION"]
    transfer_items = [s for s in states if s.current_bottleneck == "TRANSFER"]
    acquisition_items = [s for s in states if s.current_bottleneck == "MASTERY"]

    schedule_blocks = []
    
    # Block 1: 08:00 - Morning Retrieval / Retention
    if retrieval_items:
        target = retrieval_items[0]
        c_name = concepts.get(target.concept_id, "Core Concepts")
        schedule_blocks.append({
            "time": "08:00 - 08:30",
            "type": "RETRIEVAL",
            "title": f"Spaced Retrieval: {c_name}",
            "concept_id": str(target.concept_id),
            "estimated_duration_mins": 30,
            "grounding": f"Retention decayed to {target.retention:.0%}. Memory reinforcement required.",
            "priority": "HIGH",
        })
    else:
        schedule_blocks.append({
            "time": "08:00 - 08:20",
            "type": "WARMUP",
            "title": "Daily Foundations Warmup",
            "estimated_duration_mins": 20,
            "grounding": "High retention verified. Baseline recall test.",
            "priority": "LOW",
        })

    # Block 2: 12:00 - Afternoon Acquisition / Practice
    if acquisition_items or remediation_items:
        target = remediation_items[0] if remediation_items else acquisition_items[0]
        c_name = concepts.get(target.concept_id, "Foundations")
        is_rem = target.current_bottleneck == "MISCONCEPTION"
        schedule_blocks.append({
            "time": "12:00 - 12:45",
            "type": "REMEDIATION" if is_rem else "ACQUISITION",
            "title": f"{'Remediation' if is_rem else 'Practice'}: {c_name}",
            "concept_id": str(target.concept_id),
            "estimated_duration_mins": 45,
            "grounding": f"Misconception score at {target.misconception:.0%}" if is_rem else f"Mastery at {target.mastery:.0%}",
            "priority": "CRITICAL" if is_rem else "MEDIUM",
        })
    else:
        schedule_blocks.append({
            "time": "12:00 - 12:40",
            "type": "PRACTICE",
            "title": "Interactive Problem Solving Desk",
            "estimated_duration_mins": 40,
            "grounding": "Steady progression state.",
            "priority": "MEDIUM",
        })

    # Block 3: 17:00 - Evening Transfer / Synthesis
    if transfer_items:
        target = transfer_items[0]
        c_name = concepts.get(target.concept_id, "Applied Problems")
        schedule_blocks.append({
            "time": "17:00 - 17:45",
            "type": "TRANSFER",
            "title": f"Transfer Challenge: {c_name}",
            "concept_id": str(target.concept_id),
            "estimated_duration_mins": 45,
            "grounding": f"Mastery is high ({target.mastery:.0%}) but transfer across new contexts is {target.transfer:.0%}.",
            "priority": "HIGH",
        })
    else:
        schedule_blocks.append({
            "time": "17:00 - 17:30",
            "type": "SYNTHESIS",
            "title": "Algorithmic & Case Study Synthesis",
            "estimated_duration_mins": 30,
            "grounding": "Cross-domain application review.",
            "priority": "LOW",
        })

    return {
        "student_id": str(student_id),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "total_workload_hours": sum(b["estimated_duration_mins"] for b in schedule_blocks) / 60.0,
        "schedule_blocks": schedule_blocks,
        "bottlenecks_addressed": len(retrieval_items) + len(remediation_items) + len(transfer_items),
        "generated_by": "LENS-Ω + SN1 Autonomous Scheduler",
    }
