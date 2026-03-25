from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.db import Base


class AssinaturaDigital(Base):
    __tablename__ = "assinaturas_digitais"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(64), unique=True, nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)

    # Dados do formulário pré-assinatura
    titulo = Column(String(100), nullable=True)
    finalidade = Column(String(30), nullable=True)
    partes_envolvidas = Column(String(200), nullable=True)
    descricao = Column(Text, nullable=True)

    # Dados técnicos
    hash_documento = Column(String(64), nullable=True)   # SHA-256 do PDF original
    pdf_url = Column(Text, nullable=True)                # URL pública no R2
    tx_hash = Column(String(100), nullable=True)
    token_id = Column(String(80), nullable=True)
    network = Column(String(20), nullable=True, default="polygon")
    polygonscan_url = Column(Text, nullable=True)

    # Estado: "pending" → após /prepare; "complete" → após /upload
    status = Column(String(20), nullable=False, default="pending")

    assinado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
