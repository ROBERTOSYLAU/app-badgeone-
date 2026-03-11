from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from app.core.db import Base


class OrganizationNote(Base):
    __tablename__ = "organization_notes"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    title = Column(String(180), nullable=False)
    content = Column(String(4000), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
