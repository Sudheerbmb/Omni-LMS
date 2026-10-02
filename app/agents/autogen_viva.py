"""
AutoGen Multi-Agent Interactive Viva & Oral Defense Simulation
Powered by Groq Cloud LPU (qwen/qwen3.8-27b / openai/gpt-oss-120b).
Features dynamic, real-time multi-agent cross-examination debate between:
  - Examiner 1: Prof. Eleanor Wright (Academic Committee Chair)
  - Examiner 2: Dr. Soren Kierkegaard (Adversarial Logic Auditor)
"""
import json
import os
import re
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel
from app.platform.config import settings

class VivaRoundRequest(BaseModel):
    subject: str
    topic: str
    student_response: str = ""
    round_number: int = 1
    previous_history: List[Dict[str, str]] = []

class VivaDialogueTurn(BaseModel):
    speaker: str
    speaker_role: str
    avatar_color: str
    message: str

class VivaRoundResponse(BaseModel):
    round_number: int
    dialogue: List[VivaDialogueTurn]
    current_evaluation: Dict[str, Any]
    next_question: str

async def call_groq_llm_for_viva(messages: List[Dict[str, str]], json_mode: bool = True) -> Optional[str]:
    """Invokes Groq Cloud LPU API with high-speed inference."""
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return None

    # Candidate models verified available on Groq Cloud
    candidate_models = [
        settings.groq_model,
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b"
    ]
    candidate_models = [m for m in candidate_models if m]

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    for model_name in candidate_models:
        payload: Dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.35,
            "max_tokens": 1000,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    print(f"[Groq Viva Retry] Model {model_name} HTTP {res.status_code}: {res.text[:100]}")
        except Exception as err:
            print(f"[Groq Viva Call Exception with {model_name}]: {err}")

    return None

async def process_autogen_viva_round(req: VivaRoundRequest) -> VivaRoundResponse:
    round_num = req.round_number
    subject = req.subject
    topic = req.topic
    resp = req.student_response.strip()

    # ── ROUND 1: Opening Question Formulation ──────────────────────────────
    if round_num == 1 and not resp:
        groq_prompt = [
            {
                "role": "system",
                "content": (
                    "You are simulating an academic oral defense committee. "
                    "Formulate a challenging and precise opening question from Prof. Eleanor Wright (Academic Committee Chair) "
                    "testing core axioms, definitions, and equations on the given academic topic. "
                    "Return ONLY valid JSON with format: {\"opening_question\": \"...\"}"
                )
            },
            {
                "role": "user",
                "content": f"Subject: {subject}\nTopic: {topic}\nFormulate the opening defense question."
            }
        ]

        groq_res = await call_groq_llm_for_viva(groq_prompt, json_mode=True)
        opening_msg = f"Welcome to your oral defense on {topic} ({subject}). To begin, please explain the foundational mathematical principles governing this system and describe the boundary conditions where this behavior occurs."

        if groq_res:
            try:
                parsed = json.loads(groq_res)
                if "opening_question" in parsed and parsed["opening_question"].strip():
                    opening_msg = parsed["opening_question"].strip()
            except Exception as e:
                print(f"[Groq JSON Parse Error]: {e}")

        dialogue = [
            VivaDialogueTurn(
                speaker="Prof. Eleanor Wright",
                speaker_role="Academic Committee Chair",
                avatar_color="from-cyan-500 to-blue-600",
                message=opening_msg
            )
        ]

        return VivaRoundResponse(
            round_number=1,
            dialogue=dialogue,
            current_evaluation={"rigor_score": 0, "status": "AWAITING_STUDENT_RESPONSE"},
            next_question=opening_msg
        )

    # ── SUBSEQUENT ROUNDS: Multi-Agent Dynamic Debate via Groq LPU ─────────
    history_context = "\n".join([f"{h.get('speaker', 'Examiner')}: {h.get('message', '')}" for h in req.previous_history[-4:]])
    
    groq_dialogue_prompt = [
        {
            "role": "system",
            "content": (
                "You are an AI multi-agent simulation engine running a university oral viva defense with 2 distinct examiners:\n"
                "1. 'Prof. Eleanor Wright' (Academic Committee Chair): Constructive academic director. Analyzes the student's actual response. If the student admits not knowing ('I don't know', 'no idea', etc.), she acknowledges their candor, identifies what concept was asked, and provides a foundational hint. If the student answers well, she acknowledges their correctness.\n"
                "2. 'Dr. Soren Kierkegaard' (Adversarial Logic Auditor): Skeptical, rigorous examiner. If the student said 'I don't know', Soren pushes them to deduce the answer logically from first principles. If the student gave a technical answer, Soren attacks edge cases, perturbations, asymptotic limits, or false assumptions.\n\n"
                "STRICT RULES:\n"
                "- Directly reference the student's ACTUAL answer. NEVER give canned praise for 'I don't know' or nonsense answers.\n"
                "- Return STRICT JSON with keys:\n"
                "  \"eleanor_turn\": \"Eleanor's response (2-3 sentences addressing student)\",\n"
                "  \"soren_turn\": \"Soren's adversarial challenge/probe (2-3 sentences)\",\n"
                "  \"rigor_score\": integer between 10 and 100 based on accuracy (give 20-35 if student admits not knowing),\n"
                "  \"conceptual_clarity\": \"High\" | \"Moderate\" | \"Emerging\" | \"Remediation Needed\",\n"
                "  \"next_question\": \"The next specific question for the student to defend\""
            )
        },
        {
            "role": "user",
            "content": (
                f"Subject: {subject}\n"
                f"Topic: {topic}\n"
                f"Prior Exchange:\n{history_context}\n\n"
                f"Student's Latest Answer:\n\"{resp}\"\n\n"
                f"Evaluate and generate the examiners' dialogue."
            )
        }
    ]

    groq_resp_raw = await call_groq_llm_for_viva(groq_dialogue_prompt, json_mode=True)
    
    dialogue: List[VivaDialogueTurn] = []
    rigor = 75
    clarity = "Moderate"
    next_q = f"How would you verify mathematical stability for {topic} under non-ideal perturbations?"

    if groq_resp_raw:
        try:
            parsed = json.loads(groq_resp_raw)
            eleanor_text = parsed.get("eleanor_turn", "")
            soren_text = parsed.get("soren_turn", "")
            rigor = int(parsed.get("rigor_score", 70))
            clarity = parsed.get("conceptual_clarity", "Moderate")
            next_q = parsed.get("next_question", next_q)

            if eleanor_text:
                dialogue.append(
                    VivaDialogueTurn(
                        speaker="Prof. Eleanor Wright",
                        speaker_role="Academic Committee Chair",
                        avatar_color="from-cyan-500 to-blue-600",
                        message=eleanor_text
                    )
                )
            if soren_text:
                dialogue.append(
                    VivaDialogueTurn(
                        speaker="Dr. Soren Kierkegaard",
                        speaker_role="Adversarial Logic Auditor",
                        avatar_color="from-amber-500 to-orange-600",
                        message=soren_text
                    )
                )
        except Exception as e:
            print(f"[Groq Multi-Agent Parse Error]: {e}")

    # Fallback if Groq unavailable or returned empty
    if not dialogue:
        is_unknown = bool(re.search(r"\b(dont know|don't know|do not know|no idea|unsure|not sure|idk|cant explain|can't explain|cannot explain|help me|no)\b", resp, re.IGNORECASE))
        
        if is_unknown or len(resp) < 6:
            dialogue.append(
                VivaDialogueTurn(
                    speaker="Prof. Eleanor Wright",
                    speaker_role="Academic Committee Chair",
                    avatar_color="from-cyan-500 to-blue-600",
                    message=f"I appreciate your candor in acknowledging uncertainty regarding {topic}. In an oral defense, identifying where your certainty ends is the first step of scholarship. Let us step back: what is the most basic definition or intuition you have about {topic}?"
                )
            )
            dialogue.append(
                VivaDialogueTurn(
                    speaker="Dr. Soren Kierkegaard",
                    speaker_role="Adversarial Logic Auditor",
                    avatar_color="from-amber-500 to-orange-600",
                    message=f"Do not concede defeat immediately. Even if the full formula escapes you, consider the conservation laws and symmetry. Deduce what must logically occur when this system reaches equilibrium."
                )
            )
            rigor = 30
            clarity = "Remediation Needed"
            next_q = f"What is the simplest fundamental relationship or intuition you have for {topic}?"
        else:
            dialogue.append(
                VivaDialogueTurn(
                    speaker="Prof. Eleanor Wright",
                    speaker_role="Academic Committee Chair",
                    avatar_color="from-cyan-500 to-blue-600",
                    message=f"Thank you for that explanation. You pointed out: \"{resp[:80]}...\". That identifies a key aspect of {topic}."
                )
            )
            dialogue.append(
                VivaDialogueTurn(
                    speaker="Dr. Soren Kierkegaard",
                    speaker_role="Adversarial Logic Auditor",
                    avatar_color="from-amber-500 to-orange-600",
                    message=f"While that holds in standard cases, what occurs when non-linear edge cases or extreme boundary values are reached? How do you prevent asymptotic divergence?"
                )
            )
            rigor = 82
            clarity = "High"
            next_q = f"How does your model for {topic} behave under extreme boundary conditions?"

    return VivaRoundResponse(
        round_number=round_num + 1,
        dialogue=dialogue,
        current_evaluation={
            "rigor_score": rigor,
            "conceptual_clarity": clarity,
            "defense_status": "DEFENDING" if rigor < 90 else "EXEMPLARY_MASTERY"
        },
        next_question=next_q
    )
