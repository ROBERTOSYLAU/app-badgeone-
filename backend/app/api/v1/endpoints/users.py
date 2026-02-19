from fastapi import APIRouter, Depends, HTTPException
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


@router.post("")
def create_user(payload: UserCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if payload.role not in {"admin", "issuer"}:
        raise HTTPException(status_code=400, detail="Role inválida")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")

    if payload.organization_id is not None:
        org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organização não encontrada")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
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
        "organization_id": user.organization_id,
    }


@router.get("")
def list_users(db: Session = Depends(get_db), _=Depends(require_admin)):
    users = db.query(User).order_by(User.id.desc()).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "organization_id": u.organization_id,
        }
        for u in users
    ]
