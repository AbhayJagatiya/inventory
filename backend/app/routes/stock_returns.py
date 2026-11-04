"""Stock Returns Routes

Handles creation and posting of items returned to inventory.
Routes at /api/v1/returns
"""

from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.ledger.schemas import ReturnCreate, StockTransactionOut
from app.features.ledger.services import LedgerService
from app.features.users.models import User

router = APIRouter()


@router.post("", include_in_schema=False)
@router.post(
    "/",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create stock return transaction",
    description="Create a new stock return transaction.",
)
def create_return(
    payload: ReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Create a stock return transaction."""
    transaction = LedgerService.create_return(db, payload, actor=current_user)
    return StandardSuccessResponse(
        data=LedgerService.build_transaction_out(transaction),
        message="Stock return transaction created successfully",
    )


@router.post(
    "/{transaction_id}/post",
    response_model=StandardSuccessResponse[StockTransactionOut],
    status_code=status.HTTP_200_OK,
    summary="Post return to inventory",
    description="Post a draft return transaction to inventory, updating stock levels.",
)
def post_return(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_TRANSACTIONS")),
) -> StandardSuccessResponse[StockTransactionOut]:
    """Post a stock return transaction to inventory ledger."""
    transaction = LedgerService.post_return(db, transaction_id, actor=current_user)
    return StandardSuccessResponse(
        data=LedgerService.build_transaction_out(transaction),
        message="Stock return posted to inventory successfully",
    )
