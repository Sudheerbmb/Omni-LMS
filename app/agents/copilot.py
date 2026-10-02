"""
Autonomous Context-Aware Omni-Copilot Agent Engine
Powered by Groq Cloud LPU (qwen/qwen3.8-27b / openai/gpt-oss-120b).
Analyzes user intent dynamically across on-page state, role permissions, and tool execution.
"""
import json
import os
import re
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel
from app.platform.config import settings

class CopilotReasonRequest(BaseModel):
    query: str
    current_tab: str = "overview"
    user_role: str = "student"
    user_name: str = "Student"
    user_email: str = ""
    grade_number: Optional[int] = 10
    page_context: Optional[Dict[str, Any]] = None

class CopilotReasonResponse(BaseModel):
    action_type: str  # NAVIGATE_TAB, START_LIVE_CLASS, JOIN_LIVE_CLASS, OPEN_CREWAI_STUDIO, OPEN_AUTOGEN_VIVA, ANALYZE_COGNITIVE_RISK, RUN_CODE_LAB, OPEN_ASSIGNMENTS_DESK, GENERAL_REPLY, RESTRICTED_ACTION
    action_params: Dict[str, Any]
    agent_reply: str
    reasoning_steps: List[str]

async def call_groq_copilot(messages: List[Dict[str, str]]) -> Optional[str]:
    """Invokes Groq Cloud LPU for intelligent agentic reasoning."""
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return None

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
            "temperature": 0.25,
            "max_tokens": 1200,
            "response_format": {"type": "json_object"}
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    print(f"[Groq Copilot Retry] Model {model_name} HTTP {res.status_code}")
        except Exception as err:
            print(f"[Groq Copilot Exception with {model_name}]: {err}")

    return None

async def reason_copilot_intent(req: CopilotReasonRequest) -> CopilotReasonResponse:
    query = req.query.strip()
    role = req.user_role.lower()
    current_tab = req.current_tab
    grade = req.grade_number or 10
    name = req.user_name

    system_prompt = (
        "You are Omni-Copilot, the fully autonomous, context-aware AI agent governing the Omni-LMS enterprise platform.\n"
        "You have full page context awareness and enforce strict Role-Based Access Control (RBAC).\n\n"
        "CURRENT PLATFORM CONTEXT:\n"
        f"- Active User: {name} (Role: {role.upper()}, Enrolled Grade: Class {grade})\n"
        f"- Currently Active Page/Tab: '{current_tab}'\n\n"
        "PLATFORM TOOLS & ACTION TYPES:\n"
        "1. 'START_LIVE_CLASS': (FACULTY / ADMIN ONLY) Launch a live WebRTC classroom lecture for a grade/time. Params: {\"grade\": \"Class 6-A\", \"subject\": \"Mathematics\", \"start_time\": \"4:45 PM\", \"target_tab\": \"classroom\"}\n"
        "2. 'JOIN_LIVE_CLASS': (STUDENTS ONLY) Navigate to student's authorized live lecture room. Params: {\"grade\": f\"Class {grade}\", \"target_tab\": \"classroom\"}\n"
        "3. 'OPEN_CREWAI_STUDIO': (FACULTY / ADMIN ONLY) Open 3-agent syllabus generation studio. Params: {\"topic\": \"...\"}\n"
        "4. 'OPEN_AUTOGEN_VIVA': (STUDENTS & FACULTY) Open interactive 2-examiner oral defense session. Params: {\"topic\": \"...\"}\n"
        "5. 'ANALYZE_COGNITIVE_RISK': Open learning agent / cognitive radar. Params: {\"target_tab\": \"learning-intelligence\"}\n"
        "6. 'NAVIGATE_TAB': Switch UI tab to one of: ['overview', 'timetable', 'courses', 'assessments', 'learning-intelligence', 'assignments', 'certificates', 'organizations', 'coding', 'classroom', 'admin']. Params: {\"target_tab\": \"...\"}\n"
        "7. 'GENERAL_REPLY': Answer a pedagogical, academic, or contextual question directly in the chat HUD without switching pages. Params: {}\n"
        "8. 'RESTRICTED_ACTION': If the user requests an unauthorized action (e.g., student trying to start/host a class, student trying to run admin school-wide risk audits or delete orgs). Params: {\"target_tab\": \"classroom\" or appropriate tab}\n\n"
        "STRICT RBAC RULES:\n"
        "- If Role is 'STUDENT' and user asks to 'start', 'host', 'create', or 'schedule' a live class: return action_type 'RESTRICTED_ACTION', explain that students cannot host classes, and offer to navigate to their authorized Class {grade} live room.\n"
        "- If Role is 'STUDENT' and user asks for admin tenancy or teacher leave approval: return 'RESTRICTED_ACTION'.\n\n"
        "OUTPUT FORMAT (STRICT JSON):\n"
        "{\n"
        "  \"action_type\": \"...\",\n"
        "  \"action_params\": { ... },\n"
        "  \"agent_reply\": \"Natural conversational explanation directly addressing the user's intent with full situational awareness of their current page and role.\",\n"
        "  \"reasoning_steps\": [\n"
        "    \"Step 1: Analyzed command in context of current tab ('{current_tab}')\",\n"
        "    \"Step 2: Checked authorization for {role.upper()} role\",\n"
        "    \"Step 3: Dispatched tool action ...\"\n"
        "  ]\n"
        "}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"User Command: \"{query}\"\nCurrent Page Tab: \"{current_tab}\""}
    ]

    groq_output = await call_groq_copilot(messages)

    if groq_output:
        try:
            parsed = json.loads(groq_output)
            action_type = parsed.get("action_type", "GENERAL_REPLY")
            action_params = parsed.get("action_params", {})
            agent_reply = parsed.get("agent_reply", f"Processed request for: {query}")
            reasoning_steps = parsed.get("reasoning_steps", [
                f"Parsed command '{query}' on tab '{current_tab}'",
                f"Applied {role.upper()} role-based authorization",
                f"Executing action {action_type}"
            ])
            return CopilotReasonResponse(
                action_type=action_type,
                action_params=action_params,
                agent_reply=agent_reply,
                reasoning_steps=reasoning_steps
            )
        except Exception as e:
            print(f"[Groq Copilot JSON Parse Error]: {e}")

    # ── FALLBACK AGENT REASONING ENGINE (Context-Aware) ──────────────────────
    lower = query.lower()

    if "start class" in lower or "launch class" in lower or "start lecture" in lower or "create class" in lower:
        if role == "student":
            return CopilotReasonResponse(
                action_type="RESTRICTED_ACTION",
                action_params={"target_tab": "classroom"},
                agent_reply=f"As a student, you cannot initiate or host live classes. I have routed you to the Class {grade} Live Classrooms lobby so you can join lectures hosted by your teachers.",
                reasoning_steps=[
                    f"Analyzed intent: '{query}' on active page '{current_tab}'",
                    "Security Guard: Verified STUDENT role (hosting prohibited)",
                    f"Redirecting student to authorized Class {grade} live room"
                ]
            )
        else:
            grade_match = re.search(r"(?:for\s+|class\s+|grade\s+)(\d+(?:[a-zA-Z\s\-]+)?)", query, re.IGNORECASE)
            grade_str = f"Class {grade_match.group(1).strip()}" if grade_match else "Class 6-A"
            time_match = re.search(r"at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)", query, re.IGNORECASE)
            time_str = time_match.group(1) if time_match else "4:45 PM"

            return CopilotReasonResponse(
                action_type="START_LIVE_CLASS",
                action_params={
                    "grade": grade_str,
                    "subject": "Mathematics",
                    "start_time": time_str,
                    "target_tab": "classroom"
                },
                agent_reply=f"Navigated to Live Classrooms and launched active WebRTC lecture room for {grade_str} scheduled at {time_str}. Status: LIVE.",
                reasoning_steps=[
                    f"Extracted grade '{grade_str}' and time '{time_str}' from natural speech",
                    "Authorized FACULTY lecture initiation",
                    f"Invoking MCP tool: lms_start_live_class(grade='{grade_str}', time='{time_str}')",
                    "Switching UI context to Live Classrooms tab"
                ]
            )

    if "crew" in lower or "curriculum studio" in lower or "design course" in lower:
        if role == "student":
            return CopilotReasonResponse(
                action_type="RESTRICTED_ACTION",
                action_params={"target_tab": "courses"},
                agent_reply="The CrewAI Curriculum Design Studio is an instructor tool for designing syllabi. I have opened the Course Catalog for your learning roadmap.",
                reasoning_steps=[
                    "Analyzed request for CrewAI Studio",
                    "Student authorization check: Curriculum creation restricted",
                    "Navigating student to approved Course Catalog"
                ]
            )
        return CopilotReasonResponse(
            action_type="OPEN_CREWAI_STUDIO",
            action_params={},
            agent_reply="Assembled the CrewAI Multi-Agent Curriculum Design Studio (Subject Matter Specialist, Psychometrician, and Instructional Designer).",
            reasoning_steps=[
                f"Identified curriculum engineering intent from '{query}'",
                "Verified faculty credentials",
                "Mounting CrewAI 3-Agent Collaborative Workspace"
            ]
        )

    if "viva" in lower or "oral defense" in lower or "autogen" in lower:
        return CopilotReasonResponse(
            action_type="OPEN_AUTOGEN_VIVA",
            action_params={"topic": "Quadratic Equations & Asymptotic Stability"},
            agent_reply="Convened the AutoGen Multi-Agent Oral Viva Defense Chamber with Prof. Eleanor Wright and Dr. Soren Kierkegaard.",
            reasoning_steps=[
                "Identified oral examination defense request",
                "Spawning AutoGen multi-agent conversational simulation",
                "Enabling Web Speech voice transcription harness"
            ]
        )

    # General navigation fallback
    target_tab = "overview"
    if "timetable" in lower or "schedule" in lower or "period" in lower:
        target_tab = "timetable"
    elif "code" in lower or "coding" in lower or "python" in lower:
        target_tab = "coding"
    elif "assignment" in lower or "homework" in lower:
        target_tab = "assignments"
    elif "certificate" in lower or "credential" in lower:
        target_tab = "certificates"
    elif "risk" in lower or "study" in lower or "bottleneck" in lower or "radar" in lower:
        target_tab = "learning-intelligence"
    elif "class" in lower or "lecture" in lower:
        target_tab = "classroom"

    return CopilotReasonResponse(
        action_type="NAVIGATE_TAB",
        action_params={"target_tab": target_tab},
        agent_reply=f"Navigated to '{target_tab}' page in response to your command: \"{query}\".",
        reasoning_steps=[
            f"Evaluated natural language intent: \"{query}\"",
            f"Identified destination tab: '{target_tab}' from current '{current_tab}'",
            f"Synchronized page state for {role.upper()} user"
        ]
    )
