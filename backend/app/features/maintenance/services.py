"""Maintenance Service

Tracks asset repairs, technician work, cumulative service expenditure, and operational status.
"""

from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import NotFoundError, OfficeAccessDeniedError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.services import AuditService
from app.features.inventory.models import Item
from app.features.maintenance.models import MaintenanceRecord
from app.features.maintenance.schemas import MaintenanceComplete, MaintenanceCreate, MaintenanceUpdate
from app.features.users.models import User


class MaintenanceService:
    @staticmethod
    def get_maintenance(db: Session, maintenance_id: UUID) -> MaintenanceRecord:
        rec = db.query(MaintenanceRecord).filter(MaintenanceRecord.id == maintenance_id).first()
        if not rec:
            raise NotFoundError(f"Maintenance ticket '{maintenance_id}' was not found", code="MAINTENANCE_NOT_FOUND")
        return rec

    @staticmethod
    def list_maintenance(
        db: Session,
        office_id: Optional[UUID] = None,
        item_id: Optional[UUID] = None,
        status: Optional[str] = None,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[MaintenanceRecord], int]:
        query = db.query(MaintenanceRecord)

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(MaintenanceRecord.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(MaintenanceRecord.office_id == office_id)

        if item_id:
            query = query.filter(MaintenanceRecord.item_id == item_id)
        if status:
            query = query.filter(MaintenanceRecord.status == status.upper())

        total = query.count()
        records = query.order_by(MaintenanceRecord.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        return records, total

    @staticmethod
    def log_maintenance(db: Session, payload: MaintenanceCreate, reporter: User) -> MaintenanceRecord:
        if ROLE_SYSTEM_ADMIN not in reporter.role_names and payload.office_id != reporter.office_id:
            raise OfficeAccessDeniedError("Cannot log maintenance ticket outside assigned office")

        item = db.query(Item).filter(Item.id == payload.item_id).first()
        if not item:
            raise NotFoundError("Item not found", code="ITEM_NOT_FOUND")
        if item.office_id != payload.office_id:
            raise ValidationError("Item does not belong to the ticket office")

        if item.operational_status == "DISPOSED":
            raise ValidationError("Cannot log maintenance for an officially DISPOSED asset")

        record = MaintenanceRecord(
            item_id=payload.item_id,
            office_id=payload.office_id,
            issue_description=payload.issue_description.strip(),
            service_provider=payload.service_provider.strip(),
            reported_date=payload.reported_date,
            estimated_cost=payload.estimated_cost,
            actual_cost=0.00,
            status="REPORTED",
            reported_by=reporter.id,
        )
        db.add(record)

        # Transition asset operational status to UNDER_MAINTENANCE
        item.operational_status = "UNDER_MAINTENANCE"
        db.flush()

        AuditService.log_action(
            db=db,
            action="CREATE",
            module="MAINTENANCE",
            record_id=str(record.id),
            actor=reporter,
            office_id=record.office_id,
            new_values={"item_code": item.item_code, "issue": record.issue_description},
        )
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def update_maintenance(
        db: Session,
        maintenance_id: UUID,
        payload: MaintenanceUpdate,
        updater: Optional[User] = None,
    ) -> MaintenanceRecord:
        rec = MaintenanceService.get_maintenance(db, maintenance_id)
        update_dict = payload.model_dump(exclude_unset=True)

        for field, value in update_dict.items():
            setattr(rec, field, value)

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="MAINTENANCE",
            record_id=str(rec.id),
            actor=updater,
            office_id=rec.office_id,
            new_values=update_dict,
        )
        db.commit()
        db.refresh(rec)
        return rec

    @staticmethod
    def complete_maintenance(
        db: Session,
        maintenance_id: UUID,
        payload: MaintenanceComplete,
        completer: User,
    ) -> MaintenanceRecord:
        rec = MaintenanceService.get_maintenance(db, maintenance_id)
        if rec.status in ["COMPLETED", "CANCELLED"]:
            raise ValidationError(f"Maintenance ticket is already {rec.status}")

        rec.completion_date = payload.completion_date
        rec.actual_cost = payload.actual_cost
        rec.work_performed = payload.work_performed.strip()
        rec.invoice_reference = payload.invoice_reference
        rec.status = "COMPLETED"

        # Restore asset operational status based on resulting condition
        item = db.query(Item).filter(Item.id == rec.item_id).first()
        if item:
            item.condition = payload.resulting_condition
            if payload.resulting_condition == "SCRAP":
                item.operational_status = "DAMAGED"
            else:
                item.operational_status = "AVAILABLE_IN_STORE"
                item.current_custodian = None

        db.flush()
        AuditService.log_action(
            db=db,
            action="COMPLETE",
            module="MAINTENANCE",
            record_id=str(rec.id),
            actor=completer,
            office_id=rec.office_id,
            new_values={"status": "COMPLETED", "actual_cost": float(payload.actual_cost)},
        )
        db.commit()
        db.refresh(rec)
        return rec

