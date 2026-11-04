"""
Warranties Routes
Routes at /api/v1/warranties for managing item warranty records.
Handles CRUD operations and expiry tracking for warranties.

NOTE: The /expiring route is defined BEFORE /{warranty_id} to prevent
FastAPI from treating the literal string "expiring" as a UUID path parameter.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import ResponseMeta, StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.warranties.models import Warranty
from app.features.warranties.schemas import WarrantyCreate, WarrantyOut, WarrantyUpdate
from app.features.warranties.services import WarrantyService
from app.features.users.models import User

router = APIRouter()


# ---------------------------------------------------------------------------
# Collection routes
# ---------------------------------------------------------------------------


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[WarrantyOut]],
    status_code=status.HTTP_200_OK,
    summary="List warranties",
    description="Retrieve a paginated list of warranties. Supports filtering by office, item, active status, and expiry window.",
)
def list_warranties(
    office_id: Optional[UUID] = Query(None, description="Filter by office ID"),
    item_id: Optional[UUID] = Query(None, description="Filter by inventory item ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    expiring_within_days: Optional[int] = Query(
        None, ge=1, description="Return warranties expiring within this many days"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_WARRANTIES")),
) -> StandardSuccessResponse[List[WarrantyOut]]:
    """List warranties with optional filters."""
    warranties, total = WarrantyService.list_warranties(
        db,
        office_id=office_id,
        item_id=item_id,
        is_active=is_active,
        expiring_within_days=expiring_within_days,
        current_user=current_user,
        page=page,
        limit=limit,
    )
    return StandardSuccessResponse(
        data=warranties,
        message="Warranties retrieved successfully",
        meta=ResponseMeta(page=page, limit=limit, total=total),
    )


@router.post(
    "/",
    response_model=StandardSuccessResponse[WarrantyOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create warranty",
    description="Register a new warranty record for an inventory item.",
)
def create_warranty(
    payload: WarrantyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_WARRANTIES")),
) -> StandardSuccessResponse[WarrantyOut]:
    """Create a new warranty record."""
    warranty = WarrantyService.create_warranty(
        db, payload, created_by=current_user
    )
    return StandardSuccessResponse(
        data=warranty,
        message="Warranty created successfully",
    )


# ---------------------------------------------------------------------------
# IMPORTANT: /expiring MUST be declared before /{warranty_id}
# to avoid FastAPI routing "expiring" as a UUID parameter.
# ---------------------------------------------------------------------------


@router.get(
    "/expiring",
    response_model=StandardSuccessResponse[List[WarrantyOut]],
    status_code=status.HTTP_200_OK,
    summary="List expiring warranties",
    description="Retrieve warranties that are expiring within the specified number of days.",
)
def get_expiring_warranties(
    office_id: Optional[UUID] = Query(None, description="Filter by office ID"),
    days: int = Query(30, ge=1, le=365, description="Number of days ahead to check for expiry"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_WARRANTIES")),
) -> StandardSuccessResponse[List[WarrantyOut]]:
    """List warranties expiring within the given number of days."""
    warranties = WarrantyService.get_expiring_warranties(
        db,
        days=days,
        office_id=office_id,
        current_user=current_user,
    )
    return StandardSuccessResponse(
        data=warranties,
        message=f"Warranties expiring within {days} days retrieved successfully",
    )


# ---------------------------------------------------------------------------
# Item routes (parameterised — must come after /expiring)
# ---------------------------------------------------------------------------


@router.get(
    "/{warranty_id}",
    response_model=StandardSuccessResponse[WarrantyOut],
    status_code=status.HTTP_200_OK,
    summary="Get warranty",
    description="Retrieve a single warranty record by its ID.",
)
def get_warranty(
    warranty_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_WARRANTIES")),
) -> StandardSuccessResponse[WarrantyOut]:
    """Get a warranty by ID."""
    warranty = WarrantyService.get_warranty(db, warranty_id)
    return StandardSuccessResponse(
        data=warranty,
        message="Warranty retrieved successfully",
    )


@router.patch(
    "/{warranty_id}",
    response_model=StandardSuccessResponse[WarrantyOut],
    status_code=status.HTTP_200_OK,
    summary="Update warranty",
    description="Partially update an existing warranty record.",
)
def update_warranty(
    warranty_id: UUID,
    payload: WarrantyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_WARRANTIES")),
) -> StandardSuccessResponse[WarrantyOut]:
    """Update a warranty record."""
    warranty = WarrantyService.update_warranty(
        db, warranty_id, payload, updated_by=current_user
    )
    return StandardSuccessResponse(
        data=warranty,
        message="Warranty updated successfully",
    )
