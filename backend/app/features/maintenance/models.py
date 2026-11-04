"""Maintenance and Repair Database Model

Logs repair requests, technician interventions, costs, and restores operational status.
"""

import uuid
from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Numeric, String, Text, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    issue_description = Column(Text, nullable=False)
    service_provider = Column(String(150), nullable=False)
    reported_date = Column(Date, nullable=False)
    completion_date = Column(Date, nullable=True)
    estimated_cost = Column(Numeric(14, 2), nullable=False, default=0.00)
    actual_cost = Column(Numeric(14, 2), nullable=False, default=0.00)
    status = Column(String(30), nullable=False, default="REPORTED", index=True)
    # REPORTED, UNDER_REVIEW, APPROVED, IN_REPAIR, COMPLETED, CANCELLED
    work_performed = Column(Text, nullable=True)
    invoice_reference = Column(String(100), nullable=True)
    reported_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("estimated_cost >= 0", name="chk_maint_estimated_cost_non_negative"),
        CheckConstraint("actual_cost >= 0", name="chk_maint_actual_cost_non_negative"),
    )

    item = relationship("Item", back_populates="maintenance_records")
    office = relationship("Office")
    reporter = relationship("User")

