from fastapi import APIRouter
from app.api.v1.endpoints import auth, organizations, lots, users, credentials, organization_notes, audit_logs, lot_notes

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(lots.router, prefix="/lots", tags=["lots"])
api_router.include_router(credentials.router, prefix="/credentials", tags=["credentials"])
api_router.include_router(organization_notes.router, prefix="/organization-notes", tags=["organization-notes"])
api_router.include_router(lot_notes.router, prefix="/lot-notes", tags=["lot-notes"])
api_router.include_router(audit_logs.router, prefix="/audit-logs", tags=["audit-logs"])
