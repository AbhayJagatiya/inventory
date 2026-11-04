"""Users Pydantic Schemas"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.features.roles.schemas import RoleOut


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=120)
    designation: str = Field(..., min_length=2, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    office_id: UUID
    role_id: UUID


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    designation: Optional[str] = Field(None, min_length=2, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20)
    office_id: Optional[UUID] = None
    role_id: Optional[UUID] = None


class UserStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(ACTIVE|INACTIVE|LOCKED|PASSWORD_RESET_REQUIRED)$")
    reason: Optional[str] = None


class AdminResetPassword(BaseModel):
    temporary_password: str = Field(..., min_length=8)


class UserOut(UserBase):
    id: UUID
    office_id: UUID
    status: str
    roles: List[RoleOut] = []
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

