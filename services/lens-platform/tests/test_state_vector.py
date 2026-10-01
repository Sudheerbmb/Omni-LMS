import math
from datetime import datetime, timedelta, timezone
from lens.engine.state_vector import (
    calculate_mastery,
    calculate_retention,
    calculate_transfer,
    calculate_misconception,
    calculate_competency,
    calculate_uncertainty,
    calculate_identifiability,
    calculate_learning_velocity,
    clamp,
)


def test_mastery_bayesian_update():
    # Initial mastery = 0.20, succeeds on difficult quiz (score=1.0, difficulty=0.8)
    m_next = calculate_mastery(0.20, 1.0, evidence_type="QUIZ", difficulty=0.8)
    assert m_next > 0.20
    assert m_next <= 1.0

    # Failure on easy quiz lowers/stagnates mastery
    m_fail = calculate_mastery(0.80, 0.0, evidence_type="QUIZ", difficulty=0.2)
    assert m_fail < 0.80


def test_retention_ebbinghaus_decay():
    now = datetime.now(timezone.utc)
    t_past_7_days = now - timedelta(days=7)
    
    # 7 days elapsed should decay retention from 1.0
    r_7 = calculate_retention(1.0, t_past_7_days, now, lambda_param=0.05)
    expected = math.exp(-0.05 * 7)
    assert abs(r_7 - expected) < 1e-3
    assert r_7 < 1.0


def test_transfer_model():
    # Initial transfer = 0.10, observed transfer score = 0.90
    t_next = calculate_transfer(0.10, 0.90, alpha=0.25)
    assert t_next == (0.25 * 0.90 + 0.75 * 0.10)


def test_misconception_aggregator():
    ms_init = 0.0
    # Misconception detected -> increases
    ms_1 = calculate_misconception(ms_init, misconception_detected=True, penalty=0.35)
    assert ms_1 == 0.35

    # Second misconception -> compounds
    ms_2 = calculate_misconception(ms_1, misconception_detected=True, penalty=0.35)
    assert ms_2 > 0.50

    # No misconception on next trial -> decays
    ms_3 = calculate_misconception(ms_2, misconception_detected=False, decay=0.85)
    assert ms_3 < ms_2


def test_competency_calculation():
    # Competency is geometric 4th root: [M * R * T * (1 - MS)]^(1/4)
    # When M=0.81, R=0.81, T=0.81, (1-MS)=1.0 -> (0.81^3 * 1.0)^0.25 = 0.8538
    c = calculate_competency(mastery=0.81, retention=0.81, transfer=0.81, misconception=0.0)
    expected = math.pow(0.81 * 0.81 * 0.81 * 1.0, 0.25)
    assert abs(c - expected) < 1e-4

    # When all 4 dimensions equal 0.81 (misconception=0.19 -> 1-MS=0.81) -> (0.81^4)^0.25 = 0.81
    c_four = calculate_competency(mastery=0.81, retention=0.81, transfer=0.81, misconception=0.19)
    assert abs(c_four - 0.81) < 1e-4


def test_identifiability_and_uncertainty():
    # Sparse single event
    i_sparse = calculate_identifiability(["QUIZ"])
    u_sparse = calculate_uncertainty(evidence_count=1, observed_types=["QUIZ"])
    
    # Rich diverse evidence
    diverse_types = ["DIAGNOSTIC", "BENCHMARK", "QUIZ", "CODING", "TRANSFER", "ASSIGNMENT", "RETRIEVAL"]
    i_rich = calculate_identifiability(diverse_types)
    u_rich = calculate_uncertainty(evidence_count=20, observed_types=diverse_types)

    assert i_rich > i_sparse
    assert u_rich < u_sparse
