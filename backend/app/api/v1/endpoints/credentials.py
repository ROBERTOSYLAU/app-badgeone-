from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.auth import require_issuer_or_admin, require_admin, enforce_org_access
from app.models.user import User
from app.core.db import get_db
from app.models.lot import BadgeLot
from app.models.organization import Organization
from app.models.credential import Credential
from app.integrations.blockchain import mint_badge
from app.integrations.storage import mock_pin_metadata

router = APIRouter()


class IssueCredentialRequest(BaseModel):
    organization_id: int
    lot_id: int
    recipient_name: str
    recipient_email: EmailStr | None = None
    course_name: str  # mantém compatibilidade, exibido como "Certificação"
    recipient_cpf: str | None = None  # opcional, LGPD


class CredentialUpdate(BaseModel):
    status: str


@router.post("/issue")
def issue_credential(payload: IssueCredentialRequest, db: Session = Depends(get_db), user: User = Depends(require_issuer_or_admin)):
    enforce_org_access(user, payload.organization_id)

    org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    lot = db.query(BadgeLot).filter(BadgeLot.id == payload.lot_id, BadgeLot.organization_id == payload.organization_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lote não encontrado para organização")

    remaining = lot.total_badges - lot.issued
    if lot.status in {"paused", "revoked", "finished", "trashed"}:
        raise HTTPException(status_code=400, detail="Lote indisponível para emissão")
    if org.status in {"inactive", "trashed"}:
        raise HTTPException(status_code=400, detail="Organização indisponível para operação")
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="Lote sem saldo")

    public_id = uuid4().hex[:20]
    metadata = {
        "issuer": org.name,
        "recipient_name": payload.recipient_name,
        "recipient_email": payload.recipient_email,
        "course_name": payload.course_name,
        "public_id": public_id,
    }
    metadata_uri = mock_pin_metadata(metadata)

    # Mint real na Polygon — usa end_date do lote como validade, ou 10 anos
    lot_end_date = getattr(lot, "end_date", None)
    chain = mint_badge(
        public_id=public_id,
        recipient_name=payload.recipient_name,
        valid_until=lot_end_date,
    )

    credential = Credential(
        organization_id=payload.organization_id,
        lot_id=payload.lot_id,
        recipient_name=payload.recipient_name,
        recipient_email=payload.recipient_email,
        course_name=payload.course_name,
        public_id=public_id,
        metadata_uri=metadata_uri,
        tx_hash=chain["tx_hash"],
        token_id=chain["token_id"],
        status="valid",
    )
    if hasattr(credential, "issued_by_user_id"):
        credential.issued_by_user_id = user.id
    if hasattr(credential, "recipient_cpf") and payload.recipient_cpf:
        credential.recipient_cpf = payload.recipient_cpf
    db.add(credential)

    lot.issued = lot.issued + 1
    db.add(lot)

    db.commit()
    db.refresh(credential)

    polygonscan_url = chain.get("polygonscan_url") or f"https://polygonscan.com/tx/{credential.tx_hash}"

    return {
        "id": credential.id,
        "public_id": credential.public_id,
        "status": credential.status,
        "metadata_uri": credential.metadata_uri,
        "tx_hash": credential.tx_hash,
        "token_id": credential.token_id,
        "remaining_lot": lot.total_badges - lot.issued,
        "network": chain.get("network", "polygon"),
        "mint_mode": chain.get("mode", "live"),
        "polygonscan_url": polygonscan_url,
    }


@router.patch("/{credential_id}")
def update_credential(credential_id: int, payload: CredentialUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    cred = db.query(Credential).filter(Credential.id == credential_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credencial não encontrada")

    if payload.status not in {"valid", "paused", "revoked", "trashed", "rectified"}:
        raise HTTPException(status_code=400, detail="Status inválido")

    cred.status = payload.status
    db.commit()
    db.refresh(cred)

    return {
        "id": cred.id,
        "public_id": cred.public_id,
        "status": cred.status,
    }


@router.get("/verify/{public_id}")
def verify_credential(public_id: str, db: Session = Depends(get_db)):
    c = db.query(Credential).filter(Credential.public_id == public_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Credencial não encontrada")

    return {
        "public_id": c.public_id,
        "recipient_name": c.recipient_name,
        "course_name": c.course_name,
        "status": c.status,
        "metadata_uri": c.metadata_uri,
        "tx_hash": c.tx_hash,
        "token_id": c.token_id,
    }


def _mask_cpf(cpf: str | None) -> str | None:
    if not cpf:
        return None
    digits = (cpf or "").replace(".", "").replace("-", "")
    if len(digits) < 6:
        return "***"
    return f"***.{digits[3:6]}.***-**"


def _mask_email(email: str | None) -> str | None:
    if not email:
        return None
    parts = email.split("@")
    if len(parts) != 2:
        return "***"
    local = parts[0]
    visible = local[:2] if len(local) >= 2 else local[0]
    return f"{visible}***@{parts[1]}"


def _mask_name(name: str | None) -> str | None:
    if not name:
        return None
    parts = name.strip().split()
    if len(parts) == 1:
        return parts[0][0] + "***"
    return f"{parts[0]} {'*' * len(parts[-1])}"


@router.get("")
def list_credentials(
    organization_id: int | None = Query(None),
    full: int = Query(0),
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    q = db.query(Credential)
    if user.role == "issuer":
        if user.organization_id is None:
            return []
        q = q.filter(Credential.organization_id == user.organization_id)
    elif organization_id is not None:
        q = q.filter(Credential.organization_id == organization_id)
    data = q.order_by(Credential.id.desc()).limit(300).all()
    return [
        {
            "id": x.id,
            "organization_id": x.organization_id,
            "lot_id": x.lot_id,
            "public_id": x.public_id,
            "recipient_name": x.recipient_name,
            "recipient_email": x.recipient_email,
            "course_name": x.course_name,
            "status": x.status,
            "tx_hash": x.tx_hash,
            "token_id": x.token_id,
            "created_at": x.created_at.isoformat() if x.created_at else None,
            "issued_by_user_id": getattr(x, "issued_by_user_id", None) if hasattr(x, "issued_by_user_id") else None,
        }
        for x in data
    ]


class RectifyRequest(BaseModel):
    recipient_name: str | None = None
    recipient_email: EmailStr | None = None
    course_name: str | None = None
    rectification_note: str


@router.patch("/{credential_id}/rectify")
def rectify_credential(
    credential_id: int,
    payload: RectifyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    cred = db.query(Credential).filter(Credential.id == credential_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credencial não encontrada")
    # Issuer só pode retificar o que emitiu
    if user.role == "issuer":
        if cred.organization_id != user.organization_id:
            raise HTTPException(status_code=403, detail="Acesso negado")
        issued_by = getattr(cred, "issued_by_user_id", None)
        if issued_by and issued_by != user.id:
            raise HTTPException(status_code=403, detail="Você só pode retificar emissões feitas por você")
    if not payload.rectification_note or not payload.rectification_note.strip():
        raise HTTPException(status_code=400, detail="Nota de retificação é obrigatória")
    if payload.recipient_name:
        cred.recipient_name = payload.recipient_name.strip()
    if payload.recipient_email is not None:
        cred.recipient_email = payload.recipient_email
    if payload.course_name:
        cred.course_name = payload.course_name.strip()
    if hasattr(cred, "rectification_note"):
        cred.rectification_note = payload.rectification_note.strip()
    cred.status = "rectified" if cred.status == "valid" else cred.status
    db.commit()
    db.refresh(cred)
    return {
        "id": cred.id,
        "public_id": cred.public_id,
        "status": cred.status,
        "recipient_name": cred.recipient_name,
        "course_name": cred.course_name,
        "rectification_note": getattr(cred, "rectification_note", None),
    }
