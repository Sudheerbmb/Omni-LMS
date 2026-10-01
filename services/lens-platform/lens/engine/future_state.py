from typing import Dict
from lens.engine.state_vector import calculate_competency, clamp


def predict_future_state(
    current_state: Dict[str, float],
    intervention_type: str,
    intervention_difficulty: float = 0.5,
    expected_gains: Dict[str, float] = None,
) -> Dict[str, float]:
    """
    Section 25: Future-state transition model
    S_hat_{t+1}(a) = F(S_t, a)
    Estimates expected gains across dimensions based on intervention type and difficulty.
    """
    gains = expected_gains or {}
    m = current_state.get("mastery", 0.1)
    r = current_state.get("retention", 1.0)
    t = current_state.get("transfer", 0.0)
    ms = current_state.get("misconception", 0.0)
    u = current_state.get("uncertainty", 0.8)
    i = current_state.get("identifiability", 0.1)

    type_upper = intervention_type.upper()
    
    # Modeled dimensional deltas by canonical intervention type
    if "MICRO_LESSON" in type_upper or "WORKED_EXAMPLE" in type_upper or "ACQUISITION" in type_upper:
        d_m = gains.get("M", 0.20 * (1.0 - m))
        d_r = gains.get("R", 0.05)
        d_t = gains.get("T", 0.05)
        d_ms = gains.get("MS", -0.10 * ms)
        d_u = -0.15 * u
        d_i = 0.10
    elif "RETRIEVAL" in type_upper or "PRACTICE" in type_upper:
        d_m = gains.get("M", 0.10 * (1.0 - m))
        d_r = gains.get("R", 0.25 * (1.0 - r)) # Primary retention booster
        d_t = gains.get("T", 0.05)
        d_ms = gains.get("MS", -0.05 * ms)
        d_u = -0.10 * u
        d_i = 0.15
    elif "TRANSFER" in type_upper or "CHALLENGE" in type_upper or "PROJECT" in type_upper:
        d_m = gains.get("M", 0.08)
        d_r = gains.get("R", 0.10)
        d_t = gains.get("T", 0.30 * (1.0 - t)) # Primary transfer booster
        d_ms = gains.get("MS", -0.05 * ms)
        d_u = -0.10 * u
        d_i = 0.20
    elif "REMEDIATION" in type_upper or "DIAGNOSTIC" in type_upper:
        d_m = gains.get("M", 0.15 * (1.0 - m))
        d_r = gains.get("R", 0.05)
        d_t = gains.get("T", 0.05)
        d_ms = gains.get("MS", -0.40 * ms) # Primary misconception reducer
        d_u = -0.30 * u                    # Primary uncertainty reducer
        d_i = 0.25
    else:
        d_m = 0.05
        d_r = 0.05
        d_t = 0.05
        d_ms = -0.05
        d_u = -0.05
        d_i = 0.05

    future_m = clamp(m + d_m)
    future_r = clamp(r + d_r)
    future_t = clamp(t + d_t)
    future_ms = clamp(ms + d_ms)
    future_u = clamp(u + d_u)
    future_i = clamp(i + d_i)
    future_c = calculate_competency(future_m, future_r, future_t, future_ms)

    return {
        "mastery": future_m,
        "retention": future_r,
        "transfer": future_t,
        "misconception": future_ms,
        "competency": future_c,
        "uncertainty": future_u,
        "identifiability": future_i,
        "expected_delta": {
            "d_mastery": future_m - m,
            "d_retention": future_r - r,
            "d_transfer": future_t - t,
            "d_misconception": future_ms - ms,
            "d_competency": future_c - current_state.get("competency", 0.0),
        }
    }
