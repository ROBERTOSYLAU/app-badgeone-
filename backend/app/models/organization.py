from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.core.db import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    document = Column(String(40), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    address = Column(Text, nullable=True)
    cnae = Column(String(255), nullable=True)
    opening_date = Column(String(20), nullable=True)
    regime = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
