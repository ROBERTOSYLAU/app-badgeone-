from sqlalchemy import Column, Integer, String, ForeignKey
from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="issuer")
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
