"""
Supplier routes for the Dead Stock Inventory Management System.
Prefix: /api/v1/suppliers
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse, ResponseMeta
from app.core.database import get_db
from app.core.dependencies import require_permission

from app.features.suppliers.schemas import (
    SupplierCreate,
    SupplierOut,
    SupplierUpdate,
)
from app.features.suppliers.services import SupplierService
from app.features.users.models import User


router = APIRouter()


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[SupplierOut]],
    summary="List suppliers",
    status_code=status.HTTP_200_OK,
)
def list_suppliers(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("supplier:view")
    ),
):
    suppliers, total = SupplierService.list_suppliers(
        db=db,
        search=search,
        is_active=is_active,
        page=page,
        limit=limit,
    )

    return StandardSuccessResponse(
        data=suppliers,
        message="Suppliers retrieved successfully",
        meta=ResponseMeta(
            page=page,
            limit=limit,
            total=total,
        ),
    )


@router.post(
    "/",
    response_model=StandardSuccessResponse[SupplierOut],
    summary="Create supplier",
    status_code=status.HTTP_201_CREATED,
)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("supplier:manage")
    ),
):
    supplier = SupplierService.create_supplier(
        db=db,
        payload=payload,
        creator=current_user,
    )

    return StandardSuccessResponse(
        data=supplier,
        message="Supplier created successfully",
    )


@router.get(
    "/{supplier_id}",
    response_model=StandardSuccessResponse[SupplierOut],
    summary="Get supplier details",
    status_code=status.HTTP_200_OK,
)
def get_supplier(
    supplier_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("supplier:view")
    ),
):
    supplier = SupplierService.get_supplier(
        db=db,
        supplier_id=supplier_id,
    )

    return StandardSuccessResponse(
        data=supplier,
        message="Supplier retrieved successfully",
    )


@router.patch(
    "/{supplier_id}",
    response_model=StandardSuccessResponse[SupplierOut],
    summary="Update supplier",
    status_code=status.HTTP_200_OK,
)
def update_supplier(
    supplier_id: UUID,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("supplier:manage")
    ),
):
    supplier = SupplierService.update_supplier(
        db=db,
        supplier_id=supplier_id,
        payload=payload,
        updater=current_user,
    )

    return StandardSuccessResponse(
        data=supplier,
        message="Supplier updated successfully",
    )