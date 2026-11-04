
"""Alerts and In-App Notifications API Routes."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import ResponseMeta, StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.core.exceptions import OfficeAccessDeniedError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.alerts.schemas import (
    AlertOut,
    AlertResolveRequest,
    AlertSnoozeRequest,
    NotificationOut,
    UnreadCountOut,
)
from app.features.alerts.services import AlertService
from app.features.users.models import User

router = APIRouter()


def _check_alert_access(alert, current_user: User) -> None:
    if (
        ROLE_SYSTEM_ADMIN not in current_user.role_names
        and alert.office_id != current_user.office_id
    ):
        raise OfficeAccessDeniedError(
            "You cannot access alerts outside your assigned office"
        )


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[AlertOut]],
    summary="List alerts",
)
def list_alerts(
    office_id: Optional[UUID] = Query(None),
    alert_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    record_status: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("alerts:view")),
):
    if ROLE_SYSTEM_ADMIN not in current_user.role_names:
        if office_id and office_id != current_user.office_id:
            raise OfficeAccessDeniedError("Access to another office is denied")
        office_id = current_user.office_id

    alerts, total = AlertService.list_alerts(
        db=db,
        office_id=office_id,
        alert_type=alert_type,
        priority=priority,
        status=record_status,
        page=page,
        limit=limit,
    )

    return StandardSuccessResponse(
        data=alerts,
        message="Alerts retrieved successfully",
        meta=ResponseMeta(page=page, limit=limit, total=total),
    )


@router.get(
    "/{alert_id}",
    response_model=StandardSuccessResponse[AlertOut],
    summary="Get alert details",
)
def get_alert(
    alert_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("alerts:view")),
):
    alert = AlertService.get_alert(db, alert_id)
    _check_alert_access(alert, current_user)

    return StandardSuccessResponse(
        data=alert,
        message="Alert retrieved successfully",
    )


@router.post(
    "/run-check",
    response_model=StandardSuccessResponse[int],
    summary="Run alert evaluation",
)
def run_alert_check(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings:manage")),
):
    if ROLE_SYSTEM_ADMIN not in current_user.role_names:
        if office_id and office_id != current_user.office_id:
            raise OfficeAccessDeniedError("Access to another office is denied")
        office_id = current_user.office_id

    count = AlertService.run_alert_evaluation_job(
        db=db,
        office_id=office_id,
    )

    return StandardSuccessResponse(
        data=count,
        message=f"Alert evaluation completed. Service reported {count} generated alerts.",
    )


@router.post(
    "/{alert_id}/acknowledge",
    response_model=StandardSuccessResponse[AlertOut],
    summary="Acknowledge alert",
)
def acknowledge_alert(
    alert_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("alerts:resolve")),
):
    alert = AlertService.get_alert(db, alert_id)
    _check_alert_access(alert, current_user)

    updated = AlertService.acknowledge_alert(
        db=db,
        alert_id=alert_id,
        user=current_user,
    )

    return StandardSuccessResponse(
        data=updated,
        message="Alert acknowledged successfully",
    )


@router.post(
    "/{alert_id}/resolve",
    response_model=StandardSuccessResponse[AlertOut],
    summary="Resolve alert",
)
def resolve_alert(
    alert_id: UUID,
    payload: AlertResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("alerts:resolve")),
):
    alert = AlertService.get_alert(db, alert_id)
    _check_alert_access(alert, current_user)

    updated = AlertService.resolve_alert(
        db=db,
        alert_id=alert_id,
        remarks=payload.resolution_remarks,
        user=current_user,
    )

    return StandardSuccessResponse(
        data=updated,
        message="Alert resolved successfully",
    )


@router.post(
    "/{alert_id}/snooze",
    response_model=StandardSuccessResponse[AlertOut],
    summary="Snooze alert",
)
def snooze_alert(
    alert_id: UUID,
    payload: AlertSnoozeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("alerts:resolve")),
):
    alert = AlertService.get_alert(db, alert_id)
    _check_alert_access(alert, current_user)

    updated = AlertService.snooze_alert(
        db=db,
        alert_id=alert_id,
        snooze_days=payload.snooze_days,
        user=current_user,
    )

    return StandardSuccessResponse(
        data=updated,
        message="Alert snoozed successfully",
    )


# -------------------- In-App Notifications --------------------


@router.get(
    "/notifications",
    response_model=StandardSuccessResponse[List[NotificationOut]],
    summary="List current user's notifications",
)
def list_notifications(
    is_read: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("alerts:view")),
):
    notifications, total = AlertService.list_user_notifications(
        db=db,
        user=current_user,
        is_read=is_read,
        page=page,
        limit=limit,
    )

    return StandardSuccessResponse(
        data=notifications,
        message="Notifications retrieved successfully",
        meta=ResponseMeta(page=page, limit=limit, total=total),
    )


@router.get(
    "/notifications/unread-count",
    response_model=StandardSuccessResponse[UnreadCountOut],
    summary="Get unread notification count",
)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("alerts:view")),
):
    count = AlertService.get_unread_count(db=db, user=current_user)

    return StandardSuccessResponse(
        data=UnreadCountOut(unread_count=count),
        message="Unread notification count retrieved successfully",
    )


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=StandardSuccessResponse[NotificationOut],
    summary="Mark notification as read",
)
def mark_notification_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("alerts:view")),
):
    notification = AlertService.mark_notification_read(
        db=db,
        notification_id=notification_id,
        user=current_user,
    )

    return StandardSuccessResponse(
        data=notification,
        message="Notification marked as read",
    )


@router.post(
    "/notifications/mark-all-read",
    response_model=StandardSuccessResponse[int],
    summary="Mark all notifications as read",
)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("alerts:view")),
):
    count = AlertService.mark_all_notifications_read(
        db=db,
        user=current_user,
    )

    return StandardSuccessResponse(
        data=count,
        message=f"{count} notifications marked as read",
    )
