import json
import os
from typing import Any, Dict, List, Optional
from app.platform.config import settings

GROQ_KEY = settings.groq_api_key or os.getenv("GROQ_API_KEY")


async def call_groq_llm(messages: List[Dict[str, str]], model: str = "llama-3.3-70b-versatile", json_mode: bool = False) -> str:
    """Invokes Groq Cloud LPU with ultra-low latency."""
    if not GROQ_KEY:
        # Fallback to local intelligence if key is missing
        return ""
    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=GROQ_KEY)
        params: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": 0.2,
        }
        if json_mode:
            params["response_format"] = {"type": "json_object"}
        resp = await client.chat.completions.create(**params)
        return resp.choices[0].message.content or ""
    except Exception as err:
        print(f"Groq API error: {err}")
        return ""


async def generate_dynamic_diagnostic_questions(
    grade_name: str,
    subjects: List[str],
    num_questions: int = 6,
) -> List[Dict[str, Any]]:
    """
    Section 12 & 13: Dynamic AI Generation of Multi-dimensional Diagnostic Items
    Strictly grounded in student's grade and enrolled curriculum standards.
    """
    prompt = f"""You are an expert psychometric assessment designer for primary and secondary education.
Generate a dynamic {num_questions}-question baseline diagnostic assessment for a student in **{grade_name}**.

The assessment MUST cover these enrolled subjects: {', '.join(subjects)}.

Return ONLY a JSON object with a key "questions" containing a list of {num_questions} questions formatted exactly as follows:
{{
  "questions": [
    {{
      "id": "q1",
      "subject": "{subjects[0]}",
      "concept": "Core Concept Name",
      "prompt": "Clear, age-appropriate question prompt for {grade_name}",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "difficulty": 0.45,
      "cognitive_level": "FOUNDATION",
      "misconception_tag": "common_misconception_if_failed"
    }}
  ]
}}

Requirements:
1. Ensure questions strictly match {grade_name} standard curriculum (e.g. Class 4 for grade 4, Class 10 for grade 10).
2. Exactly 4 options per question with 1 unambiguous correct answer.
3. Vary cognitive levels across FOUNDATION, APPLICATION, REASONING.
"""
    response_text = await call_groq_llm(
        messages=[
            {"role": "system", "content": "You are a specialized curriculum psychometric test generator. Output valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        model="llama-3.3-70b-versatile",
        json_mode=True,
    )

    if response_text:
        try:
            data = json.loads(response_text)
            if "questions" in data and isinstance(data["questions"], list) and len(data["questions"]) > 0:
                return data["questions"]
        except Exception as e:
            print(f"JSON parsing error: {e}")

    # High-fidelity grade-aligned fallback if network is unreachable
    if "4" in grade_name or "5" in grade_name:
        return [
            {
                "id": "q1",
                "subject": "Mathematics",
                "concept": "Multi-digit Arithmetic",
                "prompt": "What is the product of 34 × 12?",
                "options": ["398", "408", "418", "428"],
                "correct_index": 1,
                "difficulty": 0.40,
                "cognitive_level": "FOUNDATION",
            },
            {
                "id": "q2",
                "subject": "Science (EVS)",
                "concept": "Plant Photosynthesis",
                "prompt": "What gas do green plants absorb from the air during photosynthesis?",
                "options": ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
                "correct_index": 1,
                "difficulty": 0.35,
                "cognitive_level": "FOUNDATION",
            },
            {
                "id": "q3",
                "subject": "Mathematics",
                "concept": "Fractions",
                "prompt": "Which fraction is larger: 3/5 or 2/5?",
                "options": ["2/5", "3/5", "They are equal", "Cannot be compared"],
                "correct_index": 1,
                "difficulty": 0.45,
                "cognitive_level": "APPLICATION",
            },
            {
                "id": "q4",
                "subject": "English Grammar",
                "concept": "Parts of Speech",
                "prompt": "Which word is a verb in: 'The children played happily in the garden.'?",
                "options": ["Children", "Played", "Happily", "Garden"],
                "correct_index": 1,
                "difficulty": 0.30,
                "cognitive_level": "FOUNDATION",
            },
            {
                "id": "q5",
                "subject": "Science (EVS)",
                "concept": "States of Matter",
                "prompt": "When water freezes into ice, it changes from a:",
                "options": ["Liquid to a Solid", "Solid to a Gas", "Gas to a Liquid", "Liquid to a Gas"],
                "correct_index": 0,
                "difficulty": 0.30,
                "cognitive_level": "APPLICATION",
            },
            {
                "id": "q6",
                "subject": "Social Studies",
                "concept": "Maps & Directions",
                "prompt": "If you face the rising sun in the morning, which direction is to your left?",
                "options": ["West", "South", "North", "East"],
                "correct_index": 2,
                "difficulty": 0.50,
                "cognitive_level": "REASONING",
            },
        ]
    else:
        return [
            {
                "id": "q1",
                "subject": "Mathematics",
                "concept": "Quadratic Equations",
                "prompt": "What are the roots of the quadratic equation x² - 5x + 6 = 0?",
                "options": ["x = 2, 3", "x = -2, -3", "x = 1, 6", "x = -1, -6"],
                "correct_index": 0,
                "difficulty": 0.45,
                "cognitive_level": "APPLICATION",
            },
            {
                "id": "q2",
                "subject": "Physics & Chemistry",
                "concept": "Chemical Equations",
                "prompt": "In the reaction 2H₂ + O₂ → 2H₂O, the ratio of hydrogen to oxygen molecules is:",
                "options": ["1:1", "2:1", "1:2", "2:2"],
                "correct_index": 1,
                "difficulty": 0.40,
                "cognitive_level": "FOUNDATION",
            },
            {
                "id": "q3",
                "subject": "Physics & Chemistry",
                "concept": "Refraction of Light",
                "prompt": "The ratio of the speed of light in a vacuum to the speed of light in a medium is called:",
                "options": ["Refractive Index", "Focal Length", "Power of Lens", "Dispersion Index"],
                "correct_index": 0,
                "difficulty": 0.50,
                "cognitive_level": "FOUNDATION",
            },
            {
                "id": "q4",
                "subject": "Life Sciences",
                "concept": "Cellular Respiration",
                "prompt": "The first step of glucose breakdown occurring in the cytoplasm without oxygen is:",
                "options": ["Krebs Cycle", "Glycolysis", "Electron Transport", "Fermentation"],
                "correct_index": 1,
                "difficulty": 0.55,
                "cognitive_level": "REASONING",
            },
            {
                "id": "q5",
                "subject": "Mathematics",
                "concept": "Trigonometry",
                "prompt": "If tan(θ) = 1, what is the value of θ for 0° < θ < 90°?",
                "options": ["30°", "45°", "60°", "90°"],
                "correct_index": 1,
                "difficulty": 0.35,
                "cognitive_level": "FOUNDATION",
            },
            {
                "id": "q6",
                "subject": "Social Science",
                "concept": "Democratic Politics",
                "prompt": "Power sharing between different levels of government (Central, State, Local) is known as:",
                "options": ["Horizontal Division", "Vertical Division", "Community Government", "Coalition Power"],
                "correct_index": 1,
                "difficulty": 0.45,
                "cognitive_level": "APPLICATION",
            },
        ]


async def generate_sn1_chat_response(
    student_name: str,
    grade_name: str,
    subjects: List[str],
    state_vector: Dict[str, Any],
    user_message: str,
) -> str:
    """
    Section 84 & 39: SN1 Grounded Agent Reasoning using Groq LLM
    """
    is_calibrated = state_vector.get("is_calibrated", False)
    
    system_prompt = f"""You are SN1, the autonomous Student Neural Intelligence agent operating on top of the LENS-Ω engine.
You are assisting {student_name}, enrolled in {grade_name} studying {', '.join(subjects)}.

Strict Operational Directives:
1. Ground every statement strictly in the provided mathematical state vector S_t.
2. If the student has zero diagnostic baseline evidence (is_calibrated=False), explain that uncertainty is 95% and encourage taking the baseline diagnostic.
3. If calibrated, explain the student's active bottleneck ({state_vector.get('current_bottleneck')}) and provide actionable, encouraging guidance.
4. Keep answers concise, clear, and age-appropriate for {grade_name}.
"""
    state_context = f"""
Student Name: {student_name}
Grade / Enrolled Curriculum: {grade_name}
Subjects: {', '.join(subjects)}
Calibrated: {is_calibrated}
Mastery (M): {state_vector.get('mastery', 0.0):.1%}
Retention (R): {state_vector.get('retention', 0.0):.1%}
Transfer (T): {state_vector.get('transfer', 0.0):.1%}
Misconception (MS): {state_vector.get('misconception', 0.0):.1%}
Holistic Competency (C): {state_vector.get('competency', 0.0):.1%}
Epistemic Uncertainty (U): {state_vector.get('uncertainty', 0.95):.1%}
Identifiability (I): {state_vector.get('identifiability', 0.0):.1%}
Active Bottleneck: {state_vector.get('current_bottleneck', 'INSUFFICIENT_EVIDENCE')}
Learning Mode: {state_vector.get('current_learning_mode', 'DIAGNOSTIC')}
"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"State Vector Data:\n{state_context}\n\nStudent Question: \"{user_message}\""}
    ]

    llm_resp = await call_groq_llm(messages, model="llama-3.3-70b-versatile")
    if llm_resp:
        return llm_resp
    
    # Fallback explanation
    if not is_calibrated:
        return (
            f"Hello {student_name}! Because you have zero diagnostic evidence in {grade_name} yet, "
            f"my epistemic uncertainty is at 95%. Taking the diagnostic assessment will calibrate your true learning curve."
        )
    return (
        f"Based on your {grade_name} state vector (Competency: {state_vector.get('competency', 0.0):.0%}, "
        f"Bottleneck: {state_vector.get('current_bottleneck')}), I recommend completing your scheduled practice."
    )
