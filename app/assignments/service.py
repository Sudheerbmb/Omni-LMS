from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.assignments.models import Assignment, AssignmentSubmission
from app.assignments.schemas import AssignmentCreate, GradeRequest, SubmissionCreate
from app.courses.models import Course
from app.enrollment.models import Enrollment
from app.identity.models import OrganizationMembership, User


class AssignmentNotFoundError(ValueError):
    pass


class AssignmentAccessError(ValueError):
    pass


class SubmissionAlreadyExistsError(ValueError):
    pass


async def create_assignment(session: AsyncSession, course_id: UUID, data: AssignmentCreate, user: User) -> Assignment:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == course.organization_id if course else None,
            OrganizationMembership.user_id == user.id,
        )
    )
    if not course or not membership:
        raise AssignmentAccessError("User cannot manage this course")
    assignment = Assignment(course_id=course_id, **data.model_dump())
    session.add(assignment)
    await session.commit()
    await session.refresh(assignment)
    return assignment


async def submit_assignment(session: AsyncSession, assignment_id: UUID, data: SubmissionCreate, user: User) -> AssignmentSubmission:
    assignment = await session.scalar(select(Assignment).where(Assignment.id == assignment_id))
    if not assignment:
        raise AssignmentNotFoundError("Assignment not found")
    enrollment = await session.scalar(
        select(Enrollment).where(Enrollment.course_id == assignment.course_id, Enrollment.user_id == user.id)
    )
    if not enrollment:
        raise AssignmentAccessError("User is not enrolled in this course")
    existing = await session.scalar(
        select(AssignmentSubmission).where(
            AssignmentSubmission.assignment_id == assignment_id,
            AssignmentSubmission.user_id == user.id,
        )
    )
    if existing:
        raise SubmissionAlreadyExistsError("A submission already exists for this assignment")
    submission = AssignmentSubmission(assignment_id=assignment_id, user_id=user.id, content=data.content)
    session.add(submission)
    await session.commit()
    await session.refresh(submission)
    return submission


async def grade_submission(session: AsyncSession, submission_id: UUID, data: GradeRequest, user: User) -> AssignmentSubmission:
    submission = await session.scalar(select(AssignmentSubmission).where(AssignmentSubmission.id == submission_id))
    if not submission:
        raise AssignmentNotFoundError("Submission not found")
    assignment = await session.scalar(select(Assignment).where(Assignment.id == submission.assignment_id))
    course = await session.scalar(select(Course).where(Course.id == assignment.course_id))
    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == course.organization_id,
            OrganizationMembership.user_id == user.id,
        )
    )
    if not membership:
        raise AssignmentAccessError("User cannot grade this assignment")
    if data.score > assignment.max_score:
        raise AssignmentAccessError("Score exceeds assignment maximum")
    submission.score = data.score
    submission.feedback = data.feedback
    submission.status = "graded"
    await session.commit()
    await session.refresh(submission)
    return submission
