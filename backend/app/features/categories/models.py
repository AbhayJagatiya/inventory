"""Categories and Units of Measure Database Models

Defines classification hierarchy, useful life parameters, and unit codes.
"""

import uuid
from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    code = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    parent_id = Column(Uuid, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=True)
    slow_moving_threshold_days = Column(Integer, nullable=False, default=90)
    inactivity_threshold_days = Column(Integer, nullable=False, default=180)
    obsolescence_years = Column(Integer, nullable=False, default=5)
    depreciation_rate_pct = Column(Numeric(5, 2), nullable=False, default=15.00)
    is_active = Column(Boolean, nullable=False, default=True)

    parent = relationship("Category", remote_side=[id], backref="subcategories")
    items = relationship("Item", back_populates="category")


class UnitOfMeasure(Base):
    __tablename__ = "units_of_measure"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    code = Column(String(20), unique=True, nullable=False, index=True)  # NOS, BOX, PACKET, SET, KG, MTR
    name = Column(String(50), nullable=False)

    items = relationship("Item", back_populates="uom")

