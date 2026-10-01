import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple


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
    Section 14: Bayesian / logistic state update
    M_{t+1} = M_t + alpha_t * (y_t - M_t)
    """
    type_weights = {
        "DIAGNOSTIC": 0.40,
        "BENCHMARK": 0.35,
        "EXAM": 0.30,
        "QUIZ": 0.22,
        "ASSIGNMENT": 0.18,
        "PRACTICE": 0.15,
        "CODING": 0.20,
        "RETRIEVAL": 0.18,
        "TRANSFER": 0.25,
        "REASSESSMENT": 0.30,
    }
    base_alpha = type_weights.get(evidence_type.upper(), 0.18)
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
    Section 16: Cross-context transfer estimator
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
    Section 18: Epistemic uncertainty
    """
    if evidence_count == 0:
        return 0.95
    density_factor = 1.0 / math.sqrt(1.0 + evidence_count)
    unique_types = len(set(observed_types))
    diversity_factor = max(0.1, 1.0 - (unique_types / max(1, len(REQUIRED_EVIDENCE_FAMILY))))
    variance_penalty = clamp(recent_variance) * 0.4
    u = 0.5 * density_factor + 0.3 * diversity_factor + variance_penalty
    return clamp(u, min_val=0.05, max_val=0.95)


def calculate_identifiability(observed_types: List[str]) -> float:
    """
    Section 19: Identifiability metric
    """
    if not observed_types:
        return 0.0
    present = set(t.upper() for t in observed_types).intersection(REQUIRED_EVIDENCE_FAMILY)
    return clamp(len(present) / len(REQUIRED_EVIDENCE_FAMILY))


def detect_bottleneck(
    mastery: float,
    retention: float,
    transfer: float,
    misconception: float,
    uncertainty: float,
    identifiability: float,
) -> Tuple[str, str]:
    """
    Section 22 & 23: Deterministic bottleneck classifier and mode resolver
    """
    if identifiability < 0.50 or uncertainty >= 0.70:
        return "INSUFFICIENT_EVIDENCE", "DIAGNOSTIC"
    
    weighted_scores = {
        "MASTERY": (1.0 - mastery) * 1.0,
        "RETENTION": (1.0 - retention) * 0.8,
        "TRANSFER": (1.0 - transfer) * 0.9,
        "MISCONCEPTION": misconception * 1.2,
        "UNCERTAINTY": uncertainty * 0.5,
    }
    b = max(weighted_scores, key=weighted_scores.get)
    
    mode_map = {
        "MASTERY": "ACQUISITION",
        "RETENTION": "RETRIEVAL",
        "TRANSFER": "TRANSFER",
        "MISCONCEPTION": "REMEDIATION",
        "UNCERTAINTY": "DIAGNOSTIC",
        "INSUFFICIENT_EVIDENCE": "DIAGNOSTIC",
    }
    return b, mode_map.get(b, "ACQUISITION")
