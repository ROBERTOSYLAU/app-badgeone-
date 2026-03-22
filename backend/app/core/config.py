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

    # Polygon / blockchain
    polygon_rpc_url: str = "https://polygon-rpc.com"
    polygon_private_key: str = ""
    polygon_contract_address: str = ""
    polygonscan_api_key: str = ""
    badge_verify_base_url: str = "https://app.badgeone.com.br/verify"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

if settings.app_env == "production" and settings.jwt_secret in {"change-me", "", "changeme"}:
    raise RuntimeError("JWT_SECRET inseguro para produção. Defina valor forte no ambiente.")
