"""Stock Transfers Routes

Handles creation, approval, and completion of transfer workflows.
Routes at /api/v1/transfers
"""

from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.ledger.schemas import TransferAction, TransferCreate, StockTransactionOut
from app.features.ledger.services import LedgerService
from app.features.users.models import User

router = APIRouter()


@router.post("", include_in_schema=False)
@router.post(
    "/",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create stock transfer transaction",
    description="Initiate a new inter-office stock transfer.",
)
def create_transfer(
    payload: TransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Create a new stock transfer transaction (pending approval)."""
    transaction = LedgerService.create_transfer(db, payload, actor=current_user)
    return StandardSuccessResponse(
        data=LedgerService.build_transaction_out(transaction),
        message="Stock transfer transaction created successfully",
    )


@router.post(
    "/{transaction_id}/approve",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_200_OK,
    summary="Approve or reject stock transfer",
    description="Approve or reject a pending stock transfer.",
)
def approve_transfer(
    transaction_id: UUID,
    payload: TransferAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Approve or reject a pending stock transfer transaction."""
    transaction = LedgerService.approve_transfer(
        db,
        transaction_id,
        action=payload.action or "APPROVE",
        reason=payload.reason,
        remarks=payload.remarks,
        approver=current_user,
    )
    return StandardSuccessResponse(
        data=LedgerService.build_transaction_out(transaction),
        message="Stock transfer updated successfully",
    )


@router.post(
    "/{transaction_id}/dispatch",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_200_OK,
    summary="Dispatch stock transfer",
    description="Mark an approved stock transfer as in transit with waybill details.",
)
def dispatch_transfer(
    transaction_id: UUID,
    payload: TransferAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Mark an approved stock transfer as IN_TRANSIT."""
    transaction = LedgerService.dispatch_transfer(
        db,
        transaction_id,
        carrier_name=payload.carrier_name,
        waybill_number=payload.waybill_number,
        vehicle_number=payload.vehicle_number,
        expected_delivery_date=payload.expected_delivery_date,
        dispatcher=current_user,
    )
    return StandardSuccessResponse(
        data=LedgerService.build_transaction_out(transaction),
        message="Stock transfer marked in transit",
    )


@router.post(
    "/{transaction_id}/complete",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_200_OK,
    summary="Complete stock transfer",
    description="Mark an approved or in-transit stock transfer as completed and update inventory.",
)
def complete_transfer(
    transaction_id: UUID,
    payload: TransferAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Mark an approved or in-transit stock transfer as completed."""
    transaction = LedgerService.complete_transfer(
        db,
        transaction_id,
        remarks=payload.remarks,
        received_by=payload.received_by,
        destination_location_id=payload.destination_location_id,
        receiver=current_user,
    )
    return StandardSuccessResponse(
        data=LedgerService.build_transaction_out(transaction),
        message="Stock transfer completed successfully",
    )
