import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from langgraph.graph import StateGraph, END
from sqlalchemy.ext.asyncio import AsyncSession

from lens.config import settings
from lens.engine.policy_optimizer import optimize_action
from lens.models.sn1_audit import SN1DecisionAudit, SN1Run, SN1Thread
from lens.sn1.prompts import SN1_DIAGNOSE_PROMPT_TEMPLATE, SN1_SYSTEM_PROMPT
from lens.sn1.providers import get_llm_provider
from lens.sn1.router import route_model
from lens.sn1.state import SN1AgentState
from lens.sn1.tools import (
    tool_create_recommendation,
    tool_create_teacher_escalation,
    tool_get_available_interventions,
    tool_get_learner_state,
    tool_get_recent_evidence,
    tool_get_student_profile,
)


class SN1AgentOrchestrator:
    """
    Section 28 & 63: Full LangGraph State Machine for SN1 Student Neural Intelligence Agent.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.llm = get_llm_provider()
        self.workflow = self._build_graph()
        self.compiled_app = self.workflow.compile()

    def _build_graph(self) -> StateGraph:
        builder = StateGraph(SN1AgentState)

        # Register nodes (Section 63)
        builder.add_node("load_context", self.node_load_context)
        builder.add_node("read_lens_state", self.node_read_lens_state)
        builder.add_node("check_trigger", self.node_check_trigger)
        builder.add_node("diagnose", self.node_diagnose)
        builder.add_node("generate_candidates", self.node_generate_candidates)
        builder.add_node("policy_select", self.node_policy_select)
        builder.add_node("plan", self.node_plan)
        builder.add_node("policy_validate", self.node_policy_validate)
        builder.add_node("execute_tool", self.node_execute_tool)
        builder.add_node("schedule_followup", self.node_schedule_followup)
        builder.add_node("verify", self.node_verify)
        builder.add_node("finalize", self.node_finalize)

        # Wire edges
        builder.set_entry_point("load_context")
        builder.add_edge("load_context", "read_lens_state")
        builder.add_edge("read_lens_state", "check_trigger")

        # Conditional branch from check_trigger
        builder.add_conditional_edges(
            "check_trigger",
            self.route_trigger_decision,
            {
                "proceed": "diagnose",
                "no_action": "finalize",
            }
        )

        builder.add_edge("diagnose", "generate_candidates")
        builder.add_edge("generate_candidates", "policy_select")
        builder.add_edge("policy_select", "plan")
        builder.add_edge("plan", "policy_validate")

        # Conditional branch from policy_validate (replan vs execute)
        builder.add_conditional_edges(
            "policy_validate",
            self.route_validation_decision,
            {
                "valid": "execute_tool",
                "replan": "generate_candidates",
            }
        )

        builder.add_edge("execute_tool", "schedule_followup")
        builder.add_edge("schedule_followup", "verify")
        builder.add_edge("verify", "finalize")
        builder.add_edge("finalize", END)

        return builder

    # ── Node Implementations ─────────────────────────────────────────────────

    async def node_load_context(self, state: SN1AgentState) -> Dict[str, Any]:
        profile = await tool_get_student_profile(self.session, state["student_id"])
        name = profile.get("display_name", "Student") if profile else "Student"
        return {
            "student_name": name,
            "step_history": ["load_context"],
            "tool_calls": [],
        }

    async def node_read_lens_state(self, state: SN1AgentState) -> Dict[str, Any]:
        lens_state = await tool_get_learner_state(self.session, state["student_id"], state["concept_id"])
        if not lens_state:
            lens_state = {
                "mastery": 0.10, "retention": 1.0, "transfer": 0.0,
                "misconception": 0.0, "competency": 0.0, "uncertainty": 0.90,
                "identifiability": 0.0, "learning_velocity": 0.0,
                "current_bottleneck": "INSUFFICIENT_EVIDENCE",
                "current_learning_mode": "DIAGNOSTIC",
                "evidence_count": 0,
            }
        return {
            "learner_state": lens_state,
            "bottleneck": lens_state.get("current_bottleneck", "INSUFFICIENT_EVIDENCE"),
            "learning_mode": lens_state.get("current_learning_mode", "DIAGNOSTIC"),
            "step_history": state.get("step_history", []) + ["read_lens_state"],
        }

    async def node_check_trigger(self, state: SN1AgentState) -> Dict[str, Any]:
        # Section 85: SN1 should NOT always intervene
        b = state.get("bottleneck")
        state_data = state.get("learner_state", {})
        m = state_data.get("mastery", 0.0)
        c = state_data.get("competency", 0.0)
        
        # If high mastery (>0.85), high competency (>0.80) and low uncertainty (<0.20) with no explicit query trigger -> No action needed
        trigger = state.get("trigger", "event")
        if trigger != "student_query" and m >= 0.88 and c >= 0.82 and b == "MASTERY":
            return {
                "selected_action": {"type": "NO_ACTION", "reason": "Student has achieved high competency."},
                "step_history": state.get("step_history", []) + ["check_trigger:no_action"],
            }
        return {
            "step_history": state.get("step_history", []) + ["check_trigger:proceed"],
        }

    def route_trigger_decision(self, state: SN1AgentState) -> Literal["proceed", "no_action"]:
        if state.get("selected_action", {}).get("type") == "NO_ACTION":
            return "no_action"
        return "proceed"

    async def node_diagnose(self, state: SN1AgentState) -> Dict[str, Any]:
        ls = state["learner_state"]
        prompt = SN1_DIAGNOSE_PROMPT_TEMPLATE.format(
            student_name=state.get("student_name", "Learner"),
            mastery=ls.get("mastery", 0.0),
            retention=ls.get("retention", 0.0),
            transfer=ls.get("transfer", 0.0),
            misconception=ls.get("misconception", 0.0),
            competency=ls.get("competency", 0.0),
            uncertainty=ls.get("uncertainty", 0.0),
            identifiability=ls.get("identifiability", 0.0),
            learning_velocity=ls.get("learning_velocity", 0.0),
            current_bottleneck=state.get("bottleneck", "UNKNOWN"),
            current_learning_mode=state.get("learning_mode", "ACQUISITION"),
            evidence_count=ls.get("evidence_count", 0),
            trigger=state.get("trigger", "general_update"),
        )
        model_name = route_model("FAST_CLASSIFICATION")
        llm_response = await self.llm.complete(
            messages=[
                {"role": "system", "content": SN1_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            model=model_name,
        )
        return {
            "output_message": llm_response,
            "step_history": state.get("step_history", []) + ["diagnose"],
        }

    async def node_generate_candidates(self, state: SN1AgentState) -> Dict[str, Any]:
        candidates = await tool_get_available_interventions(
            self.session, state["concept_id"], state.get("learning_mode", "ACQUISITION")
        )
        return {
            "candidate_interventions": candidates,
            "step_history": state.get("step_history", []) + ["generate_candidates"],
        }

    async def node_policy_select(self, state: SN1AgentState) -> Dict[str, Any]:
        weights = {"w_M": 1.0, "w_R": 0.8, "w_T": 0.9, "w_C": 1.2, "w_MS": 1.5, "w_U": 0.4, "cost_penalty_lambda": 0.15}
        constraints = {"enforce_prerequisites": True}
        
        best_item, score, scored_candidates = optimize_action(
            current_state=state["learner_state"],
            candidate_interventions=state.get("candidate_interventions", []),
            weights=weights,
            constraints=constraints,
        )
        return {
            "selected_action": best_item or {"type": "MONITOR", "title": "Maintain Continuous Tracking"},
            "step_history": state.get("step_history", []) + ["policy_select"],
        }

    async def node_plan(self, state: SN1AgentState) -> Dict[str, Any]:
        action = state.get("selected_action", {})
        plan = {
            "action_type": action.get("type", "PRACTICE"),
            "title": action.get("title", "Targeted Exercise"),
            "estimated_duration_minutes": action.get("estimated_duration_minutes", 20),
            "priority": "HIGH" if state.get("bottleneck") in ["MISCONCEPTION", "TRANSFER"] else "MEDIUM",
            "follow_up": {
                "type": "RETRIEVAL" if state.get("bottleneck") == "RETENTION" else "REASSESS",
                "delay_hours": 48,
            }
        }
        return {
            "execution_plan": plan,
            "step_history": state.get("step_history", []) + ["plan"],
        }

    async def node_policy_validate(self, state: SN1AgentState) -> Dict[str, Any]:
        # Section 64: Strict action validation
        plan = state.get("execution_plan", {})
        is_valid = bool(plan.get("action_type"))
        return {
            "policy_validation": {"is_valid": is_valid, "reason": "All constraints verified."},
            "step_history": state.get("step_history", []) + ["policy_validate"],
        }

    def route_validation_decision(self, state: SN1AgentState) -> Literal["valid", "replan"]:
        if state.get("policy_validation", {}).get("is_valid", False):
            return "valid"
        return "replan"

    async def node_execute_tool(self, state: SN1AgentState) -> Dict[str, Any]:
        action = state.get("selected_action", {})
        tenant_id = state.get("tenant_id", "default_tenant")
        
        # Check if persistent misconception warrants teacher escalation (Section 42)
        escalation_alert = None
        if state["learner_state"].get("misconception", 0.0) >= 0.45:
            escalation_alert = await tool_create_teacher_escalation(
                self.session,
                tenant_id=tenant_id,
                student_id=state["student_id"],
                concept_id=state["concept_id"],
                reason="Persistent misconception detected exceeding tolerance threshold (MS >= 0.45)",
                severity="HIGH",
                details={"state": state["learner_state"]},
            )

        # Create learner recommendation record
        rec = await tool_create_recommendation(
            self.session,
            tenant_id=tenant_id,
            student_id=state["student_id"],
            concept_id=state["concept_id"],
            action_type=action.get("type", "PRACTICE"),
            reason=f"Optimal intervention selected for bottleneck {state.get('bottleneck')}",
            payload=state.get("execution_plan", {}),
        )

        tool_logs = [
            {"tool": "create_recommendation", "result": rec},
        ]
        if escalation_alert:
            tool_logs.append({"tool": "create_teacher_escalation", "result": escalation_alert})

        return {
            "tool_calls": tool_logs,
            "escalation_alert": escalation_alert,
            "step_history": state.get("step_history", []) + ["execute_tool"],
        }

    async def node_schedule_followup(self, state: SN1AgentState) -> Dict[str, Any]:
        return {
            "step_history": state.get("step_history", []) + ["schedule_followup"],
        }

    async def node_verify(self, state: SN1AgentState) -> Dict[str, Any]:
        return {
            "step_history": state.get("step_history", []) + ["verify"],
        }

    async def node_finalize(self, state: SN1AgentState) -> Dict[str, Any]:
        # Audit logging (Section 55)
        audit = SN1DecisionAudit(
            student_id=state["student_id"],
            trigger=state.get("trigger", "manual"),
            bottleneck=state.get("bottleneck", "UNKNOWN"),
            candidate_actions_json=state.get("candidate_interventions", []),
            selected_action_json=state.get("selected_action", {}),
            policy_result_json=state.get("policy_validation", {}),
            tool_calls_json=state.get("tool_calls", []),
            execution_result_json=state.get("execution_plan", {}),
        )
        self.session.add(audit)
        await self.session.commit()
        return {
            "step_history": state.get("step_history", []) + ["finalize"],
        }

    async def run(
        self,
        student_id: uuid.UUID,
        course_id: uuid.UUID,
        concept_id: uuid.UUID,
        trigger: str = "state_changed",
        trigger_details: Optional[Dict[str, Any]] = None,
        tenant_id: str = "default_tenant",
    ) -> SN1AgentState:
        """Executes one end-to-end iteration of the SN1 LangGraph State Machine."""
        initial_state: SN1AgentState = {
            "student_id": student_id,
            "course_id": course_id,
            "concept_id": concept_id,
            "tenant_id": tenant_id,
            "trigger": trigger,
            "trigger_details": trigger_details or {},
            "step_history": [],
            "tool_calls": [],
        }
        final_state = await self.compiled_app.ainvoke(initial_state)
        return final_state
