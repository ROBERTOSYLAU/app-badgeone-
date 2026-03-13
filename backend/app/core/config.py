from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "Badge One API"
    database_url: str = "sqlite:///./badgeone.db"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12

    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    auth_cookie_name: str = "badgeone_session"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: str = "lax"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

if settings.app_env == "production" and settings.jwt_secret in {"change-me", "", "changeme"}:
    raise RuntimeError("JWT_SECRET inseguro para produção. Defina valor forte no ambiente.")
