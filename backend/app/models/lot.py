from sqlalchemy import Column, Integer, String, ForeignKey
from app.core.db import Base


class BadgeLot(Base):
    __tablename__ = "badge_lots"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    title = Column(String(180), nullable=True)
    description = Column(String(500), nullable=True)
    total_badges = Column(Integer, nullable=False)
    issued = Column(Integer, nullable=False, default=0)
    issue_window_days = Column(Integer, nullable=False, default=365)
    status = Column(String(20), nullable=False, default="active")
