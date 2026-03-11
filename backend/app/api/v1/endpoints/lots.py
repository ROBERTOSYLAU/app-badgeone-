from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_admin, require_issuer_or_admin
from app.core.db import get_db
from app.models.lot import BadgeLot
from app.models.organization import Organization

router = APIRouter()


class LotCreate(BaseModel):
    organization_id: int
    total_badges: int
    issue_window_days: int = 365


class LotUpdate(BaseModel):
    total_badges: int | None = None
    status: str | None = None


@router.post("")
def create_lot(payload: LotCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    lot = BadgeLot(
        organization_id=payload.organization_id,
        total_badges=payload.total_badges,
        issued=0,
        issue_window_days=payload.issue_window_days,
        status="active",
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return {
        "id": lot.id,
        "organization_id": lot.organization_id,
        "total_badges": lot.total_badges,
        "issued": lot.issued,
        "remaining": lot.total_badges - lot.issued,
        "issue_window_days": lot.issue_window_days,
        "status": lot.status,
    }


@router.patch("/{lot_id}")
def update_lot(lot_id: int, payload: LotUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    lot = db.query(BadgeLot).filter(BadgeLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lote não encontrado")

    if payload.total_badges is not None:
        if payload.total_badges < lot.issued:
            raise HTTPException(status_code=400, detail="Total não pode ser menor que emitidos")
        lot.total_badges = payload.total_badges

    if payload.status is not None:
        if payload.status not in {"active", "paused", "revoked", "finished"}:
            raise HTTPException(status_code=400, detail="Status inválido")
        lot.status = payload.status

    db.commit()
    db.refresh(lot)

    return {
        "id": lot.id,
        "organization_id": lot.organization_id,
        "total_badges": lot.total_badges,
        "issued": lot.issued,
        "remaining": lot.total_badges - lot.issued,
        "issue_window_days": lot.issue_window_days,
        "status": lot.status,
    }


@router.get("")
def list_lots(db: Session = Depends(get_db), _=Depends(require_issuer_or_admin)):
    data = db.query(BadgeLot).order_by(BadgeLot.id.desc()).all()
    return [
        {
            "id": x.id,
            "organization_id": x.organization_id,
            "total_badges": x.total_badges,
            "issued": x.issued,
            "remaining": x.total_badges - x.issued,
            "issue_window_days": x.issue_window_days,
            "status": x.status,
        }
        for x in data
    ]
