"""Barcodes Pydantic Schemas"""

from datetime import date
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class BarcodeLookupRequest(BaseModel):
    barcode: str = Field(..., min_length=1, max_length=100)


class BarcodeLookupOut(BaseModel):
    item_id: UUID
    office_id: UUID
    location_id: UUID
    item_code: str
    barcode_number: str
    item_name: str
    item_type: str
    category_name: str
    location_name: str
    brand: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    condition: str
    operational_status: str
    current_classification: str
    current_custodian: Optional[str] = None
    current_department: Optional[str] = None
    purchase_date: Optional[date] = None
    last_movement_date: Optional[date] = None
    is_legacy: bool = False
    available_qty: float = 0.0
    unit_purchase_cost: float

    model_config = ConfigDict(from_attributes=True)

