from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


def calculate_retrieval_schedule(
    last_learning_time: datetime,
    retention_score: float,
    intervals: Optional[List[int]] = None,
    difficulty: float = 0.5,
) -> List[Dict[str, Any]]:
    """
    Section 33, 34: Spaced retrieval scheduling
    Adapts standard intervals ([2, 7, 21] days) based on student retention and difficulty.
    """
    base_intervals = intervals or [2, 7, 21]
    
    # Adaptive multiplier: strong retention stretches intervals; fragile retention contracts intervals
    multiplier = max(0.5, min(2.0, (retention_score / 0.70) * (1.2 - 0.4 * difficulty)))
    
    schedule = []
    current_base = last_learning_time
    if current_base.tzinfo is None:
        current_base = current_base.replace(tzinfo=timezone.utc)
        
    for idx, days in enumerate(base_intervals, start=1):
        adjusted_days = max(1, round(days * multiplier))
        target_time = current_base + timedelta(days=adjusted_days)
        schedule.append({
            "retrieval_number": idx,
            "target_date": target_time.isoformat(),
            "scheduled_days_after": adjusted_days,
            "status": "scheduled",
        })
        
    return schedule


def calculate_periodic_evaluation_due(
    last_evaluation_time: Optional[datetime],
    interval_days: int = 30,
) -> bool:
    """
    Section 35: Periodic longitudinal evaluation trigger
    """
    if not last_evaluation_time:
        return True
    
    now = datetime.now(timezone.utc)
    if last_evaluation_time.tzinfo is None:
        last_evaluation_time = last_evaluation_time.replace(tzinfo=timezone.utc)
        
    elapsed_days = (now - last_evaluation_time).total_seconds() / 86400.0
    return elapsed_days >= interval_days
