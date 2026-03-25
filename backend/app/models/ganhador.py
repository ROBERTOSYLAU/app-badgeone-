from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.core.db import Base


class Ganhador(Base):
    __tablename__ = "ganhadores"

    id = Column(Integer, primary_key=True, index=True)
    organizacao_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    tipo = Column(String(2), nullable=False, default="PF")  # PF | PJ

    # Pessoa Física
    nome = Column(String(255), nullable=True)
    cpf = Column(String(14), nullable=True)

    # Pessoa Jurídica
    razao_social = Column(String(255), nullable=True)
    cnpj = Column(String(18), nullable=True)
    nome_responsavel = Column(String(255), nullable=True)

    # Compartilhados
    email = Column(String(255), nullable=True)
    telefone = Column(String(20), nullable=True)
    wallet_address = Column(String(255), nullable=True)

    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
