"""Office Database Model

Defines Panchayat office hierarchy and multi-tenancy roots.
"""

import uuid
from sqlalchemy import Boolean, Column, DateTime, String, Text, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Office(Base):
    __tablename__ = "offices"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    office_type = Column(String(50), nullable=False, default="DISTRICT_PANCHAYAT")
    district = Column(String(100), nullable=False, default="Gir Somnath")
    taluka = Column(String(100), nullable=False, default="Veraval")
    address = Column(Text, nullable=False)
    contact_email = Column(String(100), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    users = relationship("User", back_populates="office", cascade="all, delete-orphan")
    locations = relationship("Location", back_populates="office", cascade="all, delete-orphan")

