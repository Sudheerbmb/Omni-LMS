from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.courses.schemas import (
    CategoryCreate,
    CategoryRead,
    CourseCreate,
    CourseDetailRead,
    CourseRead,
    CourseUpdate,
    ReviewCreate,
    ReviewRead,
)
from app.courses.service import (
    archive_course,
    create_category,
    create_course,
    create_review,
    get_course,
    list_categories,
    list_courses,
    list_reviews,
    publish_course,
    update_course,
    upload_thumbnail,
)
from app.identity.auth import get_current_user
from app.identity.models import User
from app.identity.permissions import require_permission
from app.platform.database import get_session
from app.platform.errors import LMSError
from app.platform.storage import upload_file

router = APIRouter(prefix="/api/v1/courses", tags=["courses"])


def _err(exc: LMSError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryRead])
async def get_categories(session: AsyncSession = Depends(get_session)) -> list[CategoryRead]:
    cats = await list_categories(session)
    return [CategoryRead.model_validate(c) for c in cats]


@router.post("/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_cat(
    data: CategoryCreate,
    _: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CategoryRead:
    try:
        cat = await create_category(session, data)
        return CategoryRead.model_validate(cat)
    except LMSError as exc:
        raise _err(exc) from exc


# ── Courses ───────────────────────────────────────────────────────────────────

@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
async def create(
    data: CourseCreate,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CourseRead:
    try:
        course = await create_course(session, data, current_user)
        return CourseRead.model_validate(course)
    except LMSError as exc:
        raise _err(exc) from exc


@router.get("", response_model=dict)
async def list_all(
    org_id: UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    level: str | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> dict:
    try:
        courses, total = await list_courses(
            session, org_id=org_id, status=status_filter, level=level,
            category_id=category_id, search=search, page=page, page_size=page_size,
        )
        pages = max(1, (total + page_size - 1) // page_size)
        return {
            "items": [CourseRead.model_validate(c).model_dump() for c in courses],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages,
        }
    except LMSError as exc:
        raise _err(exc) from exc


@router.get("/{course_id}", response_model=CourseDetailRead)
async def get_one(
    course_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> CourseDetailRead:
    try:
        course = await get_course(session, course_id)
        return CourseDetailRead.model_validate(course)
    except LMSError as exc:
        raise _err(exc) from exc


@router.patch("/{course_id}", response_model=CourseRead)
async def update(
    course_id: UUID,
    data: CourseUpdate,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CourseRead:
    try:
        course = await update_course(session, course_id, data, current_user)
        return CourseRead.model_validate(course)
    except LMSError as exc:
        raise _err(exc) from exc


@router.post("/{course_id}/publish", response_model=CourseRead)
async def publish(
    course_id: UUID,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CourseRead:
    try:
        course = await publish_course(session, course_id, current_user)
        return CourseRead.model_validate(course)
    except LMSError as exc:
        raise _err(exc) from exc


@router.post("/{course_id}/archive", response_model=CourseRead)
async def archive(
    course_id: UUID,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CourseRead:
    try:
        course = await archive_course(session, course_id, current_user)
        return CourseRead.model_validate(course)
    except LMSError as exc:
        raise _err(exc) from exc


@router.post("/{course_id}/thumbnail", response_model=CourseRead)
async def upload_course_thumbnail(
    course_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CourseRead:
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WEBP images allowed")
    data_bytes = await file.read()
    url = await upload_file(data_bytes, file.filename or "thumb.jpg", prefix="thumbnails")
    try:
        course = await upload_thumbnail(session, course_id, url, current_user)
        return CourseRead.model_validate(course)
    except LMSError as exc:
        raise _err(exc) from exc


# ── Reviews ───────────────────────────────────────────────────────────────────

@router.post("/{course_id}/reviews", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
async def add_review(
    course_id: UUID,
    data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ReviewRead:
    try:
        review = await create_review(session, course_id, data, current_user)
        return ReviewRead.model_validate(review)
    except LMSError as exc:
        raise _err(exc) from exc


@router.get("/{course_id}/reviews", response_model=list[ReviewRead])
async def get_reviews(
    course_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> list[ReviewRead]:
    reviews = await list_reviews(session, course_id)
    return [ReviewRead.model_validate(r) for r in reviews]
