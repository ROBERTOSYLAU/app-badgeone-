from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_admin, require_issuer_or_admin
from app.core.db import get_db
from app.models.lot import BadgeLot
from app.models.organization import Organization
from app.core.audit import log_action

router = APIRouter()


class LotCreate(BaseModel):
    organization_id: int
    title: str | None = None
    description: str | None = None
    total_badges: int
    issue_window_days: int = 365


class LotUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    total_badges: int | None = None
    status: str | None = None


@router.post("")
def create_lot(payload: LotCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    lot = BadgeLot(
        organization_id=payload.organization_id,
        title=(payload.title or "").strip() or None,
        description=(payload.description or "").strip() or None,
        total_badges=payload.total_badges,
        issued=0,
        issue_window_days=payload.issue_window_days,
        status="active",
    )
    db.add(lot)
    db.flush()
    log_action(db, "lot", lot.id, "create", f"Lote criado: total={lot.total_badges}, status={lot.status}, org={lot.organization_id}")
    db.commit()
    db.refresh(lot)
    return {
        "id": lot.id,
        "organization_id": lot.organization_id,
        "title": lot.title,
        "description": lot.description,
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

    before = f"title={lot.title}, total={lot.total_badges}, status={lot.status}"

    if payload.title is not None:
        lot.title = (payload.title or "").strip() or None

    if payload.description is not None:
        lot.description = (payload.description or "").strip() or None

    if payload.total_badges is not None:
        if payload.total_badges < lot.issued:
            raise HTTPException(status_code=400, detail="Total não pode ser menor que emitidos")
        lot.total_badges = payload.total_badges

    if payload.status is not None:
        if payload.status not in {"active", "paused", "revoked", "finished", "trashed"}:
            raise HTTPException(status_code=400, detail="Status inválido")
        lot.status = payload.status

    after = f"title={lot.title}, total={lot.total_badges}, status={lot.status}"
    log_action(db, "lot", lot.id, "update", f"{before} -> {after}")
    db.commit()
    db.refresh(lot)

    return {
        "id": lot.id,
        "organization_id": lot.organization_id,
        "title": lot.title,
        "description": lot.description,
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
            "title": x.title,
            "description": x.description,
            "total_badges": x.total_badges,
            "issued": x.issued,
            "remaining": x.total_badges - x.issued,
            "issue_window_days": x.issue_window_days,
            "status": x.status,
        }
        for x in data
    ]
