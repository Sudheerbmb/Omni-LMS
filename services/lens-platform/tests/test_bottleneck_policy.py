from lens.engine.bottleneck import detect_bottleneck
from lens.engine.learning_mode import resolve_learning_mode
from lens.engine.future_state import predict_future_state
from lens.engine.policy_optimizer import calculate_utility, optimize_action


def test_bottleneck_insufficient_evidence():
    thresholds = {"minimum_identifiability": 0.50}
    weights = {"w_M": 1.0, "w_R": 0.8, "w_T": 0.9, "w_MS": 1.2, "w_U": 0.5}

    # If identifiability is low, must classify as INSUFFICIENT_EVIDENCE
    b, _ = detect_bottleneck(
        mastery=0.90, retention=0.90, transfer=0.80, misconception=0.0,
        uncertainty=0.70, identifiability=0.20,
        thresholds=thresholds, weights=weights,
    )
    assert b == "INSUFFICIENT_EVIDENCE"
    assert resolve_learning_mode(b) == "DIAGNOSTIC"


def test_bottleneck_transfer_selection():
    thresholds = {"minimum_identifiability": 0.50}
    weights = {"w_M": 1.0, "w_R": 0.8, "w_T": 0.9, "w_MS": 1.2, "w_U": 0.5}

    # High mastery (0.85), high retention (0.90), but low transfer (0.20)
    b, scores = detect_bottleneck(
        mastery=0.85, retention=0.90, transfer=0.20, misconception=0.05,
        uncertainty=0.15, identifiability=0.80,
        thresholds=thresholds, weights=weights,
    )
    assert b == "TRANSFER"
    assert resolve_learning_mode(b) == "TRANSFER"


def test_policy_optimization_action_selection():
    current_state = {
        "mastery": 0.85,
        "retention": 0.90,
        "transfer": 0.20,
        "misconception": 0.05,
        "competency": 0.50,
        "uncertainty": 0.15,
        "identifiability": 0.80,
    }
    candidates = [
        {"id": "c1", "type": "MICRO_LESSON", "cost": 1.0, "expected_dimensions": {"M": 0.10}},
        {"id": "c2", "type": "TRANSFER_PROBLEM", "cost": 1.0, "expected_dimensions": {"T": 0.40}},
        {"id": "c3", "type": "PRACTICE", "cost": 1.0, "expected_dimensions": {"R": 0.05}},
    ]
    weights = {"w_M": 1.0, "w_R": 0.8, "w_T": 1.5, "w_C": 1.2, "w_MS": 1.5, "w_U": 0.4, "cost_penalty_lambda": 0.1}
    constraints = {"enforce_prerequisites": True}

    best_action, best_score, all_scored = optimize_action(
        current_state=current_state,
        candidate_interventions=candidates,
        weights=weights,
        constraints=constraints,
    )
    assert best_action is not None
    assert best_action["type"] == "TRANSFER_PROBLEM"
