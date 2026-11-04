"""
Procurement routes.
Prefix: /api/v1/procurements
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse, ResponseMeta
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.core.permissions import ROLE_SYSTEM_ADMIN

from app.features.procurement.schemas import (
    ProcurementCreate,
    ProcurementOut,
    ProcurementUpdate,
)
from app.features.procurement.services import ProcurementService
from app.features.users.models import User


router = APIRouter()


def _check_office_access(record_office_id: UUID, current_user: User) -> None:
    """Prevent users from accessing procurement records outside their office."""
    if (
        ROLE_SYSTEM_ADMIN not in current_user.role_names
        and record_office_id != current_user.office_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this office's procurement record.",
        )


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[ProcurementOut]],
    summary="List procurement orders",
)
def list_procurements(
    office_id: Optional[UUID] = Query(None),
    supplier_id: Optional[UUID] = Query(None),
    procurement_status: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("supplier:view")),
):
    procurements, total = ProcurementService.list_procurements(
        db=db,
        office_id=office_id,
        supplier_id=supplier_id,
        status=procurement_status,
        current_user=current_user,
        page=page,
        limit=limit,
    )

    return StandardSuccessResponse(
        data=procurements,
        message="Procurement orders retrieved successfully",
        meta=ResponseMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=(total + limit - 1) // limit,
        ),
    )


@router.post(
    "/",
    response_model=StandardSuccessResponse[ProcurementOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create procurement order",
)
def create_procurement(
    payload: ProcurementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("supplier:manage")),
):
    procurement = ProcurementService.create_procurement(
        db=db,
        payload=payload,
        creator=current_user,
    )

    return StandardSuccessResponse(
        data=procurement,
        message="Procurement order created successfully",
    )


@router.get(
    "/{procurement_id}",
    response_model=StandardSuccessResponse[ProcurementOut],
    summary="Get procurement order details",
)
def get_procurement(
    procurement_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("supplier:view")),
):
    procurement = ProcurementService.get_procurement(
        db=db,
        procurement_id=procurement_id,
    )
    _check_office_access(procurement.office_id, current_user)

    return StandardSuccessResponse(
        data=procurement,
        message="Procurement order retrieved successfully",
    )


@router.patch(
    "/{procurement_id}",
    response_model=StandardSuccessResponse[ProcurementOut],
    summary="Update procurement order",
)
def update_procurement(
    procurement_id: UUID,
    payload: ProcurementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("supplier:manage")),
):
    existing = ProcurementService.get_procurement(
        db=db,
        procurement_id=procurement_id,
    )
    _check_office_access(existing.office_id, current_user)

    procurement = ProcurementService.update_procurement(
        db=db,
        procurement_id=procurement_id,
        payload=payload,
        updater=current_user,
    )

    return StandardSuccessResponse(
        data=procurement,
        message="Procurement order updated successfully",
    )