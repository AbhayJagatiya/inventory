"""System Settings Service

Implements configuration management with office override fallback hierarchy.
"""

from typing import Any, Dict, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import NotFoundError, ValidationError
from app.features.audit.services import AuditService
from app.features.settings.models import SystemSetting
from app.features.users.models import User

DEFAULT_SYSTEM_SETTINGS: List[Dict[str, Any]] = [
    {
        "setting_category": "CLASSIFICATION",
        "setting_key": "classification.slow_moving_threshold_days",
        "setting_value": 90,
        "data_type": "INTEGER",
        "description": "Days of inactivity before an item is flagged as SLOW_MOVING",
        "is_public": True,
    },
    {
        "setting_category": "CLASSIFICATION",
        "setting_key": "classification.inactivity_threshold_days",
        "setting_value": 180,
        "data_type": "INTEGER",
        "description": "Days of inactivity before an item is flagged as NON_MOVING",
        "is_public": True,
    },
    {
        "setting_category": "CLASSIFICATION",
        "setting_key": "classification.obsolescence_years",
        "setting_value": 5,
        "data_type": "INTEGER",
        "description": "Default useful lifespan in years before considering asset OBSOLETE",
        "is_public": True,
    },
    {
        "setting_category": "APPROVAL_WORKFLOW",
        "setting_key": "approval.condemnation_reviewer_role",
        "setting_value": "STORE_OFFICER",
        "data_type": "STRING",
        "description": "Role authorized to review and assess condemnation proposals",
        "is_public": False,
    },
    {
        "setting_category": "APPROVAL_WORKFLOW",
        "setting_key": "approval.condemnation_approver_role",
        "setting_value": "STORE_OFFICER",
        "data_type": "STRING",
        "description": "Role authorized to grant final approval for condemnation write-offs",
        "is_public": False,
    },
    {
        "setting_category": "APPROVAL_WORKFLOW",
        "setting_key": "approval.disposal_high_value_threshold",
        "setting_value": 100000.00,
        "data_type": "DECIMAL",
        "description": "Monetary threshold requiring additional committee sanction",
        "is_public": False,
    },
    {
        "setting_category": "NOTIFICATIONS",
        "setting_key": "notifications.lead_days_warranty",
        "setting_value": [30, 60, 90],
        "data_type": "JSON",
        "description": "Upcoming warranty expiry alert lead windows in days",
        "is_public": False,
    },
    {
        "setting_category": "OFFICE_CONFIG",
        "setting_key": "system.default_timezone",
        "setting_value": "Asia/Kolkata",
        "data_type": "STRING",
        "description": "Official timezone for operational timestamps and reports",
        "is_public": True,
    },
    {
        "setting_category": "OFFICE_CONFIG",
        "setting_key": "system.currency",
        "setting_value": "INR",
        "data_type": "STRING",
        "description": "Default currency code for asset valuation and proceeds",
        "is_public": True,
    },
]


class SettingsService:
    @staticmethod
    def get_setting(db: Session, setting_key: str, office_id: Optional[UUID] = None) -> Any:
        """Retrieves setting value using office override -> global fallback precedence."""
        query = db.query(SystemSetting).filter(SystemSetting.setting_key == setting_key)
        if office_id:
            query = query.filter((SystemSetting.office_id == office_id) | (SystemSetting.office_id.is_(None)))
            # Prioritize office override over global (NULLS LAST)
            setting = query.order_by(SystemSetting.office_id.desc().nullslast()).first()
        else:
            setting = query.filter(SystemSetting.office_id.is_(None)).first()

        if setting:
            return setting.setting_value

        # Fallback to in-code defaults if not yet seeded
        for default in DEFAULT_SYSTEM_SETTINGS:
            if default["setting_key"] == setting_key:
                return default["setting_value"]

        return None

    @staticmethod
    def get_all_settings(
        db: Session,
        office_id: Optional[UUID] = None,
        category: Optional[str] = None,
        public_only: bool = False,
    ) -> Dict[str, Any]:
        """Resolves all settings applying office overrides."""
        query = db.query(SystemSetting)
        if category:
            query = query.filter(SystemSetting.setting_category == category.upper())
        if public_only:
            query = query.filter(SystemSetting.is_public.is_(True))

        all_records = query.all()

        # Build dictionary with global fallback then office override
        resolved: Dict[str, Any] = {}

        # 1. First apply global settings
        for s in all_records:
            if s.office_id is None:
                resolved[s.setting_key] = s.setting_value

        # 2. Then overlay office overrides
        if office_id:
            for s in all_records:
                if s.office_id == office_id:
                    resolved[s.setting_key] = s.setting_value

        # 3. Overlay any unseeded defaults
        for default in DEFAULT_SYSTEM_SETTINGS:
            if (not category or default["setting_category"] == category.upper()) and (
                not public_only or default["is_public"]
            ):
                if default["setting_key"] not in resolved:
                    resolved[default["setting_key"]] = default["setting_value"]

        return resolved

    @staticmethod
    def set_setting(
        db: Session,
        key: str,
        value: Any,
        office_id: Optional[UUID] = None,
        updater: Optional[User] = None,
    ) -> SystemSetting:
        """Creates or updates a system setting parameter with audit trail."""
        query = db.query(SystemSetting).filter(SystemSetting.setting_key == key)
        if office_id:
            query = query.filter(SystemSetting.office_id == office_id)
        else:
            query = query.filter(SystemSetting.office_id.is_(None))

        setting = query.first()
        old_val = None
        if setting:
            if not setting.is_editable:
                raise ValidationError(f"Setting '{key}' is locked and not editable.")
            old_val = setting.setting_value
            setting.setting_value = value
            setting.updated_by = updater.id if updater else None
        else:
            # Determine category and meta from defaults
            cat = "SYSTEM_PREFERENCES"
            desc = f"Setting for {key}"
            dtype = "STRING"
            is_pub = False
            for d in DEFAULT_SYSTEM_SETTINGS:
                if d["setting_key"] == key:
                    cat = d["setting_category"]
                    desc = d["description"]
                    dtype = d["data_type"]
                    is_pub = d["is_public"]
                    break

            setting = SystemSetting(
                office_id=office_id,
                setting_category=cat,
                setting_key=key,
                setting_value=value,
                data_type=dtype,
                description=desc,
                is_public=is_pub,
                is_editable=True,
                updated_by=updater.id if updater else None,
            )
            db.add(setting)

        db.flush()

        AuditService.log_action(
            db=db,
            action="UPDATE" if old_val is not None else "CREATE",
            module="SETTINGS",
            record_id=str(setting.id),
            actor=updater,
            office_id=office_id,
            old_values={"setting_key": key, "value": old_val} if old_val is not None else None,
            new_values={"setting_key": key, "value": value},
        )
        return setting

    @staticmethod
    def seed_default_settings(db: Session) -> None:
        """Seeds initial system default settings if they do not exist."""
        for d in DEFAULT_SYSTEM_SETTINGS:
            exists = (
                db.query(SystemSetting)
                .filter(SystemSetting.setting_key == d["setting_key"], SystemSetting.office_id.is_(None))
                .first()
            )
            if not exists:
                db.add(
                    SystemSetting(
                        office_id=None,
                        setting_category=d["setting_category"],
                        setting_key=d["setting_key"],
                        setting_value=d["setting_value"],
                        data_type=d["data_type"],
                        description=d["description"],
                        is_public=d["is_public"],
                        is_editable=True,
                    )
                )
        db.commit()

