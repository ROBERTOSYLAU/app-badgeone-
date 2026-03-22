from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
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
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    original_title = Column(String(180), nullable=True)
    display_title = Column(String(180), nullable=True)
