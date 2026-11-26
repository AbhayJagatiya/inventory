"""Maintenance Pydantic Schemas"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class MaintenanceBase(BaseModel):
    issue_description: str = Field(..., min_length=3)
    service_provider: str = Field(..., min_length=2, max_length=150)
    reported_date: date
    estimated_cost: float = Field(default=0.00, ge=0)


class MaintenanceCreate(MaintenanceBase):
    item_id: UUID
    office_id: Optional[UUID] = None
    remarks: Optional[str] = None


class MaintenanceUpdate(BaseModel):
    service_provider: Optional[str] = Field(None, min_length=2, max_length=150)
    estimated_cost: Optional[float] = Field(None, ge=0)
    actual_cost: Optional[float] = Field(None, ge=0)
    status: Optional[str] = Field(
        None,
        pattern="^(REPORTED|UNDER_REVIEW|APPROVED|IN_REPAIR|COMPLETED|CANCELLED)$",
    )
    work_performed: Optional[str] = None
    invoice_reference: Optional[str] = Field(None, max_length=100)


class MaintenanceComplete(BaseModel):
    completion_date: date
    actual_cost: float = Field(..., ge=0)
    work_performed: str = Field(..., min_length=3)
    invoice_reference: Optional[str] = Field(None, max_length=100)
    resulting_condition: str = Field(default="GOOD", pattern="^(GOOD|FAIR|SCRAP)$")
    completion_remarks: Optional[str] = None


class MaintenanceOut(MaintenanceBase):
    id: UUID
    ticket_reference: Optional[str] = None
    item_id: UUID
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    category_id: Optional[UUID] = None
    category_name: Optional[str] = None
    office_id: UUID
    office_name: Optional[str] = None
    completion_date: Optional[date] = None
    actual_cost: float
    status: str
    work_performed: Optional[str] = None
    invoice_reference: Optional[str] = None
    reported_by: UUID
    reporter_name: Optional[str] = None
    cumulative_repair_cost: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MaintenanceDetailOut(MaintenanceOut):
    item_operational_status: Optional[str] = None
    item_condition: Optional[str] = None
    item_purchase_cost: Optional[float] = None
    documents: List[Dict[str, Any]] = []
    item_history: List[Dict[str, Any]] = []
    audit_logs: List[Dict[str, Any]] = []


class MaintenanceSummaryOut(BaseModel):
    total_tickets: int
    reported_count: int
    under_review_count: int
    approved_count: int
    in_repair_count: int
    completed_count: int
    cancelled_count: int
    overdue_count: int
    total_actual_cost: float
    avg_repair_cost: float
    assets_under_maintenance: int
    by_status: List[Dict[str, Any]] = []
    by_category: List[Dict[str, Any]] = []
    monthly_activity: List[Dict[str, Any]] = []
    cost_over_time: List[Dict[str, Any]] = []
