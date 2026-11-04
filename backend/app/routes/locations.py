"""
Location routes for the Dead Stock Inventory Management System.
Prefix: /api/v1/locations (registered in main.py)
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission

from app.features.locations.schemas import (
    LocationCreate,
    LocationOut,
    LocationUpdate,
)
from app.features.locations.services import LocationService
from app.features.users.models import User


router = APIRouter()


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[LocationOut]],
    summary="List office locations",
    status_code=status.HTTP_200_OK,
)
def list_locations(
    office_id: Optional[UUID] = Query(
        None,
        description="Filter locations by office ID",
    ),
    location_type: Optional[str] = Query(
        None,
        description="Filter by location type",
    ),
    is_active: Optional[bool] = Query(
        None,
        description="Filter active or inactive locations",
    ),
    search: Optional[str] = Query(
        None,
        description="Search building, room number or description",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("master:locations_view")
    ),
):
    """Retrieve locations within the permitted office scope."""

    locations = LocationService.list_locations(
        db=db,
        office_id=office_id,
        location_type=location_type,
        is_active=is_active,
        search=search,
        current_user=current_user,
    )

    return StandardSuccessResponse(
        data=locations,
        message="Locations retrieved successfully",
    )


@router.post(
    "/",
    response_model=StandardSuccessResponse[LocationOut],
    summary="Create a new location",
    status_code=status.HTTP_201_CREATED,
)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("master:locations_manage")
    ),
):
    """Create a building, room, store or yard location."""

    location = LocationService.create_location(
        db=db,
        payload=payload,
        creator=current_user,
    )

    return StandardSuccessResponse(
        data=location,
        message="Location created successfully",
    )


@router.get(
    "/{location_id}",
    response_model=StandardSuccessResponse[LocationOut],
    summary="Get location details",
    status_code=status.HTTP_200_OK,
)
def get_location(
    location_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("master:locations_view")
    ),
):
    """Retrieve a single location."""

    location = LocationService.get_location(
        db=db,
        location_id=location_id,
        current_user=current_user,
    )

    return StandardSuccessResponse(
        data=location,
        message="Location retrieved successfully",
    )


@router.patch(
    "/{location_id}",
    response_model=StandardSuccessResponse[LocationOut],
    summary="Update a location",
    status_code=status.HTTP_200_OK,
)
def update_location(
    location_id: UUID,
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("master:locations_manage")
    ),
):
    """Partially update an existing location."""

    location = LocationService.update_location(
        db=db,
        location_id=location_id,
        payload=payload,
        updater=current_user,
    )

    return StandardSuccessResponse(
        data=location,
        message="Location updated successfully",
    )


@router.delete(
    "/{location_id}",
    response_model=StandardSuccessResponse[dict],
    summary="Deactivate a location",
    status_code=status.HTTP_200_OK,
)
def deactivate_location(
    location_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("master:locations_manage")
    ),
):
    """
    Soft-delete a location.

    A location containing active inventory cannot be deactivated.
    """

    LocationService.delete_location(
        db=db,
        location_id=location_id,
        actor=current_user,
    )

    return StandardSuccessResponse(
        data={
            "location_id": str(location_id),
            "is_active": False,
        },
        message="Location deactivated successfully",
    )