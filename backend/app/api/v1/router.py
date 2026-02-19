from fastapi import APIRouter
from app.api.v1.endpoints import auth, organizations, lots, users, credentials

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(lots.router, prefix="/lots", tags=["lots"])
api_router.include_router(credentials.router, prefix="/credentials", tags=["credentials"])
