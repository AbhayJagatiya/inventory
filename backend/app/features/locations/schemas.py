"""Locations Pydantic Schemas"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class LocationBase(BaseModel):
    building_name: str = Field(..., min_length=2, max_length=100)
    floor: str = Field(..., min_length=1, max_length=50)
    room_number: str = Field(..., min_length=1, max_length=50)
    location_type: str = Field(default="STORE_ROOM", max_length=50)  # STORE_ROOM, OFFICE_ROOM, RECORD_ROOM, OPEN_YARD
    description: Optional[str] = None


class LocationCreate(LocationBase):
    office_id: Optional[UUID] = None


class LocationUpdate(BaseModel):
    building_name: Optional[str] = Field(None, min_length=2, max_length=100)
    floor: Optional[str] = Field(None, min_length=1, max_length=50)
    room_number: Optional[str] = Field(None, min_length=1, max_length=50)
    location_type: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class LocationOut(LocationBase):
    id: UUID
    office_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    active_items_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)
