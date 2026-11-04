"""Core Inventory and Stock Balance Models

Implements dual tracking: individually tracked durable assets and quantity-tracked consumables.
"""

import uuid
from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    category_id = Column(Uuid, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(Uuid, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    supplier_id = Column(Uuid, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=True, index=True)
    procurement_item_id = Column(Uuid, ForeignKey("procurement_items.id", ondelete="RESTRICT"), nullable=True, index=True)
    uom_id = Column(Uuid, ForeignKey("units_of_measure.id", ondelete="RESTRICT"), nullable=False)

    item_code = Column(String(50), unique=True, nullable=False, index=True)  # AST-GS-VRV-YYYY-XXXXX or ITM-GS-VRV-XXXXX
    item_name = Column(String(200), nullable=False, index=True)
    item_type = Column(String(30), nullable=False, index=True)  # DURABLE_ASSET, CONSUMABLE_STOCK
    barcode_number = Column(String(100), nullable=True, index=True)
    brand = Column(String(100), nullable=True)
    model_number = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True, index=True)
    purchase_date = Column(Date, nullable=True, index=True)
    invoice_number = Column(String(100), nullable=True)
    unit_purchase_cost = Column(Numeric(14, 2), nullable=False, default=0.00)
    total_cost = Column(Numeric(14, 2), nullable=False, default=0.00)
    condition = Column(String(30), nullable=False, default="GOOD")  # NEW, GOOD, FAIR, POOR, DAMAGED, SCRAP
    operational_status = Column(String(30), nullable=False, default="AVAILABLE_IN_STORE", index=True)
    # AVAILABLE_IN_STORE, IN_USE, UNDER_MAINTENANCE, DISPATCHED_TO_VENDOR, DAMAGED, NON_FUNCTIONAL, PENDING_CONDEMNATION, PENDING_DISPOSAL, DISPOSED
    current_classification = Column(String(30), nullable=False, default="ACTIVE", index=True)
    # ACTIVE, SLOW_MOVING, NON_MOVING, OBSOLETE
    current_custodian = Column(String(150), nullable=True)
    current_department = Column(String(100), nullable=True)
    last_movement_date = Column(Date, nullable=True, index=True)
    min_stock_level = Column(Numeric(12, 2), nullable=False, default=0.00)
    is_legacy = Column(Boolean, nullable=False, default=False)
    legacy_reference_number = Column(String(100), nullable=True)

    created_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    updated_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("id", "office_id", name="uq_items_id_office"),
        CheckConstraint("unit_purchase_cost >= 0", name="chk_item_unit_cost_non_negative"),
        CheckConstraint("total_cost >= 0", name="chk_item_total_cost_non_negative"),
    )

    office = relationship("Office")
    category = relationship("Category", back_populates="items")
    location = relationship("Location", back_populates="items")
    supplier = relationship("Supplier", back_populates="items")
    procurement_item = relationship("ProcurementItem")
    uom = relationship("UnitOfMeasure", back_populates="items")
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])

    stock_balances = relationship("StockBalance", back_populates="item", cascade="all, delete-orphan")
    warranty = relationship("Warranty", back_populates="item", uselist=False)
    maintenance_records = relationship("MaintenanceRecord", back_populates="item")


class StockBalance(Base):
    __tablename__ = "stock_balances"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(Uuid, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    available_qty = Column(Numeric(12, 2), nullable=False, default=0.00)
    allocated_qty = Column(Numeric(12, 2), nullable=False, default=0.00)
    in_vendor_rma_qty = Column(Numeric(12, 2), nullable=False, default=0.00)
    disposed_qty = Column(Numeric(12, 2), nullable=False, default=0.00)
    last_reconciled_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("office_id", "item_id", "location_id", name="uq_stock_balances_office_item_loc"),
        CheckConstraint("available_qty >= 0", name="chk_balance_available_non_negative"),
        CheckConstraint("allocated_qty >= 0", name="chk_balance_allocated_non_negative"),
        CheckConstraint("in_vendor_rma_qty >= 0", name="chk_balance_rma_non_negative"),
        CheckConstraint("disposed_qty >= 0", name="chk_balance_disposed_non_negative"),
    )

    office = relationship("Office")
    item = relationship("Item", back_populates="stock_balances")
    location = relationship("Location", back_populates="stock_balances")

