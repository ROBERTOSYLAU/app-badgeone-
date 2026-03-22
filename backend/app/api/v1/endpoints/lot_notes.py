from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.db import get_db
from app.models.lot import BadgeLot
from app.models.lot_note import LotNote

router = APIRouter()


class NoteCreate(BaseModel):
    title: str | None = None
    content: str


@router.get("/{lot_id}")
def list_notes(lot_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    data = db.query(LotNote).filter(LotNote.lot_id == lot_id).order_by(LotNote.id.desc()).all()
    return [
        {
            "id": x.id,
            "lot_id": x.lot_id,
            "title": x.title,
            "content": x.content,
            "created_at": x.created_at.isoformat() if x.created_at else None,
        }
        for x in data
    ]


@router.post("/{lot_id}")
def create_note(lot_id: int, payload: NoteCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    lot = db.query(BadgeLot).filter(BadgeLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lote não encontrado")

    content = (payload.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Anotação vazia")

    title = (payload.title or "").strip()
    if not title:
        title = content[:50] + ("..." if len(content) > 50 else "")

    note = LotNote(lot_id=lot_id, title=title, content=content)
    db.add(note)
    db.commit()
    db.refresh(note)

    return {
        "id": note.id,
        "lot_id": note.lot_id,
        "title": note.title,
        "content": note.content,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    note = db.query(LotNote).filter(LotNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Anotação não encontrada")
    db.delete(note)
    db.commit()
    return {"ok": True, "id": note_id}
