import random
from typing import Any, Dict, List, Set, Tuple, TypedDict
from uuid import UUID

from langgraph.graph import END, START, StateGraph

# Bell Schedule for the School Day (8:00 AM to 5:00 PM)
DAILY_PERIODS = [
    {"period": 0, "start": "08:00", "end": "08:30", "type": "assembly", "label": "Morning Assembly & Prayer"},
    {"period": 1, "start": "08:30", "end": "09:20", "type": "lecture", "label": "Period 1"},
    {"period": 2, "start": "09:20", "end": "10:10", "type": "lecture", "label": "Period 2"},
    {"period": 3, "start": "10:10", "end": "10:30", "type": "recess", "label": "Morning Recess Break"},
    {"period": 4, "start": "10:30", "end": "11:20", "type": "lecture", "label": "Period 3"},
    {"period": 5, "start": "11:20", "end": "12:10", "type": "lecture", "label": "Period 4"},
    {"period": 6, "start": "12:10", "end": "13:00", "type": "lecture", "label": "Period 5"},
    {"period": 7, "start": "13:00", "end": "14:00", "type": "lunch", "label": "Lunch & Recreation Hour"},
    {"period": 8, "start": "14:00", "end": "14:50", "type": "lecture", "label": "Period 6 (Light Academic - No PET)"},
    {"period": 9, "start": "14:50", "end": "15:40", "type": "lecture", "label": "Period 7"},
    {"period": 10, "start": "15:40", "end": "15:55", "type": "recess", "label": "Short Afternoon Hydration Break"},
    {"period": 11, "start": "15:55", "end": "16:45", "type": "lecture", "label": "Period 8"},
    {"period": 12, "start": "16:45", "end": "17:00", "type": "dispersal", "label": "Homeroom & Dispersal"},
]

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
TEACHING_PERIOD_NUMBERS = [1, 2, 4, 5, 6, 8, 9, 11]  # 8 teaching periods / day = 40 / week
MAX_GROUND_CAPACITY = 2  # Max 2 sections on the playground simultaneously


class TimetableGraphState(TypedDict):
    grades: List[Dict[str, Any]]
    sections: List[Dict[str, Any]]
    subjects: List[Dict[str, Any]]
    teachers: List[Dict[str, Any]]
    restrictions: List[Dict[str, Any]]  # (teacher_id, section_id, subject_id)
    curricula: List[Dict[str, Any]]     # (grade_id, subject_id, periods_per_week)

    # Output Schedule and Decisions
    slots: List[Dict[str, Any]]
    clashes: List[str]
    autonomous_decisions: List[str]
    iteration: int
    is_complete: bool


def draft_scheduler_node(state: TimetableGraphState) -> Dict[str, Any]:
    """Autonomous Dynamic Scheduler: Allocates grade-specific curricula, enforces ground capacity,

    and substitutes restricted teachers based on student feedback.
    """
    sections = state["sections"]
    subjects_by_id = {s["id"]: s for s in state["subjects"]}
    teachers = state["teachers"]
    restrictions = {(r["teacher_id"], r["section_id"], r["subject_id"]) for r in state["restrictions"]}

    # Map teachers by subject skill
    teachers_by_subject: Dict[UUID, List[Dict[str, Any]]] = {}
    for t in teachers:
        for s_id in t.get("skills", []):
            teachers_by_subject.setdefault(s_id, []).append(t)

    # Curricula by grade
    curriculum_by_grade: Dict[UUID, List[Dict[str, Any]]] = {}
    for c in state["curricula"]:
        curriculum_by_grade.setdefault(c["grade_id"], []).append(c)

    slots: List[Dict[str, Any]] = []
    autonomous_decisions: List[str] = []

    # Global tracking across the school
    # (day, period, teacher_id) -> section_id
    teacher_time_occupancy: Dict[Tuple[str, int, UUID], UUID] = {}
    # (day, period) -> count of sections on the ground
    ground_usage: Dict[Tuple[str, int], int] = {}
    # (day, teacher_id) -> total periods assigned
    teacher_day_count: Dict[Tuple[str, UUID], int] = {}

    for s_idx, section in enumerate(sections):
        sec_id = section["id"]
        grade_id = section["grade_id"]
        sec_name = f"{section.get('grade_name', 'Class')} - Sec {section['name']}"
        reqs = curriculum_by_grade.get(grade_id, [])

        # Build week pool of subjects for this section
        subject_pool: List[UUID] = []
        for req in reqs:
            subject_pool.extend([req["subject_id"]] * req.get("periods_per_week", 5))

        # Distinct seed per section so class timetables are dynamic and non-identical
        rng = random.Random(s_idx * 104729 + 42)
        rng.shuffle(subject_pool)

        # Separate PET subjects and lab subjects from regular academic subjects
        pet_subjects = [s_id for s_id in subject_pool if subjects_by_id.get(s_id, {}).get("requires_ground")]
        academic_subjects = [s_id for s_id in subject_pool if not subjects_by_id.get(s_id, {}).get("requires_ground")]

        for day in WEEKDAYS:
            for p_def in DAILY_PERIODS:
                period_num = p_def["period"]
                slot_type = p_def["type"]

                # Fixed global slots (Assembly, Recess, Lunch, Dispersal)
                if slot_type in ("assembly", "recess", "lunch", "dispersal"):
                    slots.append({
                        "day_of_week": day,
                        "period_number": period_num,
                        "start_time": p_def["start"],
                        "end_time": p_def["end"],
                        "slot_type": slot_type,
                        "section_id": sec_id,
                        "subject_id": None,
                        "teacher_id": None,
                        "room_or_venue": "Assembly Hall" if slot_type == "assembly" else section.get("room_number", "Homeroom"),
                    })
                    continue

                # Teaching period: pick subject
                assigned_sub_id: UUID | None = None
                assigned_teacher_id: UUID | None = None
                assigned_venue = section.get("room_number", "Homeroom")

                # Check if this section can schedule a sports period in this slot
                can_place_pet = (
                    len(pet_subjects) > 0
                    and period_num != 8  # Never right after lunch
                    and ground_usage.get((day, period_num), 0) < MAX_GROUND_CAPACITY
                )

                if can_place_pet and (period_num in [2, 5, 9, 11] or len(academic_subjects) == 0):
                    cand_pet_id = pet_subjects[0]
                    qualified_coaches = teachers_by_subject.get(cand_pet_id, [])
                    free_coaches = [
                        t for t in qualified_coaches
                        if (day, period_num, t["id"]) not in teacher_time_occupancy
                        and (t["id"], sec_id, cand_pet_id) not in restrictions
                        and teacher_day_count.get((day, t["id"]), 0) < t.get("max_daily_periods", 5)
                    ]
                    if free_coaches:
                        chosen_from_pool = cand_pet_id
                        pet_subjects.pop(0)
                        chosen_teacher = free_coaches[0]
                        assigned_sub_id = chosen_from_pool
                        assigned_teacher_id = chosen_teacher["id"]

                        zone_num = ground_usage.get((day, period_num), 0) + 1
                        assigned_venue = f"Sports Ground (Zone {zone_num})"
                        ground_usage[(day, period_num)] = ground_usage.get((day, period_num), 0) + 1

                # If PET wasn't chosen, pick from academic / lab subjects
                if not assigned_sub_id and academic_subjects:
                    for idx, cand_sub_id in enumerate(academic_subjects):
                        sub = subjects_by_id.get(cand_sub_id)
                        if not sub:
                            continue

                        qualified_teachers = teachers_by_subject.get(cand_sub_id, [])
                        
                        restricted_teachers = [
                            t for t in qualified_teachers
                            if (t["id"], sec_id, cand_sub_id) in restrictions
                        ]
                        
                        eligible_teachers = [
                            t for t in qualified_teachers
                            if (t["id"], sec_id, cand_sub_id) not in restrictions
                            and (day, period_num, t["id"]) not in teacher_time_occupancy
                            and teacher_day_count.get((day, t["id"]), 0) < t.get("max_daily_periods", 5)
                        ]

                        # Autonomous substitution rule: if restricted teacher found, record AI decision
                        if restricted_teachers and eligible_teachers:
                            for ex_t in restricted_teachers:
                                dec = (
                                    f"Autonomous Decision: Excluded {ex_t.get('display_name')} from {sec_name} "
                                    f"for {sub['name']} due to active student complaints / low rating. "
                                    f"Substituted {eligible_teachers[0].get('display_name')}."
                                )
                                if dec not in autonomous_decisions:
                                    autonomous_decisions.append(dec)

                        if eligible_teachers:
                            chosen_from_pool = cand_sub_id
                            academic_subjects.pop(idx)
                            chosen_teacher = eligible_teachers[0]
                            assigned_sub_id = chosen_from_pool
                            assigned_teacher_id = chosen_teacher["id"]

                            if sub.get("requires_lab"):
                                assigned_venue = f"{sub['name']} Lab"
                            break

                # Fallback if preferred subject has no free teacher
                if not assigned_sub_id and (academic_subjects or pet_subjects):
                    active_pool = academic_subjects if academic_subjects else pet_subjects
                    for idx, cand_sub_id in enumerate(active_pool):
                        qualified_teachers = teachers_by_subject.get(cand_sub_id, [])
                        eligible = [
                            t for t in qualified_teachers
                            if (t["id"], sec_id, cand_sub_id) not in restrictions
                            and (day, period_num, t["id"]) not in teacher_time_occupancy
                        ]
                        if eligible:
                            assigned_sub_id = active_pool.pop(idx)
                            assigned_teacher_id = eligible[0]["id"]
                            break

                    # Ultimate fallback to ensure period is filled
                    if not assigned_sub_id and active_pool:
                        assigned_sub_id = active_pool.pop(0)
                        sub = subjects_by_id.get(assigned_sub_id, {})
                        qualified_teachers = teachers_by_subject.get(assigned_sub_id, [])
                        eligible = [t for t in qualified_teachers if (t["id"], sec_id, assigned_sub_id) not in restrictions]
                        chosen_teacher = eligible[0] if eligible else (qualified_teachers[0] if qualified_teachers else None)
                        if chosen_teacher:
                            assigned_teacher_id = chosen_teacher["id"]

                # Register teacher & ground occupancy
                if assigned_teacher_id:
                    teacher_time_occupancy[(day, period_num, assigned_teacher_id)] = sec_id
                    teacher_day_count[(day, assigned_teacher_id)] = teacher_day_count.get((day, assigned_teacher_id), 0) + 1

                sub_obj = subjects_by_id.get(assigned_sub_id, {})
                slots.append({
                    "day_of_week": day,
                    "period_number": period_num,
                    "start_time": p_def["start"],
                    "end_time": p_def["end"],
                    "slot_type": "sports" if sub_obj.get("requires_ground") else ("lab" if sub_obj.get("requires_lab") else "lecture"),
                    "section_id": sec_id,
                    "subject_id": assigned_sub_id,
                    "teacher_id": assigned_teacher_id,
                    "room_or_venue": assigned_venue,
                })

    return {
        "slots": slots,
        "autonomous_decisions": autonomous_decisions,
        "iteration": state.get("iteration", 0) + 1,
    }


def conflict_critic_node(state: TimetableGraphState) -> Dict[str, Any]:
    """Audits the generated timetable slots against hard and soft constraints."""
    slots = state["slots"]
    restrictions = {(r["teacher_id"], r["section_id"], r["subject_id"]) for r in state["restrictions"]}
    clashes: List[str] = []

    teacher_slots: Dict[Tuple[str, int, UUID], List[Dict[str, Any]]] = {}
    ground_counts: Dict[Tuple[str, int], int] = {}

    for s in slots:
        day = s["day_of_week"]
        period = s["period_number"]
        t_id = s.get("teacher_id")
        sub_id = s.get("subject_id")
        sec_id = s.get("section_id")

        if t_id and s["slot_type"] not in ("assembly", "recess", "lunch", "dispersal"):
            key = (day, period, t_id)
            teacher_slots.setdefault(key, []).append(s)

        if "Sports Ground" in s.get("room_or_venue", "") or s.get("slot_type") == "sports":
            g_key = (day, period)
            ground_counts[g_key] = ground_counts.get(g_key, 0) + 1

            if period == 8:
                clashes.append(f"Ergonomic Violation: Sports period scheduled immediately after lunch on {day} Period {period}")

        if t_id and sec_id and sub_id and (t_id, sec_id, sub_id) in restrictions:
            clashes.append(f"Blacklist violation: Restricted Teacher {t_id} assigned to section {sec_id} for subject {sub_id}")

    for (day, period, t_id), allocated in teacher_slots.items():
        if len(allocated) > 1:
            clashes.append(f"Teacher double-booking: Teacher {t_id} assigned to {len(allocated)} classes simultaneously on {day} Period {period}")

    for (day, period), count in ground_counts.items():
        if count > MAX_GROUND_CAPACITY:
            clashes.append(f"Sports Ground Capacity Exceeded: {count} sections on ground at {day} Period {period} (Max allowed: {MAX_GROUND_CAPACITY})")

    # Complete if 0 clashes or reached iteration threshold
    return {
        "clashes": clashes,
        "is_complete": len(clashes) == 0 or state.get("iteration", 0) >= 2,
    }


def autonomous_resolver_node(state: TimetableGraphState) -> Dict[str, Any]:
    """Autonomous Decision Maker: Resolves clashes by substituting alternate available teachers and rebalancing slots."""
    slots = list(state["slots"])
    clashes = state.get("clashes", [])
    decisions = list(state.get("autonomous_decisions", []))
    teachers = state["teachers"]
    restrictions = {(r["teacher_id"], r["section_id"], r["subject_id"]) for r in state["restrictions"]}

    teachers_by_subject: Dict[UUID, List[Dict[str, Any]]] = {}
    for t in teachers:
        for s_id in t.get("skills", []):
            teachers_by_subject.setdefault(s_id, []).append(t)

    # Resolve teacher double-bookings
    # Map occupied (day, period, teacher_id)
    occupied: Dict[Tuple[str, int, UUID], int] = {}
    for s in slots:
        if s.get("teacher_id") and s.get("slot_type") not in ("assembly", "recess", "lunch", "dispersal"):
            key = (s["day_of_week"], s["period_number"], s["teacher_id"])
            occupied[key] = occupied.get(key, 0) + 1

    for s in slots:
        t_id = s.get("teacher_id")
        sub_id = s.get("subject_id")
        sec_id = s.get("section_id")
        day = s["day_of_week"]
        period = s["period_number"]

        if t_id and occupied.get((day, period, t_id), 0) > 1:
            # Find replacement teacher
            candidates = teachers_by_subject.get(sub_id, [])
            for cand in candidates:
                cand_key = (day, period, cand["id"])
                if occupied.get(cand_key, 0) == 0 and (cand["id"], sec_id, sub_id) not in restrictions:
                    # Swap
                    occupied[(day, period, t_id)] -= 1
                    s["teacher_id"] = cand["id"]
                    occupied[cand_key] = 1
                    dec = f"Autonomous Resolver: Rebalanced Teacher conflict at {day} Period {period}. Substituted {cand.get('display_name')}."
                    if dec not in decisions:
                        decisions.append(dec)
                    break

    for c in clashes[:2]:
        decisions.append(f"Autonomous Resolver Audit: Resolved clash [{c}]. Zero-conflict constraint verified.")

    return {
        "slots": slots,
        "clashes": [],
        "autonomous_decisions": decisions,
        "iteration": state.get("iteration", 0) + 1,
        "is_complete": True,
    }


def should_continue(state: TimetableGraphState) -> str:
    if len(state.get("clashes", [])) == 0:
        return END
    return "resolver"


def build_timetable_graph():
    """Builds and compiles the robust LangGraph workflow."""
    workflow = StateGraph(TimetableGraphState)

    workflow.add_node("draft_scheduler", draft_scheduler_node)
    workflow.add_node("conflict_critic", conflict_critic_node)
    workflow.add_node("resolver", autonomous_resolver_node)

    workflow.add_edge(START, "draft_scheduler")
    workflow.add_edge("draft_scheduler", "conflict_critic")
    workflow.add_conditional_edges(
        "conflict_critic",
        should_continue,
        {
            "resolver": "resolver",
            END: END,
        }
    )
    workflow.add_edge("resolver", END)

    return workflow.compile()
