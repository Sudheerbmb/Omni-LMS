from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    app_name: str = "NexusLMS"
    app_version: str = "2.0.0"
    app_description: str = "Enterprise Learning Management System"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    api_prefix: str = "/api/v1"
    docs_url: str = "/docs"
    redoc_url: str = "/redoc"
    frontend_url: str = "http://localhost:5173"

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./lms.db"
    database_pool_size: int = 20
    database_max_overflow: int = 40
    database_echo: bool = False

    # ── Redis ────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 300

    # ── Auth & Security ───────────────────────────────────────────────────────
    jwt_secret: str = "CHANGE-ME-use-a-long-random-secret-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 30
    password_reset_token_minutes: int = 60
    email_verification_token_hours: int = 24
    max_login_attempts: int = 5
    lockout_minutes: int = 15

    # ── CORS ─────────────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str) -> str:
        return v

    def get_cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ── Bootstrap admin ──────────────────────────────────────────────────────
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: str | None = None
    bootstrap_admin_name: str = "Platform Administrator"

    # ── Email / SMTP ─────────────────────────────────────────────────────────
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    smtp_from_email: str = "noreply@nexuslms.io"
    smtp_from_name: str = "NexusLMS"
    email_enabled: bool = False

    # ── File Storage ─────────────────────────────────────────────────────────
    storage_backend: Literal["local", "s3"] = "local"
    local_upload_dir: str = "./uploads"
    max_upload_size_mb: int = 100

    # AWS S3 (used when storage_backend="s3")
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str = "us-east-1"
    s3_bucket: str | None = None
    s3_public_url: str | None = None

    # ── Zoom Integration ──────────────────────────────────────────────────────
    zoom_secret_token: str | None = None
    zoom_account_id: str | None = None
    zoom_client_id: str | None = None
    zoom_client_secret: str | None = None
    zoom_webhook_secret: str | None = None

    # ── Vimeo Integration ─────────────────────────────────────────────────────
    vimeo_access_token: str | None = None

    # ── AI / LLM Integration ──────────────────────────────────────────────────
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    ai_recommendations_enabled: bool = False
    ai_max_recommendations: int = 10

    # ── Celery / Background Tasks ─────────────────────────────────────────────
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # ── Observability ─────────────────────────────────────────────────────────
    sentry_dsn: str | None = None
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "console"

    # ── Rate limiting ─────────────────────────────────────────────────────────
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60

    # ── Pagination ────────────────────────────────────────────────────────────
    default_page_size: int = 20
    max_page_size: int = 100

    # ── Certificate ───────────────────────────────────────────────────────────
    certificate_issuer: str = "NexusLMS"
    certificate_signature: str = "Platform Administrator"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
