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


class WarrantyUpdate(BaseModel):
    provider_name: Optional[str] = Field(None, min_length=2, max_length=150)
    end_date: Optional[date] = None
    coverage_details: Optional[str] = None
    support_contact: Optional[str] = Field(None, max_length=100)


class WarrantyOut(WarrantyBase):
    id: UUID
    item_id: UUID
    supplier_id: Optional[UUID] = None
    document_id: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

