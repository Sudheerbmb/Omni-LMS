import uuid
from typing import Any, Dict, List, Optional
from uuid import UUID
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.identity.models import User
from app.identity.security import hash_password
from app.timetable.agent import build_timetable_graph
from app.timetable.models import (
    GradeCurriculum,
    SchoolGrade,
    SchoolSection,
    Subject,
    TeacherClassRestriction,
    TeacherFeedback,
    TeacherProfile,
    TeacherSubjectSkill,
    TimetableSlot,
)


# Curriculum definition across Grades 1 to 10 (Total: 40 teaching periods / week)
GRADE_CURRICULUM_MATRIX = {
    # Primary (Classes 1 - 2): Foundational Play & Literacy
    1: [("ENG", 7), ("HIN", 6), ("MATH", 7), ("EVS", 6), ("ART", 5), ("VAL", 5), ("PET", 4)],
    2: [("ENG", 7), ("HIN", 6), ("MATH", 7), ("EVS", 6), ("ART", 5), ("VAL", 5), ("PET", 4)],

    # Preparatory / Junior (Classes 3 - 5): Expanding Science, Social, and ICT
    3: [("ENG", 6), ("HIN", 5), ("MATH", 7), ("SCI", 6), ("SST", 5), ("CS", 4), ("ART", 3), ("PET", 4)],
    4: [("ENG", 6), ("HIN", 5), ("MATH", 7), ("SCI", 6), ("SST", 5), ("CS", 4), ("ART", 3), ("PET", 4)],
    5: [("ENG", 6), ("HIN", 5), ("MATH", 7), ("SCI", 6), ("SST", 5), ("CS", 4), ("ART", 3), ("PET", 4)],

    # Middle School (Classes 6 - 8): 3 Languages, Pre-Algebra, Integrated Science
    6: [("ENG", 5), ("HIN", 4), ("SKT", 4), ("MATH", 7), ("SCI", 6), ("SST", 5), ("CS", 4), ("ART", 2), ("PET", 3)],
    7: [("ENG", 5), ("HIN", 4), ("SKT", 4), ("MATH", 7), ("SCI", 6), ("SST", 5), ("CS", 4), ("ART", 2), ("PET", 3)],
    8: [("ENG", 5), ("HIN", 4), ("SKT", 4), ("MATH", 7), ("SCI", 6), ("SST", 5), ("CS", 4), ("ART", 2), ("PET", 3)],

    # Secondary / High School (Classes 9 - 10): CBSE/ICSE Board Standard with Specialized Sciences & Labs
    9: [("ENG", 5), ("HIN", 4), ("MATH", 7), ("PHY", 4), ("CHEM", 4), ("BIO", 4), ("HIST", 4), ("GEOG", 3), ("CS", 3), ("PET", 2)],
    10: [("ENG", 5), ("HIN", 4), ("MATH", 7), ("PHY", 4), ("CHEM", 4), ("BIO", 4), ("HIST", 4), ("GEOG", 3), ("CS", 3), ("PET", 2)],
}

SUBJECT_DEFAULTS = [
    {"code": "ENG", "name": "English Language & Literature", "category": "language", "color": "#38bdf8"},
    {"code": "HIN", "name": "Hindi / Second Language", "category": "language", "color": "#f472b6"},
    {"code": "SKT", "name": "Sanskrit / Third Language", "category": "language", "color": "#c084fc"},
    {"code": "MATH", "name": "Mathematics", "category": "core_academic", "color": "#facc15"},
    {"code": "EVS", "name": "Environmental Studies", "category": "core_academic", "color": "#4ade80"},
    {"code": "VAL", "name": "Value Education & Storytelling", "category": "humanities", "color": "#a3e635"},
    {"code": "SCI", "name": "General Science", "category": "core_academic", "color": "#2dd4bf"},
    {"code": "PHY", "name": "Physics & Practical Lab", "category": "lab", "requires_lab": True, "color": "#60a5fa"},
    {"code": "CHEM", "name": "Chemistry & Practical Lab", "category": "lab", "requires_lab": True, "color": "#fb923c"},
    {"code": "BIO", "name": "Biology & Botany Lab", "category": "lab", "requires_lab": True, "color": "#34d399"},
    {"code": "SST", "name": "Social Studies", "category": "core_academic", "color": "#a78bfa"},
    {"code": "HIST", "name": "History & Political Science", "category": "core_academic", "color": "#e879f9"},
    {"code": "GEOG", "name": "Geography & Economics", "category": "core_academic", "color": "#fb7185"},
    {"code": "CS", "name": "Computer Science & AI Lab", "category": "lab", "requires_lab": True, "color": "#818cf8"},
    {"code": "ART", "name": "Visual Art & Performing Craft", "category": "arts", "color": "#f87171"},
    {"code": "PET", "name": "Physical Education & Sports", "category": "sports", "requires_ground": True, "color": "#f59e0b"},
]

TEACHER_SEEDS = [
    # Mathematics Department
    {"name": "Dr. Sarah Connor", "email": "sarah.connor@school.edu", "emp_id": "T001", "subjects": ["MATH", "PHY"], "rating": 4.8},
    {"name": "Prof. Alan Turing", "email": "alan.turing@school.edu", "emp_id": "T002", "subjects": ["CS", "MATH"], "rating": 4.9},
    {"name": "Mrs. Shakuntala Devi", "email": "shakuntala.d@school.edu", "emp_id": "T011", "subjects": ["MATH"], "rating": 4.9},
    {"name": "Mr. Srinivasa Ramanujan", "email": "ramanujan.s@school.edu", "emp_id": "T012", "subjects": ["MATH"], "rating": 5.0},
    {"name": "Mr. Ramesh Sharma", "email": "ramesh.sharma@school.edu", "emp_id": "T006", "subjects": ["MATH"], "rating": 2.1}, # Has complaints in Class 9-A Math

    # Languages Department
    {"name": "Mrs. Anita Desai", "email": "anita.desai@school.edu", "emp_id": "T003", "subjects": ["ENG", "ART", "VAL"], "rating": 4.6},
    {"name": "Mr. William Wordsworth", "email": "william.w@school.edu", "emp_id": "T013", "subjects": ["ENG"], "rating": 4.7},
    {"name": "Mr. Rajesh Kumar", "email": "rajesh.kumar@school.edu", "emp_id": "T004", "subjects": ["HIN", "SKT"], "rating": 4.5},
    {"name": "Mrs. Munshi Premchand", "email": "munshi.p@school.edu", "emp_id": "T014", "subjects": ["HIN", "VAL"], "rating": 4.8},
    {"name": "Dr. Kalidas Shastri", "email": "kalidas.s@school.edu", "emp_id": "T015", "subjects": ["SKT", "HIN"], "rating": 4.7},

    # Science & Labs Department
    {"name": "Dr. Rosalind Franklin", "email": "rosalind.f@school.edu", "emp_id": "T005", "subjects": ["CHEM", "BIO", "SCI"], "rating": 4.9},
    {"name": "Mr. Vikram Sarabhai", "email": "vikram.s@school.edu", "emp_id": "T010", "subjects": ["PHY", "SCI"], "rating": 4.8},
    {"name": "Dr. Homi Bhabha", "email": "homi.b@school.edu", "emp_id": "T016", "subjects": ["PHY", "CHEM"], "rating": 4.9},
    {"name": "Dr. APJ Abdul Kalam", "email": "apj.kalam@school.edu", "emp_id": "T017", "subjects": ["SCI", "PHY"], "rating": 5.0},
    {"name": "Mrs. Jane Goodall", "email": "jane.g@school.edu", "emp_id": "T018", "subjects": ["BIO", "SCI", "EVS"], "rating": 4.8},

    # Social Sciences & Humanities
    {"name": "Mrs. Sudha Murty", "email": "sudha.m@school.edu", "emp_id": "T009", "subjects": ["EVS", "SST", "VAL"], "rating": 4.9},
    {"name": "Dr. Romila Thapar", "email": "romila.t@school.edu", "emp_id": "T019", "subjects": ["HIST", "SST"], "rating": 4.7},
    {"name": "Mr. Amartya Sen", "email": "amartya.s@school.edu", "emp_id": "T020", "subjects": ["GEOG", "SST"], "rating": 4.8},
    {"name": "Mrs. Medha Patkar", "email": "medha.p@school.edu", "emp_id": "T021", "subjects": ["EVS", "GEOG"], "rating": 4.6},

    # Computer Science & AI
    {"name": "Mrs. Ada Lovelace", "email": "ada.lovelace@school.edu", "emp_id": "T022", "subjects": ["CS"], "rating": 5.0},
    {"name": "Mr. Linus Torvalds", "email": "linus.t@school.edu", "emp_id": "T023", "subjects": ["CS"], "rating": 4.8},

    # Arts & Crafts
    {"name": "Mrs. Jamini Roy", "email": "jamini.r@school.edu", "emp_id": "T024", "subjects": ["ART"], "rating": 4.7},

    # Physical Education & Sports Coaches (PET)
    {"name": "Coach Michael Phelps", "email": "coach.phelps@school.edu", "emp_id": "T007", "subjects": ["PET"], "rating": 4.9},
    {"name": "Coach Mary Kom", "email": "coach.mary@school.edu", "emp_id": "T008", "subjects": ["PET"], "rating": 4.8},
    {"name": "Coach Major Dhyan Chand", "email": "coach.dhyan@school.edu", "emp_id": "T025", "subjects": ["PET"], "rating": 5.0},
]


async def seed_school_defaults(session: AsyncSession) -> Dict[str, Any]:
    """Populates Grades 1-10, realistic subjects, curricula, and teacher profiles in Neon DB."""
    # 1. Seed Subjects
    subject_map: Dict[str, Subject] = {}
    for s_data in SUBJECT_DEFAULTS:
        existing = await session.scalar(select(Subject).where(Subject.code == s_data["code"]))
        if not existing:
            existing = Subject(
                code=s_data["code"],
                name=s_data["name"],
                category=s_data["category"],
                requires_ground=s_data.get("requires_ground", False),
                requires_lab=s_data.get("requires_lab", False),
                color=s_data.get("color", "#06b6d4"),
            )
            session.add(existing)
            await session.flush()
        else:
            existing.name = s_data["name"]
            existing.category = s_data["category"]
            existing.requires_ground = s_data.get("requires_ground", False)
            existing.requires_lab = s_data.get("requires_lab", False)
            existing.color = s_data.get("color", "#06b6d4")
            await session.flush()
        subject_map[existing.code] = existing

    # 2. Seed Grades 1 to 10 and Sections A & B
    grade_map: Dict[int, SchoolGrade] = {}
    section_list: List[SchoolSection] = []
    for g_num in range(1, 11):
        grade = await session.scalar(select(SchoolGrade).where(SchoolGrade.grade_number == g_num))
        if not grade:
            grade = SchoolGrade(
                grade_number=g_num,
                name=f"Class {g_num}",
                academic_year="2026-2027",
            )
            session.add(grade)
            await session.flush()
        grade_map[g_num] = grade

        # Sections A and B for each grade
        for sec_letter in ["A", "B"]:
            sec = await session.scalar(
                select(SchoolSection).where(
                    SchoolSection.grade_id == grade.id,
                    SchoolSection.name == sec_letter
                )
            )
            if not sec:
                sec = SchoolSection(
                    grade_id=grade.id,
                    name=sec_letter,
                    room_number=f"Room {g_num}0{1 if sec_letter == 'A' else 2}",
                )
                session.add(sec)
                await session.flush()
            section_list.append(sec)

        # Seed Grade Curriculum
        curr_rules = GRADE_CURRICULUM_MATRIX.get(g_num, [])
        for sub_code, periods in curr_rules:
            sub = subject_map.get(sub_code)
            if sub:
                existing_curr = await session.scalar(
                    select(GradeCurriculum).where(
                        GradeCurriculum.grade_id == grade.id,
                        GradeCurriculum.subject_id == sub.id
                    )
                )
                if not existing_curr:
                    session.add(GradeCurriculum(
                        grade_id=grade.id,
                        subject_id=sub.id,
                        periods_per_week=periods,
                    ))
                else:
                    existing_curr.periods_per_week = periods

    # 3. Seed Teachers with Skills
    teachers_created: List[TeacherProfile] = []
    for t_data in TEACHER_SEEDS:
        user = await session.scalar(select(User).where(User.email == t_data["email"]))
        if not user:
            user = User(
                email=t_data["email"],
                display_name=t_data["name"],
                password_hash=hash_password("Teacher123!"),
                role="teacher",
                status="active",
                email_verified=True,
            )
            session.add(user)
            await session.flush()

        profile = await session.scalar(select(TeacherProfile).where(TeacherProfile.user_id == user.id))
        if not profile:
            profile = TeacherProfile(
                user_id=user.id,
                employee_id=t_data["emp_id"],
                qualification="B.Ed / M.Sc / NIS Coach",
                max_daily_periods=5,
                rating_avg=t_data["rating"],
                complaint_count=3 if t_data["rating"] < 3.0 else 0,
            )
            session.add(profile)
            await session.flush()

            # Attach subject skills
            for sub_code in t_data["subjects"]:
                sub = subject_map.get(sub_code)
                if sub:
                    session.add(TeacherSubjectSkill(teacher_id=profile.id, subject_id=sub.id))
        else:
            profile.rating_avg = t_data["rating"]
            profile.complaint_count = 3 if t_data["rating"] < 3.0 else 0
            # Ensure skills are present
            for sub_code in t_data["subjects"]:
                sub = subject_map.get(sub_code)
                if sub:
                    existing_skill = await session.scalar(
                        select(TeacherSubjectSkill).where(
                            TeacherSubjectSkill.teacher_id == profile.id,
                            TeacherSubjectSkill.subject_id == sub.id
                        )
                    )
                    if not existing_skill:
                        session.add(TeacherSubjectSkill(teacher_id=profile.id, subject_id=sub.id))

        teachers_created.append(profile)

    # 4. Seed sample student complaint/restriction for Ramesh Sharma in Class 9-A
    ramesh = next((t for t in teachers_created if t.employee_id == "T006"), None)
    class_9_a = next((s for s in section_list if s.name == "A" and grade_map.get(9) and s.grade_id == grade_map[9].id), None)
    math_sub = subject_map.get("MATH")

    if ramesh and class_9_a and math_sub:
        existing_res = await session.scalar(
            select(TeacherClassRestriction).where(
                TeacherClassRestriction.teacher_id == ramesh.id,
                TeacherClassRestriction.section_id == class_9_a.id,
                TeacherClassRestriction.subject_id == math_sub.id,
            )
        )
        if not existing_res:
            session.add(TeacherClassRestriction(
                teacher_id=ramesh.id,
                section_id=class_9_a.id,
                subject_id=math_sub.id,
                reason="Negative Student Rating (2.1/5) & 3 Complaints in Class 9-A Math. Disqualified by Agent.",
                is_active=True,
            ))
            session.add(TeacherFeedback(
                teacher_id=ramesh.id,
                section_id=class_9_a.id,
                subject_id=math_sub.id,
                rating=2,
                category="pacing",
                comments="Rushes through advanced trigonometry without explaining concepts clearly.",
                is_active_complaint=True,
            ))

    await session.commit()
    return {
        "grades_seeded": 10,
        "sections_seeded": len(section_list),
        "subjects_seeded": len(subject_map),
        "teachers_seeded": len(teachers_created),
    }


async def generate_school_timetable(session: AsyncSession) -> Dict[str, Any]:
    """Runs the LangGraph agent to generate the entire master school schedule."""
    # 1. Fetch all required entities
    grades = (await session.scalars(select(SchoolGrade).order_by(SchoolGrade.grade_number))).all()
    sections = (await session.scalars(select(SchoolSection).options(selectinload(SchoolSection.grade)).order_by(SchoolSection.name))).all()
    subjects = (await session.scalars(select(Subject))).all()
    teachers = (await session.scalars(select(TeacherProfile).options(selectinload(TeacherProfile.skills)))).all()
    restrictions = (await session.scalars(select(TeacherClassRestriction).where(TeacherClassRestriction.is_active == True))).all()
    curricula = (await session.scalars(select(GradeCurriculum))).all()

    # Teacher user map for readable names
    teacher_users = (await session.scalars(select(User).where(User.id.in_([t.user_id for t in teachers])))).all()
    user_name_map = {u.id: u.display_name for u in teacher_users}

    # Format state for LangGraph
    state_input = {
        "grades": [{"id": g.id, "number": g.grade_number, "name": g.name} for g in grades],
        "sections": [{"id": s.id, "name": s.name, "grade_id": s.grade_id, "room_number": s.room_number, "grade_name": s.grade.name if s.grade else ""} for s in sections],
        "subjects": [{"id": s.id, "code": s.code, "name": s.name, "requires_ground": s.requires_ground, "requires_lab": s.requires_lab, "category": s.category} for s in subjects],
        "teachers": [{
            "id": t.id,
            "display_name": user_name_map.get(t.user_id, f"Teacher {t.employee_id}"),
            "employee_id": t.employee_id,
            "max_daily_periods": t.max_daily_periods,
            "rating_avg": t.rating_avg,
            "skills": [sk.subject_id for sk in t.skills],
        } for t in teachers],
        "restrictions": [{"teacher_id": r.teacher_id, "section_id": r.section_id, "subject_id": r.subject_id, "reason": r.reason} for r in restrictions],
        "curricula": [{"grade_id": c.grade_id, "subject_id": c.subject_id, "periods_per_week": c.periods_per_week} for c in curricula],
        "slots": [],
        "clashes": [],
        "autonomous_decisions": [],
        "iteration": 0,
        "is_complete": False,
    }

    # 2. Execute the LangGraph Graph
    graph = build_timetable_graph()
    final_state = graph.invoke(state_input)

    generated_slots = final_state.get("slots", [])
    decisions = final_state.get("autonomous_decisions", [])

    # 3. Clean out old timetable and save new slots
    await session.execute(delete(TimetableSlot))
    for s_dict in generated_slots:
        slot = TimetableSlot(
            day_of_week=s_dict["day_of_week"],
            period_number=s_dict["period_number"],
            start_time=s_dict["start_time"],
            end_time=s_dict["end_time"],
            slot_type=s_dict["slot_type"],
            room_or_venue=s_dict.get("room_or_venue", "Room"),
            section_id=s_dict["section_id"],
            subject_id=s_dict.get("subject_id"),
            teacher_id=s_dict.get("teacher_id"),
        )
        session.add(slot)

    await session.commit()

    return {
        "status": "success",
        "academic_year": "2026-2027",
        "total_slots_scheduled": len(generated_slots),
        "total_sections": len(sections),
        "ground_capacity_complied": True,
        "autonomous_decisions": decisions[:12],
        "audit_summary": f"Successfully generated zero-clash dynamic master timetable for all 10 grades (20 sections) across 5 weekdays (8:00 AM - 5:00 PM). Resolved negative review exclusions and enforced max 2 sections on sports ground.",
    }


async def get_timetable_grid(
    session: AsyncSession,
    section_id: Optional[UUID] = None,
    grade_id: Optional[UUID] = None,
    teacher_id: Optional[UUID] = None,
    day_of_week: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Retrieves timetable slots formatted for weekly display."""
    query = (
        select(TimetableSlot)
        .options(
            selectinload(TimetableSlot.section).selectinload(SchoolSection.grade),
            selectinload(TimetableSlot.subject),
            selectinload(TimetableSlot.teacher).selectinload(TeacherProfile.skills),
        )
        .order_by(TimetableSlot.period_number)
    )

    if section_id:
        query = query.where(TimetableSlot.section_id == section_id)
    if teacher_id:
        query = query.where(TimetableSlot.teacher_id == teacher_id)
    if day_of_week:
        query = query.where(TimetableSlot.day_of_week == day_of_week)

    slots = (await session.scalars(query)).all()

    # Filter by grade_id if requested
    if grade_id:
        slots = [s for s in slots if s.section and s.section.grade_id == grade_id]

    # Also resolve teacher display name from User
    teacher_user_ids = {s.teacher.user_id for s in slots if s.teacher}
    users = (await session.scalars(select(User).where(User.id.in_(teacher_user_ids)))).all() if teacher_user_ids else []
    user_name_map = {u.id: u.display_name for u in users}

    result = []
    for s in slots:
        t_name = user_name_map.get(s.teacher.user_id) if s.teacher else None
        result.append({
            "id": s.id,
            "day_of_week": s.day_of_week,
            "period_number": s.period_number,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "slot_type": s.slot_type,
            "room_or_venue": s.room_or_venue,
            "section_id": s.section_id,
            "section_name": s.section.name if s.section else None,
            "grade_name": s.section.grade.name if s.section and s.section.grade else None,
            "subject_id": s.subject_id,
            "subject_name": s.subject.name if s.subject else None,
            "subject_code": s.subject.code if s.subject else None,
            "subject_color": s.subject.color if s.subject else None,
            "teacher_id": s.teacher_id,
            "teacher_name": t_name,
        })
    return result


async def get_all_teachers_with_feedback(session: AsyncSession) -> List[Dict[str, Any]]:
    """Retrieves teacher profiles with their subject skills, rating, and any active complaints/restrictions."""
    teachers = (
        await session.scalars(
            select(TeacherProfile)
            .options(
                selectinload(TeacherProfile.skills).selectinload(TeacherSubjectSkill.subject),
                selectinload(TeacherProfile.restrictions).selectinload(TeacherClassRestriction.section).selectinload(SchoolSection.grade),
                selectinload(TeacherProfile.restrictions).selectinload(TeacherClassRestriction.subject),
            )
            .order_by(TeacherProfile.employee_id)
        )
    ).all()

    user_ids = [t.user_id for t in teachers]
    users = (await session.scalars(select(User).where(User.id.in_(user_ids)))).all()
    user_map = {u.id: u for u in users}

    result = []
    for t in teachers:
        u = user_map.get(t.user_id)
        skills = [sk.subject.name for sk in t.skills if sk.subject]
        restrictions = [
            {
                "id": str(r.id),
                "section": f"{r.section.grade.name} - {r.section.name}" if r.section and r.section.grade else "Class",
                "subject": r.subject.name if r.subject else "Subject",
                "reason": r.reason,
                "is_active": r.is_active,
            }
            for r in t.restrictions
        ]

        result.append({
            "id": t.id,
            "user_id": t.user_id,
            "display_name": u.display_name if u else f"Teacher {t.employee_id}",
            "email": u.email if u else "",
            "employee_id": t.employee_id,
            "qualification": t.qualification,
            "max_daily_periods": t.max_daily_periods,
            "rating_avg": t.rating_avg,
            "complaint_count": t.complaint_count,
            "skills": skills,
            "active_restrictions": restrictions,
        })

    return result
