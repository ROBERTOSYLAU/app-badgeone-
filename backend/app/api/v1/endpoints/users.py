from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.db import get_db
from app.core.security import hash_password
from app.models.user import User
from app.models.organization import Organization

router = APIRouter()


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "issuer"
    organization_id: int | None = None
    status: str = "active"


@router.post("")
def create_user(payload: UserCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if payload.role not in {"admin", "issuer"}:
        raise HTTPException(status_code=400, detail="Role inválida")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")

    if payload.role == "issuer" and payload.organization_id is None:
        raise HTTPException(status_code=400, detail="Emissor deve estar vinculado a uma organização")

    if payload.organization_id is not None:
        org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organização não encontrada")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        status=payload.status if payload.status in {"active", "inactive"} else "active",
        organization_id=payload.organization_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "organization_id": user.organization_id,
    }


@router.get("")
def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
    organization_id: int | None = Query(default=None),
):
    q = db.query(User).order_by(User.id.desc())
    if organization_id is not None:
        q = q.filter(User.organization_id == organization_id)
    users = q.all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "status": u.status,
            "organization_id": u.organization_id,
            "password_is_default": getattr(u, "password_is_default", True),
        }
        for u in users
    ]


class UserEmailUpdate(BaseModel):
    email: EmailStr


@router.patch("/{user_id}")
def update_user(user_id: int, payload: UserEmailUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Admin atualiza o e-mail do emissor vinculado à organização."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if db.query(User).filter(User.email == payload.email, User.id != user_id).first():
        raise HTTPException(status_code=409, detail="E-mail já está em uso")
    user.email = payload.email
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "password_is_default": getattr(user, "password_is_default", True),
    }


@router.post("/{user_id}/reset-password")
def admin_reset_user_password(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Admin redefine a senha do emissor para o padrão Emissor123."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user.password_hash = hash_password("Emissor123")
    user.password_reset_token = None
    user.password_reset_expires = None
    if hasattr(user, "password_is_default"):
        user.password_is_default = True
    db.commit()
    return {"ok": True, "message": "Senha redefinida para Emissor123"}
