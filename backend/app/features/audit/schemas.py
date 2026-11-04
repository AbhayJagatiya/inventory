"""Audit Pydantic Schemas"""

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[UUID] = None
    username: str
    role_name: str
    office_id: Optional[UUID] = None
    action: str
    module: str
    record_id: str
    ip_address: str
    user_agent: Optional[str] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    outcome: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

