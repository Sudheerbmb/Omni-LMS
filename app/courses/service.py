from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.courses.models import Category, Course, CourseReview, CourseVersion
from app.courses.schemas import CategoryCreate, CourseCreate, CourseUpdate, ReviewCreate
from app.identity.models import OrganizationMembership, User
from app.platform.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError


# ── Categories ────────────────────────────────────────────────────────────────

async def list_categories(session: AsyncSession) -> list[Category]:
    rows = await session.scalars(select(Category).order_by(Category.name))
    return list(rows.all())


async def create_category(session: AsyncSession, data: CategoryCreate) -> Category:
    existing = await session.scalar(select(Category).where(Category.slug == data.slug))
    if existing:
        raise ConflictError("A category with this slug already exists")
    cat = Category(**data.model_dump())
    session.add(cat)
    await session.commit()
    await session.refresh(cat)
    return cat


# ── Courses ────────────────────────────────────────────────────────────────────

async def create_course(session: AsyncSession, data: CourseCreate, owner: User) -> Course:
    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == data.organization_id,
            OrganizationMembership.user_id == owner.id,
        )
    )
    if not membership:
        raise ForbiddenError("You are not a member of this organization")

    existing = await session.scalar(
        select(Course).where(
            Course.organization_id == data.organization_id,
            Course.slug == data.slug,
        )
    )
    if existing:
        raise ConflictError("A course with this slug already exists in this organization")

    course_data = data.model_dump(exclude={"title", "description", "what_you_learn", "requirements", "target_audience"})
    course = Course(**course_data)
    session.add(course)
    await session.flush()

    session.add(CourseVersion(
        course_id=course.id,
        version_number=1,
        title=data.title,
        description=data.description,
        what_you_learn=data.what_you_learn,
        requirements=data.requirements,
        target_audience=data.target_audience,
    ))
    await session.commit()
    await session.refresh(course)
    return course


async def get_course(session: AsyncSession, course_id: UUID) -> Course:
    course = await session.scalar(
        select(Course)
        .where(Course.id == course_id)
        .options(selectinload(Course.versions))
    )
    if not course:
        raise NotFoundError("Course not found")
    return course


async def list_courses(
    session: AsyncSession,
    org_id: UUID | None = None,
    status: str | None = None,
    level: str | None = None,
    category_id: UUID | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Course], int]:
    q = select(Course)
    if org_id:
        q = q.where(Course.organization_id == org_id)
    if status:
        q = q.where(Course.status == status)
    if level:
        q = q.where(Course.level == level)
    if category_id:
        q = q.where(Course.category_id == category_id)
    if search:
        # Join to version for title search on current version
        q = q.join(
            CourseVersion,
            (CourseVersion.course_id == Course.id) & (CourseVersion.version_number == Course.current_version),
        ).where(CourseVersion.title.ilike(f"%{search}%"))

    total = await session.scalar(select(func.count()).select_from(q.subquery()))
    rows = await session.scalars(
        q.order_by(Course.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(rows.all()), total or 0


async def update_course(session: AsyncSession, course_id: UUID, data: CourseUpdate, user: User) -> Course:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise NotFoundError("Course not found")
    await _require_course_access(session, course, user)

    # Fields that go on Course directly
    course_fields = {
        "category_id", "level", "language", "tags", "estimated_hours",
        "max_students", "price", "is_free", "certificate_enabled",
        "is_featured", "promo_video_url",
    }
    # Fields that go on the current CourseVersion
    version_fields = {"title", "description", "what_you_learn", "requirements", "target_audience"}

    update_data = data.model_dump(exclude_none=True)

    for field, value in update_data.items():
        if field in course_fields:
            setattr(course, field, value)

    version_updates = {k: v for k, v in update_data.items() if k in version_fields}
    if version_updates:
        version = await session.scalar(
            select(CourseVersion).where(
                CourseVersion.course_id == course_id,
                CourseVersion.version_number == course.current_version,
            )
        )
        if version:
            for field, value in version_updates.items():
                setattr(version, field, value)

    await session.commit()
    await session.refresh(course)
    return course


async def publish_course(session: AsyncSession, course_id: UUID, user: User) -> Course:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise NotFoundError("Course not found")
    await _require_course_access(session, course, user)
    if course.status == "published":
        raise ConflictError("Course is already published")
    course.status = "published"
    await session.commit()
    await session.refresh(course)
    return course


async def archive_course(session: AsyncSession, course_id: UUID, user: User) -> Course:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise NotFoundError("Course not found")
    await _require_course_access(session, course, user)
    course.status = "archived"
    await session.commit()
    await session.refresh(course)
    return course


async def upload_thumbnail(session: AsyncSession, course_id: UUID, url: str, user: User) -> Course:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise NotFoundError("Course not found")
    await _require_course_access(session, course, user)
    course.thumbnail_url = url
    await session.commit()
    await session.refresh(course)
    return course


# ── Reviews ───────────────────────────────────────────────────────────────────

async def create_review(
    session: AsyncSession, course_id: UUID, data: ReviewCreate, user: User
) -> CourseReview:
    from app.enrollment.models import Enrollment
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise NotFoundError("Course not found")
    enrollment = await session.scalar(
        select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.user_id == user.id)
    )
    if not enrollment:
        raise ForbiddenError("You must be enrolled to leave a review")
    existing = await session.scalar(
        select(CourseReview).where(CourseReview.course_id == course_id, CourseReview.user_id == user.id)
    )
    if existing:
        raise ConflictError("You have already reviewed this course")

    review = CourseReview(course_id=course_id, user_id=user.id, **data.model_dump())
    session.add(review)
    await session.flush()

    # Recalculate avg rating
    stats = await session.execute(
        select(func.avg(CourseReview.rating), func.count(CourseReview.id))
        .where(CourseReview.course_id == course_id)
    )
    avg, count = stats.one()
    course.rating_avg = round(float(avg or 0), 2)
    course.rating_count = count or 0

    await session.commit()
    await session.refresh(review)
    return review


async def list_reviews(session: AsyncSession, course_id: UUID) -> list[CourseReview]:
    rows = await session.scalars(
        select(CourseReview)
        .where(CourseReview.course_id == course_id)
        .order_by(CourseReview.created_at.desc())
    )
    return list(rows.all())


# ── Helper ────────────────────────────────────────────────────────────────────

async def _require_course_access(session: AsyncSession, course: Course, user: User) -> None:
    if user.role == "admin":
        return
    membership = await session.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == course.organization_id,
            OrganizationMembership.user_id == user.id,
        )
    )
    if not membership:
        raise ForbiddenError("You do not have access to this course")
