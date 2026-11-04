"""Condemnation Proposals and Approvals Pydantic Schemas"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class CondemnationRequestItemCreate(BaseModel):
    item_id: UUID
    item_condition: str = Field(..., pattern="^(DAMAGED|SCRAP|POOR|OBSOLETE)$")
    assessed_scrap_value: float = Field(default=0.00, ge=0)
    inspector_remarks: Optional[str] = None


class CondemnationRequestCreate(BaseModel):
    office_id: UUID
    reason_code: str = Field(..., pattern="^(OBSOLETE|BEYOND_ECONOMIC_REPAIR|DAMAGED_BEYOND_RECOVERY|DESTROYED)$")
    condition_summary: str = Field(..., min_length=5)
    items: List[CondemnationRequestItemCreate] = Field(..., min_length=1)


class CondemnationReviewRequest(BaseModel):
    action: str = Field(default="REVIEW", pattern="^(REVIEW)$")
    remarks: str = Field(..., min_length=3)


class CondemnationDecisionRequest(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT|REQUEST_INFO)$")
    order_number: Optional[str] = None
    remarks: str = Field(..., min_length=3)


class ApprovalActionOut(BaseModel):
    id: UUID
    request_id: UUID
    action_by: UUID
    role_snapshot: str
    action: str
    order_number: Optional[str] = None
    remarks: str
    action_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CondemnationRequestItemOut(BaseModel):
    id: UUID
    request_id: UUID
    office_id: UUID
    item_id: UUID
    item_condition: str
    assessed_scrap_value: float
    inspector_remarks: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CondemnationRequestOut(BaseModel):
    id: UUID
    request_number: str
    office_id: UUID
    reason_code: str
    condition_summary: str
    status: str
    submitted_by: UUID
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items: List[CondemnationRequestItemOut] = []
    approval_actions: List[ApprovalActionOut] = []

    model_config = ConfigDict(from_attributes=True)

