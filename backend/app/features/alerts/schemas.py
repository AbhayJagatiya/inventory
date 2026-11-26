"""Alerts and Notifications Pydantic Schemas"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class AlertOut(BaseModel):
    id: UUID
    alert_reference: Optional[str] = None
    office_id: UUID
    office_name: Optional[str] = None
    item_id: Optional[UUID] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    alert_type: str
    priority: str
    title: str
    message: str
    status: str
    snoozed_until: Optional[datetime] = None
    resolved_by: Optional[UUID] = None
    resolver_name: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertSummaryOut(BaseModel):
    total_active: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    unacknowledged_count: int
    acknowledged_count: int
    snoozed_count: int
    resolved_count: int
    by_type: Dict[str, int] = {}
    recent_alerts: List[AlertOut] = []


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
