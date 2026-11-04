"""Offices Pydantic Schemas"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OfficeBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    office_type: str = Field(default="DISTRICT_PANCHAYAT", max_length=50)
    district: str = Field(default="Gir Somnath", max_length=100)
    taluka: str = Field(default="Veraval", max_length=100)
    address: str = Field(..., min_length=5)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=20)


class OfficeCreate(OfficeBase):
    code: str = Field(..., min_length=2, max_length=20)


class OfficeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    address: Optional[str] = Field(None, min_length=5)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None


class OfficeOut(OfficeBase):
    id: UUID
    code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OfficeSummaryOut(BaseModel):
    office: OfficeOut
    total_items: int
    total_valuation: float
    dead_stock_count: int
    pending_condemnations_count: int
    active_alerts_count: int

