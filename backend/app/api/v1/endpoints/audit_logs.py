from datetime import datetime, timedelta, timezone

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
    period: str = Query("all"),  # all|day|week|month
    limit: int = Query(100),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(AuditLog)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        q = q.filter(AuditLog.entity_id == entity_id)

    now = datetime.now(timezone.utc)
    if period == "day":
        q = q.filter(AuditLog.created_at >= now - timedelta(days=1))
    elif period == "week":
        q = q.filter(AuditLog.created_at >= now - timedelta(days=7))
    elif period == "month":
        q = q.filter(AuditLog.created_at >= now - timedelta(days=30))

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


@router.delete("")
def clear_audit_logs(
    period: str = Query("all"),
    entity_type: str | None = Query(None),
    entity_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(AuditLog)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        q = q.filter(AuditLog.entity_id == entity_id)

    now = datetime.now(timezone.utc)
    if period == "day":
        q = q.filter(AuditLog.created_at >= now - timedelta(days=1))
    elif period == "week":
        q = q.filter(AuditLog.created_at >= now - timedelta(days=7))
    elif period == "month":
        q = q.filter(AuditLog.created_at >= now - timedelta(days=30))

    count = q.count()
    q.delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "deleted": count, "period": period}
