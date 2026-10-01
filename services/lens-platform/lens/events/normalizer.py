import uuid
from typing import Optional
from lens.events.contracts import LMSEventContract, EvidenceNormalizedContract


def normalize_lms_event(event: LMSEventContract, default_concept_id: Optional[uuid.UUID] = None) -> EvidenceNormalizedContract:
    """
    Section 8, 9: Converts heterogenous LMS learning events into standardized Evidence.
    """
    p = event.payload
    c_id = event.concept_id or (uuid.UUID(p["concept_id"]) if "concept_id" in p else (default_concept_id or event.course_id))
    
    score = float(p.get("score", 1.0 if p.get("passed", True) else 0.0))
    if score > 1.0: # Normalize percentage 0-100 to 0.0-1.0
        score = score / 100.0
    score = max(0.0, min(1.0, score))
    
    is_correct = bool(p.get("correct", p.get("passed", score >= 0.70)))
    
    # Map raw event type to standardized LENS family
    raw_type = event.event_type.lower()
    if "diagnostic" in raw_type or "benchmark" in raw_type:
        e_type = "BENCHMARK"
    elif "quiz" in raw_type:
        e_type = "QUIZ"
    elif "coding" in raw_type:
        e_type = "CODING"
    elif "assignment" in raw_type:
        e_type = "ASSIGNMENT"
    elif "exam" in raw_type:
        e_type = "EXAM"
    elif "retrieval" in raw_type:
        e_type = "RETRIEVAL"
    elif "transfer" in raw_type:
        e_type = "TRANSFER"
    elif "remediation" in raw_type or "reassess" in raw_type:
        e_type = "REASSESSMENT"
    elif "classroom" in raw_type:
        e_type = "LIVE_CLASS"
    elif "tutor" in raw_type:
        e_type = "AI_TUTOR"
    else:
        e_type = "PRACTICE"

    return EvidenceNormalizedContract(
        student_id=event.student_id,
        course_id=event.course_id,
        concept_id=c_id,
        activity_id=p.get("activity_id") or p.get("assessment_id"),
        assessment_id=p.get("assessment_id"),
        question_id=p.get("question_id"),
        event_type=e_type,
        correct=is_correct,
        score=score,
        difficulty=float(p.get("difficulty", 0.50)),
        discrimination=float(p.get("discrimination", 1.00)),
        cognitive_level=p.get("cognitive_level", "APPLICATION"),
        response_time_seconds=p.get("response_time_seconds"),
        attempt_number=int(p.get("attempt_number", 1)),
        confidence=p.get("confidence"),
        hint_used=bool(p.get("hint_used", False)),
        assistance_used=bool(p.get("assistance_used", False)),
        misconception_signal=p.get("misconception_signal"),
        transfer_context=p.get("transfer_context"),
        timestamp=event.occurred_at,
        metadata=p,
    )
