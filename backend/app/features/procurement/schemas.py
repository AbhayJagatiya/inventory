"""Procurement Orders and Supplier Returns (RMA) Pydantic Schemas"""

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ProcurementItemCreate(BaseModel):
    category_id: UUID
    item_description: str = Field(..., min_length=2)
    item_type: str = Field(default="DURABLE_ASSET", pattern="^(DURABLE_ASSET|CONSUMABLE_STOCK)$")
    quantity_ordered: float = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    tax_rate_pct: float = Field(default=0.00, ge=0, le=100)


class ProcurementItemOut(BaseModel):
    id: UUID
    procurement_id: UUID
    category_id: UUID
    item_description: str
    item_type: str
    quantity_ordered: float
    quantity_received: float
    unit_price: float
    tax_rate_pct: float
    total_price: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProcurementCreate(BaseModel):
    office_id: UUID
    supplier_id: UUID
    order_date: date
    invoice_number: Optional[str] = None
    items: List[ProcurementItemCreate] = Field(..., min_length=1)


class ProcurementUpdate(BaseModel):
    invoice_number: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(PENDING|PARTIALLY_RECEIVED|FULLY_RECEIVED|CANCELLED)$")


class ProcurementOut(BaseModel):
    id: UUID
    procurement_number: str
    office_id: UUID
    supplier_id: UUID
    order_date: date
    invoice_number: Optional[str] = None
    total_amount: float
    status: str
    created_by: UUID
    created_at: datetime
    items: List[ProcurementItemOut] = []

    model_config = ConfigDict(from_attributes=True)


# Supplier Returns / RMA
class SupplierReturnCreate(BaseModel):
    office_id: UUID
    supplier_id: UUID
    item_id: UUID
    procurement_id: Optional[UUID] = None
    warranty_id: Optional[UUID] = None
    return_date: date
    quantity: float = Field(..., gt=0)
    reason: str = Field(..., pattern="^(DEFECTIVE_ON_ARRIVAL|WARRANTY_REPAIR|INCORRECT_SPECIFICATION|DAMAGED_IN_TRANSIT)$")
    rma_reference_number: Optional[str] = None


class SupplierReturnDispatch(BaseModel):
    dispatch_date: date
    return_tracking_number: str = Field(..., min_length=1)
    carrier_name: str = Field(..., min_length=1)


class SupplierReturnVendorResponse(BaseModel):
    response: str = Field(..., pattern="^(ACCEPT|REJECT)$")
    vendor_acknowledgement_date: date
    rejection_reason: Optional[str] = None


class SupplierReturnResolve(BaseModel):
    resolution_type: str = Field(..., pattern="^(REPLACEMENT|CREDIT_NOTE|REFUND|REPAIRED_RETURN)$")
    resolution_remarks: str = Field(..., min_length=3)
    replacement_item_id: Optional[UUID] = None
    credit_note_number: Optional[str] = None
    credit_amount: Optional[float] = Field(default=0.00, ge=0)
    refund_reference_number: Optional[str] = None
    refund_amount: Optional[float] = Field(default=0.00, ge=0)


class SupplierReturnOut(BaseModel):
    id: UUID
    return_number: str
    office_id: UUID
    supplier_id: UUID
    item_id: UUID
    procurement_id: Optional[UUID] = None
    warranty_id: Optional[UUID] = None
    return_date: date
    dispatch_date: Optional[date] = None
    return_tracking_number: Optional[str] = None
    carrier_name: Optional[str] = None
    quantity: float
    reason: str
    status: str
    rma_reference_number: Optional[str] = None
    vendor_acknowledgement_date: Optional[date] = None
    vendor_rejection_reason: Optional[str] = None
    resolution_type: Optional[str] = None
    resolution_date: Optional[date] = None
    replacement_item_id: Optional[UUID] = None
    credit_note_number: Optional[str] = None
    credit_amount: float
    refund_reference_number: Optional[str] = None
    refund_amount: float
    resolution_remarks: Optional[str] = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

