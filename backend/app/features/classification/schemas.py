"""Classification and Dead Stock Pydantic Schemas"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.features.inventory.schemas import ItemOut


class ClassificationSummaryOut(BaseModel):
    office_id: Optional[UUID] = None
    total_evaluated: int
    active_count: int
    slow_moving_count: int
    non_moving_count: int
    obsolete_count: int
    overridden_count: int
    calculated_at: datetime


class ClassificationRunRequest(BaseModel):
    office_id: UUID
    category_id: Optional[UUID] = None


class ClassificationRunResultOut(BaseModel):
    office_id: UUID
    evaluated_count: int
    updated_count: int
    overridden_preserved_count: int
    completed_at: datetime


class ClassificationOverrideRequest(BaseModel):
    new_classification: str = Field(..., pattern="^(ACTIVE|SLOW_MOVING|NON_MOVING|OBSOLETE)$")
    override_reason: str = Field(..., min_length=5)


class ClassificationReleaseOverrideRequest(BaseModel):
    release_reason: str = Field(..., min_length=3)


class ClassificationOut(BaseModel):
    id: UUID
    item_id: UUID
    office_id: UUID
    calculated_classification: str
    effective_classification: str
    rule_version: str
    days_inactive: int
    item_age_days: int
    contributing_factors: Dict[str, Any]
    is_overridden: bool
    override_reason: Optional[str] = None
    overridden_by: Optional[UUID] = None
    overridden_at: Optional[datetime] = None
    calculated_at: datetime
    item: Optional[ItemOut] = None

    model_config = ConfigDict(from_attributes=True)


class DeadStockCandidateOut(BaseModel):
    item: ItemOut
    classification: ClassificationOut
    days_inactive: int
    item_age_days: int
    recorded_cost: float

