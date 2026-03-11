from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import verify_password, create_access_token, hash_password
from app.models.user import User

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SeedAdminRequest(BaseModel):
    email: EmailStr = "admin@badgeone.com.br"
    password: str = "Admin@123"
    name: str = "Badge One Admin"


@router.post("/seed-admin")
def seed_admin(payload: SeedAdminRequest, db: Session = Depends(get_db)):
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
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    token = create_access_token(subject=str(user.id), role=user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user": {"id": user.id, "email": user.email, "name": user.name},
    }


@router.post("/reset-admin")
def reset_admin(payload: SeedAdminRequest, db: Session = Depends(get_db)):
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
