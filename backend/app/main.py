from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.api.v1.router import api_router
from app.core.db import Base, engine
from app.core.config import settings
from app.models import User, Organization, BadgeLot, Credential, OrganizationNote, AuditLog

app = FastAPI(
    title="Badge One App API",
    version="0.1.0",
    description="API do SaaS Badge One (Sprint 1)",
)

allowed_origins = [x.strip() for x in settings.cors_origins.split(",") if x.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    
    # Add missing columns to organizations table
    try:
        with engine.begin() as conn:
            # Organizations table columns
            conn.execute(text("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address TEXT"))
            conn.execute(text("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cnae VARCHAR(255)"))
            conn.execute(text("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS opening_date VARCHAR(20)"))
            conn.execute(text("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS regime VARCHAR(100)"))
            conn.execute(text("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"))
            # Other tables
            conn.execute(text("ALTER TABLE badge_lots ADD COLUMN IF NOT EXISTS title VARCHAR(180)"))
            conn.execute(text("ALTER TABLE badge_lots ADD COLUMN IF NOT EXISTS description VARCHAR(500)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(64)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE"))
            conn.execute(text("ALTER TABLE badge_lots ADD COLUMN IF NOT EXISTS original_title VARCHAR(180)"))
            conn.execute(text("ALTER TABLE badge_lots ADD COLUMN IF NOT EXISTS display_title VARCHAR(180)"))
            conn.execute(text("ALTER TABLE credentials ADD COLUMN IF NOT EXISTS issued_by_user_id INTEGER"))
            conn.execute(text("ALTER TABLE credentials ADD COLUMN IF NOT EXISTS recipient_cpf VARCHAR(14)"))
            conn.execute(text("ALTER TABLE credentials ADD COLUMN IF NOT EXISTS rectification_note VARCHAR(500)"))
            print("✅ Database migrations completed successfully")
    except Exception as e:
        print(f"⚠️ Migration warning (may already exist): {e}")


@app.get("/health")
def health():
    return {"status": "ok", "service": "badgeone-app-api"}
