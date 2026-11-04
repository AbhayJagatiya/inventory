"""Suppliers Database Model

Stores vendor details, GSTIN/PAN identifiers, and communication info.
"""

import uuid
from sqlalchemy import Boolean, Column, DateTime, String, Text, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    supplier_code = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=False)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=False)
    gstin = Column(String(20), nullable=True, index=True)
    pan = Column(String(20), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    procurements = relationship("Procurement", back_populates="supplier")
    items = relationship("Item", back_populates="supplier")
    warranties = relationship("Warranty", back_populates="supplier")
    supplier_returns = relationship("SupplierReturn", back_populates="supplier")

