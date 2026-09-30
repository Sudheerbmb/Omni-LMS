import hashlib
import hmac
import os
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.assessment import models as assessment_models  # noqa: F401
from app.assessment.router import router as assessment_router
from app.admin import router as admin_router
from app.ai import models as ai_models  # noqa: F401
from app.ai.router import router as intelligence_router
from app.assignments import models as assignment_models  # noqa: F401
from app.assignments.router import router as assignments_router
from app.identity.router import router as identity_router
from app.notifications import models as notification_models  # noqa: F401
from app.notifications.router import router as notifications_router
from app.identity import models as identity_models  # noqa: F401
from app.courses.router import router as courses_router
from app.courses import models as course_models  # noqa: F401
from app.content.router import router as content_router
from app.dashboard import router as dashboard_router
from app.certification import models as certificate_models  # noqa: F401
from app.certification.router import router as certification_router
from app.classroom import models as classroom_models  # noqa: F401
from app.classroom.router import router as classroom_router
from app.coding import models as coding_models  # noqa: F401
from app.coding.router import router as coding_router
from app.communication import models as communication_models  # noqa: F401
from app.communication.router import router as communication_router
from app.enrollment.router import router as enrollment_router
from app.learning.router import router as learning_router
from app.platform.config import settings
from app.platform.database import init_database
from app.platform.errors import unhandled_exception_handler
from app.platform.logging import configure_logging
from app.tenancy.router import router as tenancy_router
from app.vimeo import upload_zoom_recording
from app.tenancy import models as tenancy_models  # noqa: F401

load_dotenv()
configure_logging()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.environment == "development":
        await init_database()
    yield

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(Exception, unhandled_exception_handler)
app.include_router(identity_router)
app.include_router(notifications_router)
app.include_router(tenancy_router)
app.include_router(courses_router)
app.include_router(content_router)
app.include_router(enrollment_router)
app.include_router(learning_router)
app.include_router(assessment_router)
app.include_router(admin_router)
app.include_router(dashboard_router)
app.include_router(intelligence_router)
app.include_router(assignments_router)
app.include_router(certification_router)
app.include_router(classroom_router)
app.include_router(coding_router)
app.include_router(communication_router)

ZOOM_SECRET_TOKEN = settings.zoom_secret_token or os.getenv("ZOOM_SECRET_TOKEN")


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "zoom-lms-integration"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }


@app.get("/ready")
async def ready():
    return {
        "status": "ready",
        "environment": settings.environment,
    }


@app.post("/api/zoom/webhook")
async def zoom_webhook(request: Request):
    body = await request.json()
    event = body.get("event")

    # Zoom endpoint URL validation
    if event == "endpoint.url_validation":
        if not ZOOM_SECRET_TOKEN:
            raise HTTPException(
                status_code=500,
                detail="ZOOM_SECRET_TOKEN is not configured"
            )

        payload = body.get("payload", {})
        plain_token = payload.get("plainToken")

        if not plain_token:
            raise HTTPException(
                status_code=400,
                detail="Missing plainToken"
            )

        encrypted_token = hmac.new(
            ZOOM_SECRET_TOKEN.encode("utf-8"),
            plain_token.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        return {
            "plainToken": plain_token,
            "encryptedToken": encrypted_token
        }

    print(f"Received Zoom event: {event}")

    if event == "recording.completed":
        print("======================================")
        print("ZOOM RECORDING COMPLETED")
        print("======================================")
        print(body)

        zoom_object = body.get("payload", {}).get("object", {})
        recording_files = zoom_object.get("recording_files", [])
        download_token = zoom_object.get("download_token")
        for recording in recording_files:
            if recording.get("file_type") == "MP4" and recording.get("recording_type") == "shared_screen_with_speaker_view":
                try:
                    vimeo_uri = await upload_zoom_recording(
                        {**recording, "download_token": recording.get("download_token") or download_token}
                    )
                    print(f"Uploaded recording to Vimeo: {vimeo_uri}")
                except (RuntimeError, ValueError, httpx.HTTPError) as error:
                    print(f"Vimeo upload failed: {error}")
                break

    return {
        "status": "received"
    }
