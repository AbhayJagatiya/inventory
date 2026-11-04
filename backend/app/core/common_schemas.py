"""Common Pydantic Schemas and API Envelope Models

Conforms strictly to the API envelope standard in docs/api-contract.md.
"""

from datetime import datetime, timezone
from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, ConfigDict, Field

DataT = TypeVar("DataT")


class ResponseMeta(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    request_id: Optional[str] = None
    page: Optional[int] = None
    limit: Optional[int] = None
    total: Optional[int] = None
    total_pages: Optional[int] = None

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


class StandardSuccessResponse(BaseModel, Generic[DataT]):
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    success: bool = True
    data: DataT
    message: str = "Operation completed successfully"
    meta: ResponseMeta = Field(default_factory=ResponseMeta)


class ErrorDetail(BaseModel):
    field: Optional[str] = None
    issue: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: List[ErrorDetail] = Field(default_factory=list)


class StandardErrorResponse(BaseModel):
    success: bool = False
    error: ErrorBody
    meta: ResponseMeta = Field(default_factory=ResponseMeta)


class PaginatedParams(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)
