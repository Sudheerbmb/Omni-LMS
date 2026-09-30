from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.assessment.models import Assessment, AssessmentAttempt, AssessmentQuestion
from app.assessment.schemas import AssessmentCreate, AttemptCreate, QuestionCreate
from app.courses.models import Course
from app.identity.models import OrganizationMembership, User
from app.enrollment.models import Enrollment


class AssessmentNotFoundError(ValueError):
    pass


class AssessmentAccessError(ValueError):
    pass


async def create_assessment(session: AsyncSession, course_id: UUID, data: AssessmentCreate, user: User) -> Assessment:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == course.organization_id if course else None,
            OrganizationMembership.user_id == user.id,
        )
    )
    if not course or not membership:
        raise AssessmentAccessError("User cannot manage this course")
    assessment = Assessment(course_id=course_id, title=data.title, passing_score=data.passing_score)
    session.add(assessment)
    await session.commit()
    await session.refresh(assessment)
    return assessment


async def add_question(session: AsyncSession, assessment_id: UUID, data: QuestionCreate, user: User) -> AssessmentQuestion:
    assessment = await session.scalar(select(Assessment).where(Assessment.id == assessment_id))
    if not assessment:
        raise AssessmentNotFoundError("Assessment not found")
    course = await session.scalar(select(Course).where(Course.id == assessment.course_id))
    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == course.organization_id,
            OrganizationMembership.user_id == user.id,
        )
    )
    if not membership:
        raise AssessmentAccessError("User cannot manage this assessment")
    question = AssessmentQuestion(
        assessment_id=assessment_id,
        prompt=data.prompt,
        options=data.options,
        correct_answer=data.correct_answer,
        position=data.position,
    )
    session.add(question)
    await session.commit()
    await session.refresh(question)
    return question


async def submit_attempt(session: AsyncSession, assessment_id: UUID, data: AttemptCreate, user: User) -> AssessmentAttempt:
    assessment = await session.scalar(select(Assessment).where(Assessment.id == assessment_id))
    if not assessment:
        raise AssessmentNotFoundError("Assessment not found")
    enrollment = await session.scalar(
        select(Enrollment).where(Enrollment.course_id == assessment.course_id, Enrollment.user_id == user.id)
    )
    if not enrollment:
        raise AssessmentAccessError("User is not enrolled in this course")
    questions = list((await session.scalars(
        select(AssessmentQuestion).where(AssessmentQuestion.assessment_id == assessment_id)
    )).all())
    correct = sum(1 for question in questions if data.answers.get(question.id) == question.correct_answer)
    score = round(correct / len(questions) * 100) if questions else 0
    attempt = AssessmentAttempt(
        assessment_id=assessment_id,
        user_id=user.id,
        answers={str(key): value for key, value in data.answers.items()},
        score=score,
        passed=score >= assessment.passing_score,
    )
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)
    return attempt
