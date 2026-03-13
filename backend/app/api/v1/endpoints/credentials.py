from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.auth import require_issuer_or_admin, require_admin
from app.core.db import get_db
from app.models.lot import BadgeLot
from app.models.organization import Organization
from app.models.credential import Credential
from app.integrations.blockchain import mock_mint_badge
from app.integrations.storage import mock_pin_metadata

router = APIRouter()


class IssueCredentialRequest(BaseModel):
    organization_id: int
    lot_id: int
    recipient_name: str
    recipient_email: EmailStr | None = None
    course_name: str


class CredentialUpdate(BaseModel):
    status: str


@router.post("/issue")
def issue_credential(payload: IssueCredentialRequest, db: Session = Depends(get_db), _=Depends(require_issuer_or_admin)):
    org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    lot = db.query(BadgeLot).filter(BadgeLot.id == payload.lot_id, BadgeLot.organization_id == payload.organization_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lote não encontrado para organização")

    remaining = lot.total_badges - lot.issued
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
    chain = mock_mint_badge(public_id=public_id, recipient_name=payload.recipient_name)

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
    db.add(credential)

    lot.issued = lot.issued + 1
    db.add(lot)

    db.commit()
    db.refresh(credential)

    return {
        "id": credential.id,
        "public_id": credential.public_id,
        "status": credential.status,
        "metadata_uri": credential.metadata_uri,
        "tx_hash": credential.tx_hash,
        "token_id": credential.token_id,
        "remaining_lot": lot.total_badges - lot.issued,
    }


@router.patch("/{credential_id}")
def update_credential(credential_id: int, payload: CredentialUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    cred = db.query(Credential).filter(Credential.id == credential_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credencial não encontrada")

    if payload.status not in {"valid", "paused", "revoked", "trashed"}:
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


@router.get("")
def list_credentials(organization_id: int | None = Query(None), db: Session = Depends(get_db), _=Depends(require_issuer_or_admin)):
    q = db.query(Credential)
    if organization_id is not None:
        q = q.filter(Credential.organization_id == organization_id)
    data = q.order_by(Credential.id.desc()).limit(300).all()
    return [
        {
            "id": x.id,
            "organization_id": x.organization_id,
            "lot_id": x.lot_id,
            "public_id": x.public_id,
            "recipient_name": x.recipient_name,
            "course_name": x.course_name,
            "status": x.status,
            "tx_hash": x.tx_hash,
            "token_id": x.token_id,
        }
        for x in data
    ]
