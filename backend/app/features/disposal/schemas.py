"""Disposal Execution Pydantic Schemas"""

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class DisposalItemCreate(BaseModel):
    item_id: UUID
    disposed_qty: float = Field(default=1.00, gt=0)
    realized_amount: float = Field(default=0.00, ge=0)


class DisposalCreate(BaseModel):
    request_id: UUID
    office_id: UUID
    disposal_method: str = Field(
        ...,
        pattern="^(PUBLIC_AUCTION|E_WASTE_RECYCLING|SCRAP_SALE|BUYBACK|DESTRUCTION_BURIAL|DONATION_TRANSFER)$",
    )
    disposal_date: date
    total_sale_proceeds: float = Field(default=0.00, ge=0)
    recipient_agency: str = Field(..., min_length=2, max_length=150)
    reference_order_number: str = Field(..., min_length=2, max_length=100)
    certificate_document_id: Optional[UUID] = None
    items: List[DisposalItemCreate] = Field(..., min_length=1)


class DisposalItemOut(BaseModel):
    id: UUID
    disposal_id: UUID
    item_id: UUID
    disposed_qty: float
    realized_amount: float

    model_config = ConfigDict(from_attributes=True)


class DisposalOut(BaseModel):
    id: UUID
    disposal_number: str
    request_id: UUID
    office_id: UUID
    disposal_method: str
    disposal_date: date
    total_sale_proceeds: float
    recipient_agency: str
    reference_order_number: str
    certificate_document_id: Optional[UUID] = None
    executed_by: UUID
    created_at: datetime
    items: List[DisposalItemOut] = []

    model_config = ConfigDict(from_attributes=True)

