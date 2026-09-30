from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.certification.schemas import CertificateRead
from app.certification.service import CompletionRequiredError, CourseNotFoundError, issue_certificate, verify_certificate
from app.identity.models import User
from app.identity.permissions import require_permission
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/certificates", tags=["certification"])


@router.post("/courses/{course_id}", response_model=CertificateRead, status_code=status.HTTP_201_CREATED)
async def issue(
    course_id: UUID,
    current_user: User = Depends(require_permission("certificate:view")),
    session: AsyncSession = Depends(get_session),
) -> CertificateRead:
    try:
        return await issue_certificate(session, course_id, current_user)
    except CourseNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CompletionRequiredError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/verify/{certificate_number}", response_model=CertificateRead)
async def verify(certificate_number: str, session: AsyncSession = Depends(get_session)) -> CertificateRead:
    certificate = await verify_certificate(session, certificate_number)
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return certificate
