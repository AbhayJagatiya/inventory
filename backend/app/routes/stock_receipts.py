"""Stock Receipts Routes

Handles creation and posting of stock receipt transactions.
Exposed at /api/v1/receipts for PDF-spec path compatibility.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.ledger.schemas import ReceiptCreate, StockTransactionOut
from app.features.ledger.services import LedgerService
from app.features.users.models import User

router = APIRouter()


@router.post("", include_in_schema=False)
@router.post(
    "/",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create stock receipt transaction",
    description="Create a new stock receipt transaction.",
)
def create_receipt(
    payload: ReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Create a stock receipt transaction."""
    transaction = LedgerService.create_receipt(db, payload, actor=current_user)
    return StandardSuccessResponse(
        data=LedgerService.build_transaction_out(transaction),
        message="Stock receipt transaction created successfully",
    )


@router.post(
    "/{transaction_id}/post",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_200_OK,
    summary="Post receipt to inventory",
    description="Post a draft receipt transaction to inventory, updating stock levels.",
)
def post_receipt(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Post a receipt transaction to inventory ledger."""
    transaction = LedgerService.post_receipt(db, transaction_id, actor=current_user)
    return StandardSuccessResponse(
        data=LedgerService.build_transaction_out(transaction),
        message="Stock receipt posted to inventory successfully",
    )
