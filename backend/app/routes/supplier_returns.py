"""
Supplier Returns / RMA routes.
Prefix: /api/v1/supplier-returns
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
    SupplierReturnCreate,
    SupplierReturnDispatch,
    SupplierReturnOut,
    SupplierReturnResolve,
    SupplierReturnVendorResponse,
)
from app.features.procurement.services import ProcurementService
from app.features.users.models import User


router = APIRouter()


def _check_office_access(record_office_id: UUID, current_user: User) -> None:
    """Prevent users from accessing RMA records outside their office."""
    if (
        ROLE_SYSTEM_ADMIN not in current_user.role_names
        and record_office_id != current_user.office_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this office's supplier return record.",
        )


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[SupplierReturnOut]],
    summary="List supplier returns",
)
def list_supplier_returns(
    office_id: Optional[UUID] = Query(None),
    supplier_id: Optional[UUID] = Query(None),
    return_status: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("supplier:rma_view")),
):
    returns, total = ProcurementService.list_supplier_returns(
        db=db,
        office_id=office_id,
        supplier_id=supplier_id,
        status=return_status,
        current_user=current_user,
        page=page,
        limit=limit,
    )

    return StandardSuccessResponse(
        data=returns,
        message="Supplier returns retrieved successfully",
        meta=ResponseMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=(total + limit - 1) // limit,
        ),
    )


@router.post(
    "/",
    response_model=StandardSuccessResponse[SupplierReturnOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create supplier return",
)
def create_supplier_return(
    payload: SupplierReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("supplier:rma_manage")),
):
    supplier_return = ProcurementService.create_supplier_return(
        db=db,
        payload=payload,
        creator=current_user,
    )

    return StandardSuccessResponse(
        data=supplier_return,
        message="Supplier return initiated successfully",
    )


@router.get(
    "/{return_id}",
    response_model=StandardSuccessResponse[SupplierReturnOut],
    summary="Get supplier return details",
)
def get_supplier_return(
    return_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("supplier:rma_view")),
):
    supplier_return = ProcurementService.get_supplier_return(
        db=db,
        return_id=return_id,
    )
    _check_office_access(supplier_return.office_id, current_user)

    return StandardSuccessResponse(
        data=supplier_return,
        message="Supplier return retrieved successfully",
    )


@router.post(
    "/{return_id}/dispatch",
    response_model=StandardSuccessResponse[SupplierReturnOut],
    summary="Dispatch return to supplier",
)
def dispatch_supplier_return(
    return_id: UUID,
    payload: SupplierReturnDispatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("supplier:rma_manage")),
):
    existing = ProcurementService.get_supplier_return(db, return_id)
    _check_office_access(existing.office_id, current_user)

    supplier_return = ProcurementService.dispatch_supplier_return(
        db=db,
        return_id=return_id,
        payload=payload,
        actor=current_user,
    )

    return StandardSuccessResponse(
        data=supplier_return,
        message="Supplier return dispatched successfully",
    )


@router.post(
    "/{return_id}/vendor-response",
    response_model=StandardSuccessResponse[SupplierReturnOut],
    summary="Record supplier response",
)
def record_vendor_response(
    return_id: UUID,
    payload: SupplierReturnVendorResponse,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("supplier:rma_manage")),
):
    existing = ProcurementService.get_supplier_return(db, return_id)
    _check_office_access(existing.office_id, current_user)

    supplier_return = ProcurementService.record_vendor_response(
        db=db,
        return_id=return_id,
        payload=payload,
        actor=current_user,
    )

    return StandardSuccessResponse(
        data=supplier_return,
        message="Supplier response recorded successfully",
    )


@router.post(
    "/{return_id}/resolve",
    response_model=StandardSuccessResponse[SupplierReturnOut],
    summary="Resolve supplier return",
)
def resolve_supplier_return(
    return_id: UUID,
    payload: SupplierReturnResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("supplier:rma_manage")),
):
    existing = ProcurementService.get_supplier_return(db, return_id)
    _check_office_access(existing.office_id, current_user)

    supplier_return = ProcurementService.resolve_supplier_return(
        db=db,
        return_id=return_id,
        payload=payload,
        actor=current_user,
    )

    return StandardSuccessResponse(
        data=supplier_return,
        message="Supplier return resolved successfully",
    )