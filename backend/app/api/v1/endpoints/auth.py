from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import verify_password, create_access_token, hash_password
from app.core.auth import get_current_user
from app.models.user import User
from app.models.organization import Organization

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SeedAdminRequest(BaseModel):
    email: EmailStr = "admin@badgeone.com.br"
    password: str = "Admin@123"
    name: str = "Badge One Admin"


def _permissions_for(user: User) -> list[str]:
    if user.role == "admin":
        return ["admin:*", "org:*", "lot:*", "credential:*"]
    return ["org:read:self", "lot:read:self", "lot:issue:self", "credential:read:self", "credential:issue:self"]


def _build_login_payload(user: User, db: Session, token: str):
    org_name = None
    if user.organization_id is not None:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        org_name = org.name if org else None

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "user_name": user.name,
        "organization_id": user.organization_id,
        "organization_name": org_name,
        "permissions": _permissions_for(user),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "organization_id": user.organization_id,
            "organization_name": org_name,
            "permissions": _permissions_for(user),
        },
    }


@router.post("/seed-admin")
def seed_admin(payload: SeedAdminRequest, db: Session = Depends(get_db)):
    if settings.app_env == "production":
        raise HTTPException(status_code=403, detail="Seed admin desabilitado em produção")

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        return {"ok": True, "message": "admin already exists", "email": existing.email}

    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"ok": True, "id": user.id, "email": user.email}


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    if user.role == "issuer" and user.organization_id is None:
        raise HTTPException(status_code=403, detail="Usuário emissor sem organização vinculada")

    if user.role == "issuer" and user.organization_id is not None:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        if not org or org.status in {"inactive", "trashed"}:
            raise HTTPException(status_code=403, detail="Organização inativa ou indisponível")

    token = create_access_token(subject=str(user.id), role=user.role)

    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )

    return _build_login_payload(user, db, token)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(settings.auth_cookie_name, path="/")
    return {"ok": True}


@router.get("/me")
def me(request_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    token = create_access_token(subject=str(request_user.id), role=request_user.role)
    return _build_login_payload(request_user, db, token)


@router.post("/reset-admin")
def reset_admin(payload: SeedAdminRequest, db: Session = Depends(get_db)):
    if settings.app_env == "production":
        raise HTTPException(status_code=403, detail="Reset admin desabilitado em produção")

    user = db.query(User).filter(User.email == payload.email).first()

    if user:
        user.name = payload.name
        user.role = "admin"
        user.password_hash = hash_password(payload.password)
        db.commit()
        db.refresh(user)
        return {"ok": True, "message": "admin atualizado", "email": user.email}

    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"ok": True, "message": "admin criado", "email": user.email}
