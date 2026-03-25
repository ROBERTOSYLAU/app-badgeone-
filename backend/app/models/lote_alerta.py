from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.core.db import Base


class LoteAlerta(Base):
    __tablename__ = "lote_alertas"

    id = Column(Integer, primary_key=True, index=True)
    lote_id = Column(Integer, ForeignKey("badge_lots.id"), nullable=False)
    organizacao_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    tipo = Column(String(20), nullable=False)  # 'vencendo' | 'vencido'
    dias_restantes = Column(Integer, nullable=True)
    lido_admin = Column(Boolean, nullable=False, default=False, server_default="false")
    lido_emissor = Column(Boolean, nullable=False, default=False, server_default="false")
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), server_default=func.now())
