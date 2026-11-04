"""Audit Service

Provides append-only recording and filtering of security and operational activities.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.features.audit.models import AuditLog
from app.features.users.models import User


class AuditService:
    @staticmethod
    def log_action(
        db: Session,
        action: str,
        module: str,
        record_id: str,
        actor: Optional[User] = None,
        office_id: Optional[UUID] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        ip_address: str = "127.0.0.1",
        user_agent: Optional[str] = None,
        outcome: str = "SUCCESS",
    ) -> AuditLog:
        """Appends an immutable audit log entry."""
        user_id = actor.id if actor else None
        username = actor.username if actor else "SYSTEM"
        role_name = actor.role_names[0] if (actor and actor.role_names) else "SYSTEM"
        effective_office_id = office_id or (actor.office_id if actor else None)

        audit_entry = AuditLog(
            user_id=user_id,
            username=username,
            role_name=role_name,
            office_id=effective_office_id,
            action=action,
            module=module,
            record_id=str(record_id),
            ip_address=ip_address,
            user_agent=user_agent,
            old_values=old_values,
            new_values=new_values,
            outcome=outcome,
        )
        db.add(audit_entry)
        # Flush so the entry is part of current transaction
        db.flush()
        return audit_entry

    @staticmethod
    def list_logs(
        db: Session,
        user_id: Optional[UUID] = None,
        office_id: Optional[UUID] = None,
        module: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[AuditLog], int]:
        """Queries and filters audit log entries with pagination."""
        query = db.query(AuditLog)

        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if office_id:
            query = query.filter(AuditLog.office_id == office_id)
        if module:
            query = query.filter(AuditLog.module.ilike(f"%{module}%"))
        if action:
            query = query.filter(AuditLog.action == action.upper())
        if start_date:
            query = query.filter(AuditLog.timestamp >= start_date)
        if end_date:
            query = query.filter(AuditLog.timestamp <= end_date)

        total = query.count()
        logs = query.order_by(AuditLog.timestamp.desc()).offset((page - 1) * limit).limit(limit).all()
        return logs, total

