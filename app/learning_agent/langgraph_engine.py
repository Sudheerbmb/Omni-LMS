"""
LENS-Ω + SN1 LangGraph Cognitive State Machine Engine
Fully autonomous multi-node pedagogical reasoning architecture connected to Groq Cloud LPU.
"""

import json
import os
from typing import Any, Dict, List, Optional, TypedDict
from langgraph.graph import StateGraph, END

from app.platform.config import settings
from app.timetable.curriculum_data import CHAPTERS_DB

GROQ_KEY = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
GROQ_MODELS = [
    settings.groq_model or "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "llama3-70b-8192"
]


class CognitiveAgentState(TypedDict):
    student_name: str
    grade_name: str
    subjects: List[str]
    state_vector: Dict[str, Any]
    user_query: str
    history: List[Dict[str, str]]
    concept_diagnostics: List[str]
    retrieved_curriculum: List[str]
    pedagogical_trace: List[str]
    agent_response: str


async def call_groq_resilient(messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 800) -> str:
    """Resilient multi-model Groq caller with automatic failover."""
    if not GROQ_KEY:
        return ""

    import urllib.request
    for model_name in GROQ_MODELS:
        try:
            req_data = {
                "model": model_name,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                data=json.dumps(req_data).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {GROQ_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "OmniLMS-LangGraph/1.0"
                }
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"].strip()
                if content:
                    return content
        except Exception as e:
            print(f"[LangGraph Groq Failover] {model_name} failed: {e}")
            continue

    return ""


# ── LangGraph Nodes ───────────────────────────────────────────────────────────

def assess_state_node(state: CognitiveAgentState) -> Dict[str, Any]:
    """Node 1: Psychometric & Bayesian State Vector Assessment"""
    vec = state.get("state_vector", {})
    diagnostics = []

    is_calibrated = vec.get("is_calibrated", False)
    competency = vec.get("competency", 0.0)
    mastery = vec.get("mastery", 0.0)
    retention = vec.get("retention", 0.85)
    transfer = vec.get("transfer", 0.0)
    misconception = vec.get("misconception", 0.0)
    uncertainty = vec.get("uncertainty", 0.95)
    bottleneck = vec.get("current_bottleneck", "INSUFFICIENT_EVIDENCE")
    mode = vec.get("current_learning_mode", "DIAGNOSTIC")

    if not is_calibrated or uncertainty >= 0.70:
        diagnostics.append(f"• Baseline Calibration Status: UNCALIBRATED (Epistemic Uncertainty: {uncertainty:.0%}).")
        diagnostics.append("• Action Required: Take subject benchmark assessments to unlock Bayesian mastery telemetry.")
    else:
        diagnostics.append(f"• Holistic Competency Index: {competency:.0%} | Mastery: {mastery:.0%}")
        diagnostics.append(f"• Memory Retention Trace: {retention:.0%} | Transfer Ability: {transfer:.0%}")
        diagnostics.append(f"• Active System Bottleneck: [{bottleneck}] | Mode: [{mode}]")
        if misconception > 0.15:
            diagnostics.append(f"• Cognitive Misconception Signal Detected: {misconception:.0%} severity.")

    trace = state.get("pedagogical_trace", [])
    trace.append(f"Assessed cognitive vector S_t -> Bottleneck: {bottleneck}, Mode: {mode}")

    return {
        "concept_diagnostics": diagnostics,
        "pedagogical_trace": trace
    }


def retrieve_curriculum_node(state: CognitiveAgentState) -> Dict[str, Any]:
    """Node 2: Dynamic Curriculum Grounding & Concept Retrieval"""
    grade = state.get("grade_name", "Class 4")
    subjects = state.get("subjects", ["Mathematics", "Science (EVS)"])

    # Extract grade number
    import re
    g_match = re.search(r"(\d+)", grade)
    g_num = int(g_match.group(1)) if g_match else 4

    curriculum_keys = [k for k in CHAPTERS_DB.keys() if f"_{g_num}" in k]
    retrieved = []

    for k in curriculum_keys:
        chapters = CHAPTERS_DB.get(k, [])
        ch_titles = [c.get("title", "") for c in chapters[:3]]
        retrieved.append(f"{k.replace(f'_{g_num}', '')} (Grade {g_num}): Chapters -> {', '.join(ch_titles)}")

    if not retrieved:
        retrieved.append(f"Standard Grade {g_num} foundational curriculum in {', '.join(subjects)}.")

    trace = state.get("pedagogical_trace", [])
    trace.append(f"Grounding curriculum context for Grade {g_num} ({len(retrieved)} subject modules retrieved)")

    return {
        "retrieved_curriculum": retrieved,
        "pedagogical_trace": trace
    }


async def generate_response_node(state: CognitiveAgentState) -> Dict[str, Any]:
    """Node 3: Pedagogical Synthesis with Groq LPU API"""
    student_name = state.get("student_name", "Student")
    grade_name = state.get("grade_name", "Class 4")
    user_query = state.get("user_query", "")
    diagnostics = state.get("concept_diagnostics", [])
    curriculum = state.get("retrieved_curriculum", [])
    history = state.get("history", [])

    system_prompt = f"""You are SN1, the autonomous Student Neural Intelligence & Learning Agent powered by LangGraph on the LENS-Ω cognitive platform.
You are directly assisting {student_name} ({grade_name}).

LIVE COGNITIVE TELEMETRY (State Vector S_t):
{chr(10).join(diagnostics)}

CURRICULUM GROUNDING:
{chr(10).join(curriculum)}

OPERATIONAL DIRECTIVES:
1. Provide intellectually rigorous, tailored, and Socratic answers. Never output static or generic placeholder text.
2. If the student asks a conceptual or homework question, break it down step-by-step with clear derivations, formulas, or intuitive examples.
3. If the student asks about what to study or their bottlenecks, explain their exact competency, what concepts require drills, and how to improve.
4. If uncalibrated, guide them through taking their pending subject benchmark tests.
5. Format with clear Markdown, bullet points, and concise mathematical clarity."""

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt}
    ]

    for h in history[-6:]:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})

    messages.append({"role": "user", "content": user_query})

    response_text = await call_groq_resilient(messages, temperature=0.35)

    if not response_text:
        # High quality grounded dynamic fallback
        bottleneck = state.get("state_vector", {}).get("current_bottleneck", "INSUFFICIENT_EVIDENCE")
        comp = state.get("state_vector", {}).get("competency", 0.0)
        response_text = (
            f"Hello {student_name}! Grounded in your {grade_name} neural state vector across {', '.join(state.get('subjects', []))}:\n\n"
            f"• **Holistic Competency:** {comp:.0%}\n"
            f"• **Active Bottleneck:** `{bottleneck}`\n\n"
            f"To address your query regarding **\"{user_query}\"**, I recommend focusing on foundational practice drills and completing any pending subject benchmarks to eliminate epistemic uncertainty."
        )

    return {
        "agent_response": response_text
    }


# ── LangGraph Workflow Assembly ──────────────────────────────────────────────

def create_cognitive_agent_graph():
    """Builds and compiles the executable LangGraph StateGraph."""
    workflow = StateGraph(CognitiveAgentState)

    workflow.add_node("assess_state", assess_state_node)
    workflow.add_node("retrieve_curriculum", retrieve_curriculum_node)
    workflow.add_node("generate_response", generate_response_node)

    workflow.set_entry_point("assess_state")
    workflow.add_edge("assess_state", "retrieve_curriculum")
    workflow.add_edge("retrieve_curriculum", "generate_response")
    workflow.add_edge("generate_response", END)

    return workflow.compile()


cognitive_agent_graph = create_cognitive_agent_graph()


async def execute_sn1_langgraph(
    student_name: str,
    grade_name: str,
    subjects: List[str],
    state_vector: Dict[str, Any],
    user_query: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Executes the full LangGraph state machine pipeline asynchronously."""
    initial_state: CognitiveAgentState = {
        "student_name": student_name,
        "grade_name": grade_name,
        "subjects": subjects,
        "state_vector": state_vector,
        "user_query": user_query,
        "history": history or [],
        "concept_diagnostics": [],
        "retrieved_curriculum": [],
        "pedagogical_trace": [],
        "agent_response": "",
    }

    result = await cognitive_agent_graph.ainvoke(initial_state)
    return result
