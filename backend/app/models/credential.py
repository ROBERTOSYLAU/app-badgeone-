from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, func
from app.core.db import Base


class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    lot_id = Column(Integer, ForeignKey("badge_lots.id"), nullable=False)

    recipient_name = Column(String(180), nullable=False)
    recipient_email = Column(String(255), nullable=True)
    course_name = Column(String(180), nullable=False)

    public_id = Column(String(64), unique=True, nullable=False, index=True)
    metadata_uri = Column(String(255), nullable=True)
    tx_hash = Column(String(100), nullable=True)
    token_id = Column(String(80), nullable=True)

    issued_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    recipient_cpf = Column(String(14), nullable=True)
    ganhador_id = Column(Integer, ForeignKey("ganhadores.id"), nullable=True)
    status = Column(String(20), nullable=False, default="valid")
    rectification_note = Column(String(500), nullable=True)
    certificate_url = Column(Text, nullable=True)          # URL do PDF no R2
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
