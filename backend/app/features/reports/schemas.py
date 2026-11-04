"""Reports and Dashboard Pydantic Schemas"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ExportRequest(BaseModel):
    report_name: str
    office_id: Optional[UUID] = None
    format: str = Field(default="csv", pattern="^(csv|xlsx|pdf)$")
    filters: Dict[str, Any] = Field(default_factory=dict)


class AdminDashboardOut(BaseModel):
    total_registered_assets: int
    active_stock_value: float
    available_items_count: int
    dead_stock_candidates_count: int
    dead_stock_valuation: float
    pending_condemnation_count: int
    disposed_items_count: int
    total_disposal_proceeds: float
    recent_activity: List[Dict[str, Any]] = []
    office_distribution: List[Dict[str, Any]] = []
    calculated_at: datetime


class OfficerDashboardOut(BaseModel):
    office_id: UUID
    office_name: str
    total_office_items: int
    active_stock_value: float
    pending_condemnation_reviews: int
    active_verification_discrepancies: int
    maintenance_pending_count: int
    expiring_warranties_count: int
    active_alerts_count: int
    recent_transactions: List[Dict[str, Any]] = []
    calculated_at: datetime


class StaffDashboardOut(BaseModel):
    office_id: UUID
    available_stock_count: int
    my_recent_receipts_count: int
    my_recent_issues_count: int
    pending_returns_count: int
    recent_my_transactions: List[Dict[str, Any]] = []
    calculated_at: datetime


class AlertsSummaryOut(BaseModel):
    total_unresolved: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    by_type: Dict[str, int] = {}
    unread_notifications_count: int

