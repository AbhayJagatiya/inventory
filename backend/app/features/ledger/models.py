"""Inventory Movement Ledger Database Models

Implements immutable transaction vouchers and lines tracking physical movements.
"""

import uuid
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Numeric, String, Text, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    transaction_number = Column(String(50), unique=True, nullable=False, index=True)
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
    transaction_type = Column(String(30), nullable=False, index=True)
    # RECEIPT, ISSUE, RETURN, TRANSFER, DISPOSAL_WRITEOFF,
    # SUPPLIER_RMA_OUT, SUPPLIER_RMA_IN, SUPPLIER_RMA_RESTORE, SUPPLIER_RMA_WRITEOFF, REVERSAL_CORRECTION
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    source_office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=True, index=True)
    destination_office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=True, index=True)
    source_location_id = Column(Uuid, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=True, index=True)
    destination_location_id = Column(Uuid, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=True, index=True)
    original_transaction_id = Column(Uuid, ForeignKey("stock_transactions.id", ondelete="RESTRICT"), nullable=True, index=True)

    recipient_name = Column(String(150), nullable=True)
    recipient_department = Column(String(100), nullable=True)
    reference_document = Column(String(100), nullable=True)
    status = Column(String(30), nullable=False, default="DRAFT", index=True)  # DRAFT, SUBMITTED, POSTED, CANCELLED
    actor_id = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    remarks = Column(Text, nullable=True)
    reversal_reason = Column(Text, nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    office = relationship("Office", foreign_keys=[office_id])
    source_office = relationship("Office", foreign_keys=[source_office_id])
    destination_office = relationship("Office", foreign_keys=[destination_office_id])
    source_location = relationship("Location", foreign_keys=[source_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    original_transaction = relationship("StockTransaction", remote_side=[id])
    actor = relationship("User")
    lines = relationship("StockTransactionLine", back_populates="transaction", cascade="all, delete-orphan")


class StockTransactionLine(Base):
    __tablename__ = "stock_transaction_lines"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    transaction_id = Column(Uuid, ForeignKey("stock_transactions.id", ondelete="RESTRICT"), nullable=False, index=True)
    original_line_id = Column(Uuid, ForeignKey("stock_transaction_lines.id", ondelete="RESTRICT"), nullable=True, index=True)
    procurement_item_id = Column(Uuid, ForeignKey("procurement_items.id", ondelete="RESTRICT"), nullable=True, index=True)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity = Column(Numeric(12, 2), nullable=False)
    cumulative_returned_qty = Column(Numeric(12, 2), nullable=False, default=0.00)
    unit_cost = Column(Numeric(14, 2), nullable=False, default=0.00)
    total_cost = Column(Numeric(14, 2), nullable=False, default=0.00)
    condition_observed = Column(String(30), nullable=True)
    remarks = Column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_txn_line_qty_positive"),
        CheckConstraint("cumulative_returned_qty >= 0", name="chk_txn_line_cumul_return_non_negative"),
        CheckConstraint("unit_cost >= 0", name="chk_txn_line_unit_cost_non_negative"),
        CheckConstraint("total_cost >= 0", name="chk_txn_line_total_cost_non_negative"),
    )

    transaction = relationship("StockTransaction", back_populates="lines")
    original_line = relationship("StockTransactionLine", remote_side=[id])
    item = relationship("Item")
    procurement_item = relationship("ProcurementItem")

