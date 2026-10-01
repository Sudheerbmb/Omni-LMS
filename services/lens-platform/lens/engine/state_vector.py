import math
from datetime import datetime, timezone
from typing import List, Optional, Set


REQUIRED_EVIDENCE_FAMILY: Set[str] = {
    "DIAGNOSTIC",
    "BENCHMARK",
    "QUIZ",
    "PRACTICE",
    "ASSIGNMENT",
    "CODING",
    "EXAM",
    "RETRIEVAL",
    "TRANSFER"
}


def clamp(val: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    return max(min_val, min(max_val, float(val)))


def calculate_mastery(
    previous_mastery: float,
    observed_performance: float,
    evidence_type: str = "QUIZ",
    difficulty: float = 0.50,
) -> float:
    """
    Section 14: Bayesian / logistic update estimator
    M_{t+1} = M_t + alpha_t * (y_t - M_t)
    where alpha_t is calibrated based on evidence validity and difficulty.
    """
    # Dynamic alpha weighting by evidence type
    type_weights = {
        "DIAGNOSTIC": 0.35,
        "BENCHMARK": 0.30,
        "EXAM": 0.30,
        "QUIZ": 0.20,
        "ASSIGNMENT": 0.15,
        "PRACTICE": 0.12,
        "CODING": 0.18,
        "RETRIEVAL": 0.15,
        "TRANSFER": 0.20,
        "REASSESSMENT": 0.25,
    }
    base_alpha = type_weights.get(evidence_type.upper(), 0.15)
    # Difficulty adjustment: succeeding on difficult items gives higher boost
    alpha_t = base_alpha * (0.8 + 0.4 * difficulty)
    
    y_t = clamp(observed_performance)
    m_next = previous_mastery + alpha_t * (y_t - previous_mastery)
    return clamp(m_next)


def calculate_retention(
    r_0: float,
    last_event_time: Optional[datetime],
    current_time: Optional[datetime] = None,
    lambda_param: float = 0.05,
) -> float:
    """
    Section 15: Ebbinghaus forgetting model
    R(t) = R_0 * exp(-lambda * t)
    where t is elapsed time in days.
    """
    if not last_event_time:
        return clamp(r_0)
    
    now = current_time or datetime.now(timezone.utc)
    if last_event_time.tzinfo is None:
        last_event_time = last_event_time.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
        
    delta_seconds = max(0.0, (now - last_event_time).total_seconds())
    delta_days = delta_seconds / 86400.0
    
    r_t = r_0 * math.exp(-lambda_param * delta_days)
    return clamp(r_t)


def calculate_transfer(
    previous_transfer: float,
    observed_transfer_score: float,
    alpha: float = 0.25,
) -> float:
    """
    Section 16, 17: Transfer learning estimator across varying contexts
    T_{t+1} = alpha * T_obs + (1 - alpha) * T_t
    """
    t_obs = clamp(observed_transfer_score)
    t_next = alpha * t_obs + (1.0 - alpha) * previous_transfer
    return clamp(t_next)


def calculate_misconception(
    previous_misconception: float,
    misconception_detected: bool,
    decay: float = 0.85,
    penalty: float = 0.35,
) -> float:
    """
    Section 17: Aggregates repeated error patterns into misconception score
    """
    if misconception_detected:
        ms_next = previous_misconception + penalty * (1.0 - previous_misconception)
    else:
        ms_next = previous_misconception * decay
    return clamp(ms_next)


def calculate_competency(
    mastery: float,
    retention: float,
    transfer: float,
    misconception: float,
) -> float:
    """
    Section 20: Holistic competency baseline
    C = [M * R * T * (1 - MS)]^(1/4)
    """
    m = clamp(mastery)
    r = clamp(retention)
    # Ensure transfer has non-zero floor for initialization
    t = max(0.05, clamp(transfer))
    clean_ms = max(0.0, 1.0 - clamp(misconception))
    
    product = m * r * t * clean_ms
    c = math.pow(max(0.0, product), 0.25)
    return clamp(c)


def calculate_uncertainty(
    evidence_count: int,
    observed_types: List[str],
    recent_variance: float = 0.0,
) -> float:
    """
    Section 18: Epistemic uncertainty model
    Increases when evidence is sparse or contradictory; decreases when evidence is rich and diverse.
    """
    # 1. Density factor: 1 / sqrt(1 + N)
    density_factor = 1.0 / math.sqrt(1.0 + evidence_count)
    
    # 2. Diversity factor
    unique_types = len(set(observed_types))
    diversity_factor = max(0.1, 1.0 - (unique_types / max(1, len(REQUIRED_EVIDENCE_FAMILY))))
    
    # 3. Disagreement / variance penalty
    variance_penalty = clamp(recent_variance) * 0.4
    
    u = 0.5 * density_factor + 0.3 * diversity_factor + variance_penalty
    return clamp(u, min_val=0.05, max_val=0.95)


def calculate_identifiability(
    observed_types: List[str],
    required_family: Optional[Set[str]] = None,
) -> float:
    """
    Section 19: Identifiability metric
    I = observed_required_evidence_types / required_evidence_types
    """
    target_family = required_family or REQUIRED_EVIDENCE_FAMILY
    present_types = set(t.upper() for t in observed_types).intersection(target_family)
    i_score = len(present_types) / max(1, len(target_family))
    return clamp(i_score)


def calculate_learning_velocity(
    state_history: List[dict],
) -> float:
    """
    Section 21: Longitudinal learning velocity
    V = Delta(M, C, T) / Delta(t)
    """
    if not state_history or len(state_history) < 2:
        return 0.0
    
    # Sort history chronologically
    first = state_history[0]
    latest = state_history[-1]
    
    delta_score = (
        (latest.get("mastery", 0.0) - first.get("mastery", 0.0)) * 0.4 +
        (latest.get("competency", 0.0) - first.get("competency", 0.0)) * 0.4 +
        (latest.get("transfer", 0.0) - first.get("transfer", 0.0)) * 0.2
    )
    
    t_start = first.get("timestamp")
    t_end = latest.get("timestamp")
    if t_start and t_end:
        if isinstance(t_start, str):
            t_start = datetime.fromisoformat(t_start)
        if isinstance(t_end, str):
            t_end = datetime.fromisoformat(t_end)
        days = max(1.0, (t_end - t_start).total_seconds() / 86400.0)
    else:
        days = max(1.0, len(state_history) * 1.0)
        
    v = delta_score / days
    # Clamp velocity in reasonable range [-1.0, 1.0]
    return max(-1.0, min(1.0, v))
