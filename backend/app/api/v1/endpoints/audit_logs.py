from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.db import get_db
from app.models.audit_log import AuditLog

router = APIRouter()


@router.get("")
def list_audit_logs(
    entity_type: str | None = Query(None),
    entity_id: int | None = Query(None),
    limit: int = Query(100),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(AuditLog)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        q = q.filter(AuditLog.entity_id == entity_id)

    data = q.order_by(AuditLog.id.desc()).limit(min(max(limit, 1), 500)).all()
    return [
        {
            "id": x.id,
            "entity_type": x.entity_type,
            "entity_id": x.entity_id,
            "action": x.action,
            "details": x.details,
            "actor": x.actor,
            "created_at": x.created_at.isoformat() if x.created_at else None,
        }
        for x in data
    ]
