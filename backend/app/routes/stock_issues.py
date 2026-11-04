"""
Stock Issues Routes
Routes at /api/v1/issues for managing stock issue transactions.
Handles creation and posting of items issued from inventory.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.ledger.schemas import IssueCreate, StockTransactionOut
from app.features.ledger.services import LedgerService
from app.features.users.models import User

router = APIRouter()


@router.post(
    "/",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create stock issue transaction",
    description="Create a new stock issue transaction. The transaction must be posted separately to update inventory.",
)
def create_issue(
    payload: IssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Create a stock issue transaction (draft state)."""
    transaction = LedgerService.create_issue(db, payload, actor=current_user)
    return StandardSuccessResponse(
        data=transaction,
        message="Stock issue transaction created successfully",
    )


@router.post(
    "/{transaction_id}/post",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_200_OK,
    summary="Post issue to inventory",
    description="Post a draft issue transaction to inventory, updating stock levels.",
)
def post_issue(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Post a stock issue transaction to inventory ledger."""
    transaction = LedgerService.post_issue(db, transaction_id, actor=current_user)
    return StandardSuccessResponse(
        data=transaction,
        message="Stock issue posted to inventory successfully",
    )
