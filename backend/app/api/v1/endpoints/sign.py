"""
Badge One Sign — endpoints para assinatura digital de documentos avulsos.

Fluxo de dois passos:
  1. POST /sign/prepare  → gera publicId, registra na blockchain, salva no banco (pending)
  2. POST /sign/upload   → recebe o PDF estampado, salva no R2, atualiza banco (complete)

Verificação pública (sem auth):
  GET  /sign/verify/{public_id}
"""

import json
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_issuer_or_admin, enforce_org_access
from app.core.config import settings
from app.core.db import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.lot import BadgeLot
from app.models.assinatura_digital import AssinaturaDigital
from app.models.transacao_blockchain import TransacaoBlockchain
from app.integrations.blockchain import register_document
from app.integrations.r2_storage import upload_file
from app.api.v1.endpoints.licenca import _licenca_ativa, _saldo_badges

router = APIRouter()


class PrepareRequest(BaseModel):
    pdf_hash: str          # SHA-256 hex do PDF original
    titulo: str
    finalidade: str
    partes_envolvidas: str
    descricao: str = ""
    usar_badge: bool = False   # true = consumir 1 badge do lote ao invés da licença


@router.post("/prepare")
def sign_prepare(
    payload: PrepareRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    """
    Passo 1: registra o documento na blockchain e cria o registro no banco com status 'pending'.
    Retorna publicId + tokenId + txHash para que o frontend possa renderizar o carimbo.
    """
    org_id = user.organization_id
    if not org_id:
        raise HTTPException(status_code=400, detail="Usuário sem organização vinculada")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    # Validar licença de assinatura ativa
    licenca = _licenca_ativa(db, org_id)
    saldo = _saldo_badges(db, org_id)

    if not licenca:
        if saldo > 0 and not payload.usar_badge:
            # Tem badges mas não escolheu usar — pede confirmação ao frontend
            raise HTTPException(
                status_code=402,
                detail={
                    "codigo": "usar_badge_disponivel",
                    "mensagem": f"Você não possui licença ativa, mas tem {saldo} badge(s) disponível(is). Deseja usar 1 badge para assinar este documento?",
                    "saldo_badges": saldo,
                },
            )
        if not licenca and (saldo == 0 or not payload.usar_badge):
            if saldo == 0:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "codigo": "licenca_inativa",
                        "mensagem": "Sua assinatura não está ativa. Entre em contato com o administrador.",
                    },
                )

    # Se usar_badge=True, consumir 1 badge do lote ativo
    lote_consumido = None
    if payload.usar_badge and not licenca:
        lote_ativo = (
            db.query(BadgeLot)
            .filter(
                BadgeLot.organization_id == org_id,
                BadgeLot.status == "active",
                (BadgeLot.total_badges - BadgeLot.issued) > 0,
            )
            .order_by(BadgeLot.id.asc())
            .first()
        )
        if not lote_ativo:
            raise HTTPException(
                status_code=403,
                detail={
                    "codigo": "licenca_inativa",
                    "mensagem": "Sua assinatura não está ativa. Entre em contato com o administrador.",
                },
            )
        lote_ativo.issued = lote_ativo.issued + 1
        db.add(lote_ativo)
        lote_consumido = lote_ativo.id

    public_id = uuid4().hex[:20]

    # URL prevista do PDF no R2 (padrão conhecido: sign/{publicId}.pdf)
    predicted_pdf_url = (
        f"{settings.cloudflare_r2_public_url}/sign/{public_id}.pdf"
        if settings.cloudflare_r2_public_url
        else ""
    )

    # Montar metadata para blockchain — inclui pdfUrl previsto
    metadata = json.dumps({
        "titulo": payload.titulo,
        "finalidade": payload.finalidade,
        "partes": payload.partes_envolvidas,
        "descricao": payload.descricao,
        "pdfHash": payload.pdf_hash,
        "pdfUrl": predicted_pdf_url,
        "publicId": public_id,
        "sistema": "Badge One Sign v1.0",
        "emissor": org.name,
        "cnpj": org.document or "",
    }, ensure_ascii=False)

    # Registrar na Polygon
    chain = register_document(
        public_id=public_id,
        doc_hash=payload.pdf_hash,
        metadata=metadata,
    )

    polygonscan_url = chain.get("polygonscan_url") or f"https://polygonscan.com/tx/{chain['tx_hash']}"

    # Salvar no banco (status pending — ainda sem o PDF)
    registro = AssinaturaDigital(
        public_id=public_id,
        organization_id=org_id,
        titulo=payload.titulo,
        finalidade=payload.finalidade,
        partes_envolvidas=payload.partes_envolvidas,
        descricao=payload.descricao,
        hash_documento=payload.pdf_hash,
        tx_hash=chain["tx_hash"],
        token_id=chain["token_id"],
        network=chain.get("network", "polygon"),
        polygonscan_url=polygonscan_url,
        status="pending",
    )
    db.add(registro)

    # Salvar transação blockchain
    if chain.get("tx_hash") and chain.get("mode") != "mock_fallback":
        tx_rec = TransacaoBlockchain(
            tx_hash=chain["tx_hash"],
            block_number=chain.get("block_number"),
            gas_used=str(chain.get("gas_used", "")),
            tipo="sign_document",
            referencia_id=public_id,
        )
        db.add(tx_rec)

    db.commit()
    db.refresh(registro)

    return {
        "public_id": public_id,
        "token_id": chain["token_id"],
        "tx_hash": chain["tx_hash"],
        "polygonscan_url": polygonscan_url,
        "network": chain.get("network", "polygon"),
        "mint_mode": chain.get("mode", "live"),
        "lote_consumido": lote_consumido,
        "badge_usado": lote_consumido is not None,
    }


@router.post("/upload")
async def sign_upload(
    public_id: str = Form(...),
    pdf: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    """
    Passo 2: recebe o PDF estampado, faz upload para o R2, atualiza o registro.
    Retorna a URL pública do PDF + todos os dados do registro.
    """
    registro = db.query(AssinaturaDigital).filter(
        AssinaturaDigital.public_id == public_id
    ).first()

    if not registro:
        raise HTTPException(status_code=404, detail="Registro de assinatura não encontrado")

    # Garantir que o usuário tem acesso à organização deste registro
    enforce_org_access(user, registro.organization_id)

    pdf_bytes = await pdf.read()
    r2_key = f"sign/{public_id}.pdf"
    pdf_url = upload_file(pdf_bytes, r2_key, "application/pdf")

    registro.pdf_url = pdf_url
    registro.status = "complete"
    db.commit()
    db.refresh(registro)

    # Salvar metadados JSON no R2 para referência/auditoria
    org = db.query(Organization).filter(Organization.id == registro.organization_id).first()
    metadata_json = json.dumps({
        "public_id": registro.public_id,
        "titulo": registro.titulo,
        "finalidade": registro.finalidade,
        "partes_envolvidas": registro.partes_envolvidas,
        "descricao": registro.descricao,
        "hash_documento": registro.hash_documento,
        "pdf_url": pdf_url,
        "tx_hash": registro.tx_hash,
        "token_id": registro.token_id,
        "network": registro.network,
        "polygonscan_url": registro.polygonscan_url,
        "assinado_em": registro.assinado_em.isoformat() if registro.assinado_em else None,
        "org_nome": org.name if org else None,
        "org_cnpj": org.document if org else None,
        "sistema": "Badge One Sign v1.0",
    }, ensure_ascii=False, indent=2)
    try:
        upload_file(metadata_json.encode("utf-8"), f"sign/{public_id}.json", "application/json")
    except Exception:
        pass  # falha silenciosa — o PDF já foi salvo

    return {
        "public_id": registro.public_id,
        "pdf_url": pdf_url,
        "token_id": registro.token_id,
        "tx_hash": registro.tx_hash,
        "polygonscan_url": registro.polygonscan_url,
        "network": registro.network,
        "assinado_em": registro.assinado_em.isoformat() if registro.assinado_em else None,
    }


@router.get("/verify/{public_id}")
def sign_verify(public_id: str, db: Session = Depends(get_db)):
    """Verificação pública de documento assinado — sem autenticação."""
    registro = db.query(AssinaturaDigital).filter(
        AssinaturaDigital.public_id == public_id
    ).first()

    if not registro:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    org = db.query(Organization).filter(
        Organization.id == registro.organization_id
    ).first()

    return {
        "public_id": registro.public_id,
        "titulo": registro.titulo,
        "finalidade": registro.finalidade,
        "partes_envolvidas": registro.partes_envolvidas,
        "descricao": registro.descricao,
        "hash_documento": registro.hash_documento,
        "pdf_url": registro.pdf_url,
        "tx_hash": registro.tx_hash,
        "token_id": registro.token_id,
        "network": registro.network,
        "polygonscan_url": registro.polygonscan_url,
        "assinado_em": registro.assinado_em.isoformat() if registro.assinado_em else None,
        "status": registro.status,
        "org_nome": org.name if org else None,
        "org_cnpj": org.document if org else None,
    }
