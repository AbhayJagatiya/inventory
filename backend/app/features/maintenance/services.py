"""Maintenance Service

Tracks asset repairs, technician work, cumulative service expenditure, and operational status.
"""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from app.core.exceptions import ConflictError, NotFoundError, OfficeAccessDeniedError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.models import AuditLog
from app.features.audit.services import AuditService
from app.features.categories.models import Category
from app.features.documents.models import AssetDocument
from app.features.inventory.models import Item
from app.features.maintenance.models import MaintenanceRecord
from app.features.maintenance.schemas import (
    MaintenanceComplete,
    MaintenanceCreate,
    MaintenanceDetailOut,
    MaintenanceOut,
    MaintenanceSummaryOut,
    MaintenanceUpdate,
)
from app.features.users.models import User


OPEN_MAINTENANCE_STATUSES = ("REPORTED", "UNDER_REVIEW", "APPROVED", "IN_REPAIR")

VALID_TRANSITIONS = {
    "REPORTED": {"UNDER_REVIEW", "APPROVED", "IN_REPAIR", "CANCELLED"},
    "UNDER_REVIEW": {"APPROVED", "IN_REPAIR", "CANCELLED"},
    "APPROVED": {"IN_REPAIR", "CANCELLED"},
    "IN_REPAIR": {"COMPLETED", "CANCELLED"},
    "COMPLETED": set(),
    "CANCELLED": set(),
}


def _ticket_ref(rec_id: UUID) -> str:
    return f"MNT-{str(rec_id).split('-')[0].upper()}"


class MaintenanceService:
    @staticmethod
    def _serialize(
        rec: MaintenanceRecord,
        cumulative_cost: Optional[float] = None,
    ) -> MaintenanceOut:
        return MaintenanceOut(
            id=rec.id,
            ticket_reference=_ticket_ref(rec.id),
            item_id=rec.item_id,
            item_code=rec.item.item_code if rec.item else None,
            item_name=rec.item.item_name if rec.item else None,
            category_id=rec.item.category_id if rec.item else None,
            category_name=rec.item.category.name if rec.item and rec.item.category else None,
            office_id=rec.office_id,
            office_name=rec.office.name if rec.office else None,
            issue_description=rec.issue_description,
            service_provider=rec.service_provider,
            reported_date=rec.reported_date,
            completion_date=rec.completion_date,
            estimated_cost=float(rec.estimated_cost or 0.0),
            actual_cost=float(rec.actual_cost or 0.0),
            status=rec.status,
            work_performed=rec.work_performed,
            invoice_reference=rec.invoice_reference,
            reported_by=rec.reported_by,
            reporter_name=rec.reporter.full_name if rec.reporter else None,
            cumulative_repair_cost=cumulative_cost,
            created_at=rec.created_at,
            updated_at=rec.updated_at,
        )

    @staticmethod
    def get_maintenance(db: Session, maintenance_id: UUID) -> MaintenanceRecord:
        rec = (
            db.query(MaintenanceRecord)
            .options(
                joinedload(MaintenanceRecord.item).joinedload(Item.category),
                joinedload(MaintenanceRecord.office),
                joinedload(MaintenanceRecord.reporter),
            )
            .filter(MaintenanceRecord.id == maintenance_id)
            .first()
        )
        if not rec:
            raise NotFoundError(
                f"Maintenance ticket '{maintenance_id}' was not found",
                code="MAINTENANCE_NOT_FOUND",
            )
        return rec

    @staticmethod
    def get_maintenance_detail(db: Session, maintenance_id: UUID) -> MaintenanceDetailOut:
        rec = MaintenanceService.get_maintenance(db, maintenance_id)

        cum_res = (
            db.query(func.sum(MaintenanceRecord.actual_cost))
            .filter(
                MaintenanceRecord.item_id == rec.item_id,
                MaintenanceRecord.status == "COMPLETED",
            )
            .scalar()
        )
        cumulative_cost = float(cum_res or 0.0)

        docs = (
            db.query(AssetDocument)
            .filter(
                AssetDocument.related_entity_type == "MAINTENANCE",
                AssetDocument.related_entity_id == rec.id,
            )
            .order_by(AssetDocument.uploaded_at.desc())
            .all()
        )
        docs_list = [
            {
                "id": str(d.id),
                "file_name": d.file_name,
                "document_category": d.document_category,
                "mime_type": d.mime_type,
                "file_size": d.file_size,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            }
            for d in docs
        ]

        history_recs = (
            db.query(MaintenanceRecord)
            .filter(
                MaintenanceRecord.item_id == rec.item_id,
                MaintenanceRecord.id != rec.id,
            )
            .order_by(MaintenanceRecord.reported_date.desc())
            .limit(20)
            .all()
        )
        history_list = [
            {
                "id": str(h.id),
                "ticket_reference": _ticket_ref(h.id),
                "reported_date": h.reported_date.isoformat() if h.reported_date else None,
                "completion_date": h.completion_date.isoformat() if h.completion_date else None,
                "service_provider": h.service_provider,
                "issue_description": h.issue_description,
                "actual_cost": float(h.actual_cost or 0.0),
                "status": h.status,
            }
            for h in history_recs
        ]

        audits = (
            db.query(AuditLog)
            .filter(
                AuditLog.module == "MAINTENANCE",
                AuditLog.record_id == str(rec.id),
            )
            .order_by(AuditLog.timestamp.desc())
            .limit(25)
            .all()
        )
        audit_list = [
            {
                "id": a.id,
                "action": a.action,
                "username": a.username,
                "role_name": a.role_name,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                "old_values": a.old_values,
                "new_values": a.new_values,
                "outcome": a.outcome,
            }
            for a in audits
        ]

        base = MaintenanceService._serialize(rec, cumulative_cost=cumulative_cost)
        return MaintenanceDetailOut(
            **base.model_dump(),
            item_operational_status=rec.item.operational_status if rec.item else None,
            item_condition=rec.item.condition if rec.item else None,
            item_purchase_cost=float(rec.item.total_cost or 0.0) if rec.item else None,
            documents=docs_list,
            item_history=history_list,
            audit_logs=audit_list,
        )

    @staticmethod
    def list_maintenance(
        db: Session,
        office_id: Optional[UUID] = None,
        item_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        service_provider: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[MaintenanceOut], int]:
        query = db.query(MaintenanceRecord).options(
            joinedload(MaintenanceRecord.item).joinedload(Item.category),
            joinedload(MaintenanceRecord.office),
            joinedload(MaintenanceRecord.reporter),
        )

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(MaintenanceRecord.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(MaintenanceRecord.office_id == office_id)

        if item_id:
            query = query.filter(MaintenanceRecord.item_id == item_id)
        if status:
            query = query.filter(MaintenanceRecord.status == status.upper())
        if service_provider:
            query = query.filter(MaintenanceRecord.service_provider.ilike(f"%{service_provider.strip()}%"))
        if date_from:
            query = query.filter(MaintenanceRecord.reported_date >= date_from)
        if date_to:
            query = query.filter(MaintenanceRecord.reported_date <= date_to)

        if category_id or (search and search.strip()):
            query = query.join(Item, MaintenanceRecord.item_id == Item.id)
            if category_id:
                query = query.filter(Item.category_id == category_id)
            if search and search.strip():
                term = f"%{search.strip()}%"
                clean_q = search.strip().upper().replace("MNT-", "")
                query = query.filter(
                    or_(
                        Item.item_code.ilike(term),
                        Item.item_name.ilike(term),
                        MaintenanceRecord.service_provider.ilike(term),
                        MaintenanceRecord.issue_description.ilike(term),
                        MaintenanceRecord.invoice_reference.ilike(term),
                        func.cast(MaintenanceRecord.id, Item.item_code.type).ilike(f"{clean_q}%"),
                    )
                )

        total = query.count()

        sort_map = {
            "reported_date": MaintenanceRecord.reported_date,
            "completion_date": MaintenanceRecord.completion_date,
            "estimated_cost": MaintenanceRecord.estimated_cost,
            "actual_cost": MaintenanceRecord.actual_cost,
            "status": MaintenanceRecord.status,
            "created_at": MaintenanceRecord.created_at,
        }
        sort_col = sort_map.get(sort_by, MaintenanceRecord.created_at)
        order_expr = sort_col.asc() if sort_dir.lower() == "asc" else sort_col.desc()

        records = (
            query.order_by(order_expr)
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return [MaintenanceService._serialize(r) for r in records], total

    @staticmethod
    def get_summary(
        db: Session,
        office_id: Optional[UUID] = None,
        current_user: Optional[User] = None,
    ) -> MaintenanceSummaryOut:
        query = db.query(MaintenanceRecord).options(
            joinedload(MaintenanceRecord.item).joinedload(Item.category)
        )
        item_query = db.query(Item).filter(Item.operational_status == "UNDER_MAINTENANCE")

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(MaintenanceRecord.office_id == current_user.office_id)
            item_query = item_query.filter(Item.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(MaintenanceRecord.office_id == office_id)
            item_query = item_query.filter(Item.office_id == office_id)

        records = query.all()
        today = datetime.now(timezone.utc).date()
        overdue_cutoff = today - timedelta(days=14)

        counts = defaultdict(int)
        total_actual = 0.0
        completed_with_cost = 0
        overdue_count = 0
        by_category_map: Dict[str, Dict[str, Any]] = {}
        monthly_map: Dict[str, Dict[str, Any]] = {}

        for r in records:
            counts[r.status] += 1
            if r.status in OPEN_MAINTENANCE_STATUSES and r.reported_date and r.reported_date <= overdue_cutoff:
                overdue_count += 1
            if r.status == "COMPLETED":
                cost = float(r.actual_cost or 0.0)
                total_actual += cost
                completed_with_cost += 1

            cat_name = r.item.category.name if r.item and r.item.category else "Uncategorized"
            if cat_name not in by_category_map:
                by_category_map[cat_name] = {"category": cat_name, "count": 0, "actual_cost": 0.0}
            by_category_map[cat_name]["count"] += 1
            if r.status == "COMPLETED":
                by_category_map[cat_name]["actual_cost"] += float(r.actual_cost or 0.0)

            if r.reported_date:
                month_key = r.reported_date.strftime("%Y-%m")
                if month_key not in monthly_map:
                    monthly_map[month_key] = {"month": month_key, "tickets": 0, "completed": 0, "cost": 0.0}
                monthly_map[month_key]["tickets"] += 1
                if r.status == "COMPLETED":
                    monthly_map[month_key]["completed"] += 1
                    monthly_map[month_key]["cost"] += float(r.actual_cost or 0.0)

        avg_cost = round(total_actual / completed_with_cost, 2) if completed_with_cost > 0 else 0.0
        assets_under_maint = item_query.count()

        statuses_order = ["REPORTED", "UNDER_REVIEW", "APPROVED", "IN_REPAIR", "COMPLETED", "CANCELLED"]
        by_status = [{"status": s, "count": counts[s]} for s in statuses_order]
        by_category = sorted(by_category_map.values(), key=lambda x: x["count"], reverse=True)
        monthly_sorted = sorted(monthly_map.values(), key=lambda x: x["month"])[-12:]

        return MaintenanceSummaryOut(
            total_tickets=len(records),
            reported_count=counts["REPORTED"],
            under_review_count=counts["UNDER_REVIEW"],
            approved_count=counts["APPROVED"],
            in_repair_count=counts["IN_REPAIR"],
            completed_count=counts["COMPLETED"],
            cancelled_count=counts["CANCELLED"],
            overdue_count=overdue_count,
            total_actual_cost=round(total_actual, 2),
            avg_repair_cost=avg_cost,
            assets_under_maintenance=assets_under_maint,
            by_status=by_status,
            by_category=by_category,
            monthly_activity=monthly_sorted,
            cost_over_time=monthly_sorted,
        )

    @staticmethod
    def log_maintenance(db: Session, payload: MaintenanceCreate, reporter: User) -> MaintenanceOut:
        item = db.query(Item).filter(Item.id == payload.item_id).first()
        if not item:
            raise NotFoundError("Item not found", code="ITEM_NOT_FOUND")

        target_office_id = payload.office_id or item.office_id

        if ROLE_SYSTEM_ADMIN not in reporter.role_names and target_office_id != reporter.office_id:
            raise OfficeAccessDeniedError("Cannot log maintenance ticket outside assigned office")

        if item.office_id != target_office_id:
            raise ValidationError("Item does not belong to the ticket office")

        if item.operational_status == "DISPOSED":
            raise ValidationError("Cannot log maintenance for an officially DISPOSED asset")

        existing_open = (
            db.query(MaintenanceRecord)
            .filter(
                MaintenanceRecord.item_id == payload.item_id,
                MaintenanceRecord.status.in_(OPEN_MAINTENANCE_STATUSES),
            )
            .first()
        )
        if existing_open:
            raise ConflictError(
                f"An open maintenance ticket ({_ticket_ref(existing_open.id)}) already exists for this asset",
                code="DUPLICATE_OPEN_MAINTENANCE",
            )

        issue_text = payload.issue_description.strip()
        if payload.remarks and payload.remarks.strip():
            issue_text = f"{issue_text}\nRemarks: {payload.remarks.strip()}"

        record = MaintenanceRecord(
            item_id=payload.item_id,
            office_id=target_office_id,
            issue_description=issue_text,
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
            new_values={
                "ticket_reference": _ticket_ref(record.id),
                "item_code": item.item_code,
                "issue": record.issue_description,
                "status": "REPORTED",
            },
        )
        db.commit()
        return MaintenanceService._serialize(MaintenanceService.get_maintenance(db, record.id))

    @staticmethod
    def update_maintenance(
        db: Session,
        maintenance_id: UUID,
        payload: MaintenanceUpdate,
        updater: Optional[User] = None,
    ) -> MaintenanceOut:
        rec = MaintenanceService.get_maintenance(db, maintenance_id)
        if rec.status in ("COMPLETED", "CANCELLED"):
            raise ValidationError(
                f"Cannot modify a maintenance ticket that is already {rec.status}",
                code="INVALID_MAINTENANCE_STATE",
            )

        update_dict = payload.model_dump(exclude_unset=True)
        old_values: Dict[str, Any] = {}

        if "status" in update_dict and update_dict["status"] != rec.status:
            new_status = update_dict["status"]
            allowed = VALID_TRANSITIONS.get(rec.status, set())
            if new_status not in allowed:
                raise ValidationError(
                    f"Invalid maintenance status transition from {rec.status} to {new_status}",
                    code="INVALID_STATUS_TRANSITION",
                )
            if new_status == "COMPLETED":
                raise ValidationError(
                    "Use the /complete endpoint to finalize maintenance with completion date, actual cost, and resulting condition",
                    code="USE_COMPLETE_ENDPOINT",
                )
            old_values["status"] = rec.status

        for field, value in update_dict.items():
            if field not in old_values:
                val = getattr(rec, field)
                old_values[field] = float(val) if hasattr(val, "as_tuple") else val
            setattr(rec, field, value)

        # If cancelled, restore item operational status if no other open tickets exist
        if rec.status == "CANCELLED" and rec.item and rec.item.operational_status == "UNDER_MAINTENANCE":
            other_open = (
                db.query(MaintenanceRecord)
                .filter(
                    MaintenanceRecord.item_id == rec.item_id,
                    MaintenanceRecord.id != rec.id,
                    MaintenanceRecord.status.in_(OPEN_MAINTENANCE_STATUSES),
                )
                .first()
            )
            if not other_open:
                rec.item.operational_status = "AVAILABLE_IN_STORE"

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="MAINTENANCE",
            record_id=str(rec.id),
            actor=updater,
            office_id=rec.office_id,
            old_values=old_values,
            new_values=update_dict,
        )
        db.commit()
        return MaintenanceService._serialize(MaintenanceService.get_maintenance(db, rec.id))

    @staticmethod
    def complete_maintenance(
        db: Session,
        maintenance_id: UUID,
        payload: MaintenanceComplete,
        completer: User,
    ) -> MaintenanceOut:
        rec = MaintenanceService.get_maintenance(db, maintenance_id)
        if rec.status in ("COMPLETED", "CANCELLED"):
            raise ValidationError(f"Maintenance ticket is already {rec.status}")

        if payload.completion_date < rec.reported_date:
            raise ValidationError(
                "Completion date cannot be earlier than reported date",
                code="INVALID_DATE_RANGE",
            )

        work_text = payload.work_performed.strip()
        if payload.completion_remarks and payload.completion_remarks.strip():
            work_text = f"{work_text}\nCompletion Remarks: {payload.completion_remarks.strip()}"

        old_status = rec.status
        rec.completion_date = payload.completion_date
        rec.actual_cost = payload.actual_cost
        rec.work_performed = work_text
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
            old_values={"status": old_status},
            new_values={
                "status": "COMPLETED",
                "actual_cost": float(payload.actual_cost),
                "resulting_condition": payload.resulting_condition,
            },
        )
        db.commit()
        return MaintenanceService._serialize(MaintenanceService.get_maintenance(db, rec.id))
