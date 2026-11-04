"""Physical Verification Database Models

Tracks audit sessions, baseline expected snapshots, live scan events, and reconciliation.
"""

import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class VerificationSession(Base):
    __tablename__ = "verification_sessions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_number = Column(String(50), unique=True, nullable=False, index=True)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    scope_type = Column(String(30), nullable=False)  # FULL_OFFICE, LOCATION, CATEGORY
    location_id = Column(Uuid, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=True, index=True)
    category_id = Column(Uuid, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=True, index=True)
    status = Column(String(30), nullable=False, default="PLANNED", index=True)
    # PLANNED, IN_PROGRESS, UNDER_REVIEW, COMPLETED, CANCELLED
    notes = Column(Text, nullable=True)
    lead_verifier_id = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("id", "office_id", name="uq_verif_sessions_id_office"),
    )

    office = relationship("Office")
    location = relationship("Location")
    category = relationship("Category")
    lead_verifier = relationship("User")
    items = relationship("VerificationItem", back_populates="session", cascade="all, delete-orphan")
    scan_events = relationship("VerificationScanEvent", back_populates="session", cascade="all, delete-orphan")


class VerificationItem(Base):
    __tablename__ = "verification_items"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id = Column(Uuid, ForeignKey("verification_sessions.id", ondelete="RESTRICT"), nullable=False, index=True)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    expected_location_id = Column(Uuid, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False)
    observed_location_id = Column(Uuid, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=True)
    expected_condition = Column(String(30), nullable=False)
    observed_condition = Column(String(30), nullable=True)
    expected_qty = Column(Numeric(12, 2), nullable=False)
    counted_qty = Column(Numeric(12, 2), nullable=False, default=0.00)
    discrepancy_type = Column(String(40), nullable=False, default="NONE", index=True)
    # NONE, NOT_FOUND, UNEXPECTED_ITEM, LOCATION_MISMATCH, QUANTITY_MISMATCH, CONDITION_MISMATCH, DUPLICATE_SUSPECTED
    resolution_status = Column(String(30), nullable=False, default="PENDING", index=True)  # PENDING, RESOLVED, IGNORED
    resolution_remarks = Column(Text, nullable=True)
    verified_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    session = relationship("VerificationSession", back_populates="items")
    office = relationship("Office")
    item = relationship("Item")
    expected_location = relationship("Location", foreign_keys=[expected_location_id])
    observed_location = relationship("Location", foreign_keys=[observed_location_id])
    verifier = relationship("User")


class VerificationScanEvent(Base):
    __tablename__ = "verification_scan_events"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id = Column(Uuid, ForeignKey("verification_sessions.id", ondelete="RESTRICT"), nullable=False, index=True)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    scanned_barcode = Column(String(100), nullable=False, index=True)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=True, index=True)
    scanned_location_id = Column(Uuid, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    observed_condition = Column(String(30), nullable=False)
    counted_quantity = Column(Numeric(12, 2), nullable=False, default=1.00)
    scan_result = Column(String(40), nullable=False)
    # MATCHED_VERIFIED, LOCATION_MISMATCH, CONDITION_MISMATCH, UNEXPECTED_ITEM, DUPLICATE_SCAN_REPEATED, UNKNOWN_BARCODE
    is_duplicate_scan = Column(Boolean, nullable=False, default=False)
    scanned_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    scanned_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    device_info = Column(String(255), nullable=True)
    remarks = Column(Text, nullable=True)

    session = relationship("VerificationSession", back_populates="scan_events")
    office = relationship("Office")
    item = relationship("Item")
    scanned_location = relationship("Location")
    scanner_user = relationship("User")

