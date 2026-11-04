"""Audit Trail Database Model

Maintains an immutable, append-only security and operational audit trail.
"""

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, JSON, String, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True, index=True)
    username = Column(String(50), nullable=False)
    role_name = Column(String(50), nullable=False)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=True, index=True)
    action = Column(String(50), nullable=False, index=True)
    # CREATE, UPDATE, DELETE, LOGIN, LOGOUT, POST, APPROVE, REJECT, DISPOSE, OVERRIDE, EXPORT
    module = Column(String(50), nullable=False, index=True)
    record_id = Column(String(100), nullable=False, index=True)
    ip_address = Column(String(45), nullable=False, default="127.0.0.1")
    user_agent = Column(String(255), nullable=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    outcome = Column(String(20), nullable=False, default="SUCCESS")  # SUCCESS, FAILURE
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    user = relationship("User")
    office = relationship("Office")

