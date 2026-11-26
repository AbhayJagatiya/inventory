"""Inventory and Asset Management Pydantic Schemas"""

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    uom_id: Optional[UUID] = None
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
    office_id: Optional[UUID] = None
    uom: Optional[str] = None
    quantity: Optional[float] = None
    initial_quantity: float = Field(default=1.00, ge=0)
    supplier_name: Optional[str] = None


class ItemUpdate(BaseModel):
    item_name: Optional[str] = Field(None, min_length=2, max_length=200)
    item_type: Optional[str] = Field(None, pattern="^(DURABLE_ASSET|CONSUMABLE_STOCK)$")
    category_id: Optional[UUID] = None
    location_id: Optional[UUID] = None
    uom_id: Optional[UUID] = None
    brand: Optional[str] = Field(None, max_length=100)
    model_number: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    purchase_date: Optional[date] = None
    invoice_number: Optional[str] = Field(None, max_length=100)
    unit_purchase_cost: Optional[float] = Field(None, ge=0)
    condition: Optional[str] = Field(None, pattern="^(NEW|GOOD|FAIR|POOR|DAMAGED|SCRAP)$")
    current_custodian: Optional[str] = Field(None, max_length=150)
    current_department: Optional[str] = Field(None, max_length=100)
    min_stock_level: Optional[float] = Field(None, ge=0)
    is_legacy: Optional[bool] = None
    legacy_reference_number: Optional[str] = Field(None, max_length=100)
    # Accept convenience fields that the frontend sends; they are resolved in the service layer
    uom: Optional[str] = None
    supplier_name: Optional[str] = None
    quantity: Optional[float] = None
    initial_quantity: Optional[float] = None
    office_id: Optional[UUID] = None


class CategorySummaryOut(BaseModel):
    id: UUID
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class LocationSummaryOut(BaseModel):
    id: UUID
    room_number: str
    building_name: Optional[str] = None
    floor: Optional[str] = None
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UOMSummaryOut(BaseModel):
    id: UUID
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class ItemOut(ItemBase):
    id: UUID
    office_id: UUID
    office_name: Optional[str] = None
    office_code: Optional[str] = None
    supplier_name: Optional[str] = None
    warranty_expiry_date: Optional[date] = None
    item_code: str
    uom_id: UUID
    barcode_number: Optional[str] = None
    total_cost: float
    operational_status: str
    current_classification: str
    classification: Optional[str] = None
    last_movement_date: Optional[date] = None
    created_by: UUID
    updated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    stock_balances: List[StockBalanceOut] = []
    category: Optional[CategorySummaryOut] = None
    location: Optional[LocationSummaryOut] = None
    uom: Optional[str] = None
    quantity: float = 0.0

    model_config = ConfigDict(from_attributes=True)

    @field_validator("uom", mode="before")
    @classmethod
    def extract_uom_code(cls, v):
        if v is None or isinstance(v, str):
            return v
        return getattr(v, "code", str(v))

    @classmethod
    def model_validate(cls, obj, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        if not instance.classification:
            instance.classification = instance.current_classification
        if not instance.office_name and getattr(obj, "office", None) is not None:
            instance.office_name = obj.office.name
            instance.office_code = obj.office.code
        if not instance.supplier_name and getattr(obj, "supplier", None) is not None:
            instance.supplier_name = obj.supplier.name
        if not instance.warranty_expiry_date and getattr(obj, "warranty", None) is not None:
            instance.warranty_expiry_date = obj.warranty.end_date
        # Compute total available quantity from stock_balances
        if hasattr(obj, "stock_balances") and obj.stock_balances:
            instance.quantity = float(sum(float(b.available_qty or 0) for b in obj.stock_balances))
        elif instance.item_type == "DURABLE_ASSET":
            instance.quantity = 1.0
        return instance


class ItemHistoryEventOut(BaseModel):
    event_type: str  # RECEIPT, ISSUE, RETURN, TRANSFER, MAINTENANCE, VERIFICATION, DISPOSAL
    event_date: datetime
    reference_number: Optional[str] = None
    actor_name: str
    details: str
    quantity: Optional[float] = None
    condition: Optional[str] = None
    location_name: Optional[str] = None
