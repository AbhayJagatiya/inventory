"""Categories and Units of Measure Pydantic Schemas"""

from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    parent_id: Optional[UUID] = None
    slow_moving_threshold_days: int = Field(default=90, ge=1)
    inactivity_threshold_days: int = Field(default=180, ge=1)
    obsolescence_years: int = Field(default=5, ge=1)
    depreciation_rate_pct: float = Field(default=15.00, ge=0.0, le=100.0)


class CategoryCreate(CategoryBase):
    code: str = Field(..., min_length=2, max_length=30)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    slow_moving_threshold_days: Optional[int] = Field(None, ge=1)
    inactivity_threshold_days: Optional[int] = Field(None, ge=1)
    obsolescence_years: Optional[int] = Field(None, ge=1)
    depreciation_rate_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    is_active: Optional[bool] = None


class CategoryOut(CategoryBase):
    id: UUID
    code: str
    is_active: bool
    item_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class UnitOfMeasureCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=50)


class UnitOfMeasureOut(BaseModel):
    id: UUID
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)

