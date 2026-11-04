"""
Office management routes for the Dead Stock Inventory Management System.
Handles CRUD operations and dashboard summaries for offices (Panchayat units).
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import ResponseMeta, StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.offices.models import Office
from app.features.offices.schemas import (
    OfficeCreate,
    OfficeOut,
    OfficeSummaryOut,
    OfficeUpdate,
)
from app.features.offices.services import OfficeService
from app.features.users.models import User

router = APIRouter()


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[OfficeOut]],
    status_code=status.HTTP_200_OK,
    summary="List offices",
    description=(
        "Returns a paginated list of offices. Non-admin callers are scoped to "
        "offices they are authorized to view per the office isolation rules."
    ),
)
def list_offices(
    office_type: Optional[str] = Query(None, description="Filter by office type"),
    district: Optional[str] = Query(None, description="Filter by district name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(20, ge=1, le=100, description="Records per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_OFFICES")),
):
    """Requires VIEW_OFFICES permission."""
    offices, total = OfficeService.list_offices(
        db=db,
        office_type=office_type,
        district=district,
        is_active=is_active,
        page=page,
        limit=limit,
        current_user=current_user,
    )
    return StandardSuccessResponse(
        data=offices,
        message="Offices retrieved successfully",
        meta=ResponseMeta(page=page, limit=limit, total=total),
    )


@router.post(
    "/",
    response_model=StandardSuccessResponse[OfficeOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create office",
    description="Register a new office (Panchayat unit) in the system.",
)
def create_office(
    payload: OfficeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_OFFICES")),
):
    """Requires MANAGE_OFFICES permission."""
    office = OfficeService.create_office(
        db=db,
        payload=payload,
        created_by=current_user,
    )
    return StandardSuccessResponse(
        data=office,
        message="Office created successfully",
    )


@router.get(
    "/{office_id}",
    response_model=StandardSuccessResponse[OfficeOut],
    status_code=status.HTTP_200_OK,
    summary="Get office",
    description="Retrieve a single office record by UUID.",
)
def get_office(
    office_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_OFFICES")),
):
    """Requires VIEW_OFFICES permission."""
    office = OfficeService.get_office(db=db, office_id=office_id)
    return StandardSuccessResponse(
        data=office,
        message="Office retrieved successfully",
    )


@router.patch(
    "/{office_id}",
    response_model=StandardSuccessResponse[OfficeOut],
    status_code=status.HTTP_200_OK,
    summary="Update office",
    description="Partially update an office's details.",
)
def update_office(
    office_id: UUID,
    payload: OfficeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_OFFICES")),
):
    """Requires MANAGE_OFFICES permission."""
    office = OfficeService.update_office(
        db=db,
        office_id=office_id,
        payload=payload,
        updated_by=current_user,
    )
    return StandardSuccessResponse(
        data=office,
        message="Office updated successfully",
    )


@router.get(
    "/{office_id}/summary",
    response_model=StandardSuccessResponse[OfficeSummaryOut],
    status_code=status.HTTP_200_OK,
    summary="Office dashboard summary",
    description=(
        "Returns aggregated statistics and KPIs for a specific office: "
        "inventory counts, pending approvals, recent activity, etc."
    ),
)
def get_office_summary(
    office_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_OFFICES")),
):
    """Requires VIEW_OFFICES permission."""
    summary = OfficeService.get_office_summary(
        db=db,
        office_id=office_id,
        current_user=current_user,
    )
    return StandardSuccessResponse(
        data=summary,
        message="Office summary retrieved successfully",
    )
