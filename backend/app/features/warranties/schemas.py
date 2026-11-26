"""Warranties Pydantic Schemas"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class WarrantyBase(BaseModel):
    provider_name: str = Field(..., min_length=2, max_length=150)
    start_date: date
    end_date: date
    coverage_details: Optional[str] = None
    support_contact: Optional[str] = Field(None, max_length=100)


class WarrantyCreate(WarrantyBase):
    item_id: UUID
    supplier_id: Optional[UUID] = None
    document_id: Optional[UUID] = None


class WarrantyUpdate(BaseModel):
    supplier_id: Optional[UUID] = None
    provider_name: Optional[str] = Field(None, min_length=2, max_length=150)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    coverage_details: Optional[str] = None
    support_contact: Optional[str] = Field(None, max_length=100)
    document_id: Optional[UUID] = None


class WarrantyOut(WarrantyBase):
    id: UUID
    item_id: UUID
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    office_id: Optional[UUID] = None
    office_name: Optional[str] = None
    supplier_id: Optional[UUID] = None
    supplier_name: Optional[str] = None
    document_id: Optional[UUID] = None
    status: str = "ACTIVE"
    remaining_days: int = 0
    maintenance_count: int = 0
    rma_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WarrantySummaryOut(BaseModel):
    total_warranties: int
    active_count: int
    expiring_30_count: int
    expiring_60_count: int
    expiring_90_count: int
    expired_count: int
    items_without_warranty: int
