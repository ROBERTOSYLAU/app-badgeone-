from sqlalchemy import Boolean, Column, Integer, String, ForeignKey, DateTime
from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="issuer")
    status = Column(String(20), nullable=False, default="active")
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    password_reset_token = Column(String(64), nullable=True, index=True)
    password_reset_expires = Column(DateTime, nullable=True)
    password_is_default = Column(Boolean, nullable=False, default=True, server_default="true")
