"""
Unit of Measure routes.
Prefix: /api/v1/units-of-measure
"""

from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission

from app.features.categories.schemas import (
    UnitOfMeasureCreate,
    UnitOfMeasureOut,
)
from app.features.categories.services import CategoryService
from app.features.users.models import User


router = APIRouter()


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[UnitOfMeasureOut]],
    summary="List units of measure",
    status_code=status.HTTP_200_OK,
)
def list_units_of_measure(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("inventory:view")
    ),
):
    units = CategoryService.list_uoms(db=db)

    return StandardSuccessResponse(
        data=units,
        message="Units of measure retrieved successfully",
    )


@router.post(
    "/",
    response_model=StandardSuccessResponse[UnitOfMeasureOut],
    summary="Create unit of measure",
    status_code=status.HTTP_201_CREATED,
)
def create_unit_of_measure(
    payload: UnitOfMeasureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("master:uom_manage")
    ),
):
    unit = CategoryService.create_uom(
        db=db,
        payload=payload,
        creator=current_user,
    )

    return StandardSuccessResponse(
        data=unit,
        message="Unit of measure created successfully",
    )