"""Application Configuration Module

Loads environment variables using Pydantic Settings with secure fallbacks.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/deadstock_db"

    # Security & JWT
    JWT_SECRET_KEY: str = "default-insecure-secret-key-please-override-in-production-min-32-chars"
    # Initial System Admin
    INITIAL_ADMIN_PASSWORD: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_MINUTES: int = 30
    JWT_REFRESH_TOKEN_DAYS: int = 7

    # CORS
    CORS_ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # Application & Environment
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    APP_NAME: str = "Dead Stock Inventory Management System"
    ORGANIZATION_NAME: str = "District Development Office – Gir Somnath, Veraval"

    # File Uploads
    STORAGE_UPLOAD_DIR: str = "storage/uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB

    # Defaults for Gujarat Panchayat Context
    DEFAULT_OFFICE_CODE: str = "OFF-GS-VRV-001"
    DEFAULT_OFFICE_NAME: str = "District Panchayat Office, Gir Somnath"
    DEFAULT_DISTRICT: str = "Gir Somnath"
    DEFAULT_TALUKA: str = "Veraval"
    DEFAULT_TIMEZONE: str = "Asia/Kolkata"
    DEFAULT_DATE_FORMAT: str = "DD/MM/YYYY"
    DEFAULT_CURRENCY: str = "INR"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ALLOWED_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()

