"""
Badge One — endpoints de licença de assinatura digital.

Regras:
  - Ao criar um lote, a organização ganha 1 ano de licença grátis (tipo=bonus)
  - Se já tem licença ativa, a validade é estendida em +1 ano
  - Renovação manual (tipo=paid) cria nova licença por 1 ano a partir de hoje
  - sign/prepare valida se a org tem licença ativa antes de prosseguir
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import require_issuer_or_admin, require_admin
from app.core.db import get_db
from app.models.user import User
from app.models.licenca_assinatura import LicencaAssinatura

router = APIRouter()


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


def conceder_ou_estender_licenca(
    db: Session,
    organization_id: int,
    tipo: str = "bonus",
    lote_origem_id: int | None = None,
) -> LicencaAssinatura:
    """
    Cria ou estende a licença de assinatura da organização por +1 ano.
    Chamado automaticamente ao criar um lote.
    """
    agora = datetime.now(timezone.utc)
    licenca = _licenca_ativa(db, organization_id)

    if licenca:
        # Estende a validade existente por mais 1 ano
        licenca.valid_until = licenca.valid_until + timedelta(days=365)
        db.add(licenca)
    else:
        # Cria nova licença
        licenca = LicencaAssinatura(
            organization_id=organization_id,
            valid_from=agora,
            valid_until=agora + timedelta(days=365),
            tipo=tipo,
            lote_origem_id=lote_origem_id,
            status="active",
        )
        db.add(licenca)

    db.commit()
    db.refresh(licenca)
    return licenca


@router.get("/status")
def get_licenca_status(
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    """Retorna o status da licença de assinatura da organização do usuário logado."""
    if not user.organization_id:
        return {"ativa": False, "motivo": "sem_organizacao"}

    licenca = _licenca_ativa(db, user.organization_id)

    if not licenca:
        return {"ativa": False, "motivo": "sem_licenca"}

    dias_restantes = (licenca.valid_until.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).days

    return {
        "ativa": True,
        "valid_until": licenca.valid_until.isoformat(),
        "dias_restantes": dias_restantes,
        "tipo": licenca.tipo,
        "alerta": dias_restantes <= 30,
    }


@router.post("/renovar")
def renovar_licenca(
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    """
    Renova (ou cria) a licença de assinatura por +1 ano — tipo paid.
    Futuramente integrará com gateway de pagamento.
    """
    if not user.organization_id:
        raise HTTPException(status_code=400, detail="Usuário sem organização vinculada")

    licenca = conceder_ou_estender_licenca(
        db,
        organization_id=user.organization_id,
        tipo="paid",
    )

    dias_restantes = (licenca.valid_until.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).days

    return {
        "mensagem": "Licença renovada com sucesso",
        "valid_until": licenca.valid_until.isoformat(),
        "dias_restantes": dias_restantes,
        "tipo": licenca.tipo,
    }


@router.get("/admin/todas")
def listar_licencas(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Lista todas as licenças — admin only."""
    licencas = db.query(LicencaAssinatura).order_by(LicencaAssinatura.id.desc()).limit(500).all()
    agora = datetime.now(timezone.utc)
    return [
        {
            "id": l.id,
            "organization_id": l.organization_id,
            "valid_from": l.valid_from.isoformat() if l.valid_from else None,
            "valid_until": l.valid_until.isoformat(),
            "tipo": l.tipo,
            "status": l.status,
            "lote_origem_id": l.lote_origem_id,
            "ativa": l.status == "active" and l.valid_until.replace(tzinfo=timezone.utc) > agora,
        }
        for l in licencas
    ]
