from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Truetime API"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost/truetime"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    ingestion_enabled: bool = False
    ingestion_poll_interval_seconds: int = 60
    ingestion_connection_timeout: int = 10
    ingestion_force_udp: bool = False
    auto_run_migrations: bool = False

    access_token_expire_minutes: int = 60
    secret_key: str = "changeme"
    token_algorithm: str = "HS256"

    default_admin_email: str | None = "admin@truetime.local"
    default_admin_password: str | None = "ChangeMe123!"
    default_admin_full_name: str = "Primary Administrator"

    class Config:
        env_prefix = "TRUETIME_"
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
