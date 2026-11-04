"""Maintenance Pydantic Schemas"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class MaintenanceBase(BaseModel):
    issue_description: str = Field(..., min_length=3)
    service_provider: str = Field(..., min_length=2, max_length=150)
    reported_date: date
    estimated_cost: float = Field(default=0.00, ge=0)


class MaintenanceCreate(MaintenanceBase):
    item_id: UUID
    office_id: UUID


class MaintenanceUpdate(BaseModel):
    service_provider: Optional[str] = Field(None, min_length=2, max_length=150)
    estimated_cost: Optional[float] = Field(None, ge=0)
    actual_cost: Optional[float] = Field(None, ge=0)
    status: Optional[str] = Field(None, pattern="^(REPORTED|UNDER_REVIEW|APPROVED|IN_REPAIR|COMPLETED|CANCELLED)$")
    work_performed: Optional[str] = None
    invoice_reference: Optional[str] = Field(None, max_length=100)


class MaintenanceComplete(BaseModel):
    completion_date: date
    actual_cost: float = Field(..., ge=0)
    work_performed: str = Field(..., min_length=3)
    invoice_reference: Optional[str] = Field(None, max_length=100)
    resulting_condition: str = Field(default="GOOD", pattern="^(GOOD|FAIR|SCRAP)$")


class MaintenanceOut(MaintenanceBase):
    id: UUID
    item_id: UUID
    office_id: UUID
    completion_date: Optional[date] = None
    actual_cost: float
    status: str
    work_performed: Optional[str] = None
    invoice_reference: Optional[str] = None
    reported_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

