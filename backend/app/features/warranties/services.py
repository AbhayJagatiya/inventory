"""Warranties Service

Manages warranty records and upcoming expiry detection.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import ConflictError, NotFoundError
from app.features.audit.services import AuditService
from app.features.inventory.models import Item
from app.features.users.models import User
from app.features.warranties.models import Warranty
from app.features.warranties.schemas import WarrantyCreate, WarrantyUpdate


class WarrantyService:
    @staticmethod
    def get_warranty(db: Session, warranty_id: UUID) -> Warranty:
        war = db.query(Warranty).filter(Warranty.id == warranty_id).first()
        if not war:
            raise NotFoundError(f"Warranty '{warranty_id}' not found", code="WARRANTY_NOT_FOUND")
        return war

    @staticmethod
    def list_warranties(
        db: Session,
        item_id: Optional[UUID] = None,
        supplier_id: Optional[UUID] = None,
        is_expired: Optional[bool] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Warranty], int]:
        query = db.query(Warranty)
        today = datetime.now(timezone.utc).date()

        if item_id:
            query = query.filter(Warranty.item_id == item_id)
        if supplier_id:
            query = query.filter(Warranty.supplier_id == supplier_id)
        if is_expired is True:
            query = query.filter(Warranty.end_date < today)
        elif is_expired is False:
            query = query.filter(Warranty.end_date >= today)

        total = query.count()
        warranties = query.order_by(Warranty.end_date.asc()).offset((page - 1) * limit).limit(limit).all()
        return warranties, total

    @staticmethod
    def get_expiring_warranties(
        db: Session,
        lead_days: int = 60,
        office_id: Optional[UUID] = None,
    ) -> List[Warranty]:
        today = datetime.now(timezone.utc).date()
        cutoff_date = today + timedelta(days=lead_days)

        query = db.query(Warranty).join(Item).filter(
            Warranty.end_date >= today,
            Warranty.end_date <= cutoff_date,
            Item.operational_status != "DISPOSED",
        )
        if office_id:
            query = query.filter(Item.office_id == office_id)

        return query.order_by(Warranty.end_date.asc()).all()

    @staticmethod
    def create_warranty(db: Session, payload: WarrantyCreate, creator: Optional[User] = None) -> Warranty:
        item = db.query(Item).filter(Item.id == payload.item_id).first()
        if not item:
            raise NotFoundError("Item not found", code="ITEM_NOT_FOUND")

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
            new_values={"item_code": item.item_code, "end_date": str(warranty.end_date)},
        )
        db.commit()
        db.refresh(warranty)
        return warranty

    @staticmethod
    def update_warranty(
        db: Session,
        warranty_id: UUID,
        payload: WarrantyUpdate,
        updater: Optional[User] = None,
    ) -> Warranty:
        warranty = WarrantyService.get_warranty(db, warranty_id)
        update_dict = payload.model_dump(exclude_unset=True)

        for field, value in update_dict.items():
            setattr(warranty, field, value)

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="WARRANTIES",
            record_id=str(warranty.id),
            actor=updater,
            new_values=update_dict,
        )
        db.commit()
        db.refresh(warranty)
        return warranty

