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


class LotRevokeRequest(BaseModel):
    mode: str = "full"  # full | partial
    quantity: int | None = None


class LotRecoverRequest(BaseModel):
    quantity: int | None = None
    to_status: str = "active"


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


@router.post("/{lot_id}/revoke")
def revoke_lot(lot_id: int, payload: LotRevokeRequest, db: Session = Depends(get_db), _=Depends(require_admin)):
    lot = db.query(BadgeLot).filter(BadgeLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lote não encontrado")

    if payload.mode not in {"full", "partial"}:
        raise HTTPException(status_code=400, detail="Modo inválido")

    if payload.mode == "full":
        lot.status = "revoked"
        log_action(db, "lot", lot.id, "revoke_full", f"Revogação total do lote {lot.id}")
    else:
        qty = payload.quantity or 0
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Quantidade inválida")
        available = lot.total_badges - lot.issued
        if qty > available:
            raise HTTPException(status_code=400, detail=f"Quantidade maior que saldo disponível ({available})")
        lot.total_badges = lot.total_badges - qty
        log_action(db, "lot", lot.id, "revoke_partial", f"Revogado parcialmente: {qty}. Novo total={lot.total_badges}")

    db.commit()
    db.refresh(lot)
    return {
        "id": lot.id,
        "status": lot.status,
        "total_badges": lot.total_badges,
        "issued": lot.issued,
        "remaining": lot.total_badges - lot.issued,
    }


@router.post("/{lot_id}/recover")
def recover_lot(lot_id: int, payload: LotRecoverRequest, db: Session = Depends(get_db), _=Depends(require_admin)):
    lot = db.query(BadgeLot).filter(BadgeLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lote não encontrado")

    qty = payload.quantity or 0
    if qty > 0:
        lot.total_badges = lot.total_badges + qty

    if payload.to_status not in {"active", "paused", "revoked", "finished", "trashed"}:
        raise HTTPException(status_code=400, detail="Status de recuperação inválido")

    before_status = lot.status
    lot.status = payload.to_status
    log_action(db, "lot", lot.id, "recover", f"Recuperado: status {before_status}->{lot.status}, quantidade+={qty}")

    db.commit()
    db.refresh(lot)
    return {
        "id": lot.id,
        "status": lot.status,
        "total_badges": lot.total_badges,
        "issued": lot.issued,
        "remaining": lot.total_badges - lot.issued,
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
