"""Warranties Service

Manages warranty records, backend-calculated status, and upcoming expiry detection.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from uuid import UUID
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from app.core.exceptions import ConflictError, NotFoundError, OfficeAccessDeniedError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.services import AuditService
from app.features.inventory.models import Item
from app.features.maintenance.models import MaintenanceRecord
from app.features.procurement.models import SupplierReturn
from app.features.users.models import User
from app.features.warranties.models import Warranty
from app.features.warranties.schemas import (
    WarrantyCreate,
    WarrantyOut,
    WarrantySummaryOut,
    WarrantyUpdate,
)


class WarrantyService:
    @staticmethod
    def _compute_status(end_date: date, today: Optional[date] = None) -> Tuple[str, int]:
        ref = today or datetime.now(timezone.utc).date()
        remaining = (end_date - ref).days
        if remaining < 0:
            return "EXPIRED", remaining
        if remaining <= 30:
            return "EXPIRING_SOON", remaining
        return "ACTIVE", remaining

    @staticmethod
    def _serialize(
        db: Session,
        w: Warranty,
        maint_counts: Optional[Dict[UUID, int]] = None,
        rma_counts: Optional[Dict[UUID, int]] = None,
    ) -> WarrantyOut:
        status_val, remaining = WarrantyService._compute_status(w.end_date)
        m_count = (
            maint_counts.get(w.item_id, 0)
            if maint_counts is not None
            else db.query(MaintenanceRecord).filter(MaintenanceRecord.item_id == w.item_id).count()
        )
        r_count = (
            rma_counts.get(w.item_id, 0)
            if rma_counts is not None
            else db.query(SupplierReturn).filter(SupplierReturn.item_id == w.item_id).count()
        )

        return WarrantyOut(
            id=w.id,
            item_id=w.item_id,
            item_code=w.item.item_code if w.item else None,
            item_name=w.item.item_name if w.item else None,
            office_id=w.item.office_id if w.item else None,
            office_name=w.item.office.name if w.item and w.item.office else None,
            supplier_id=w.supplier_id,
            supplier_name=w.supplier.name if w.supplier else None,
            provider_name=w.provider_name,
            start_date=w.start_date,
            end_date=w.end_date,
            coverage_details=w.coverage_details,
            support_contact=w.support_contact,
            document_id=w.document_id,
            status=status_val,
            remaining_days=remaining,
            maintenance_count=m_count,
            rma_count=r_count,
            created_at=w.created_at,
        )

    @staticmethod
    def get_warranty_model(db: Session, warranty_id: UUID) -> Warranty:
        war = (
            db.query(Warranty)
            .options(
                joinedload(Warranty.item).joinedload(Item.office),
                joinedload(Warranty.supplier),
            )
            .filter(Warranty.id == warranty_id)
            .first()
        )
        if not war:
            raise NotFoundError(f"Warranty '{warranty_id}' not found", code="WARRANTY_NOT_FOUND")
        return war

    @staticmethod
    def get_warranty(db: Session, warranty_id: UUID, current_user: Optional[User] = None) -> WarrantyOut:
        war = WarrantyService.get_warranty_model(db, warranty_id)
        if (
            current_user
            and ROLE_SYSTEM_ADMIN not in current_user.role_names
            and war.item
            and war.item.office_id != current_user.office_id
        ):
            raise OfficeAccessDeniedError("You cannot access warranties outside your assigned office")
        return WarrantyService._serialize(db, war)

    @staticmethod
    def _batch_related_counts(db: Session, item_ids: List[UUID]) -> Tuple[Dict[UUID, int], Dict[UUID, int]]:
        if not item_ids:
            return {}, {}
        maint_rows = (
            db.query(MaintenanceRecord.item_id, func.count(MaintenanceRecord.id))
            .filter(MaintenanceRecord.item_id.in_(item_ids))
            .group_by(MaintenanceRecord.item_id)
            .all()
        )
        rma_rows = (
            db.query(SupplierReturn.item_id, func.count(SupplierReturn.id))
            .filter(SupplierReturn.item_id.in_(item_ids))
            .group_by(SupplierReturn.item_id)
            .all()
        )
        return dict(maint_rows), dict(rma_rows)

    @staticmethod
    def list_warranties(
        db: Session,
        office_id: Optional[UUID] = None,
        item_id: Optional[UUID] = None,
        supplier_id: Optional[UUID] = None,
        is_active: Optional[bool] = None,
        status: Optional[str] = None,
        expiring_within_days: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        search: Optional[str] = None,
        sort_by: str = "end_date",
        sort_dir: str = "asc",
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[WarrantyOut], int]:
        query = (
            db.query(Warranty)
            .join(Item, Warranty.item_id == Item.id)
            .options(
                joinedload(Warranty.item).joinedload(Item.office),
                joinedload(Warranty.supplier),
            )
        )
        today = datetime.now(timezone.utc).date()

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(Item.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(Item.office_id == office_id)

        if item_id:
            query = query.filter(Warranty.item_id == item_id)
        if supplier_id:
            query = query.filter(Warranty.supplier_id == supplier_id)

        if status:
            st = status.upper()
            if st == "ACTIVE":
                query = query.filter(Warranty.end_date >= today)
            elif st in ("EXPIRING", "EXPIRING_SOON"):
                cutoff = today + timedelta(days=expiring_within_days or 30)
                query = query.filter(Warranty.end_date >= today, Warranty.end_date <= cutoff)
            elif st == "EXPIRED":
                query = query.filter(Warranty.end_date < today)

        if is_active is True:
            query = query.filter(Warranty.end_date >= today)
        elif is_active is False:
            query = query.filter(Warranty.end_date < today)

        if expiring_within_days is not None and (not status or status.upper() not in ("EXPIRING", "EXPIRING_SOON")):
            cutoff = today + timedelta(days=expiring_within_days)
            query = query.filter(Warranty.end_date >= today, Warranty.end_date <= cutoff)

        if date_from:
            query = query.filter(Warranty.end_date >= date_from)
        if date_to:
            query = query.filter(Warranty.end_date <= date_to)

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Item.item_code.ilike(term),
                    Item.item_name.ilike(term),
                    Warranty.provider_name.ilike(term),
                    Warranty.support_contact.ilike(term),
                )
            )

        total = query.count()

        sort_map = {
            "end_date": Warranty.end_date,
            "start_date": Warranty.start_date,
            "provider_name": Warranty.provider_name,
            "created_at": Warranty.created_at,
        }
        sort_col = sort_map.get(sort_by, Warranty.end_date)
        order_expr = sort_col.desc() if sort_dir.lower() == "desc" else sort_col.asc()

        warranties = (
            query.order_by(order_expr)
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        item_ids = [w.item_id for w in warranties]
        maint_counts, rma_counts = WarrantyService._batch_related_counts(db, item_ids)
        return [
            WarrantyService._serialize(db, w, maint_counts=maint_counts, rma_counts=rma_counts)
            for w in warranties
        ], total

    @staticmethod
    def get_expiring_warranties(
        db: Session,
        lead_days: int = 60,
        office_id: Optional[UUID] = None,
        current_user: Optional[User] = None,
    ) -> List[WarrantyOut]:
        today = datetime.now(timezone.utc).date()
        cutoff_date = today + timedelta(days=lead_days)

        query = (
            db.query(Warranty)
            .join(Item, Warranty.item_id == Item.id)
            .options(
                joinedload(Warranty.item).joinedload(Item.office),
                joinedload(Warranty.supplier),
            )
            .filter(
                Warranty.end_date >= today,
                Warranty.end_date <= cutoff_date,
                Item.operational_status != "DISPOSED",
            )
        )
        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(Item.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(Item.office_id == office_id)

        warranties = query.order_by(Warranty.end_date.asc()).all()
        item_ids = [w.item_id for w in warranties]
        maint_counts, rma_counts = WarrantyService._batch_related_counts(db, item_ids)
        return [
            WarrantyService._serialize(db, w, maint_counts=maint_counts, rma_counts=rma_counts)
            for w in warranties
        ]

    @staticmethod
    def get_summary(
        db: Session,
        office_id: Optional[UUID] = None,
        current_user: Optional[User] = None,
    ) -> WarrantySummaryOut:
        today = datetime.now(timezone.utc).date()
        war_query = db.query(Warranty).join(Item, Warranty.item_id == Item.id)
        item_query = db.query(Item).filter(
            Item.operational_status != "DISPOSED",
            Item.item_type == "DURABLE_ASSET",
        )

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            war_query = war_query.filter(Item.office_id == current_user.office_id)
            item_query = item_query.filter(Item.office_id == current_user.office_id)
        elif office_id:
            war_query = war_query.filter(Item.office_id == office_id)
            item_query = item_query.filter(Item.office_id == office_id)

        warranties = war_query.all()
        total = len(warranties)
        active = sum(1 for w in warranties if w.end_date >= today)
        exp_30 = sum(1 for w in warranties if 0 <= (w.end_date - today).days <= 30)
        exp_60 = sum(1 for w in warranties if 0 <= (w.end_date - today).days <= 60)
        exp_90 = sum(1 for w in warranties if 0 <= (w.end_date - today).days <= 90)
        expired = sum(1 for w in warranties if w.end_date < today)

        warranted_item_ids = {w.item_id for w in warranties}
        durable_items = item_query.all()
        without_warranty = sum(1 for it in durable_items if it.id not in warranted_item_ids)

        return WarrantySummaryOut(
            total_warranties=total,
            active_count=active,
            expiring_30_count=exp_30,
            expiring_60_count=exp_60,
            expiring_90_count=exp_90,
            expired_count=expired,
            items_without_warranty=without_warranty,
        )

    @staticmethod
    def create_warranty(
        db: Session,
        payload: WarrantyCreate,
        creator: Optional[User] = None,
    ) -> WarrantyOut:
        if payload.end_date < payload.start_date:
            raise ValidationError(
                "Warranty end date cannot be earlier than start date",
                code="INVALID_DATE_RANGE",
            )

        item = db.query(Item).filter(Item.id == payload.item_id).first()
        if not item:
            raise NotFoundError("Item not found", code="ITEM_NOT_FOUND")

        if (
            creator
            and ROLE_SYSTEM_ADMIN not in creator.role_names
            and item.office_id != creator.office_id
        ):
            raise OfficeAccessDeniedError("Cannot register warranty for an item outside your assigned office")

        existing = db.query(Warranty).filter(Warranty.item_id == payload.item_id).first()
        if existing:
            raise ConflictError("A warranty record already exists for this item", code="DUPLICATE_WARRANTY")

        warranty = Warranty(
            item_id=payload.item_id,
            supplier_id=payload.supplier_id or item.supplier_id,
            provider_name=payload.provider_name.strip(),
            start_date=payload.start_date,
            end_date=payload.end_date,
            coverage_details=payload.coverage_details,
            support_contact=payload.support_contact,
            document_id=payload.document_id,
        )
        db.add(warranty)
        db.flush()

        AuditService.log_action(
            db=db,
            action="CREATE",
            module="WARRANTIES",
            record_id=str(warranty.id),
            actor=creator,
            office_id=item.office_id,
            new_values={
                "item_code": item.item_code,
                "provider_name": warranty.provider_name,
                "end_date": str(warranty.end_date),
            },
        )
        db.commit()
        return WarrantyService._serialize(db, WarrantyService.get_warranty_model(db, warranty.id))

    @staticmethod
    def update_warranty(
        db: Session,
        warranty_id: UUID,
        payload: WarrantyUpdate,
        updater: Optional[User] = None,
    ) -> WarrantyOut:
        warranty = WarrantyService.get_warranty_model(db, warranty_id)
        if (
            updater
            and ROLE_SYSTEM_ADMIN not in updater.role_names
            and warranty.item
            and warranty.item.office_id != updater.office_id
        ):
            raise OfficeAccessDeniedError("Cannot update warranty outside your assigned office")

        update_dict = payload.model_dump(exclude_unset=True)
        new_start = update_dict.get("start_date", warranty.start_date)
        new_end = update_dict.get("end_date", warranty.end_date)
        if new_end < new_start:
            raise ValidationError(
                "Warranty end date cannot be earlier than start date",
                code="INVALID_DATE_RANGE",
            )

        old_values = {k: str(getattr(warranty, k)) for k in update_dict.keys()}
        for field, value in update_dict.items():
            setattr(warranty, field, value)

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="WARRANTIES",
            record_id=str(warranty.id),
            actor=updater,
            office_id=warranty.item.office_id if warranty.item else None,
            old_values=old_values,
            new_values={k: str(v) for k, v in update_dict.items()},
        )
        db.commit()
        return WarrantyService._serialize(db, WarrantyService.get_warranty_model(db, warranty.id))
