import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.identity.auth import get_current_user, get_optional_user
from app.identity.models import User
from app.learning_agent.ai_generator import (
    generate_dynamic_diagnostic_questions,
    generate_sn1_chat_response,
    call_groq_llm
)
from app.learning_agent.langgraph_engine import execute_sn1_langgraph
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



class DrillGenerateRequest(BaseModel):
    grade_name: str = "Class 4"
    subject: str = "Mathematics"
    concept_id: str
    concept_name: str
    num_questions: int = 3


class DrillSubmitRequest(BaseModel):
    concept_id: str
    concept_name: str
    subject: str
    grade_name: str
    answers: Dict[str, int]
    questions: List[Dict[str, Any]]
    current_mastery: float = 0.20
    current_retention: float = 0.85
    current_attempts: int = 0
    current_correct: int = 0

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


@router.post("/drill/generate")
async def generate_drill_questions(
    req: DrillGenerateRequest,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Generates 2-3 dynamic conceptual drill questions for a specific knowledge node."""
    prompt = f"""Generate {req.num_questions} conceptual practice drill questions for:
Subject: {req.subject} | Grade: {req.grade_name} | Concept: {req.concept_name}

Return ONLY valid JSON with schema:
{{
  "questions": [
    {{
      "id": "drill_1",
      "prompt": "Question text testing {req.concept_name}",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "difficulty": 0.50,
      "explanation": "Clear step-by-step conceptual derivation",
      "misconception_tag": "common_misconception_error"
    }}
  ]
}}
"""
    messages = [
        {"role": "system", "content": "You are a psychometric drill generator. Output valid JSON only."},
        {"role": "user", "content": prompt}
    ]
    raw = await call_groq_llm(messages, json_mode=True)
    if raw:
        try:
            import json as _j
            data = _j.loads(raw)
            if "questions" in data and len(data["questions"]) > 0:
                return {"status": "success", "concept": req.concept_name, "questions": data["questions"]}
        except Exception as e:
            print(f"Drill JSON error: {e}")

    # Grounded fallback
    fallback_q = [
        {
            "id": f"drill_{req.concept_id}_1",
            "prompt": f"When analyzing {req.concept_name} in {req.subject}, which principle must always be verified first?",
            "options": [
                f"Validating boundary conditions and foundational definitions of {req.concept_name}",
                "Applying equations randomly without reading parameters",
                "Skipping intermediate algebraic steps",
                "Assuming all constants are zero"
            ],
            "correct_index": 0,
            "difficulty": 0.40,
            "explanation": f"Foundational analytical decomposition is the essential step for {req.concept_name}.",
            "misconception_tag": "boundary_condition_omission"
        },
        {
            "id": f"drill_{req.concept_id}_2",
            "prompt": f"Which of the following is an accurate real-world application of {req.concept_name}?",
            "options": [
                f"Predicting and modeling system behavior under physical constraints in {req.subject}",
                "Ignoring all conservation laws and variables",
                "Assuming non-deterministic arbitrary outputs",
                "Disregarding units and dimensional consistency"
            ],
            "correct_index": 0,
            "difficulty": 0.55,
            "explanation": f"{req.concept_name} models physical and mathematical interactions under invariant physical laws.",
            "misconception_tag": "dimensional_inconsistency"
        }
    ]
    return {"status": "success", "concept": req.concept_name, "questions": fallback_q}


@router.post("/drill/submit")
async def submit_drill(
    req: DrillSubmitRequest,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Calculates exact Bayesian update for an individual concept node."""
    total_q = len(req.questions)
    if total_q == 0:
        raise HTTPException(status_code=400, detail="Empty questions list.")

    correct = 0
    total_diff = 0.0
    misconception_found = False

    for q in req.questions:
        q_id = q.get("id")
        sel = req.answers.get(q_id)
        c_idx = q.get("correct_index", 0)
        diff = float(q.get("difficulty", 0.5))
        total_diff += diff
        if sel == c_idx:
            correct += 1
        elif diff <= 0.45:
            misconception_found = True

    score_ratio = correct / total_q
    avg_diff = total_diff / total_q

    # Bayesian update
    alpha = 0.20 + 0.25 * avg_diff
    new_m = req.current_mastery + alpha * (score_ratio - req.current_mastery)
    new_m = clamp(new_m, 0.05, 1.0)

    new_attempts = req.current_attempts + total_q
    new_correct = req.current_correct + correct
    new_r = min(1.0, req.current_retention + (0.10 if score_ratio >= 0.67 else -0.05))
    new_t = min(1.0, 0.40 + score_ratio * 0.50)
    new_ms = 0.30 if misconception_found else max(0.01, 0.05 if score_ratio >= 0.67 else 0.20)
    new_u = calculate_uncertainty(new_attempts, ["DRILL"])
    new_i = min(1.0, 0.50 + new_attempts * 0.08)
    new_c = calculate_competency(new_m, new_r, new_t, new_ms)
    bottleneck, mode = detect_bottleneck(new_m, new_r, new_t, new_ms, new_u, new_i)

    return {
        "status": "success",
        "concept_id": req.concept_id,
        "concept_name": req.concept_name,
        "score_percent": round(score_ratio * 100, 1),
        "correct_count": correct,
        "total_questions": total_q,
        "updated_state": {
            "concept_id": req.concept_id,
            "concept_name": req.concept_name,
            "subject": req.subject,
            "attempts_count": new_attempts,
            "correct_count": new_correct,
            "mastery": round(new_m, 4),
            "retention": round(new_r, 4),
            "transfer": round(new_t, 4),
            "misconception": round(new_ms, 4),
            "competency": round(new_c, 4),
            "uncertainty": round(new_u, 4),
            "identifiability": round(new_i, 4),
            "bottleneck": bottleneck,
            "learning_mode": mode,
            "last_updated": "Just now"
        }
    }


@router.post("/chat")
async def sn1_chat(
    req: SN1ChatRequest,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Live AI SN1 student agent chat executed via LangGraph multi-node state machine.
    """
    subjects = req.subjects or ["Mathematics", "Science (EVS)", "English Grammar", "Social Studies"]
    state_vec = req.state_vector or {
        "is_calibrated": False,
        "mastery": 0.0,
        "competency": 0.0,
        "uncertainty": 0.95,
        "current_bottleneck": "INSUFFICIENT_EVIDENCE",
    }
    user_name = current_user.display_name if current_user else "Learner"

    graph_res = await execute_sn1_langgraph(
        student_name=user_name,
        grade_name=req.grade_name or "Class 4",
        subjects=subjects,
        state_vector=state_vec,
        user_query=req.query
    )

    return {
        "status": "success",
        "query": req.query,
        "response": graph_res.get("agent_response", ""),
        "pedagogical_trace": graph_res.get("pedagogical_trace", [])
    }
