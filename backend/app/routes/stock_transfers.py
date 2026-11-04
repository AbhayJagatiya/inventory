"""
Stock Transfers Routes
Routes at /api/v1/transfers for managing inter-office stock transfer transactions.
Handles creation, approval, and completion of transfer workflows.
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


@router.post(
    "/",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create stock transfer transaction",
    description=(
        "Initiate a new inter-office stock transfer. "
        "The transfer requires approval before it can be completed."
    ),
)
def create_transfer(
    payload: TransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Create a new stock transfer transaction (pending approval)."""
    transaction = LedgerService.create_transfer(db, payload, actor=current_user)
    return StandardSuccessResponse(
        data=transaction,
        message="Stock transfer transaction created successfully",
    )


@router.post(
    "/{transaction_id}/approve",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_200_OK,
    summary="Approve stock transfer",
    description="Approve a pending stock transfer. Requires APPROVE_TRANSFERS permission.",
)
def approve_transfer(
    transaction_id: UUID,
    payload: TransferAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("APPROVE_TRANSFERS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Approve a pending stock transfer transaction."""
    transaction = LedgerService.approve_transfer(
        db, transaction_id, payload, actor=current_user
    )
    return StandardSuccessResponse(
        data=transaction,
        message="Stock transfer approved successfully",
    )


@router.post(
    "/{transaction_id}/complete",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_200_OK,
    summary="Complete stock transfer",
    description="Mark an approved stock transfer as completed and update inventory on both sides.",
)
def complete_transfer(
    transaction_id: UUID,
    payload: TransferAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Complete an approved stock transfer and post inventory changes."""
    transaction = LedgerService.complete_transfer(
        db, transaction_id, payload, actor=current_user
    )
    return StandardSuccessResponse(
        data=transaction,
        message="Stock transfer completed successfully",
    )
