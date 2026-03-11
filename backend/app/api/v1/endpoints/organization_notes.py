from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.db import get_db
from app.models.organization import Organization
from app.models.organization_note import OrganizationNote

router = APIRouter()


class NoteCreate(BaseModel):
    title: str | None = None
    content: str


@router.get("/{org_id}")
def list_notes(org_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    data = db.query(OrganizationNote).filter(OrganizationNote.organization_id == org_id).order_by(OrganizationNote.id.desc()).all()
    return [
        {
            "id": x.id,
            "organization_id": x.organization_id,
            "title": x.title,
            "content": x.content,
            "created_at": x.created_at.isoformat() if x.created_at else None,
        }
        for x in data
    ]


@router.post("/{org_id}")
def create_note(org_id: int, payload: NoteCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    content = (payload.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Anotação vazia")

    title = (payload.title or "").strip()
    if not title:
        title = content[:50] + ("..." if len(content) > 50 else "")

    note = OrganizationNote(organization_id=org_id, title=title, content=content)
    db.add(note)
    db.commit()
    db.refresh(note)

    return {
        "id": note.id,
        "organization_id": note.organization_id,
        "title": note.title,
        "content": note.content,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    note = db.query(OrganizationNote).filter(OrganizationNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Anotação não encontrada")

    db.delete(note)
    db.commit()
    return {"ok": True, "id": note_id}
