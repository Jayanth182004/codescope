import os
from typing import List
from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "CodeScope AI"
    API_V1_STR: str = "/api/v1"
    
    # Security
    # In production, replace these with secure environment variables
    SECRET_KEY: str = os.getenv("SECRET_KEY", "codescope_super_secret_signing_key_387d89f2e3c09b7")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days for developer ease
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # DB Parameters
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./codescope.db")

    # File uploads — configurable for cloud storage in production
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()
