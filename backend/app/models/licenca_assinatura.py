from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.db import Base


class LicencaAssinatura(Base):
    __tablename__ = "licencas_assinatura"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    valid_from = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=False)
    tipo = Column(String(20), nullable=False, default="bonus")  # bonus | paid
    lote_origem_id = Column(Integer, ForeignKey("badge_lots.id"), nullable=True)
    status = Column(String(20), nullable=False, default="active")  # active | expired | cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
