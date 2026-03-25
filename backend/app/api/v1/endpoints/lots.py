from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime

from app.core.auth import require_admin, require_issuer_or_admin
from app.models.user import User
from app.core.db import get_db
from app.models.lot import BadgeLot
from app.models.organization import Organization
from app.models.lote_documento import LoteDocumento
from app.core.audit import log_action
from app.api.v1.endpoints.licenca import conceder_ou_estender_licenca

router = APIRouter()


class LotCreate(BaseModel):
    organization_id: int
    title: str | None = None
    description: str | None = None
    total_badges: int
    issue_window_days: int = 365
    start_date: str | None = None
    end_date: str | None = None


class LotUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    total_badges: int | None = None
    status: str | None = None
    issue_window_days: int | None = None
    start_date: str | None = None
    end_date: str | None = None


class LotRevokeRequest(BaseModel):
    mode: str = "full"
    quantity: int | None = None


class LotRecoverRequest(BaseModel):
    quantity: int | None = None
    to_status: str = "active"


def _remaining(obj) -> int:
    try:
        return int(obj.total_badges) - int(obj.issued)
    except Exception:
        return 0


def _safe_issue_window_days(obj) -> int:
    try:
        value = getattr(obj, "issue_window_days", None)
        if value is None:
            return 365
        return int(value)
    except Exception:
        return 365


def _safe_created_at(obj):
    try:
        value = getattr(obj, "created_at", None)
        return value.isoformat() if value else None
    except Exception:
        return None


def _safe_dt(obj, field: str):
    try:
        value = getattr(obj, field, None)
        return value.isoformat() if value else None
    except Exception:
        return None


def _parse_dt(value: str | None):
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def ensure_lot_columns(db: Session):
    """
    Corrige bancos antigos que ainda não têm as colunas novas.
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

        if "created_at" not in existing_columns:
            db.execute(
                text(
                    f"""
                    ALTER TABLE {table_name}
                    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    """
                )
            )

        if "start_date" not in existing_columns:
            db.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN start_date TIMESTAMP WITH TIME ZONE")
            )

        if "end_date" not in existing_columns:
            db.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN end_date TIMESTAMP WITH TIME ZONE")
            )

        if "imagem_url" not in existing_columns:
            db.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN imagem_url VARCHAR(500)")
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
        start_dt = _parse_dt(payload.start_date)
        end_dt = _parse_dt(payload.end_date)

        # Auto-compute days from date range if provided
        issue_days = payload.issue_window_days
        if start_dt and end_dt and end_dt > start_dt:
            issue_days = max(1, (end_dt - start_dt).days)

        lot = BadgeLot(
            organization_id=payload.organization_id,
            title=(payload.title or "").strip() or None,
            description=(payload.description or "").strip() or None,
            total_badges=payload.total_badges,
            issued=0,
            status="active",
        )

        if hasattr(lot, "issue_window_days"):
            lot.issue_window_days = issue_days
        if hasattr(lot, "start_date"):
            lot.start_date = start_dt
        if hasattr(lot, "end_date"):
            lot.end_date = end_dt

        # Preservar título original imutável
        original = (payload.title or "").strip() or None
        if hasattr(lot, "original_title"):
            lot.original_title = original
        if hasattr(lot, "display_title"):
            lot.display_title = None  # issuer define depois se quiser

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

        # Conceder ou estender licença de assinatura por +1 ano (bonus ao criar lote)
        try:
            conceder_ou_estender_licenca(
                db,
                organization_id=lot.organization_id,
                tipo="bonus",
                lote_origem_id=lot.id,
            )
        except Exception:
            pass  # falha silenciosa — não impede criação do lote

        return {
            "id": lot.id,
            "organization_id": lot.organization_id,
            "title": lot.title,
            "description": lot.description,
            "total_badges": lot.total_badges,
            "issued": lot.issued,
            "remaining": _remaining(lot),
            "issue_window_days": _safe_issue_window_days(lot),
            "start_date": _safe_dt(lot, "start_date"),
            "end_date": _safe_dt(lot, "end_date"),
            "status": lot.status,
            "created_at": _safe_created_at(lot),
            "imagem_url": getattr(lot, "imagem_url", None),
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
        new_title = (payload.title or "").strip() or None
        lot.title = new_title
        # Sincroniza original_title se ainda não foi definido
        if hasattr(lot, "original_title") and not lot.original_title:
            lot.original_title = new_title

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

    if payload.issue_window_days is not None:
        lot.issue_window_days = payload.issue_window_days

    if payload.start_date is not None:
        start_dt = _parse_dt(payload.start_date)
        if hasattr(lot, "start_date"):
            lot.start_date = start_dt

    if payload.end_date is not None:
        end_dt = _parse_dt(payload.end_date)
        if hasattr(lot, "end_date"):
            lot.end_date = end_dt

    # Auto-compute days if both dates provided
    if payload.start_date and payload.end_date:
        s = _parse_dt(payload.start_date)
        e = _parse_dt(payload.end_date)
        if s and e and e > s:
            lot.issue_window_days = max(1, (e - s).days)

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
        "start_date": _safe_dt(lot, "start_date"),
        "end_date": _safe_dt(lot, "end_date"),
        "status": lot.status,
        "created_at": _safe_created_at(lot),
        "original_title": getattr(lot, "original_title", None),
        "display_title": getattr(lot, "display_title", None),
        "imagem_url": getattr(lot, "imagem_url", None),
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
        "created_at": _safe_created_at(lot),
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
        "created_at": _safe_created_at(lot),
    }


class LotRenameRequest(BaseModel):
    display_title: str


@router.patch("/{lot_id}/rename")
def rename_lot(
    lot_id: int,
    payload: LotRenameRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    ensure_lot_columns(db)
    lot = db.query(BadgeLot).filter(BadgeLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    if user.role == "issuer" and lot.organization_id != user.organization_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    new_name = (payload.display_title or "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Nome não pode ser vazio")
    if hasattr(lot, "display_title"):
        lot.display_title = new_name
    log_action(db, "lot", lot.id, "rename", f"display_title={new_name} por user={user.id}")
    db.commit()
    db.refresh(lot)
    return {"id": lot.id, "display_title": getattr(lot, "display_title", None), "original_title": getattr(lot, "original_title", None)}


class LotStatusRequest(BaseModel):
    status: str


@router.patch("/{lot_id}/set-status")
def set_lot_status(
    lot_id: int,
    payload: LotStatusRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    ensure_lot_columns(db)
    lot = db.query(BadgeLot).filter(BadgeLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    if user.role == "issuer" and lot.organization_id != user.organization_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    allowed = {"active", "paused", "revoked"} if user.role == "issuer" else {"active", "paused", "revoked", "finished", "trashed"}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status inválido para seu perfil")
    before = lot.status
    lot.status = payload.status
    log_action(db, "lot", lot.id, "status_change", f"{before}->{lot.status} por user={user.id}")
    db.commit()
    db.refresh(lot)
    return {"id": lot.id, "status": lot.status, "remaining": _remaining(lot)}


@router.delete("/{lot_id}")
def delete_lot(
    lot_id: int,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    lot = db.query(BadgeLot).filter(BadgeLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lote não encontrado")

    if not force:
        lot.status = "trashed"
        log_action(db, "lot", lot.id, "trash", f"Lote movido para lixeira")
        db.commit()
        return {"ok": True, "mode": "trashed", "id": lot_id}

    try:
        log_action(db, "lot", lot.id, "delete_permanent", f"Lote excluído permanentemente")
        db.delete(lot)
        db.commit()
        return {"ok": True, "mode": "deleted", "id": lot_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao excluir lote: {str(e)}")


@router.post("/{lot_id}/upload-imagem")
async def upload_lot_image(
    lot_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    from app.integrations.r2_storage import upload_file

    lot = db.query(BadgeLot).filter(BadgeLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    if user.role == "issuer" and lot.organization_id != user.organization_id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Formato inválido. Use JPEG, PNG, GIF ou WebP.")

    content = await file.read()
    ext = (file.filename or "img").rsplit(".", 1)[-1].lower() or "jpg"
    key = f"lot-images/{lot_id}.{ext}"
    url = upload_file(content, key, file.content_type or "image/jpeg")

    if hasattr(lot, "imagem_url"):
        lot.imagem_url = url
    log_action(db, "lot", lot.id, "upload_imagem", f"Imagem enviada para {url}")
    db.commit()
    db.refresh(lot)
    return {"imagem_url": url}


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

    # Check which lots have a documento model
    lot_ids = [x.id for x in data]
    doc_lot_ids: set[int] = set()
    if lot_ids:
        docs = db.query(LoteDocumento.lote_id).filter(LoteDocumento.lote_id.in_(lot_ids)).all()
        doc_lot_ids = {row.lote_id for row in docs}

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
            "start_date": _safe_dt(x, "start_date"),
            "end_date": _safe_dt(x, "end_date"),
            "status": x.status,
            "created_at": _safe_created_at(x),
            "original_title": getattr(x, "original_title", None),
            "display_title": getattr(x, "display_title", None),
            "tem_documento": x.id in doc_lot_ids,
            "imagem_url": getattr(x, "imagem_url", None),
        }
        for x in data
    ]
