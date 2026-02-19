from sqlalchemy import Column, Integer, String
from app.core.db import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    document = Column(String(40), nullable=True)
    status = Column(String(20), nullable=False, default="active")
