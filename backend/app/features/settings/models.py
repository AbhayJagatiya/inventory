"""System Settings Database Model

Stores configurable application parameters, thresholds, and role mappings.
"""

import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, JSON, String, Text, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=True, index=True)
    setting_category = Column(String(50), nullable=False, index=True)
    # CLASSIFICATION, NOTIFICATIONS, APPROVAL_WORKFLOW, OFFICE_CONFIG, SYSTEM_PREFERENCES
    setting_key = Column(String(100), nullable=False, index=True)
    setting_value = Column(JSON, nullable=False)
    data_type = Column(String(20), nullable=False, default="STRING")  # STRING, INTEGER, DECIMAL, BOOLEAN, JSON
    description = Column(Text, nullable=False)
    is_public = Column(Boolean, nullable=False, default=False)
    is_editable = Column(Boolean, nullable=False, default=True)
    updated_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    office = relationship("Office")
    updater = relationship("User")

