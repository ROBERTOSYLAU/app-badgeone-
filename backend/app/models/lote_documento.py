from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.db import Base


class LoteDocumento(Base):
    __tablename__ = "lote_documentos"

    id = Column(Integer, primary_key=True, index=True)
    lote_id = Column(Integer, ForeignKey("badge_lots.id"), unique=True, nullable=False)
    arquivo_nome = Column(String(255))
    arquivo_path = Column(Text)
    campos_config = Column(JSONB, nullable=False, default=dict)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
