"""Stock Transactions and Movement Ledger Pydantic Schemas"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class TransactionLineCreate(BaseModel):
    item_id: Optional[UUID] = None
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    item_type: Optional[str] = "DURABLE_ASSET"
    category_name: Optional[str] = None
    uom: Optional[str] = "NOS"
    quantity: Optional[float] = None
    quantity_received: Optional[float] = None
    quantity_accepted: Optional[float] = None
    quantity_ordered: Optional[float] = None
    quantity_rejected: Optional[float] = 0.0
    rejection_reason: Optional[str] = None
    quantity_issued: Optional[float] = None
    quantity_returned: Optional[float] = None
    procurement_item_id: Optional[UUID] = None
    original_line_id: Optional[UUID] = None
    unit_cost: Optional[float] = 0.00
    condition_observed: Optional[str] = None
    condition: Optional[str] = None
    remarks: Optional[str] = None
    serial_numbers: Optional[List[str]] = None
    serial_number: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class TransactionLineOut(BaseModel):
    id: UUID
    transaction_id: UUID
    original_line_id: Optional[UUID] = None
    procurement_item_id: Optional[UUID] = None
    item_id: UUID
    quantity: float
    cumulative_returned_qty: float = 0.0
    unit_cost: float = 0.0
    total_cost: float = 0.0
    condition_observed: Optional[str] = None
    remarks: Optional[str] = None

    # Enriched convenience properties for frontend display
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    item_type: Optional[str] = None
    uom: Optional[str] = None
    serial_number: Optional[str] = None
    serial_numbers: Optional[List[str]] = None
    quantity_received: Optional[float] = None
    quantity_accepted: Optional[float] = None
    quantity_ordered: Optional[float] = None
    quantity_rejected: Optional[float] = 0.0
    rejection_reason: Optional[str] = None
    quantity_issued: Optional[float] = None
    quantity_returned: Optional[float] = 0.0
    remaining_unreturned: Optional[float] = None
    total_accepted_cost: Optional[float] = None

    model_config = ConfigDict(from_attributes=True, extra="ignore")


class TransactionHeaderBase(BaseModel):
    office_id: Optional[UUID] = None
    reference_document: Optional[str] = None
    remarks: Optional[str] = None
    idempotency_key: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


# Receipts
class ReceiptCreate(TransactionHeaderBase):
    receipt_date: Optional[str] = None
    supplier_id: Optional[UUID] = None
    supplier_name: Optional[str] = None
    supplier_contact: Optional[str] = None
    po_number: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    receiving_office: Optional[str] = None
    receiving_location: Optional[str] = None
    receiving_location_id: Optional[UUID] = None
    receiving_officer: Optional[str] = None
    status: Optional[str] = "DRAFT"
    attachment_name: Optional[str] = None
    total_accepted_value: Optional[float] = None
    lines: Optional[List[TransactionLineCreate]] = None
    items: Optional[List[TransactionLineCreate]] = None

    model_config = ConfigDict(extra="ignore")


# Issues
class IssueCreate(TransactionHeaderBase):
    source_location_id: Optional[UUID] = None
    recipient_name: Optional[str] = None
    receiving_employee: Optional[str] = None
    receiving_designation: Optional[str] = None
    recipient_department: Optional[str] = None
    department: Optional[str] = None
    issue_date: Optional[str] = None
    sanction_order_number: Optional[str] = None
    purpose: Optional[str] = None
    status: Optional[str] = "POSTED"
    lines: Optional[List[TransactionLineCreate]] = None
    items: Optional[List[TransactionLineCreate]] = None

    model_config = ConfigDict(extra="ignore")


# Returns
class ReturnCreate(TransactionHeaderBase):
    original_transaction_id: Optional[UUID] = None
    original_issue_id: Optional[UUID] = None
    original_issue_voucher: Optional[str] = None
    destination_location_id: Optional[UUID] = None
    recipient_name: Optional[str] = None
    returning_employee: Optional[str] = None
    returning_department: Optional[str] = None
    receiving_officer: Optional[str] = None
    return_reason: Optional[str] = None
    return_date: Optional[str] = None
    status: Optional[str] = "POSTED"
    lines: Optional[List[TransactionLineCreate]] = None
    items: Optional[List[TransactionLineCreate]] = None

    model_config = ConfigDict(extra="ignore")


# Transfers
class TransferCreate(BaseModel):
    source_office_id: Optional[UUID] = None
    destination_office_id: Optional[UUID] = None
    source_office: Optional[str] = None
    destination_office: Optional[str] = None
    source_location_id: Optional[UUID] = None
    destination_location_id: Optional[UUID] = None
    destination_location: Optional[str] = None
    transfer_type: Optional[str] = "PERMANENT"
    expected_return_date: Optional[str] = None
    order_reference: Optional[str] = None
    reason: Optional[str] = None
    idempotency_key: Optional[str] = None
    lines: Optional[List[TransactionLineCreate]] = None
    items: Optional[List[TransactionLineCreate]] = None

    model_config = ConfigDict(extra="ignore")


class TransferAction(BaseModel):
    remarks: Optional[str] = None
    destination_location_id: Optional[UUID] = None

    model_config = ConfigDict(extra="ignore")


class ReversalCreate(BaseModel):
    reversal_reason: str = Field(..., min_length=5)

    model_config = ConfigDict(extra="ignore")


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

    # Frontend convenience aliases
    voucher_number: Optional[str] = None
    transfer_number: Optional[str] = None
    receipt_date: Optional[str] = None
    issue_date: Optional[str] = None
    return_date: Optional[str] = None
    request_date: Optional[str] = None
    department: Optional[str] = None
    receiving_employee: Optional[str] = None
    receiving_person: Optional[str] = None
    returned_by_person: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_contact: Optional[str] = None
    po_number: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    sanction_order_number: Optional[str] = None
    order_reference: Optional[str] = None
    receiving_office: Optional[str] = None
    receiving_location: Optional[str] = None
    from_office_name: Optional[str] = None
    to_office_name: Optional[str] = None
    items: List[TransactionLineOut] = []
    total_accepted_value: Optional[float] = 0.0

    model_config = ConfigDict(from_attributes=True, extra="ignore")
