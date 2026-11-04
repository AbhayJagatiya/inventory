"""
Inventory routes for the Dead Stock Inventory Management System.
Prefix: /api/v1/items (registered in main.py)
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse, ResponseMeta
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.inventory.models import Item
from app.features.inventory.schemas import ItemCreate, ItemHistoryEventOut, ItemOut, ItemUpdate
from app.features.inventory.services import InventoryService
from app.features.users.models import User

router = APIRouter()


@router.get("", include_in_schema=False)
@router.get(
    "/",
    response_model=StandardSuccessResponse[List[ItemOut]],
    summary="List inventory items",
    status_code=status.HTTP_200_OK,
)
def list_items(
    office_id: Optional[UUID] = Query(None, description="Filter by office ID"),
    item_type: Optional[str] = Query(None, description="Filter by item type"),
    category_id: Optional[UUID] = Query(None, description="Filter by category ID"),
    location_id: Optional[UUID] = Query(None, description="Filter by location ID"),
    condition: Optional[str] = Query(None, description="Filter by condition"),
    operational_status: Optional[str] = Query(None, description="Filter by operational status"),
    search: Optional[str] = Query(None, description="Full-text search term"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=200, description="Results per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_INVENTORY")),
):
    """Return a paginated list of inventory items scoped to the user's office."""
    items, total = InventoryService.list_items(
        db,
        office_id=office_id,
        item_type=item_type,
        category_id=category_id,
        location_id=location_id,
        condition=condition,
        operational_status=operational_status,
        search=search,
        current_user=current_user,
        page=page,
        limit=limit,
    )
    return StandardSuccessResponse(
        data=[ItemOut.model_validate(i) for i in items],
        message="Items retrieved successfully",
        meta=ResponseMeta(page=page, limit=limit, total=total),
    )


@router.post("", include_in_schema=False)
@router.post(
    "/",
    response_model=StandardSuccessResponse[ItemOut],
    summary="Create a new inventory item",
    status_code=status.HTTP_201_CREATED,
)
def create_item(
    payload: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_INVENTORY")),
):
    """Create a new inventory item in the system."""
    item = InventoryService.create_item(db, payload, creator=current_user)
    return StandardSuccessResponse(
        data=ItemOut.model_validate(item),
        message="Item created successfully",
    )


# NOTE: /export is declared BEFORE /{item_id} to prevent FastAPI from
# treating the literal path segment "export" as a UUID item_id.
@router.get(
    "/export",
    summary="Export inventory items as CSV",
    status_code=status.HTTP_200_OK,
)
def export_items(
    office_id: Optional[UUID] = Query(None, description="Office to export items for"),
    format: str = Query("csv", description="Export format (currently only csv)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("EXPORT_INVENTORY")),
):
    """Stream inventory items as a CSV file download."""
    csv_stream = InventoryService.export_items_csv(
        db,
        office_id=office_id,
        current_user=current_user,
    )
    return StreamingResponse(
        csv_stream,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=inventory_export.csv"
        },
    )


@router.post(
    "/bulk-import",
    response_model=StandardSuccessResponse,
    summary="Bulk import items from CSV",
    status_code=status.HTTP_200_OK,
)
def bulk_import_items(
    file: UploadFile = File(..., description="CSV file containing items to import"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_INVENTORY")),
):
    """Bulk import inventory items from a CSV upload."""
    result = InventoryService.bulk_import_items(
        db,
        file,
        office_id=current_user.office_id,
        created_by=current_user,
    )
    return StandardSuccessResponse(
        data={"imported": result["imported"], "errors": result.get("errors", [])},
        message=f"Bulk import complete. {result['imported']} item(s) imported.",
    )


@router.get(
    "/{item_id}",
    response_model=StandardSuccessResponse[ItemOut],
    summary="Get a single inventory item",
    status_code=status.HTTP_200_OK,
)
def get_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_INVENTORY")),
):
    """Retrieve a single inventory item by ID."""
    item = InventoryService.get_item(db, item_id)
    return StandardSuccessResponse(
        data=ItemOut.model_validate(item),
        message="Item retrieved successfully",
    )


@router.patch(
    "/{item_id}",
    response_model=StandardSuccessResponse[ItemOut],
    summary="Update an inventory item",
    status_code=status.HTTP_200_OK,
)
def update_item(
    item_id: UUID,
    payload: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_INVENTORY")),
):
    """Partially update an existing inventory item."""
    item = InventoryService.update_item(db, item_id, payload, updated_by=current_user)
    return StandardSuccessResponse(
        data=ItemOut.model_validate(item),
        message="Item updated successfully",
    )


@router.get(
    "/{item_id}/history",
    response_model=StandardSuccessResponse[List[ItemHistoryEventOut]],
    summary="Get item movement history",
    status_code=status.HTTP_200_OK,
)
def get_item_history(
    item_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=200, description="Results per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_INVENTORY")),
):
    """Return paginated movement/audit history for a specific item."""
    events, total = InventoryService.get_item_history(
        db,
        item_id,
        page=page,
        limit=limit,
        current_user=current_user,
    )
    return StandardSuccessResponse(
        data=events,
        message="Item history retrieved successfully",
        meta=ResponseMeta(page=page, limit=limit, total=total),
    )
