"""Roles and Permissions Pydantic Schemas"""

from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class PermissionOut(BaseModel):
    id: UUID
    code: str
    module: str
    action: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RoleBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    display_name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None


class RoleCreate(RoleBase):
    permission_ids: Optional[List[UUID]] = []


class RoleOut(RoleBase):
    id: UUID
    is_system_role: bool
    permissions: List[PermissionOut] = []

    model_config = ConfigDict(from_attributes=True)


class RoleConfigurePermissions(BaseModel):
    permission_ids: List[UUID]

