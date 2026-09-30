from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.models import LearningResource
from app.content.schemas import ResourceCreate
from app.courses.models import Course, CourseVersion
from app.identity.models import OrganizationMembership, User


class ContentAccessError(ValueError):
    pass


class CourseNotFoundError(ValueError):
    pass


async def create_resource(
    session: AsyncSession,
    course_id: UUID,
    data: ResourceCreate,
    owner: User,
) -> LearningResource:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise CourseNotFoundError("Course not found")

    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == course.organization_id,
            OrganizationMembership.user_id == owner.id,
        )
    )
    if not membership:
        raise ContentAccessError("User is not a member of this organization")

    version = await session.scalar(
        select(CourseVersion).where(
            CourseVersion.course_id == course.id,
            CourseVersion.version_number == course.current_version,
        )
    )
    resource = LearningResource(
        course_version_id=version.id,
        resource_type=data.resource_type,
        title=data.title,
        description=data.description,
        position=data.position,
        external_url=data.external_url,
    )
    session.add(resource)
    await session.commit()
    await session.refresh(resource)
    return resource
