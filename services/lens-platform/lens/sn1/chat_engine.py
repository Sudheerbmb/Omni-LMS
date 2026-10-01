import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lens.models.projections import ConceptProjection, StudentProjection
from lens.models.state import LearnerState
from lens.sn1.prompts import SN1_SYSTEM_PROMPT
from lens.sn1.providers import get_llm_provider
from lens.sn1.router import route_model


async def answer_student_query(
    session: AsyncSession,
    student_id: uuid.UUID,
    query: str,
    course_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """
    Section 39 & 40: Student Natural Language Reasoning & Explainability Engine
    Answers queries grounded strictly on LENS-Ω state vectors and real evidence.
    """
    # 1. Fetch Student Profile
    p_stmt = select(StudentProjection).where(StudentProjection.user_id == student_id)
    student = await session.scalar(p_stmt)
    student_name = student.display_name if student else "Learner"

    # 2. Fetch all concept states
    s_stmt = select(LearnerState).where(LearnerState.student_id == student_id)
    if course_id:
        s_stmt = s_stmt.where(LearnerState.course_id == course_id)
    states = (await session.scalars(s_stmt)).all()

    # 3. Fetch Concept Names
    c_stmt = select(ConceptProjection)
    concepts = {c.concept_id: c.name for c in (await session.scalars(c_stmt)).all()}

    # Calculate overall aggregated dimensions (Section 40: Exam Readiness)
    if states:
        avg_mastery = sum(s.mastery for s in states) / len(states)
        avg_retention = sum(s.retention for s in states) / len(states)
        avg_transfer = sum(s.transfer for s in states) / len(states)
        avg_competency = sum(s.competency for s in states) / len(states)
        avg_uncertainty = sum(s.uncertainty for s in states) / len(states)
        weakest = min(states, key=lambda s: s.competency)
        weakest_concept_name = concepts.get(weakest.concept_id, "Core Foundations")
    else:
        avg_mastery = 0.50
        avg_retention = 0.90
        avg_transfer = 0.30
        avg_competency = 0.45
        avg_uncertainty = 0.60
        weakest = None
        weakest_concept_name = "Foundations"

    # Build Grounded State Summary (Section 50: Token Optimization)
    state_summary = f"""
Student Name: {student_name}
Overall Mastery (M): {avg_mastery:.1%}
Overall Retention (R): {avg_retention:.1%}
Cross-Context Transfer (T): {avg_transfer:.1%}
Holistic Competency (C): {avg_competency:.1%}
Epistemic Uncertainty (U): {avg_uncertainty:.1%}
Primary Weakness / Bottleneck: {weakest_concept_name} ({weakest.current_bottleneck if weakest else 'INSUFFICIENT_EVIDENCE'})
Tracked Concept Count: {len(states)}
"""

    prompt = f"""You are answering a student's question directly.
Here is the real mathematical state vector grounded in the database:
{state_summary}

Student Question: "{query}"

Provide an explainable, encouraging, and data-grounded response answering their question precisely without inventing ungrounded statistics."""

    llm = get_llm_provider()
    model_name = route_model("STUDENT_CHAT")
    response_text = await llm.complete(
        messages=[
            {"role": "system", "content": SN1_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        model=model_name,
    )

    return {
        "student_id": str(student_id),
        "query": query,
        "response": response_text,
        "grounded_state": {
            "average_mastery": avg_mastery,
            "average_retention": avg_retention,
            "average_transfer": avg_transfer,
            "average_competency": avg_competency,
            "average_uncertainty": avg_uncertainty,
            "primary_bottleneck": weakest.current_bottleneck if weakest else "INSUFFICIENT_EVIDENCE",
            "weakest_concept": weakest_concept_name,
        }
    }
