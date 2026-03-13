from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def log_action(db: Session, entity_type: str, entity_id: int, action: str, details: str | None = None, actor: str | None = "admin"):
    db.add(AuditLog(entity_type=entity_type, entity_id=entity_id, action=action, details=details, actor=actor))
