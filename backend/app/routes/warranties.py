"""
Warranties Routes
Routes at /api/v1/warranties for managing item warranty records.
Handles CRUD operations, summary metrics, and expiry tracking for warranties.
"""

from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import ResponseMeta, StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.users.models import User
from app.features.warranties.schemas import (
    WarrantyCreate,
    WarrantyOut,
    WarrantySummaryOut,
    WarrantyUpdate,
)
from app.features.warranties.services import WarrantyService

router = APIRouter()


@router.get(
    "/summary",
    response_model=StandardSuccessResponse[WarrantySummaryOut],
    status_code=status.HTTP_200_OK,
    summary="Get warranty dashboard summary",
)
def get_warranty_summary(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warranty:view")),
) -> StandardSuccessResponse[WarrantySummaryOut]:
    summary = WarrantyService.get_summary(
        db=db,
        office_id=office_id,
        current_user=current_user,
    )
    return StandardSuccessResponse(
        data=summary,
        message="Warranty summary retrieved successfully",
    )


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[WarrantyOut]],
    status_code=status.HTTP_200_OK,
    summary="List warranties",
    description="Retrieve a paginated list of warranties with office scoping and status filtering.",
)
def list_warranties(
    office_id: Optional[UUID] = Query(None, description="Filter by office ID"),
    item_id: Optional[UUID] = Query(None, description="Filter by inventory item ID"),
    supplier_id: Optional[UUID] = Query(None, description="Filter by supplier ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    warranty_status: Optional[str] = Query(None, alias="status", description="ACTIVE, EXPIRING, EXPIRED"),
    expiring_within_days: Optional[int] = Query(
        None, ge=1, description="Return warranties expiring within this many days"
    ),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("end_date"),
    sort_dir: str = Query("asc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warranty:view")),
) -> StandardSuccessResponse[List[WarrantyOut]]:
    """List warranties with optional filters."""
    warranties, total = WarrantyService.list_warranties(
        db,
        office_id=office_id,
        item_id=item_id,
        supplier_id=supplier_id,
        is_active=is_active,
        status=warranty_status,
        expiring_within_days=expiring_within_days,
        date_from=date_from,
        date_to=date_to,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
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
    current_user: User = Depends(require_permission("warranty:manage")),
) -> StandardSuccessResponse[WarrantyOut]:
    """Create a new warranty record."""
    warranty = WarrantyService.create_warranty(
        db, payload, creator=current_user
    )
    return StandardSuccessResponse(
        data=warranty,
        message="Warranty created successfully",
    )


@router.get(
    "/expiring",
    response_model=StandardSuccessResponse[List[WarrantyOut]],
    status_code=status.HTTP_200_OK,
    summary="List expiring warranties",
    description="Retrieve warranties expiring within the specified lead_days (30/60/90).",
)
def get_expiring_warranties(
    office_id: Optional[UUID] = Query(None, description="Filter by office ID"),
    lead_days: Optional[int] = Query(None, ge=1, le=365, description="Lead window in days"),
    days: int = Query(30, ge=1, le=365, description="Legacy alias for lead_days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("warranty:view")),
) -> StandardSuccessResponse[List[WarrantyOut]]:
    """List warranties expiring within the given number of days."""
    window = lead_days if lead_days is not None else days
    warranties = WarrantyService.get_expiring_warranties(
        db,
        lead_days=window,
        office_id=office_id,
        current_user=current_user,
    )
    return StandardSuccessResponse(
        data=warranties,
        message=f"Warranties expiring within {window} days retrieved successfully",
    )


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
    current_user: User = Depends(require_permission("warranty:view")),
) -> StandardSuccessResponse[WarrantyOut]:
    """Get a warranty by ID."""
    warranty = WarrantyService.get_warranty(db, warranty_id, current_user=current_user)
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
    current_user: User = Depends(require_permission("warranty:manage")),
) -> StandardSuccessResponse[WarrantyOut]:
    """Update a warranty record."""
    warranty = WarrantyService.update_warranty(
        db, warranty_id, payload, updater=current_user
    )
    return StandardSuccessResponse(
        data=warranty,
        message="Warranty updated successfully",
    )
