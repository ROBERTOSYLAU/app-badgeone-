from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.auth import require_admin, require_issuer_or_admin
from app.models.user import User
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


def _safe_issue_window_days(obj) -> int:
    try:
        value = getattr(obj, "issue_window_days", None)
        if value is None:
            return 365
        return int(value)
    except Exception:
        return 365


def _remaining(obj) -> int:
    try:
        return int(obj.total_badges) - int(obj.issued)
    except Exception:
        return 0


def ensure_lot_columns(db: Session):
    """
    Garante que a coluna issue_window_days exista.
    Isso evita erro 500 ao listar/criar lotes em bases antigas.
    """
    table_name = getattr(BadgeLot, "__tablename__", "badge_lots")

    try:
        result = db.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = :table_name
                """
            ),
            {"table_name": table_name},
        )

        existing_columns = {row[0] for row in result}

        if "issue_window_days" not in existing_columns:
            db.execute(
                text(
                    f"""
                    ALTER TABLE {table_name}
                    ADD COLUMN issue_window_days INTEGER NOT NULL DEFAULT 365
                    """
                )
            )
            db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao preparar estrutura de lotes: {str(e)}",
        )


@router.post("/migrate/add-fields")
def migrate_lots_add_fields(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    ensure_lot_columns(db)
    return {"ok": True, "message": "Migração de lotes concluída com sucesso."}


@router.post("")
def create_lot(
    payload: LotCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    ensure_lot_columns(db)

    if payload.total_badges <= 0:
        raise HTTPException(status_code=400, detail="Quantidade de badges deve ser maior que zero")

    if payload.issue_window_days <= 0:
        raise HTTPException(status_code=400, detail="Janela de emissão deve ser maior que zero")

    org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    if getattr(org, "status", None) == "trashed":
        raise HTTPException(status_code=400, detail="Não é possível criar lote para organização na lixeira")

    try:
        lot = BadgeLot(
            organization_id=payload.organization_id,
            title=(payload.title or "").strip() or None,
            description=(payload.description or "").strip() or None,
            total_badges=payload.total_badges,
            issued=0,
            status="active",
        )

        if hasattr(lot, "issue_window_days"):
            lot.issue_window_days = payload.issue_window_days

        db.add(lot)
        db.flush()

        log_action(
            db,
            "lot",
            lot.id,
            "create",
            f"Lote criado: total={lot.total_badges}, status={lot.status}, org={lot.organization_id}",
        )

        db.commit()
        db.refresh(lot)

        return {
            "id": lot.id,
            "organization_id": lot.organization_id,
            "title": lot.title,
            "description": lot.description,
            "total_badges": lot.total_badges,
            "issued": lot.issued,
            "remaining": _remaining(lot),
            "issue_window_days": _safe_issue_window_days(lot),
            "status": lot.status,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro interno ao criar lote: {str(e)}")


@router.patch("/{lot_id}")
def update_lot(
    lot_id: int,
    payload: LotUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    ensure_lot_columns(db)

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

    if before != after:
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
        "remaining": _remaining(lot),
        "issue_window_days": _safe_issue_window_days(lot),
        "status": lot.status,
    }


@router.post("/{lot_id}/revoke")
def revoke_lot(
    lot_id: int,
    payload: LotRevokeRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    ensure_lot_columns(db)

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
            raise HTTPException(
                status_code=400,
                detail=f"Quantidade maior que saldo disponível ({available})",
            )

        lot.total_badges = lot.total_badges - qty
        log_action(
            db,
            "lot",
            lot.id,
            "revoke_partial",
            f"Revogado parcialmente: {qty}. Novo total={lot.total_badges}",
        )

    db.commit()
    db.refresh(lot)

    return {
        "id": lot.id,
        "status": lot.status,
        "total_badges": lot.total_badges,
        "issued": lot.issued,
        "remaining": _remaining(lot),
        "issue_window_days": _safe_issue_window_days(lot),
    }


@router.post("/{lot_id}/recover")
def recover_lot(
    lot_id: int,
    payload: LotRecoverRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    ensure_lot_columns(db)

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

    log_action(
        db,
        "lot",
        lot.id,
        "recover",
        f"Recuperado: status {before_status}->{lot.status}, quantidade+={qty}",
    )

    db.commit()
    db.refresh(lot)

    return {
        "id": lot.id,
        "status": lot.status,
        "total_badges": lot.total_badges,
        "issued": lot.issued,
        "remaining": _remaining(lot),
        "issue_window_days": _safe_issue_window_days(lot),
    }


@router.get("")
def list_lots(
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    ensure_lot_columns(db)

    q = db.query(BadgeLot)

    if user.role == "issuer":
        if user.organization_id is None:
            return []
        q = q.filter(BadgeLot.organization_id == user.organization_id)

    try:
        data = q.order_by(BadgeLot.id.desc()).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar lotes: {str(e)}")

    return [
        {
            "id": x.id,
            "organization_id": x.organization_id,
            "title": x.title,
            "description": x.description,
            "total_badges": x.total_badges,
            "issued": x.issued,
            "remaining": _remaining(x),
            "issue_window_days": _safe_issue_window_days(x),
            "status": x.status,
        }
        for x in data
    ]
