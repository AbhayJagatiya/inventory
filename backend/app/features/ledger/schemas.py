"""Stock Transactions and Movement Ledger Pydantic Schemas"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class TransactionLineCreate(BaseModel):
    item_id: UUID
    quantity: float = Field(..., gt=0)
    procurement_item_id: Optional[UUID] = None
    original_line_id: Optional[UUID] = None
    unit_cost: Optional[float] = Field(default=0.00, ge=0)
    condition_observed: Optional[str] = Field(None, pattern="^(NEW|GOOD|FAIR|POOR|DAMAGED|SCRAP)$")
    remarks: Optional[str] = None


class TransactionLineOut(BaseModel):
    id: UUID
    transaction_id: UUID
    original_line_id: Optional[UUID] = None
    procurement_item_id: Optional[UUID] = None
    item_id: UUID
    quantity: float
    cumulative_returned_qty: float
    unit_cost: float
    total_cost: float
    condition_observed: Optional[str] = None
    remarks: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TransactionHeaderBase(BaseModel):
    office_id: UUID
    reference_document: Optional[str] = None
    remarks: Optional[str] = None
    idempotency_key: Optional[str] = None


# Receipts
class ReceiptCreate(TransactionHeaderBase):
    supplier_id: Optional[UUID] = None
    lines: List[TransactionLineCreate] = Field(..., min_length=1)


# Issues
class IssueCreate(TransactionHeaderBase):
    source_location_id: UUID
    recipient_name: str = Field(..., min_length=2)
    recipient_department: Optional[str] = None
    lines: List[TransactionLineCreate] = Field(..., min_length=1)


# Returns
class ReturnCreate(TransactionHeaderBase):
    original_transaction_id: UUID
    destination_location_id: UUID
    recipient_name: Optional[str] = None
    lines: List[TransactionLineCreate] = Field(..., min_length=1)


# Transfers
class TransferCreate(BaseModel):
    source_office_id: UUID
    destination_office_id: UUID
    source_location_id: UUID
    destination_location_id: UUID
    reason: Optional[str] = None
    idempotency_key: Optional[str] = None
    lines: List[TransactionLineCreate] = Field(..., min_length=1)


class TransferAction(BaseModel):
    remarks: Optional[str] = None
    destination_location_id: Optional[UUID] = None


class ReversalCreate(BaseModel):
    reversal_reason: str = Field(..., min_length=5)


class StockTransactionOut(BaseModel):
    id: UUID
    transaction_number: str
    idempotency_key: Optional[str] = None
    transaction_type: str
    office_id: UUID
    source_office_id: Optional[UUID] = None
    destination_office_id: Optional[UUID] = None
    source_location_id: Optional[UUID] = None
    destination_location_id: Optional[UUID] = None
    original_transaction_id: Optional[UUID] = None
    recipient_name: Optional[str] = None
    recipient_department: Optional[str] = None
    reference_document: Optional[str] = None
    status: str
    actor_id: UUID
    remarks: Optional[str] = None
    reversal_reason: Optional[str] = None
    posted_at: Optional[datetime] = None
    created_at: datetime
    lines: List[TransactionLineOut] = []

    model_config = ConfigDict(from_attributes=True)

