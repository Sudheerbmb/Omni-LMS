import traceback

from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.platform.logging import get_logger

logger = get_logger(__name__)


# ── Domain exceptions ─────────────────────────────────────────────────────────

class LMSError(Exception):
    """Base class for all LMS domain errors."""
    status_code: int = status.HTTP_400_BAD_REQUEST

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(LMSError):
    status_code = status.HTTP_404_NOT_FOUND


class ConflictError(LMSError):
    status_code = status.HTTP_409_CONFLICT


class ForbiddenError(LMSError):
    status_code = status.HTTP_403_FORBIDDEN


class UnauthorizedError(LMSError):
    status_code = status.HTTP_401_UNAUTHORIZED


class ValidationError(LMSError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT


class RateLimitError(LMSError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS


# ── Exception handlers ────────────────────────────────────────────────────────

async def lms_error_handler(request: Request, exc: LMSError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "error_type": type(exc).__name__},
    )


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    logger.warning("database_integrity_error", error=str(exc.orig), path=request.url.path)
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "A resource with that value already exists.", "error_type": "ConflictError"},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        traceback=traceback.format_exc(),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred.", "error_type": "InternalError"},
    )
