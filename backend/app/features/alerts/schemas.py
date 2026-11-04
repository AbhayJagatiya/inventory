"""Alerts and Notifications Pydantic Schemas"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class AlertOut(BaseModel):
    id: UUID
    office_id: UUID
    item_id: Optional[UUID] = None
    alert_type: str
    priority: str
    title: str
    message: str
    status: str
    snoozed_until: Optional[datetime] = None
    resolved_by: Optional[UUID] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertResolveRequest(BaseModel):
    resolution_remarks: str = Field(..., min_length=3)


class AlertSnoozeRequest(BaseModel):
    snooze_days: int = Field(default=14, ge=1, le=90)


class NotificationOut(BaseModel):
    id: UUID
    recipient_user_id: UUID
    recipient_role_id: Optional[UUID] = None
    office_id: UUID
    alert_id: Optional[UUID] = None
    notification_type: str
    title: str
    message: str
    priority: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[UUID] = None
    action_url: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnreadCountOut(BaseModel):
    unread_count: int

