"""Barcodes Pydantic Schemas"""

from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class BarcodeLookupRequest(BaseModel):
    barcode: str = Field(..., min_length=1, max_length=100)


class BarcodeLookupOut(BaseModel):
    item_id: UUID
    office_id: UUID
    item_code: str
    barcode_number: str
    item_name: str
    category_name: str
    location_name: str
    condition: str
    operational_status: str
    current_classification: str
    current_custodian: Optional[str] = None
    unit_purchase_cost: float

    model_config = ConfigDict(from_attributes=True)

