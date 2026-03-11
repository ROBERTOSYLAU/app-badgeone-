from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.db import Base, engine
from app.models import User, Organization, BadgeLot, Credential, OrganizationNote

app = FastAPI(
    title="Badge One App API",
    version="0.1.0",
    description="API do SaaS Badge One (Sprint 1)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok", "service": "badgeone-app-api"}
