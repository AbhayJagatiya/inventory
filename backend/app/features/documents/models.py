"""Document Attachment Registry Database Model

Secures file attachments, prevents path traversal, and manages metadata.
"""

import uuid
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AssetDocument(Base):
    __tablename__ = "asset_documents"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=True, index=True)
    related_entity_type = Column(String(50), nullable=False, index=True)
    # ITEM, RECEIPT, MAINTENANCE, CONDEMNATION, DISPOSAL, SUPPLIER_RETURN
    related_entity_id = Column(Uuid, nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=False)
    document_category = Column(String(50), nullable=False)
    # INVOICE, WARRANTY_CARD, INSPECTION_PHOTO, DISPOSAL_CERTIFICATE, CHALLAN
    uploaded_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    item = relationship("Item", foreign_keys=[item_id])
    uploader = relationship("User")

