"""Document Management Pydantic Schemas"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class DocumentOut(BaseModel):
    id: UUID
    item_id: Optional[UUID] = None
    related_entity_type: str
    related_entity_id: UUID
    file_name: str
    file_size: int
    mime_type: str
    document_category: str
    uploaded_by: UUID
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)

