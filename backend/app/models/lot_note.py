from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from app.core.db import Base


class LotNote(Base):
    __tablename__ = "lot_notes"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("badge_lots.id"), nullable=False, index=True)
    title = Column(String(180), nullable=False)
    content = Column(String(4000), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
