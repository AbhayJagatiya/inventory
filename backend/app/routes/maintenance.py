"""Maintenance and Repair API Routes."""

from datetime import date
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
    MaintenanceDetailOut,
    MaintenanceOut,
    MaintenanceSummaryOut,
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
    "/summary",
    response_model=StandardSuccessResponse[MaintenanceSummaryOut],
    status_code=status.HTTP_200_OK,
    summary="Get maintenance dashboard summary and charts",
)
def get_maintenance_summary(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("maintenance:view")),
):
    summary = MaintenanceService.get_summary(
        db=db,
        office_id=office_id,
        current_user=current_user,
    )
    return StandardSuccessResponse(
        data=summary,
        message="Maintenance summary retrieved successfully",
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
    category_id: Optional[UUID] = Query(None),
    service_provider: Optional[str] = Query(None),
    record_status: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("maintenance:view")),
):
    records, total = MaintenanceService.list_maintenance(
        db=db,
        office_id=office_id,
        item_id=item_id,
        category_id=category_id,
        service_provider=service_provider,
        status=record_status,
        search=search,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_dir=sort_dir,
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
    response_model=StandardSuccessResponse[MaintenanceDetailOut],
    status_code=status.HTTP_200_OK,
    summary="Get maintenance record details",
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
    detail = MaintenanceService.get_maintenance_detail(db=db, maintenance_id=maintenance_id)

    return StandardSuccessResponse(
        data=detail,
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
