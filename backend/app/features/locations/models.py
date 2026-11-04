"""Locations Database Model

Defines physical locations/rooms within an office.
"""

import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Location(Base):
    __tablename__ = "locations"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    building_name = Column(String(100), nullable=False)
    floor = Column(String(50), nullable=False)
    room_number = Column(String(50), nullable=False)
    location_type = Column(String(50), nullable=False, default="STORE_ROOM")  # STORE_ROOM, OFFICE_ROOM, RECORD_ROOM, OPEN_YARD
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("id", "office_id", name="uq_locations_id_office"),
        UniqueConstraint("office_id", "building_name", "floor", "room_number", name="uq_locations_office_building_floor_room"),
    )

    office = relationship("Office", back_populates="locations")
    items = relationship("Item", back_populates="location")
    stock_balances = relationship("StockBalance", back_populates="location")

