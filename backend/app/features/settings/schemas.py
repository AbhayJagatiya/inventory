"""System Settings Pydantic Schemas"""

from typing import Any, List, Optional
from uuid import UUID
from pydantic import BaseModel


class SettingItemUpdate(BaseModel):
    setting_key: str
    setting_value: Any


class BulkSettingsUpdate(BaseModel):
    office_id: Optional[UUID] = None
    settings: List[SettingItemUpdate]


class SingleSettingUpdate(BaseModel):
    office_id: Optional[UUID] = None
    setting_value: Any

