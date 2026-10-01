import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.identity.auth import get_current_user
from app.identity.models import User
from app.learning_agent.ai_generator import (
    generate_dynamic_diagnostic_questions,
    generate_sn1_chat_response,
)
from app.learning_agent.engine import (
    calculate_competency,
    calculate_identifiability,
    calculate_mastery,
    calculate_misconception,
    calculate_retention,
    calculate_transfer,
    calculate_uncertainty,
    clamp,
    detect_bottleneck,
)

router = APIRouter(prefix="/api/v1/lens", tags=["LENS-Omega & SN1 Adaptive Engine"])


# ── Request / Response Schemas ───────────────────────────────────────────────

class GenerateDiagnosticRequest(BaseModel):
    grade_name: str = Field(default="Class 4")
    subjects: List[str] = Field(default=["Mathematics", "Science (EVS)", "English Grammar", "Social Studies"])
    num_questions: int = Field(default=6)


class SubmitDiagnosticRequest(BaseModel):
    grade_name: str
    subjects: List[str]
    answers: Dict[str, int] # { question_id: selected_option_index }
    questions: List[Dict[str, Any]] # Original questions with correct_index & difficulty


class SN1ChatRequest(BaseModel):
    query: str
    grade_name: Optional[str] = "Class 4"
    subjects: Optional[List[str]] = None
    state_vector: Optional[Dict[str, Any]] = None


# ── Route Handlers ───────────────────────────────────────────────────────────

@router.post("/diagnostic/generate")
async def generate_diagnostic(
    req: GenerateDiagnosticRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Dynamically generates AI-crafted baseline diagnostic questions tailored to the student's grade and subjects.
    """
    questions = await generate_dynamic_diagnostic_questions(
        grade_name=req.grade_name,
        subjects=req.subjects,
        num_questions=req.num_questions,
    )
    return {
        "status": "success",
        "grade_name": req.grade_name,
        "subjects": req.subjects,
        "questions_count": len(questions),
        "questions": questions,
    }


@router.post("/diagnostic/submit")
async def submit_diagnostic(
    req: SubmitDiagnosticRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Evaluates student diagnostic responses and computes the exact Bayesian state vector S_t.
    """
    total_q = len(req.questions)
    if total_q == 0:
        raise HTTPException(status_code=400, detail="Empty questions list.")

    correct_count = 0
    total_difficulty = 0.0
    misconceptions_detected = False

    for q in req.questions:
        q_id = q["id"]
        selected = req.answers.get(q_id)
        correct_idx = q.get("correct_index", 0)
        diff = float(q.get("difficulty", 0.5))
        total_difficulty += diff

        if selected == correct_idx:
            correct_count += 1
        else:
            if diff <= 0.40:
                misconceptions_detected = True

    score_ratio = correct_count / total_q
    avg_difficulty = total_difficulty / total_q

    # Mathematical State Estimation (Section 14, 18, 19, 20)
    new_mastery = calculate_mastery(
        previous_mastery=0.10,
        observed_performance=score_ratio,
        evidence_type="DIAGNOSTIC",
        difficulty=avg_difficulty,
    )
    new_retention = 0.85
    new_transfer = calculate_transfer(0.00, score_ratio * 0.80)
    new_misconception = calculate_misconception(0.00, misconception_detected=misconceptions_detected)
    new_competency = calculate_competency(new_mastery, new_retention, new_transfer, new_misconception)
    new_uncertainty = calculate_uncertainty(evidence_count=total_q, observed_types=["DIAGNOSTIC"])
    new_identifiability = calculate_identifiability(["DIAGNOSTIC"])
    new_velocity = 0.045

    bottleneck, mode = detect_bottleneck(
        mastery=new_mastery,
        retention=new_retention,
        transfer=new_transfer,
        misconception=new_misconception,
        uncertainty=new_uncertainty,
        identifiability=new_identifiability,
    )

    state_data = {
        "student_id": str(current_user.id),
        "student_name": current_user.display_name,
        "grade_name": req.grade_name,
        "mastery": round(new_mastery, 4),
        "retention": round(new_retention, 4),
        "transfer": round(new_transfer, 4),
        "misconception": round(new_misconception, 4),
        "competency": round(new_competency, 4),
        "uncertainty": round(new_uncertainty, 4),
        "identifiability": round(new_identifiability, 4),
        "learning_velocity": round(new_velocity, 4),
        "current_bottleneck": bottleneck,
        "current_learning_mode": mode,
        "is_calibrated": True,
        "score_percent": round(score_ratio * 100, 1),
        "correct_count": correct_count,
        "total_questions": total_q,
    }

    return {
        "status": "calibrated",
        "result": {
            "score_percent": round(score_ratio * 100, 1),
            "correct_count": correct_count,
            "total_questions": total_q,
        },
        "state_vector": state_data,
    }


@router.post("/chat")
async def sn1_chat(
    req: SN1ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Live AI SN1 student agent chat grounded on student's grade, enrolled subjects, and state vector.
    """
    subjects = req.subjects or ["Mathematics", "Science (EVS)", "English Grammar", "Social Studies"]
    state_vec = req.state_vector or {
        "is_calibrated": False,
        "mastery": 0.0,
        "competency": 0.0,
        "uncertainty": 0.95,
        "current_bottleneck": "INSUFFICIENT_EVIDENCE",
    }

    response_text = await generate_sn1_chat_response(
        student_name=current_user.display_name,
        grade_name=req.grade_name or "Class 4",
        subjects=subjects,
        state_vector=state_vec,
        user_message=req.query,
    )

    return {
        "status": "success",
        "query": req.query,
        "response": response_text,
    }
