"""System Settings API Routes"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.core.exceptions import OfficeAccessDeniedError, NotFoundError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.settings.schemas import (
    BulkSettingsUpdate,
    SingleSettingUpdate,
)
from app.features.settings.services import SettingsService
from app.features.users.models import User


router = APIRouter()


def _resolve_office(
    requested_office_id: Optional[UUID],
    current_user: User,
) -> Optional[UUID]:
    """Restrict non-admin users to their assigned office."""

    if current_user.role == ROLE_SYSTEM_ADMIN:
        return requested_office_id

    if not current_user.office_id:
        raise OfficeAccessDeniedError("User is not assigned to an office.")

    if requested_office_id and requested_office_id != current_user.office_id:
        raise OfficeAccessDeniedError("You cannot access another office's settings.")

    return current_user.office_id


def _serialize_setting(setting):
    return {
        "id": str(setting.id),
        "office_id": str(setting.office_id) if setting.office_id else None,
        "setting_category": setting.setting_category,
        "setting_key": setting.setting_key,
        "setting_value": setting.setting_value,
        "data_type": setting.data_type,
        "description": setting.description,
        "is_public": setting.is_public,
        "is_editable": setting.is_editable,
        "updated_by": str(setting.updated_by) if setting.updated_by else None,
        "updated_at": setting.updated_at,
    }


@router.get("/")
def list_settings(
    office_id: Optional[UUID] = Query(None),
    category: Optional[str] = Query(None),
    public_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings:view")),
):
    resolved_office_id = _resolve_office(office_id, current_user)

    settings = SettingsService.get_all_settings(
        db=db,
        office_id=resolved_office_id,
        category=category,
        public_only=public_only,
    )

    return {
        "success": True,
        "message": "Settings retrieved successfully.",
        "data": settings,
    }


@router.get("/{setting_key}")
def get_single_setting(
    setting_key: str,
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings:view")),
):
    resolved_office_id = _resolve_office(office_id, current_user)

    value = SettingsService.get_setting(
        db=db,
        setting_key=setting_key,
        office_id=resolved_office_id,
    )

    if value is None:
        raise NotFoundError(f"Setting '{setting_key}' was not found.")

    return {
        "success": True,
        "message": "Setting retrieved successfully.",
        "data": {
            "setting_key": setting_key,
            "setting_value": value,
        },
    }


@router.put("/bulk")
def update_settings_bulk(
    payload: BulkSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings:manage")),
):
    if not payload.settings:
        raise ValidationError("At least one setting is required.")

    resolved_office_id = _resolve_office(payload.office_id, current_user)

    updated_settings = []

    try:
        for item in payload.settings:
            setting = SettingsService.set_setting(
                db=db,
                key=item.setting_key,
                value=item.setting_value,
                office_id=resolved_office_id,
                updater=current_user,
            )
            updated_settings.append(setting)

        db.commit()

    except Exception:
        db.rollback()
        raise

    return {
        "success": True,
        "message": "Settings updated successfully.",
        "data": [_serialize_setting(item) for item in updated_settings],
    }


@router.put("/{setting_key}")
def update_single_setting(
    setting_key: str,
    payload: SingleSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings:manage")),
):
    resolved_office_id = _resolve_office(payload.office_id, current_user)

    try:
        setting = SettingsService.set_setting(
            db=db,
            key=setting_key,
            value=payload.setting_value,
            office_id=resolved_office_id,
            updater=current_user,
        )

        db.commit()
        db.refresh(setting)

    except Exception:
        db.rollback()
        raise

    return {
        "success": True,
        "message": "Setting updated successfully.",
        "data": _serialize_setting(setting),
    }