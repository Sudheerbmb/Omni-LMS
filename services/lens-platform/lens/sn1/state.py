import uuid
from typing import Any, Dict, List, Optional, TypedDict


class SN1AgentState(TypedDict, total=False):
    """
    Section 28: LangGraph execution state schema for SN1 agent.
    """
    # Identifiers
    student_id: uuid.UUID
    course_id: uuid.UUID
    concept_id: uuid.UUID
    tenant_id: str
    student_name: str
    
    # Trigger Context (Section 30)
    trigger: str
    trigger_details: Dict[str, Any]
    
    # Grounded State from LENS-Ω
    learner_state: Dict[str, Any]
    bottleneck: str
    learning_mode: str
    
    # Candidate Interventions & Optimal Selection (Section 24, 26)
    candidate_interventions: List[Dict[str, Any]]
    selected_action: Optional[Dict[str, Any]]
    policy_validation: Dict[str, Any]
    
    # Plan & Execution (Section 27, 28)
    execution_plan: Dict[str, Any]
    tool_calls: List[Dict[str, Any]]
    output_message: str
    
    # Human-In-The-Loop & Escalations (Section 42, 53)
    requires_approval: bool
    escalation_alert: Optional[Dict[str, Any]]
    
    # Execution metadata
    step_history: List[str]
    error: Optional[str]
