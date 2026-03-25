from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.core.db import Base


class SuporteTicket(Base):
    __tablename__ = "suporte_tickets"

    id = Column(Integer, primary_key=True, index=True)
    organizacao_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    emissor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assunto = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="aberto")
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), server_default=func.now())


class SuporteMensagem(Base):
    __tablename__ = "suporte_mensagens"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("suporte_tickets.id"), nullable=False)
    autor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    autor_tipo = Column(String(10), nullable=False)  # 'admin' | 'emissor'
    mensagem = Column(Text, nullable=False)
    lida = Column(Boolean, nullable=False, default=False, server_default="false")
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
