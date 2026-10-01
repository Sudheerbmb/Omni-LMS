from typing import Any, Dict, List, Optional, Tuple
from lens.engine.future_state import predict_future_state


def calculate_utility(
    state: Dict[str, float],
    weights: Dict[str, float],
) -> float:
    """
    Section 26: State utility function
    U(S) = w_M * M + w_R * R + w_T * T + w_C * C - w_MS * MS - w_U * U
    """
    w_M = weights.get("w_M", 1.0)
    w_R = weights.get("w_R", 0.8)
    w_T = weights.get("w_T", 0.9)
    w_C = weights.get("w_C", 1.2)
    w_MS = weights.get("w_MS", 1.5)
    w_U = weights.get("w_U", 0.4)

    m = state.get("mastery", 0.0)
    r = state.get("retention", 0.0)
    t = state.get("transfer", 0.0)
    c = state.get("competency", 0.0)
    ms = state.get("misconception", 0.0)
    u = state.get("uncertainty", 0.0)

    utility = (w_M * m) + (w_R * r) + (w_T * t) + (w_C * c) - (w_MS * ms) - (w_U * u)
    return utility


def optimize_action(
    current_state: Dict[str, float],
    candidate_interventions: List[Dict[str, Any]],
    weights: Dict[str, float],
    constraints: Dict[str, Any],
    student_completed_concepts: Optional[List[str]] = None,
) -> Tuple[Optional[Dict[str, Any]], float, List[Dict[str, Any]]]:
    """
    Section 26: Policy optimization
    J(a) = E[U(S_{t+1}) | S_t, a] - lambda * Cost(a)
    a* = argmax_a J(a) subject to prerequisite and workload constraints.
    """
    lambda_cost = weights.get("cost_penalty_lambda", 0.15)
    current_utility = calculate_utility(current_state, weights)
    completed_concepts = set(student_completed_concepts or [])

    scored_candidates = []
    
    for item in candidate_interventions:
        # Constraint Validation
        prereqs = item.get("required_prerequisites", [])
        if constraints.get("enforce_prerequisites", True) and prereqs:
            missing = [p for p in prereqs if p not in completed_concepts]
            if missing:
                # Disqualify if prerequisites are not met
                continue

        # Predict future state
        future_state = predict_future_state(
            current_state=current_state,
            intervention_type=item.get("type", "PRACTICE"),
            intervention_difficulty=item.get("difficulty", 0.5),
            expected_gains=item.get("expected_dimensions", {}),
        )
        
        future_utility = calculate_utility(future_state, weights)
        utility_gain = future_utility - current_utility
        action_cost = item.get("cost", 1.0)
        
        j_score = future_utility - (lambda_cost * action_cost)
        
        scored_candidates.append({
            "intervention": item,
            "future_state": future_state,
            "future_utility": future_utility,
            "utility_gain": utility_gain,
            "j_score": j_score,
            "is_valid": True,
        })

    if not scored_candidates:
        return None, 0.0, []

    # Sort candidates by objective J(a) descending
    scored_candidates.sort(key=lambda x: x["j_score"], reverse=True)
    best = scored_candidates[0]
    return best["intervention"], best["j_score"], scored_candidates
