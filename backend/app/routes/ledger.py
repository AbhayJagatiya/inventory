"""
Ledger / transaction routes for the Dead Stock Inventory Management System.
Prefix: /api/v1/transactions (registered in main.py)
"""

from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse, ResponseMeta
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.ledger.models import StockTransaction
from app.features.ledger.schemas import ReversalCreate, StockTransactionOut
from app.features.ledger.services import LedgerService
from app.features.users.models import User

router = APIRouter()


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[StockTransactionOut]],
    summary="List stock transactions",
    status_code=status.HTTP_200_OK,
)
def list_transactions(
    office_id: Optional[UUID] = Query(None, description="Filter by office ID"),
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type"),
    status: Optional[str] = Query(None, description="Filter by transaction status"),
    date_from: Optional[date] = Query(None, description="Start date filter (inclusive)"),
    date_to: Optional[date] = Query(None, description="End date filter (inclusive)"),
    search: Optional[str] = Query(None, description="Full-text search term"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=200, description="Results per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_TRANSACTIONS")),
):
    """Return a paginated list of stock transactions scoped to the user's office."""
    transactions, total = LedgerService.list_transactions(
        db,
        office_id=office_id,
        transaction_type=transaction_type,
        status=status,
        date_from=date_from,
        date_to=date_to,
        search=search,
        current_user=current_user,
        page=page,
        limit=limit,
    )
    return StandardSuccessResponse(
        data=transactions,
        message="Transactions retrieved successfully",
        meta=ResponseMeta(page=page, limit=limit, total=total),
    )


@router.get(
    "/{transaction_id}",
    response_model=StandardSuccessResponse[StockTransactionOut],
    summary="Get a single transaction with its lines",
    status_code=status.HTTP_200_OK,
)
def get_transaction(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_TRANSACTIONS")),
):
    """Retrieve a single stock transaction including all its line items."""
    transaction = LedgerService.get_transaction(db, transaction_id)
    return StandardSuccessResponse(
        data=transaction,
        message="Transaction retrieved successfully",
    )


@router.post(
    "/{transaction_id}/reverse",
    response_model=StandardSuccessResponse[StockTransactionOut],
    summary="Create a reversal voucher for a transaction",
    status_code=status.HTTP_201_CREATED,
)
def reverse_transaction(
    transaction_id: UUID,
    payload: ReversalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
):
    """Create a reversal voucher that negates a previously posted transaction."""
    reversal = LedgerService.reversal_voucher(
        db,
        transaction_id,
        payload.reversal_reason,
        actor=current_user,
    )
    return StandardSuccessResponse(
        data=reversal,
        message="Reversal voucher created successfully",
    )
