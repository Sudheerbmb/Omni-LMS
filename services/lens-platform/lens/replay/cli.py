import argparse
import asyncio
import json
import uuid
from typing import Optional
from sqlalchemy import select

from lens.database import async_session_factory
from lens.events.contracts import LMSEventContract
from lens.events.processor import process_learning_event
from lens.models.evidence import RawEventArchive
from lens.models.state import LearnerState


async def replay_student_events(student_id_str: str, events_file: Optional[str] = None):
    """
    Section 73: Deterministic Event Replay Utility
    Reconstructs exact student learner state from historical event log.
    """
    student_id = uuid.UUID(student_id_str)
    print(f"=== LENS-Ω Deterministic Replay for Student: {student_id} ===")

    async with async_session_factory() as session:
        if events_file:
            print(f"Loading raw events from file: {events_file}")
            with open(events_file, "r", encoding="utf-8") as f:
                events = [json.loads(line) for line in f if line.strip()]
        else:
            print("Querying historical events from raw_events archive in database...")
            stmt = (
                select(RawEventArchive)
                .where(RawEventArchive.student_id == student_id)
                .order_by(RawEventArchive.occurred_at)
            )
            raw_records = (await session.scalars(stmt)).all()
            events = [
                {
                    "event_id": f"replay_{r.event_id}",
                    "event_type": r.event_type,
                    "event_version": r.event_version,
                    "source": r.source,
                    "student_id": str(r.student_id),
                    "course_id": str(r.course_id),
                    "occurred_at": r.occurred_at.isoformat(),
                    "payload": r.payload_json,
                }
                for r in raw_records
            ]

        print(f"Found {len(events)} events to replay.")
        for idx, ev in enumerate(events, start=1):
            contract = LMSEventContract(**ev)
            success, state, trigger = await process_learning_event(session, contract)
            print(
                f"[{idx}/{len(events)}] {contract.event_type} -> "
                f"M: {state.mastery:.2f} | R: {state.retention:.2f} | "
                f"T: {state.transfer:.2f} | C: {state.competency:.2f} | "
                f"Bottleneck: {state.current_bottleneck}"
            )

        # Final state check
        final_stmt = select(LearnerState).where(LearnerState.student_id == student_id)
        final_states = (await session.scalars(final_stmt)).all()
        print("\n=== Replay Finished: Final Reconstructed States ===")
        for s in final_states:
            print(
                f"Concept: {s.concept_id} => Mastery: {s.mastery:.2%} | "
                f"Competency: {s.competency:.2%} | Mode: {s.current_learning_mode}"
            )


def main():
    parser = argparse.ArgumentParser(description="LENS-Ω Event Replay Utility")
    parser.add_argument("--student", required=True, help="UUID of student to replay")
    parser.add_argument("--file", required=False, help="Optional JSONL file path of historical events")
    args = parser.parse_args()

    asyncio.run(replay_student_events(args.student, args.file))


if __name__ == "__main__":
    main()
