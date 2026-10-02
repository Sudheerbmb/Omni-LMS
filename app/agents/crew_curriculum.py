"""
CrewAI Multi-Agent Curriculum Generation Studio
Powered by Groq Cloud LPU (qwen/qwen3.8-27b / openai/gpt-oss-120b).
Hierarchical collaborative team:
  - Agent 1: Dr. Alistair Finch (Senior Subject Matter Specialist)
  - Agent 2: Dr. Evelyn Vance (Cognitive Psychometrician)
  - Agent 3: Marcus Chen (Instructional Designer & Rubric Architect)
"""
import json
import os
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel
from app.platform.config import settings

class CrewCurriculumRequest(BaseModel):
    topic: str
    grade_level: str
    target_learning_goals: List[str] = []

class CrewAgentContribution(BaseModel):
    agent_name: str
    agent_role: str
    avatar_color: str
    reasoning: str
    output_deliverable: Dict[str, Any]

class CrewCurriculumResponse(BaseModel):
    curriculum_title: str
    grade_level: str
    agent_contributions: List[CrewAgentContribution]
    synthesized_course_structure: Dict[str, Any]

async def call_groq_llm_for_crew(messages: List[Dict[str, str]]) -> Optional[str]:
    """Invokes Groq Cloud LPU API with high-speed inference."""
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
            "temperature": 0.3,
            "max_tokens": 1500,
            "response_format": {"type": "json_object"}
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    print(f"[Groq Crew Retry] Model {model_name} HTTP {res.status_code}: {res.text[:100]}")
        except Exception as err:
            print(f"[Groq Crew Call Exception with {model_name}]: {err}")

    return None

async def run_crew_curriculum_designer(req: CrewCurriculumRequest) -> CrewCurriculumResponse:
    topic = req.topic.strip() or "Calculus & Optimization"
    grade = req.grade_level.strip() or "Class 10"

    groq_crew_prompt = [
        {
            "role": "system",
            "content": (
                "You simulate CrewAI hierarchical curriculum design with 3 specialized AI agents collaborating in sequence:\n"
                "1. Dr. Alistair Finch (Senior Subject Matter Specialist): Decomposes the topic into 3 distinct modules and lists prerequisite knowledge.\n"
                "2. Dr. Evelyn Vance (Cognitive Psychometrician): Calibrates cognitive load, assigns Bloom taxonomy objectives ('Remember', 'Analyze', 'Evaluate'), and calculates Bayesian mastery prior.\n"
                "3. Marcus Chen (Instructional Designer & Rubric Architect): Structures assessment distribution weights and designs a hands-on Python coding challenge.\n\n"
                "Return STRICT JSON with keys:\n"
                "{\n"
                "  \"curriculum_title\": \"Full curriculum title\",\n"
                "  \"sme_reasoning\": \"Finch's pedagogical rationale\",\n"
                "  \"modules\": [{\"title\": \"Module 1: ...\", \"hours\": 4}, {\"title\": \"Module 2: ...\", \"hours\": 6}, {\"title\": \"Module 3: ...\", \"hours\": 5}],\n"
                "  \"prerequisites\": [\"Prereq 1\", \"Prereq 2\"],\n"
                "  \"psych_reasoning\": \"Vance's cognitive load analysis\",\n"
                "  \"bloom_targets\": {\"Remember\": \"...\", \"Analyze\": \"...\", \"Evaluate\": \"...\"},\n"
                "  \"bayesian_prior\": 0.35,\n"
                "  \"designer_reasoning\": \"Chen's rubric and lab design rationale\",\n"
                "  \"assessments\": [{\"type\": \"Diagnostic Benchmark\", \"weight\": \"20%\"}, {\"type\": \"Lab Project\", \"weight\": \"40%\"}, {\"type\": \"Oral Defense Viva\", \"weight\": \"40%\"}],\n"
                "  \"coding_lab\": \"Detailed Python coding lab exercise prompt\",\n"
                "  \"total_hours\": 15\n"
                "}"
            )
        },
        {
            "role": "user",
            "content": f"Topic: {topic}\nTarget Grade: {grade}\nAssemble the crew and synthesize the comprehensive curriculum."
        }
    ]

    groq_raw = await call_groq_llm_for_crew(groq_crew_prompt)

    if groq_raw:
        try:
            p = json.loads(groq_raw)
            title = p.get("curriculum_title", f"{grade}: Advanced {topic} Mastery Curriculum")
            modules = p.get("modules", [
                {"title": f"Module 1: Foundations of {topic}", "hours": 4},
                {"title": f"Module 2: Theorems and Analytical Derivations", "hours": 6},
                {"title": f"Module 3: Edge Cases and Real-World Applications", "hours": 5}
            ])
            prereqs = p.get("prerequisites", [f"Core axioms of {topic}", "Mathematical notation"])
            sme_reasoning = p.get("sme_reasoning", f"Decomposed '{topic}' for {grade} into sequential competency milestones.")
            
            bloom = p.get("bloom_targets", {
                "Remember": f"Core definitions and theorems in {topic}",
                "Analyze": "Step-by-step problem sets and proofs",
                "Evaluate": "Error debugging and parameter optimization"
            })
            psych_reasoning = p.get("psych_reasoning", "Calibrated cognitive load to prevent transfer deficit and optimized Bayesian retention half-life.")
            bayesian_prior = float(p.get("bayesian_prior", 0.35))
            
            assessments = p.get("assessments", [
                {"type": "Diagnostic Benchmark", "weight": "20%"},
                {"type": "Laboratory Synthesis Project", "weight": "40%"},
                {"type": "Oral Defense Viva", "weight": "40%"}
            ])
            designer_reasoning = p.get("designer_reasoning", "Structured rubric criteria with automated evaluation harnesses.")
            coding_lab = p.get("coding_lab", f"Implement an algorithmic solver for {topic} in Python 3.")
            total_hours = int(p.get("total_hours", sum(m.get("hours", 4) for m in modules)))

            sme = CrewAgentContribution(
                agent_name="Dr. Alistair Finch",
                agent_role="Senior Subject Matter Specialist",
                avatar_color="from-cyan-500 to-blue-600",
                reasoning=sme_reasoning,
                output_deliverable={
                    "core_prerequisites": prereqs,
                    "key_modules": modules
                }
            )

            psych = CrewAgentContribution(
                agent_name="Dr. Evelyn Vance",
                agent_role="Cognitive Psychometrician",
                avatar_color="from-purple-500 to-indigo-600",
                reasoning=psych_reasoning,
                output_deliverable={
                    "bloom_taxonomy_targets": bloom,
                    "bayesian_prior": bayesian_prior,
                    "estimated_uncertainty": 0.20
                }
            )

            designer = CrewAgentContribution(
                agent_name="Marcus Chen",
                agent_role="Instructional Designer & Rubric Architect",
                avatar_color="from-emerald-500 to-teal-600",
                reasoning=designer_reasoning,
                output_deliverable={
                    "assessments": assessments,
                    "recommended_coding_lab": coding_lab
                }
            )

            return CrewCurriculumResponse(
                curriculum_title=title,
                grade_level=grade,
                agent_contributions=[sme, psych, designer],
                synthesized_course_structure={
                    "title": title,
                    "modules_count": len(modules),
                    "total_hours": total_hours,
                    "learning_outcomes": [
                        f"Master theoretical principles of {topic}",
                        "Derive and verify foundational equations",
                        "Implement numerical algorithmic models in Python"
                    ]
                }
            )
        except Exception as err:
            print(f"[Groq Crew JSON Parse Error]: {err}")

    # Fallback simulation
    sme = CrewAgentContribution(
        agent_name="Dr. Alistair Finch",
        agent_role="Senior Subject Matter Specialist",
        avatar_color="from-cyan-500 to-blue-600",
        reasoning=f"Decomposed '{topic}' for {grade} into foundational, intermediate, and advanced dependency milestones.",
        output_deliverable={
            "core_prerequisites": [f"Basic principles of {topic}", "Symbolic algebraic notation"],
            "key_modules": [
                {"title": f"Module 1: Foundations of {topic}", "hours": 4},
                {"title": f"Module 2: Analytical Methods & Theorems", "hours": 6},
                {"title": f"Module 3: Real-World Applications & Edge Cases", "hours": 5}
            ]
        }
    )

    psych = CrewAgentContribution(
        agent_name="Dr. Evelyn Vance",
        agent_role="Cognitive Psychometrician",
        avatar_color="from-purple-500 to-indigo-600",
        reasoning="Calibrated cognitive load across Bloom taxonomy levels to prevent conceptual transfer deficit.",
        output_deliverable={
            "bloom_taxonomy_targets": {
                "Remember": f"Definitions, formulas, and foundational axioms of {topic}",
                "Analyze": "Step-by-step mathematical derivations",
                "Evaluate": "Diagnostic error debugging in problem sets"
            },
            "bayesian_prior": 0.35,
            "estimated_uncertainty": 0.20
        }
    )

    designer = CrewAgentContribution(
        agent_name="Marcus Chen",
        agent_role="Instructional Designer & Rubric Architect",
        avatar_color="from-emerald-500 to-teal-600",
        reasoning="Formulated interactive coding exercises and assessment rubric criteria with automated test harnesses.",
        output_deliverable={
            "assessments": [
                {"type": "Diagnostic Benchmark", "weight": "20%"},
                {"type": "Laboratory Synthesis Project", "weight": "40%"},
                {"type": "Oral Defense Viva", "weight": "40%"}
            ],
            "recommended_coding_lab": f"Implement a simulated numerical solver for {topic} in Python 3."
        }
    )

    return CrewCurriculumResponse(
        curriculum_title=f"{grade}: Advanced {topic} Mastery Curriculum",
        grade_level=grade,
        agent_contributions=[sme, psych, designer],
        synthesized_course_structure={
            "title": f"{grade}: Advanced {topic} Comprehensive Program",
            "modules_count": 3,
            "total_hours": 15,
            "learning_outcomes": [
                f"Explain theoretical mechanics of {topic}",
                "Formulate and verify formal derivations",
                "Synthesize algorithmic models and pass peer oral viva"
            ]
        }
    )
