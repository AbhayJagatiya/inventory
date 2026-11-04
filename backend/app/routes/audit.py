"""Audit Trail API Routes"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.core.exceptions import OfficeAccessDeniedError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.schemas import AuditLogOut
from app.features.audit.services import AuditService
from app.features.users.models import User


router = APIRouter()


@router.get("/")
def list_audit_logs(
    user_id: Optional[UUID] = Query(None),
    office_id: Optional[UUID] = Query(None),
    module: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:view")),
):
    """Retrieve filtered audit logs with office-level access control."""

    if start_date and end_date and start_date > end_date:
        from app.core.exceptions import ValidationError
        raise ValidationError("start_date cannot be after end_date.")

    # Office-level isolation
    if current_user.role == ROLE_SYSTEM_ADMIN:
        effective_office_id = office_id
    else:
        if not current_user.office_id:
            raise OfficeAccessDeniedError(
                "User is not assigned to an office."
            )

        if office_id and office_id != current_user.office_id:
            raise OfficeAccessDeniedError(
                "You cannot access another office's audit logs."
            )

        effective_office_id = current_user.office_id

    logs, total = AuditService.list_logs(
        db=db,
        user_id=user_id,
        office_id=effective_office_id,
        module=module,
        action=action,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit,
    )

    return {
        "success": True,
        "message": "Audit logs retrieved successfully.",
        "data": [
            AuditLogOut.model_validate(log).model_dump(mode="json")
            for log in logs
        ],
        "meta": {
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit,
        },
    }