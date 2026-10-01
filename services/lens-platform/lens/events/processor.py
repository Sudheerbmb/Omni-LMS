import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lens.config import settings
from lens.engine.state_vector import (
    calculate_competency,
    calculate_identifiability,
    calculate_learning_velocity,
    calculate_mastery,
    calculate_misconception,
    calculate_retention,
    calculate_transfer,
    calculate_uncertainty,
    clamp,
)
from lens.engine.bottleneck import detect_bottleneck
from lens.engine.learning_mode import resolve_learning_mode
from lens.events.contracts import LMSEventContract
from lens.events.deduplicator import is_event_processed
from lens.events.normalizer import normalize_lms_event
from lens.models.evidence import LearnerEvidence, RawEventArchive
from lens.models.state import LearnerState
from lens.models.bottlenecks import BottleneckEvent, LearnerRecommendation
from lens.models.policies import BottleneckPolicy, InterventionPolicy


async def process_learning_event(
    session: AsyncSession,
    event: LMSEventContract,
    tenant_id: str = "default_tenant",
) -> Tuple[bool, Optional[LearnerState], Optional[str]]:
    """
    Section 31 & 60: Core Automated 21-Step Pipeline
    1. Check Idempotency
    2. Persist Raw Event
    3. Normalize & Persist Evidence
    4. Recalculate State Vector [M, R, T, MS, C, U, I, V]
    5. Detect Bottleneck & Mode
    6. Return State and Trigger Flag
    """
    # 1. Check Idempotency (Section 46)
    if await is_event_processed(session, event.event_id):
        stmt = select(LearnerState).where(
            LearnerState.student_id == event.student_id,
            LearnerState.course_id == event.course_id,
        )
        existing_state = await session.scalar(stmt)
        return True, existing_state, None

    # 2. Archive Raw Event
    raw_archive = RawEventArchive(
        event_id=event.event_id,
        event_type=event.event_type,
        event_version=event.event_version,
        source=event.source,
        student_id=event.student_id,
        course_id=event.course_id,
        tenant_id=tenant_id,
        occurred_at=event.occurred_at,
        correlation_id=event.correlation_id,
        payload_json=event.payload,
        processed=False,
    )
    session.add(raw_archive)

    # 3. Normalize to Evidence
    evidence_data = normalize_lms_event(event)
    evidence = LearnerEvidence(
        tenant_id=tenant_id,
        student_id=evidence_data.student_id,
        course_id=evidence_data.course_id,
        concept_id=evidence_data.concept_id,
        activity_id=evidence_data.activity_id,
        assessment_id=evidence_data.assessment_id,
        question_id=evidence_data.question_id,
        event_type=evidence_data.event_type,
        correct=evidence_data.correct,
        score=evidence_data.score,
        difficulty=evidence_data.difficulty,
        discrimination=evidence_data.discrimination,
        cognitive_level=evidence_data.cognitive_level,
        response_time_seconds=evidence_data.response_time_seconds,
        attempt_number=evidence_data.attempt_number,
        confidence=evidence_data.confidence,
        hint_used=evidence_data.hint_used,
        assistance_used=evidence_data.assistance_used,
        misconception_signal=evidence_data.misconception_signal,
        transfer_context=evidence_data.transfer_context,
        timestamp=evidence_data.timestamp,
        metadata_json=evidence_data.metadata,
    )
    session.add(evidence)

    # 4. Fetch or Initialize LearnerState
    state_stmt = select(LearnerState).where(
        LearnerState.tenant_id == tenant_id,
        LearnerState.student_id == evidence_data.student_id,
        LearnerState.course_id == evidence_data.course_id,
        LearnerState.concept_id == evidence_data.concept_id,
    )
    state = await session.scalar(state_stmt)
    if not state:
        state = LearnerState(
            tenant_id=tenant_id,
            student_id=evidence_data.student_id,
            course_id=evidence_data.course_id,
            concept_id=evidence_data.concept_id,
            mastery=0.10,
            retention=1.00,
            transfer=0.00,
            misconception=0.00,
            competency=0.00,
            uncertainty=0.90,
            identifiability=0.00,
            learning_velocity=0.00,
            evidence_count=0,
            observed_evidence_types=[],
            history_json=[],
        )
        session.add(state)

    # 5. Calculate State Updates
    now = datetime.now(timezone.utc)
    
    # Mastery Bayesian Update
    new_mastery = calculate_mastery(
        previous_mastery=state.mastery,
        observed_performance=evidence_data.score,
        evidence_type=evidence_data.event_type,
        difficulty=evidence_data.difficulty,
    )
    
    # Retention Ebbinghaus Update
    new_retention = calculate_retention(
        r_0=state.retention,
        last_event_time=state.last_learning_timestamp or now,
        current_time=now,
    )
    # If successful retrieval or practice, boost retention
    if evidence_data.correct and evidence_data.event_type in ["RETRIEVAL", "PRACTICE", "QUIZ"]:
        new_retention = clamp(new_retention + 0.30 * (1.0 - new_retention))
        state.last_retrieval_timestamp = now

    # Transfer Model Update
    if evidence_data.event_type == "TRANSFER" or evidence_data.transfer_context:
        new_transfer = calculate_transfer(
            previous_transfer=state.transfer,
            observed_transfer_score=evidence_data.score,
        )
    else:
        new_transfer = state.transfer

    # Misconception Signal Update
    has_misconception = bool(evidence_data.misconception_signal or (not evidence_data.correct and evidence_data.difficulty <= 0.35))
    new_misconception = calculate_misconception(
        previous_misconception=state.misconception,
        misconception_detected=has_misconception,
    )

    # Holistic Competency
    new_competency = calculate_competency(
        mastery=new_mastery,
        retention=new_retention,
        transfer=new_transfer,
        misconception=new_misconception,
    )

    # Observed Evidence Types & Diversity
    obs_types = list(set(state.observed_evidence_types + [evidence_data.event_type]))
    new_evidence_count = state.evidence_count + 1
    new_identifiability = calculate_identifiability(obs_types)
    new_uncertainty = calculate_uncertainty(
        evidence_count=new_evidence_count,
        observed_types=obs_types,
    )

    # Snapshot history point for Velocity
    snapshot = {
        "timestamp": now.isoformat(),
        "mastery": round(new_mastery, 4),
        "retention": round(new_retention, 4),
        "transfer": round(new_transfer, 4),
        "competency": round(new_competency, 4),
        "misconception": round(new_misconception, 4),
        "evidence_type": evidence_data.event_type,
    }
    updated_history = (state.history_json or []) + [snapshot]
    if len(updated_history) > 30:
        updated_history = updated_history[-30:] # Keep rolling 30 records
    new_velocity = calculate_learning_velocity(updated_history)

    # 6. Bottleneck Detection & Mode Mapping
    thresholds = {"minimum_identifiability": settings.minimum_identifiability}
    weights = {"w_M": 1.0, "w_R": 0.8, "w_T": 0.9, "w_MS": 1.2, "w_U": 0.5}
    
    new_bottleneck, _ = detect_bottleneck(
        mastery=new_mastery,
        retention=new_retention,
        transfer=new_transfer,
        misconception=new_misconception,
        uncertainty=new_uncertainty,
        identifiability=new_identifiability,
        thresholds=thresholds,
        weights=weights,
    )
    new_mode = resolve_learning_mode(new_bottleneck)

    # Check if bottleneck changed -> create BottleneckEvent
    bottleneck_changed = (new_bottleneck != state.current_bottleneck)
    if bottleneck_changed:
        b_event = BottleneckEvent(
            tenant_id=tenant_id,
            student_id=evidence_data.student_id,
            concept_id=evidence_data.concept_id,
            bottleneck_type=new_bottleneck,
            learning_mode=new_mode,
            identifiability=new_identifiability,
            state_snapshot_json=snapshot,
        )
        session.add(b_event)

    # Apply updates to state
    state.mastery = new_mastery
    state.retention = new_retention
    state.transfer = new_transfer
    state.misconception = new_misconception
    state.competency = new_competency
    state.uncertainty = new_uncertainty
    state.identifiability = new_identifiability
    state.learning_velocity = new_velocity
    state.current_bottleneck = new_bottleneck
    state.current_learning_mode = new_mode
    state.evidence_count = new_evidence_count
    state.observed_evidence_types = obs_types
    state.history_json = updated_history
    state.last_learning_timestamp = now

    raw_archive.processed = True
    raw_archive.processed_at = now

    await session.commit()
    await session.refresh(state)

    trigger_reason = f"event:{evidence_data.event_type}" if not bottleneck_changed else f"bottleneck_shift:{new_bottleneck}"
    return True, state, trigger_reason
