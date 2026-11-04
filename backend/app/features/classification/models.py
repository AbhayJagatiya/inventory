"""Item Classification Database Model

Stores algorithmic dead stock evaluation results, factors, and manual overrides.
"""

import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Classification(Base):
    __tablename__ = "classifications"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    calculated_classification = Column(String(30), nullable=False)  # ACTIVE, SLOW_MOVING, NON_MOVING, OBSOLETE
    effective_classification = Column(String(30), nullable=False, index=True)
    rule_version = Column(String(20), nullable=False, default="v1.0")
    days_inactive = Column(Integer, nullable=False, default=0)
    item_age_days = Column(Integer, nullable=False, default=0)
    contributing_factors = Column(JSON, nullable=False, default=dict)
    is_overridden = Column(Boolean, nullable=False, default=False)
    override_reason = Column(Text, nullable=True)
    overridden_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    overridden_at = Column(DateTime(timezone=True), nullable=True)
    calculated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    office = relationship("Office")
    item = relationship("Item")
    overriding_user = relationship("User")

