"""
Badge One — endpoints de licença de assinatura digital.

Regras:
  - Licença só pode ser concedida/renovada pelo ADMIN
  - Admin escolhe: anual (padrão = hoje + 1 ano) ou data personalizada
  - Ao criar lote: concede automaticamente licença bonus (só se org não tiver licença ativa)
  - Issuer NÃO pode ativar nem renovar pelo painel — apenas consultar status
  - sign/prepare valida:
      1. Tem licença ativa → prossegue normalmente
      2. Não tem licença MAS tem badges → retorna 402 com "usar_badge: true" e saldo
      3. Não tem nenhum → 403 "licenca_inativa"
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_issuer_or_admin, require_admin
from app.core.db import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.licenca_assinatura import LicencaAssinatura
from app.models.lot import BadgeLot

router = APIRouter()


# ── helpers ──────────────────────────────────────────────────────────────────

def _licenca_ativa(db: Session, organization_id: int) -> LicencaAssinatura | None:
    """Retorna a licença ativa mais recente da organização, ou None."""
    agora = datetime.now(timezone.utc)
    return (
        db.query(LicencaAssinatura)
        .filter(
            LicencaAssinatura.organization_id == organization_id,
            LicencaAssinatura.status == "active",
            LicencaAssinatura.valid_until > agora,
        )
        .order_by(LicencaAssinatura.valid_until.desc())
        .first()
    )


def _saldo_badges(db: Session, organization_id: int) -> int:
    """Retorna total de badges disponíveis (remaining) da org."""
    lots = (
        db.query(BadgeLot)
        .filter(
            BadgeLot.organization_id == organization_id,
            BadgeLot.status == "active",
        )
        .all()
    )
    return sum(max(0, (l.total_badges or 0) - (l.issued or 0)) for l in lots)


def conceder_ou_estender_licenca(
    db: Session,
    organization_id: int,
    tipo: str = "bonus",
    lote_origem_id: int | None = None,
    valid_until: datetime | None = None,
) -> LicencaAssinatura:
    """
    Cria nova licença para a organização.
    Se já existe licença ativa, NÃO estende — cria uma nova paralela.
    valid_until padrão: hoje + 1 ano.
    """
    agora = datetime.now(timezone.utc)
    licenca = LicencaAssinatura(
        organization_id=organization_id,
        valid_from=agora,
        valid_until=valid_until or (agora + timedelta(days=365)),
        tipo=tipo,
        lote_origem_id=lote_origem_id,
        status="active",
    )
    db.add(licenca)
    db.commit()
    db.refresh(licenca)
    return licenca


# ── endpoints issuer (somente leitura) ────────────────────────────────────────

@router.get("/status")
def get_licenca_status(
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    """Retorna o status da licença e saldo de badges da org do usuário logado."""
    if not user.organization_id:
        return {"ativa": False, "motivo": "sem_organizacao", "saldo_badges": 0}

    licenca = _licenca_ativa(db, user.organization_id)
    saldo = _saldo_badges(db, user.organization_id)

    if not licenca:
        return {
            "ativa": False,
            "motivo": "sem_licenca",
            "saldo_badges": saldo,
        }

    dias_restantes = (licenca.valid_until.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).days

    return {
        "ativa": True,
        "valid_until": licenca.valid_until.isoformat(),
        "dias_restantes": dias_restantes,
        "tipo": licenca.tipo,
        "alerta": dias_restantes <= 30,
        "saldo_badges": saldo,
    }


# ── endpoints admin ────────────────────────────────────────────────────────────

class ConcederLicencaRequest(BaseModel):
    organization_id: int
    tipo: str = "anual"          # anual | custom
    valid_until: str | None = None   # ISO date, obrigatório se tipo=custom


@router.post("/admin/conceder")
def admin_conceder_licenca(
    payload: ConcederLicencaRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin concede ou renova licença para uma organização."""
    org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    agora = datetime.now(timezone.utc)

    if payload.tipo == "custom":
        if not payload.valid_until:
            raise HTTPException(status_code=400, detail="valid_until é obrigatório para tipo=custom")
        try:
            vencimento = datetime.fromisoformat(payload.valid_until.replace("Z", "+00:00"))
            if vencimento.tzinfo is None:
                vencimento = vencimento.replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="valid_until inválido — use formato ISO 8601")
        if vencimento <= agora:
            raise HTTPException(status_code=400, detail="Data de vencimento deve ser futura")
    else:
        vencimento = agora + timedelta(days=365)

    licenca = conceder_ou_estender_licenca(
        db,
        organization_id=payload.organization_id,
        tipo="admin_anual" if payload.tipo == "anual" else "admin_custom",
        valid_until=vencimento,
    )

    dias_restantes = (vencimento.replace(tzinfo=timezone.utc) - agora).days

    return {
        "mensagem": f"Licença concedida para {org.name}",
        "organization_id": org.id,
        "org_nome": org.name,
        "valid_until": licenca.valid_until.isoformat(),
        "dias_restantes": dias_restantes,
        "tipo": licenca.tipo,
    }


@router.get("/admin/todas")
def listar_licencas(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Lista todas as licenças com nome da organização — admin only."""
    licencas = db.query(LicencaAssinatura).order_by(LicencaAssinatura.id.desc()).limit(500).all()
    org_ids = list({l.organization_id for l in licencas})
    orgs_map = {
        o.id: o for o in db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    } if org_ids else {}
    agora = datetime.now(timezone.utc)

    return [
        {
            "id": l.id,
            "organization_id": l.organization_id,
            "org_nome": orgs_map[l.organization_id].name if l.organization_id in orgs_map else None,
            "valid_from": l.valid_from.isoformat() if l.valid_from else None,
            "valid_until": l.valid_until.isoformat(),
            "tipo": l.tipo,
            "status": l.status,
            "lote_origem_id": l.lote_origem_id,
            "ativa": l.status == "active" and l.valid_until.replace(tzinfo=timezone.utc) > agora,
            "dias_restantes": max(0, (l.valid_until.replace(tzinfo=timezone.utc) - agora).days),
        }
        for l in licencas
    ]
