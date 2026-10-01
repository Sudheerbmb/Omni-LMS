from typing import Optional
from lens.config import settings


def route_model(task_category: str) -> str:
    """
    Section 49: Task-specific model routing
    FAST_CLASSIFICATION -> llama-3.1-8b-instant
    PLANNING -> llama-3.3-70b-versatile
    STUDENT_CHAT -> llama-3.3-70b-versatile
    COMPLEX_REASONING -> llama-3.3-70b-versatile
    """
    task = task_category.upper()
    if task == "FAST_CLASSIFICATION":
        return settings.fast_classification_model
    elif task == "PLANNING":
        return settings.planning_model
    elif task == "STUDENT_CHAT":
        return settings.student_chat_model
    elif task == "COMPLEX_REASONING":
        return settings.complex_reasoning_model
    return settings.student_chat_model
