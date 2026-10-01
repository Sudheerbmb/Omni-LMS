import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class LensSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Service & Multi-Tenancy
    app_name: str = "LENS-Ω + SN1 Adaptive Intelligence Platform"
    app_version: str = "1.0.0"
    environment: str = "development"
    default_tenant_id: str = "default_school_tenant"
    
    # LENS Independent Database
    # Defaults to shared PostgreSQL or dedicated lens_omega database
    database_url: str = os.getenv(
        "LENS_DATABASE_URL",
        os.getenv("DATABASE_URL", "postgresql+asyncpg://app_user:app_password@localhost:5432/omni_lms")
    )
    
    # Redis for Streams & Caching
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    stream_key: str = "lens:events:stream"
    consumer_group: str = "lens_processors"
    
    # Existing LMS Connection
    lms_api_url: str = os.getenv("LMS_API_URL", "http://localhost:8000")
    lms_service_token: str = os.getenv("LMS_SERVICE_TOKEN", "lens_omega_internal_token_secure")
    
    # LLM Provider Configuration (Section 48, 49)
    llm_provider: str = os.getenv("LLM_PROVIDER", "groq")  # groq, openai, anthropic, local
    groq_api_key: Optional[str] = os.getenv("GROQ_API_KEY")
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    anthropic_api_key: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    
    # Model Routing (Section 49)
    fast_classification_model: str = "llama-3.1-8b-instant"
    planning_model: str = "llama-3.3-70b-versatile"
    student_chat_model: str = "llama-3.3-70b-versatile"
    complex_reasoning_model: str = "llama-3.3-70b-versatile"
    
    # Mathematical Model & Policy Versions (Section 58)
    model_version: str = "lens_model_v1"
    policy_version: str = "policy_v1"
    
    # Identifiability Threshold (Section 20)
    minimum_identifiability: float = 0.50
    default_learning_capacity_hours: float = 2.0


settings = LensSettings()
