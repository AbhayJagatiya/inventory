"""Physical Verification Pydantic Schemas"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class VerificationSessionCreate(BaseModel):
    office_id: UUID
    scope_type: str = Field(default="FULL_OFFICE", pattern="^(FULL_OFFICE|LOCATION|CATEGORY)$")
    location_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    notes: Optional[str] = None


class VerificationScanRequest(BaseModel):
    scanned_barcode: str = Field(..., min_length=1, max_length=100)
    scanned_location_id: UUID
    observed_condition: str = Field(..., pattern="^(NEW|GOOD|FAIR|POOR|DAMAGED|SCRAP)$")
    counted_quantity: float = Field(default=1.00, gt=0)
    device_info: Optional[str] = None
    remarks: Optional[str] = None


class VerificationScanResponse(BaseModel):
    scan_result: str
    is_duplicate_scan: bool
    matched_item_id: Optional[UUID] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    discrepancy_detected: Optional[str] = None
    message: str


class VerificationDiscrepancyResolution(BaseModel):
    verification_item_id: UUID
    resolution_status: str = Field(default="RESOLVED", pattern="^(RESOLVED|IGNORED)$")
    remarks: str = Field(..., min_length=3)


class VerificationReconcileRequest(BaseModel):
    resolutions: List[VerificationDiscrepancyResolution] = Field(..., min_length=1)


class VerificationCompleteRequest(BaseModel):
    summary_remarks: str = Field(..., min_length=5)


class VerificationItemOut(BaseModel):
    id: UUID
    session_id: UUID
    office_id: UUID
    item_id: UUID
    expected_location_id: UUID
    observed_location_id: Optional[UUID] = None
    expected_condition: str
    observed_condition: Optional[str] = None
    expected_qty: float
    counted_qty: float
    discrepancy_type: str
    resolution_status: str
    resolution_remarks: Optional[str] = None
    verified_by: Optional[UUID] = None
    verified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class VerificationScanEventOut(BaseModel):
    id: UUID
    session_id: UUID
    office_id: UUID
    scanned_barcode: str
    item_id: Optional[UUID] = None
    scanned_location_id: UUID
    observed_condition: str
    counted_quantity: float
    scan_result: str
    is_duplicate_scan: bool
    scanned_by: UUID
    scanned_at: datetime
    device_info: Optional[str] = None
    remarks: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VerificationSessionOut(BaseModel):
    id: UUID
    session_number: str
    office_id: UUID
    scope_type: str
    location_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    status: str
    notes: Optional[str] = None
    lead_verifier_id: UUID
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    total_expected_items: Optional[int] = 0
    total_scanned_items: Optional[int] = 0
    discrepancy_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

