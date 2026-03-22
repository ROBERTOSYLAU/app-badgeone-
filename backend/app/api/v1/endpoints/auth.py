import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import verify_password, create_access_token, hash_password
from app.core.auth import get_current_user, require_admin
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


@router.get("/onboarding-status")
def onboarding_status(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    """Retorna status do onboarding para guiar primeiro acesso do admin."""
    from app.models.lot import BadgeLot
    from app.models.credential import Credential
    
    org_count = db.query(Organization).count()
    user_count = db.query(User).filter(User.role == "issuer").count()
    lot_count = db.query(BadgeLot).count()
    cred_count = db.query(Credential).count()
    
    return {
        "has_organization": org_count > 0,
        "has_issuer_user": user_count > 0,
        "has_lot": lot_count > 0,
        "has_emission": cred_count > 0,
        "organization_count": org_count,
        "issuer_count": user_count,
        "lot_count": lot_count,
        "emission_count": cred_count,
        "completed": org_count > 0 and user_count > 0 and lot_count > 0 and cred_count > 0,
        "next_step": (
            "create_organization" if org_count == 0 else
            "create_issuer" if user_count == 0 else
            "create_lot" if lot_count == 0 else
            "emit_badge" if cred_count == 0 else
            "completed"
        )
    }


class SeedIssuerRequest(BaseModel):
    email: EmailStr = "issuer@badgeone.com.br"
    password: str = "Admin@123"
    name: str = "Badge One Emissor"
    org_name: str = "Badge One Org"


@router.post("/seed-issuer")
def seed_issuer(payload: SeedIssuerRequest, db: Session = Depends(get_db)):
    if settings.app_env == "production":
        raise HTTPException(status_code=403, detail="Seed issuer desabilitado em produção")

    # Create or find org
    org = db.query(Organization).filter(Organization.name == payload.org_name).first()
    if not org:
        org = Organization(name=payload.org_name, status="active")
        db.add(org)
        db.commit()
        db.refresh(org)

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        return {"ok": True, "message": "issuer already exists", "email": existing.email, "organization_id": org.id}

    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        role="issuer",
        organization_id=org.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"ok": True, "id": user.id, "email": user.email, "organization_id": org.id}


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


# ── Troca de senha/email (usuário autenticado) ──────────────────────────────

class UpdateMeRequest(BaseModel):
    email: EmailStr | None = None
    current_password: str
    new_password: str | None = None


@router.put("/me")
def update_me(payload: UpdateMeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")

    if payload.email and payload.email != current_user.email:
        if db.query(User).filter(User.email == payload.email, User.id != current_user.id).first():
            raise HTTPException(status_code=409, detail="E-mail já está em uso")
        current_user.email = payload.email

    if payload.new_password:
        if len(payload.new_password) < 6:
            raise HTTPException(status_code=400, detail="Nova senha deve ter no mínimo 6 caracteres")
        current_user.password_hash = hash_password(payload.new_password)
        if hasattr(current_user, "password_is_default"):
            current_user.password_is_default = False

    db.commit()
    return {"ok": True, "email": current_user.email}


# ── Esqueci minha senha ──────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    # Always return ok to avoid email enumeration
    if not user:
        return {"ok": True, "message": "Se o e-mail estiver cadastrado, você receberá o link."}

    token = secrets.token_urlsafe(32)
    user.password_reset_token = token
    user.password_reset_expires = datetime.utcnow() + timedelta(hours=2)
    db.commit()

    return {
        "ok": True,
        "message": "Link de redefinição gerado.",
        "reset_token": token,  # Em produção, enviar por e-mail
        "expires_in": "2 horas",
    }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Senha deve ter no mínimo 6 caracteres")

    user = db.query(User).filter(User.password_reset_token == payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido ou já utilizado")

    if user.password_reset_expires and datetime.utcnow() > user.password_reset_expires:
        raise HTTPException(status_code=400, detail="Token expirado. Solicite um novo link.")

    user.password_hash = hash_password(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    db.commit()

    return {"ok": True, "message": "Senha redefinida com sucesso"}
