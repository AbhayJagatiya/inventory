"""Disposal Execution and Derecognition Database Models

Tracks authorized auction, scrap sales, e-waste transfers, and realized revenue.
"""

import uuid
from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Numeric, String, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Disposal(Base):
    __tablename__ = "disposals"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    disposal_number = Column(String(50), unique=True, nullable=False, index=True)
    request_id = Column(Uuid, ForeignKey("condemnation_requests.id", ondelete="RESTRICT"), unique=True, nullable=False, index=True)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    disposal_method = Column(String(50), nullable=False)
    # PUBLIC_AUCTION, E_WASTE_RECYCLING, SCRAP_SALE, BUYBACK, DESTRUCTION_BURIAL, DONATION_TRANSFER
    disposal_date = Column(Date, nullable=False, index=True)
    total_sale_proceeds = Column(Numeric(14, 2), nullable=False, default=0.00)
    recipient_agency = Column(String(150), nullable=False)
    reference_order_number = Column(String(100), nullable=False)
    certificate_document_id = Column(Uuid, ForeignKey("asset_documents.id", ondelete="RESTRICT"), nullable=True)
    executed_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("total_sale_proceeds >= 0", name="chk_disposal_proceeds_non_negative"),
    )

    request = relationship("CondemnationRequest", back_populates="disposal")
    office = relationship("Office")
    executor = relationship("User")
    certificate_document = relationship("AssetDocument", foreign_keys=[certificate_document_id])
    items = relationship("DisposalItem", back_populates="disposal", cascade="all, delete-orphan")


class DisposalItem(Base):
    __tablename__ = "disposal_items"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    disposal_id = Column(Uuid, ForeignKey("disposals.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    disposed_qty = Column(Numeric(12, 2), nullable=False)
    realized_amount = Column(Numeric(14, 2), nullable=False, default=0.00)

    __table_args__ = (
        CheckConstraint("disposed_qty > 0", name="chk_disposal_item_qty_positive"),
        CheckConstraint("realized_amount >= 0", name="chk_disposal_item_amount_non_negative"),
    )

    disposal = relationship("Disposal", back_populates="items")
    item = relationship("Item")

