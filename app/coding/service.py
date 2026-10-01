from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.coding.models import CodeSubmission, CodingExercise
from app.coding.schemas import CodeSubmissionCreate, ExerciseCreate, ExerciseUpdate
from app.courses.models import Course
from app.enrollment.models import Enrollment
from app.identity.models import OrganizationMembership, User
from app.learning.adaptive import record_evidence
from app.learning.schemas import EvidenceCreate


class CodingAccessError(ValueError):
    pass


class CodingNotFoundError(ValueError):
    pass


async def _get_course_for_exercise(session: AsyncSession, course_id: UUID) -> Course:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise CodingNotFoundError("Course not found")
    return course


async def _is_course_manager(session: AsyncSession, course: Course, user: User) -> bool:
    if user.role == "admin":
        return True
    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == course.organization_id,
            OrganizationMembership.user_id == user.id,
        )
    )
    return membership is not None


async def _check_course_manager(session: AsyncSession, course: Course, user: User) -> None:
    if not await _is_course_manager(session, course, user):
        raise CodingAccessError("User cannot manage this course")


async def _check_course_access(session: AsyncSession, course: Course, user: User) -> None:
    if await _is_course_manager(session, course, user):
        return
    enrollment = await session.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course.id,
            Enrollment.user_id == user.id,
        )
    )
    if not enrollment:
        raise CodingAccessError("User is not enrolled in this course")


async def create_exercise(session: AsyncSession, course_id: UUID, data: ExerciseCreate, user: User) -> CodingExercise:
    course = await _get_course_for_exercise(session, course_id)
    await _check_course_manager(session, course, user)
    exercise = CodingExercise(course_id=course_id, **data.model_dump())
    session.add(exercise)
    await session.commit()
    await session.refresh(exercise)
    return exercise


async def get_exercise(session: AsyncSession, exercise_id: UUID, user: User) -> CodingExercise:
    exercise = await session.scalar(select(CodingExercise).where(CodingExercise.id == exercise_id))
    if not exercise:
        raise CodingNotFoundError("Coding exercise not found")
    course = await _get_course_for_exercise(session, exercise.course_id)
    await _check_course_access(session, course, user)
    return exercise


async def list_exercises(session: AsyncSession, course_id: UUID, user: User) -> list[CodingExercise]:
    course = await _get_course_for_exercise(session, course_id)
    await _check_course_access(session, course, user)
    result = await session.scalars(
        select(CodingExercise)
        .where(CodingExercise.course_id == course_id)
        .order_by(CodingExercise.created_at.asc())
    )
    return list(result.all())


async def update_exercise(
    session: AsyncSession, exercise_id: UUID, data: ExerciseUpdate, user: User
) -> CodingExercise:
    exercise = await session.scalar(select(CodingExercise).where(CodingExercise.id == exercise_id))
    if not exercise:
        raise CodingNotFoundError("Coding exercise not found")
    course = await _get_course_for_exercise(session, exercise.course_id)
    await _check_course_manager(session, course, user)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(exercise, field, value)

    await session.commit()
    await session.refresh(exercise)
    return exercise


async def delete_exercise(session: AsyncSession, exercise_id: UUID, user: User) -> None:
    exercise = await session.scalar(select(CodingExercise).where(CodingExercise.id == exercise_id))
    if not exercise:
        raise CodingNotFoundError("Coding exercise not found")
    course = await _get_course_for_exercise(session, exercise.course_id)
    await _check_course_manager(session, course, user)

    await session.delete(exercise)
    await session.commit()


async def submit_code(session: AsyncSession, exercise_id: UUID, data: CodeSubmissionCreate, user: User) -> CodeSubmission:
    exercise = await session.scalar(select(CodingExercise).where(CodingExercise.id == exercise_id))
    if not exercise:
        raise CodingNotFoundError("Coding exercise not found")
    enrollment = await session.scalar(
        select(Enrollment).where(Enrollment.course_id == exercise.course_id, Enrollment.user_id == user.id)
    )
    if not enrollment:
        raise CodingAccessError("User is not enrolled in this course")
    submission = CodeSubmission(
        exercise_id=exercise_id,
        user_id=user.id,
        language=exercise.language,
        source_code=data.source_code,
    )
    session.add(submission)
    await session.commit()
    await session.refresh(submission)
    return submission


async def get_submission(session: AsyncSession, submission_id: UUID, user: User) -> CodeSubmission:
    submission = await session.scalar(select(CodeSubmission).where(CodeSubmission.id == submission_id))
    if not submission:
        raise CodingNotFoundError("Code submission not found")
    if submission.user_id == user.id:
        return submission

    exercise = await session.scalar(select(CodingExercise).where(CodingExercise.id == submission.exercise_id))
    if not exercise:
        raise CodingNotFoundError("Coding exercise not found")
    course = await _get_course_for_exercise(session, exercise.course_id)
    if not await _is_course_manager(session, course, user):
        raise CodingAccessError("User cannot view this submission")
    return submission


async def list_submissions(session: AsyncSession, exercise_id: UUID, user: User) -> list[CodeSubmission]:
    exercise = await session.scalar(select(CodingExercise).where(CodingExercise.id == exercise_id))
    if not exercise:
        raise CodingNotFoundError("Coding exercise not found")
    course = await _get_course_for_exercise(session, exercise.course_id)

    query = select(CodeSubmission).where(CodeSubmission.exercise_id == exercise_id)
    if not await _is_course_manager(session, course, user):
        # Enrolled student can only view their own submissions
        await _check_course_access(session, course, user)
        query = query.where(CodeSubmission.user_id == user.id)

    query = query.order_by(CodeSubmission.created_at.desc())
    result = await session.scalars(query)
    return list(result.all())


async def get_latest_submission(session: AsyncSession, exercise_id: UUID, user: User) -> CodeSubmission | None:
    exercise = await session.scalar(select(CodingExercise).where(CodingExercise.id == exercise_id))
    if not exercise:
        raise CodingNotFoundError("Coding exercise not found")
    course = await _get_course_for_exercise(session, exercise.course_id)
    await _check_course_access(session, course, user)

    return await session.scalar(
        select(CodeSubmission)
        .where(CodeSubmission.exercise_id == exercise_id, CodeSubmission.user_id == user.id)
        .order_by(CodeSubmission.created_at.desc())
    )


async def update_submission_result(
    session: AsyncSession,
    submission_id: UUID,
    status: str,
    result: dict | None = None,
    user: User | None = None,
) -> CodeSubmission:
    submission = await session.scalar(select(CodeSubmission).where(CodeSubmission.id == submission_id))
    if not submission:
        raise CodingNotFoundError("Code submission not found")

    if user is not None:
        exercise = await session.scalar(select(CodingExercise).where(CodingExercise.id == submission.exercise_id))
        if not exercise:
            raise CodingNotFoundError("Coding exercise not found")
        course = await _get_course_for_exercise(session, exercise.course_id)
        await _check_course_manager(session, course, user)

    submission.status = status
    if result is not None:
        submission.result = result

    if status in {"completed", "passed", "failed"}:
        exercise = await session.scalar(select(CodingExercise).where(CodingExercise.id == submission.exercise_id))
        passed = status == "passed" or bool((result or {}).get("passed"))
        test_total = int((result or {}).get("tests_total") or 0)
        test_passed = int((result or {}).get("tests_passed") or 0)
        observed_score = (test_passed / test_total) if test_total else (1.0 if passed else 0.0)
        evidence_actor = user or await session.get(User, submission.user_id)
        if evidence_actor and exercise:
            await record_evidence(session, evidence_actor, EvidenceCreate(
                user_id=submission.user_id,
                course_id=exercise.course_id,
                concept=exercise.title,
                evidence_type="transfer",
                score=observed_score,
                difficulty=0.65,
                transfer_distance=0.7,
                metadata={"exercise_id": str(exercise.id), "submission_id": str(submission.id)},
            ))

    await session.commit()
    await session.refresh(submission)
    return submission
