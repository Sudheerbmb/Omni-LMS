from typing import Dict, Tuple


def detect_bottleneck(
    mastery: float,
    retention: float,
    transfer: float,
    misconception: float,
    uncertainty: float,
    identifiability: float,
    thresholds: Dict[str, float],
    weights: Dict[str, float],
) -> Tuple[str, Dict[str, float]]:
    """
    Section 22: Deterministic bottleneck classifier
    If I < minimum_identifiability:
        B = INSUFFICIENT_EVIDENCE
    Otherwise:
        W_M = (1 - M) * w_M
        W_R = (1 - R) * w_R
        W_T = (1 - T) * w_T
        W_MS = MS * w_MS
        W_U = U * w_U
        B = argmax(W_M, W_R, W_T, W_MS, W_U)
    """
    min_identifiability = thresholds.get("minimum_identifiability", 0.50)
    
    if identifiability < min_identifiability:
        return "INSUFFICIENT_EVIDENCE", {"identifiability_gap": min_identifiability - identifiability}
    
    w_M = weights.get("w_M", 1.0)
    w_R = weights.get("w_R", 0.8)
    w_T = weights.get("w_T", 0.9)
    w_MS = weights.get("w_MS", 1.2)
    w_U = weights.get("w_U", 0.5)
    
    weighted_scores = {
        "MASTERY": (1.0 - mastery) * w_M,
        "RETENTION": (1.0 - retention) * w_R,
        "TRANSFER": (1.0 - transfer) * w_T,
        "MISCONCEPTION": misconception * w_MS,
        "UNCERTAINTY": uncertainty * w_U,
    }
    
    # Select dimension with maximum urgency weight
    bottleneck = max(weighted_scores, key=weighted_scores.get)
    return bottleneck, weighted_scores
