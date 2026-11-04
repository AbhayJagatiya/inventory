
"""Maintenance and Repair API Routes."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import ResponseMeta, StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.core.exceptions import OfficeAccessDeniedError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.maintenance.schemas import (
    MaintenanceComplete,
    MaintenanceCreate,
    MaintenanceOut,
    MaintenanceUpdate,
)
from app.features.maintenance.services import MaintenanceService
from app.features.users.models import User

router = APIRouter()


def _check_office_access(record, current_user: User) -> None:
    """Prevent users from accessing maintenance records outside their office."""
    if (
        ROLE_SYSTEM_ADMIN not in current_user.role_names
        and record.office_id != current_user.office_id
    ):
        raise OfficeAccessDeniedError(
            "You cannot access maintenance records outside your assigned office"
        )


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[MaintenanceOut]],
    status_code=status.HTTP_200_OK,
    summary="List maintenance records",
)
def list_maintenance(
    office_id: Optional[UUID] = Query(None),
    item_id: Optional[UUID] = Query(None),
    record_status: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("maintenance:view")),
):
    records, total = MaintenanceService.list_maintenance(
        db=db,
        office_id=office_id,
        item_id=item_id,
        status=record_status,
        current_user=current_user,
        page=page,
        limit=limit,
    )

    return StandardSuccessResponse(
        data=records,
        message="Maintenance records retrieved successfully",
        meta=ResponseMeta(page=page, limit=limit, total=total),
    )


@router.post(
    "/",
    response_model=StandardSuccessResponse[MaintenanceOut],
    status_code=status.HTTP_201_CREATED,
    summary="Log maintenance request",
)
def create_maintenance(
    payload: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("maintenance:log")),
):
    record = MaintenanceService.log_maintenance(
        db=db,
        payload=payload,
        reporter=current_user,
    )

    return StandardSuccessResponse(
        data=record,
        message="Maintenance request created successfully",
    )


@router.get(
    "/{maintenance_id}",
    response_model=StandardSuccessResponse[MaintenanceOut],
    status_code=status.HTTP_200_OK,
    summary="Get maintenance record",
)
def get_maintenance(
    maintenance_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("maintenance:view")),
):
    record = MaintenanceService.get_maintenance(
        db=db,
        maintenance_id=maintenance_id,
    )
    _check_office_access(record, current_user)

    return StandardSuccessResponse(
        data=record,
        message="Maintenance record retrieved successfully",
    )


@router.patch(
    "/{maintenance_id}",
    response_model=StandardSuccessResponse[MaintenanceOut],
    status_code=status.HTTP_200_OK,
    summary="Update maintenance progress",
)
def update_maintenance(
    maintenance_id: UUID,
    payload: MaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("maintenance:update")),
):
    existing = MaintenanceService.get_maintenance(db, maintenance_id)
    _check_office_access(existing, current_user)

    record = MaintenanceService.update_maintenance(
        db=db,
        maintenance_id=maintenance_id,
        payload=payload,
        updater=current_user,
    )

    return StandardSuccessResponse(
        data=record,
        message="Maintenance record updated successfully",
    )


@router.post(
    "/{maintenance_id}/complete",
    response_model=StandardSuccessResponse[MaintenanceOut],
    status_code=status.HTTP_200_OK,
    summary="Complete maintenance work",
)
def complete_maintenance(
    maintenance_id: UUID,
    payload: MaintenanceComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("maintenance:update")),
):
    existing = MaintenanceService.get_maintenance(db, maintenance_id)
    _check_office_access(existing, current_user)

    record = MaintenanceService.complete_maintenance(
        db=db,
        maintenance_id=maintenance_id,
        payload=payload,
        completer=current_user,
    )

    return StandardSuccessResponse(
        data=record,
        message="Maintenance work completed successfully",
    )
