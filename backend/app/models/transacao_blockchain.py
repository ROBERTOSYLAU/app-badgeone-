from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.db import Base


class TransacaoBlockchain(Base):
    __tablename__ = "transacoes_blockchain"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tx_hash = Column(String(66), unique=True, nullable=False, index=True)
    block_number = Column(Integer, nullable=True)
    gas_used = Column(String(30), nullable=True)
    tipo = Column(String(30), nullable=True)       # 'badge_mint' | 'sign_document'
    referencia_id = Column(String(50), nullable=True)  # public_id do badge ou assinatura
    criado_em = Column(DateTime, server_default=func.now(), nullable=False)
