"""Suppliers Pydantic Schemas"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SupplierBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    contact_person: Optional[str] = Field(None, max_length=100)
    phone: str = Field(..., min_length=5, max_length=20)
    email: Optional[EmailStr] = None
    address: str = Field(..., min_length=5)
    gstin: Optional[str] = Field(None, max_length=20)
    pan: Optional[str] = Field(None, max_length=20)


class SupplierCreate(SupplierBase):
    supplier_code: str = Field(..., min_length=2, max_length=30)


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    contact_person: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, min_length=5, max_length=20)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(None, min_length=5)
    gstin: Optional[str] = Field(None, max_length=20)
    pan: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None


class SupplierOut(SupplierBase):
    id: UUID
    supplier_code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

