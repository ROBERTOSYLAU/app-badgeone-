from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_admin, require_issuer_or_admin
from app.core.db import get_db
from app.models.organization import Organization

router = APIRouter()


class OrganizationCreate(BaseModel):
    name: str
    document: str | None = None


@router.post("")
def create_org(payload: OrganizationCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    org = Organization(name=payload.name, document=payload.document, status="active")
    db.add(org)
    db.commit()
    db.refresh(org)
    return {"id": org.id, "name": org.name, "document": org.document, "status": org.status}


@router.get("")
def list_orgs(db: Session = Depends(get_db), _=Depends(require_issuer_or_admin)):
    data = db.query(Organization).order_by(Organization.id.desc()).all()
    return [{"id": x.id, "name": x.name, "document": x.document, "status": x.status} for x in data]
