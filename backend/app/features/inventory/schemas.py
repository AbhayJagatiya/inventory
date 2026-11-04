"""Inventory and Asset Management Pydantic Schemas"""

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class StockBalanceOut(BaseModel):
    id: UUID
    office_id: UUID
    item_id: UUID
    location_id: UUID
    available_qty: float
    allocated_qty: float
    in_vendor_rma_qty: float
    disposed_qty: float
    last_reconciled_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ItemBase(BaseModel):
    item_name: str = Field(..., min_length=2, max_length=200)
    item_type: str = Field(default="DURABLE_ASSET", pattern="^(DURABLE_ASSET|CONSUMABLE_STOCK)$")
    category_id: UUID
    location_id: UUID
    supplier_id: Optional[UUID] = None
    procurement_item_id: Optional[UUID] = None
    uom_id: UUID
    brand: Optional[str] = Field(None, max_length=100)
    model_number: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    purchase_date: Optional[date] = None
    invoice_number: Optional[str] = Field(None, max_length=100)
    unit_purchase_cost: float = Field(default=0.00, ge=0)
    condition: str = Field(default="GOOD", pattern="^(NEW|GOOD|FAIR|POOR|DAMAGED|SCRAP)$")
    current_custodian: Optional[str] = Field(None, max_length=150)
    current_department: Optional[str] = Field(None, max_length=100)
    min_stock_level: float = Field(default=0.00, ge=0)
    is_legacy: bool = False
    legacy_reference_number: Optional[str] = Field(None, max_length=100)


class ItemCreate(ItemBase):
    office_id: UUID
    initial_quantity: float = Field(default=1.00, ge=0)


class ItemUpdate(BaseModel):
    item_name: Optional[str] = Field(None, min_length=2, max_length=200)
    condition: Optional[str] = Field(None, pattern="^(NEW|GOOD|FAIR|POOR|DAMAGED|SCRAP)$")
    current_custodian: Optional[str] = Field(None, max_length=150)
    current_department: Optional[str] = Field(None, max_length=100)
    location_id: Optional[UUID] = None
    min_stock_level: Optional[float] = Field(None, ge=0)


class ItemOut(ItemBase):
    id: UUID
    office_id: UUID
    item_code: str
    barcode_number: Optional[str] = None
    total_cost: float
    operational_status: str
    current_classification: str
    last_movement_date: Optional[date] = None
    created_by: UUID
    updated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    stock_balances: List[StockBalanceOut] = []

    model_config = ConfigDict(from_attributes=True)


class ItemHistoryEventOut(BaseModel):
    event_type: str  # RECEIPT, ISSUE, RETURN, TRANSFER, MAINTENANCE, VERIFICATION, DISPOSAL
    event_date: datetime
    reference_number: Optional[str] = None
    actor_name: str
    details: str
    quantity: Optional[float] = None
    condition: Optional[str] = None
    location_name: Optional[str] = None

