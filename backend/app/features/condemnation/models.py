"""Condemnation Proposals, Item Lines and Approval Workflow Models

Governs the technical write-off evaluation, committee reviews, and sanction orders.
"""

import uuid
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class CondemnationRequest(Base):
    __tablename__ = "condemnation_requests"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    request_number = Column(String(50), unique=True, nullable=False, index=True)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    reason_code = Column(String(50), nullable=False)  # OBSOLETE, BEYOND_ECONOMIC_REPAIR, DAMAGED_BEYOND_RECOVERY, DESTROYED
    condition_summary = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="DRAFT", index=True)
    # DRAFT, SUBMITTED, UNDER_REVIEW, MORE_INFO_REQUIRED, APPROVED, REJECTED, CANCELLED, DISPOSED
    submitted_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("id", "office_id", name="uq_condemn_requests_id_office"),
    )

    office = relationship("Office")
    submitter = relationship("User")
    items = relationship("CondemnationRequestItem", back_populates="request", cascade="all, delete-orphan")
    approval_actions = relationship("ApprovalAction", back_populates="request", cascade="all, delete-orphan")
    disposal = relationship("Disposal", back_populates="request", uselist=False)


class CondemnationRequestItem(Base):
    __tablename__ = "condemnation_request_items"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    request_id = Column(Uuid, ForeignKey("condemnation_requests.id", ondelete="RESTRICT"), nullable=False, index=True)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_condition = Column(String(30), nullable=False)
    assessed_scrap_value = Column(Numeric(14, 2), nullable=False, default=0.00)
    inspector_remarks = Column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("assessed_scrap_value >= 0", name="chk_condemn_scrap_val_non_negative"),
    )

    request = relationship("CondemnationRequest", back_populates="items")
    office = relationship("Office")
    item = relationship("Item")


class ApprovalAction(Base):
    __tablename__ = "approval_actions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    request_id = Column(Uuid, ForeignKey("condemnation_requests.id", ondelete="RESTRICT"), nullable=False, index=True)
    action_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    role_snapshot = Column(String(50), nullable=False)
    action = Column(String(30), nullable=False)  # SUBMIT, REVIEW, REQUEST_INFO, APPROVE, REJECT
    order_number = Column(String(100), nullable=True)
    remarks = Column(Text, nullable=False)
    action_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    request = relationship("CondemnationRequest", back_populates="approval_actions")
    actor = relationship("User")

