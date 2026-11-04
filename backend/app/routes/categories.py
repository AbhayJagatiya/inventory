"""
Category routes for the Dead Stock Inventory Management System.
Prefix: /api/v1/categories
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission

from app.features.categories.models import Category
from app.features.categories.schemas import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
)
from app.features.categories.services import CategoryService
from app.features.inventory.models import Item
from app.features.users.models import User


router = APIRouter()


@router.get("", include_in_schema=False)
@router.get(
    "/",
    response_model=StandardSuccessResponse[List[CategoryOut]],
    summary="List categories",
    status_code=status.HTTP_200_OK,
)
def list_categories(
    parent_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("master:categories_view")
    ),
):
    categories = CategoryService.list_categories(
        db=db,
        parent_id=parent_id,
        is_active=is_active,
        search=search,
    )

    return StandardSuccessResponse(
        data=[CategoryOut.model_validate(c) for c in categories],
        message="Categories retrieved successfully",
    )


@router.post("", include_in_schema=False)
@router.post(
    "/",
    response_model=StandardSuccessResponse[CategoryOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create category",
)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("master:categories_manage")
    ),
):
    category = CategoryService.create_category(
        db=db,
        payload=payload,
        creator=current_user,
    )

    return StandardSuccessResponse(
        data=CategoryOut.model_validate(category),
        message="Category created successfully",
    )


@router.get(
    "/{category_id}",
    response_model=StandardSuccessResponse[CategoryOut],
    summary="Get category details",
)
def get_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("master:categories_view")
    ),
):
    category = CategoryService.get_category(
        db=db,
        category_id=category_id,
    )

    category.item_count = (
        db.query(Item)
        .filter(
            Item.category_id == category.id,
            Item.operational_status != "DISPOSED",
        )
        .count()
    )

    return StandardSuccessResponse(
        data=CategoryOut.model_validate(category),
        message="Category retrieved successfully",
    )


@router.patch(
    "/{category_id}",
    response_model=StandardSuccessResponse[CategoryOut],
    summary="Update category",
)
def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("master:categories_manage")
    ),
):
    category = CategoryService.update_category(
        db=db,
        category_id=category_id,
        payload=payload,
        updater=current_user,
    )

    return StandardSuccessResponse(
        data=CategoryOut.model_validate(category),
        message="Category updated successfully",
    )


@router.delete(
    "/{category_id}",
    response_model=StandardSuccessResponse[dict],
    summary="Deactivate category",
)
def deactivate_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("master:categories_manage")
    ),
):
    CategoryService.delete_category(
        db=db,
        category_id=category_id,
        actor=current_user,
    )

    return StandardSuccessResponse(
        data={
            "category_id": str(category_id),
            "is_active": False,
        },
        message="Category deactivated successfully",
    )