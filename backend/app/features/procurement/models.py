"""Procurement Orders, Order Lines and Supplier RMA Models

Manages purchase orders, line items, and vendor RMA tracking.
"""

import uuid
from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Numeric, String, Text, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Procurement(Base):
    __tablename__ = "procurements"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    procurement_number = Column(String(50), unique=True, nullable=False, index=True)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    supplier_id = Column(Uuid, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    order_date = Column(Date, nullable=False)
    invoice_number = Column(String(100), nullable=True)
    total_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    status = Column(String(30), nullable=False, default="PENDING")  # PENDING, PARTIALLY_RECEIVED, FULLY_RECEIVED, CANCELLED
    created_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("total_amount >= 0", name="chk_procurement_total_non_negative"),
    )

    office = relationship("Office")
    supplier = relationship("Supplier", back_populates="procurements")
    creator = relationship("User")
    items = relationship("ProcurementItem", back_populates="procurement", cascade="all, delete-orphan")


class ProcurementItem(Base):
    __tablename__ = "procurement_items"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    procurement_id = Column(Uuid, ForeignKey("procurements.id", ondelete="RESTRICT"), nullable=False, index=True)
    category_id = Column(Uuid, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_description = Column(Text, nullable=False)
    item_type = Column(String(30), nullable=False)  # DURABLE_ASSET, CONSUMABLE_STOCK
    quantity_ordered = Column(Numeric(12, 2), nullable=False)
    quantity_received = Column(Numeric(12, 2), nullable=False, default=0.00)
    unit_price = Column(Numeric(14, 2), nullable=False)
    tax_rate_pct = Column(Numeric(5, 2), nullable=False, default=0.00)
    total_price = Column(Numeric(14, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("quantity_ordered > 0", name="chk_proc_item_qty_ordered_positive"),
        CheckConstraint("quantity_received >= 0", name="chk_proc_item_qty_received_non_negative"),
        CheckConstraint("quantity_received <= quantity_ordered", name="chk_proc_item_qty_received_le_ordered"),
        CheckConstraint("unit_price >= 0", name="chk_proc_item_unit_price_non_negative"),
        CheckConstraint("total_price >= 0", name="chk_proc_item_total_price_non_negative"),
    )

    procurement = relationship("Procurement", back_populates="items")
    category = relationship("Category")


class SupplierReturn(Base):
    __tablename__ = "supplier_returns"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    return_number = Column(String(50), unique=True, nullable=False, index=True)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    supplier_id = Column(Uuid, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    procurement_id = Column(Uuid, ForeignKey("procurements.id", ondelete="RESTRICT"), nullable=True, index=True)
    warranty_id = Column(Uuid, ForeignKey("warranties.id", ondelete="RESTRICT"), nullable=True, index=True)
    return_date = Column(Date, nullable=False)
    dispatch_date = Column(Date, nullable=True)
    return_tracking_number = Column(String(100), nullable=True)
    carrier_name = Column(String(100), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=False)
    reason = Column(String(50), nullable=False)  # DEFECTIVE_ON_ARRIVAL, WARRANTY_REPAIR, INCORRECT_SPECIFICATION, DAMAGED_IN_TRANSIT
    status = Column(String(30), nullable=False, default="INITIATED", index=True)
    # INITIATED, DISPATCHED_TO_VENDOR, UNDER_VENDOR_ASSESSMENT, REJECTED_BY_VENDOR,
    # ACCEPTED_REPLACEMENT, ACCEPTED_REPAIR, ACCEPTED_CREDIT_NOTE, ACCEPTED_REFUND, COMPLETED_CLOSED, CANCELLED
    rma_reference_number = Column(String(100), nullable=True)
    vendor_acknowledgement_date = Column(Date, nullable=True)
    vendor_rejection_reason = Column(Text, nullable=True)
    resolution_type = Column(String(30), nullable=True)  # REPLACEMENT, CREDIT_NOTE, REFUND, REPAIRED_RETURN
    resolution_date = Column(Date, nullable=True)
    replacement_item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=True)
    credit_note_number = Column(String(100), nullable=True)
    credit_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    refund_reference_number = Column(String(100), nullable=True)
    refund_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    resolution_remarks = Column(Text, nullable=True)
    created_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_supplier_return_qty_positive"),
        CheckConstraint("credit_amount >= 0", name="chk_supplier_return_credit_non_negative"),
        CheckConstraint("refund_amount >= 0", name="chk_supplier_return_refund_non_negative"),
    )

    office = relationship("Office")
    supplier = relationship("Supplier", back_populates="supplier_returns")
    item = relationship("Item", foreign_keys=[item_id])
    replacement_item = relationship("Item", foreign_keys=[replacement_item_id])
    procurement = relationship("Procurement")
    creator = relationship("User")

