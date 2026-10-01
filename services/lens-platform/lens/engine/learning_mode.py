from typing import Dict, Optional

# Section 23: Mapping bottlenecks to canonical learning modes
DEFAULT_MODE_MAPPING: Dict[str, str] = {
    "MASTERY": "ACQUISITION",
    "RETENTION": "RETRIEVAL",
    "TRANSFER": "TRANSFER",
    "MISCONCEPTION": "REMEDIATION",
    "UNCERTAINTY": "DIAGNOSTIC",
    "INSUFFICIENT_EVIDENCE": "DIAGNOSTIC",
}


def resolve_learning_mode(
    bottleneck: str,
    custom_mapping: Optional[Dict[str, str]] = None,
) -> str:
    """
    Section 23: Resolves learning mode from bottleneck using policy configuration.
    """
    mapping = custom_mapping or DEFAULT_MODE_MAPPING
    return mapping.get(bottleneck.upper(), "ACQUISITION")
