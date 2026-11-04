"""Alerts and In-App Notifications Database Models

Handles condition-based system alerts and user-targeted notifications.
"""

import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(Uuid, ForeignKey("items.id", ondelete="RESTRICT"), nullable=True, index=True)
    alert_type = Column(String(50), nullable=False, index=True)
    # NON_MOVING_INACTIVITY, WARRANTY_EXPIRING, MAINTENANCE_DUE, LOW_STOCK
    priority = Column(String(20), nullable=False, default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="ACTIVE", index=True)  # ACTIVE, ACKNOWLEDGED, SNOOZED, RESOLVED
    snoozed_until = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    office = relationship("Office")
    item = relationship("Item")
    resolver = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    recipient_user_id = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    recipient_role_id = Column(Uuid, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=True, index=True)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    alert_id = Column(Uuid, ForeignKey("alerts.id", ondelete="RESTRICT"), nullable=True, index=True)
    notification_type = Column(String(50), nullable=False, index=True)
    # SYSTEM_ALERT, APPROVAL_PENDING, TRANSFER_REQUEST, VERIFICATION_ASSIGNED, MAINTENANCE_UPDATE, STOCK_LOW
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String(20), nullable=False, default="MEDIUM")
    related_entity_type = Column(String(50), nullable=True, index=True)
    related_entity_id = Column(Uuid, nullable=True, index=True)
    action_url = Column(String(255), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    recipient = relationship("User", foreign_keys=[recipient_user_id])
    role = relationship("Role", foreign_keys=[recipient_role_id])
    office = relationship("Office")
    alert = relationship("Alert")

