"""Warranty Database Model

Tracks asset warranty periods, provider terms, and expiry timelines.
"""

import uuid
from sqlalchemy import Column, Date, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Warranty(Base):
    __tablename__ = "warranties"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), unique=True, nullable=False, index=True)
    supplier_id = Column(Uuid, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=True, index=True)
    provider_name = Column(String(150), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False, index=True)
    coverage_details = Column(Text, nullable=True)
    support_contact = Column(String(100), nullable=True)
    document_id = Column(Uuid, ForeignKey("asset_documents.id", ondelete="RESTRICT"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    item = relationship("Item", back_populates="warranty")
    supplier = relationship("Supplier", back_populates="warranties")
    document = relationship("AssetDocument", foreign_keys=[document_id])

