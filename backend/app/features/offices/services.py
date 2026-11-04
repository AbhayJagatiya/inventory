"""Offices Service

Manages office lifecycle, scoping, metrics aggregation, and initial Veraval bootstrap.
"""

from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.exceptions import ConflictError, NotFoundError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.alerts.models import Alert
from app.features.audit.services import AuditService
from app.features.condemnation.models import CondemnationRequest
from app.features.inventory.models import Item
from app.features.offices.models import Office
from app.features.offices.schemas import OfficeCreate, OfficeUpdate
from app.features.users.models import User


class OfficeService:
    @staticmethod
    def get_office(db: Session, office_id: UUID) -> Office:
        office = db.query(Office).filter(Office.id == office_id).first()
        if not office:
            raise NotFoundError(f"Office with ID '{office_id}' was not found", code="OFFICE_NOT_FOUND")
        return office

    @staticmethod
    def get_office_by_code(db: Session, code: str) -> Optional[Office]:
        return db.query(Office).filter(Office.code == code).first()

    @staticmethod
    def list_offices(
        db: Session,
        office_type: Optional[str] = None,
        district: Optional[str] = None,
        is_active: Optional[bool] = None,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Office], int]:
        query = db.query(Office)

        # Enforce scope: non-admins only see assigned office
        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(Office.id == current_user.office_id)

        if office_type:
            query = query.filter(Office.office_type == office_type.upper())
        if district:
            query = query.filter(Office.district.ilike(f"%{district}%"))
        if is_active is not None:
            query = query.filter(Office.is_active == is_active)

        total = query.count()
        offices = query.order_by(Office.code.asc()).offset((page - 1) * limit).limit(limit).all()
        return offices, total

    @staticmethod
    def create_office(db: Session, payload: OfficeCreate, creator: Optional[User] = None) -> Office:
        existing = db.query(Office).filter(Office.code == payload.code).first()
        if existing:
            raise ConflictError(f"Office with code '{payload.code}' already exists", code="DUPLICATE_OFFICE_CODE")

        office = Office(
            code=payload.code.strip().upper(),
            name=payload.name.strip(),
            office_type=payload.office_type.strip().upper(),
            district=payload.district.strip(),
            taluka=payload.taluka.strip(),
            address=payload.address.strip(),
            contact_email=payload.contact_email,
            contact_phone=payload.contact_phone,
            is_active=True,
        )
        db.add(office)
        db.flush()

        AuditService.log_action(
            db=db,
            action="CREATE",
            module="OFFICES",
            record_id=str(office.id),
            actor=creator,
            office_id=office.id,
            new_values={"code": office.code, "name": office.name},
        )
        db.commit()
        db.refresh(office)
        return office

    @staticmethod
    def update_office(db: Session, office_id: UUID, payload: OfficeUpdate, updater: Optional[User] = None) -> Office:
        office = OfficeService.get_office(db, office_id)
        old_values = {
            "name": office.name,
            "address": office.address,
            "is_active": office.is_active,
        }

        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(office, field, value)

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="OFFICES",
            record_id=str(office.id),
            actor=updater,
            office_id=office.id,
            old_values=old_values,
            new_values=update_data,
        )
        db.commit()
        db.refresh(office)
        return office

    @staticmethod
    def get_office_summary(db: Session, office_id: UUID) -> Dict[str, Any]:
        office = OfficeService.get_office(db, office_id)

        # Count active non-disposed items
        total_items = (
            db.query(Item)
            .filter(Item.office_id == office_id, Item.operational_status != "DISPOSED")
            .count()
        )

        # Calculate valuation
        val_result = (
            db.query(func.sum(Item.total_cost))
            .filter(Item.office_id == office_id, Item.operational_status != "DISPOSED")
            .scalar()
        )
        total_valuation = float(val_result or 0.0)

        # Dead stock count (NON_MOVING or OBSOLETE)
        dead_stock_count = (
            db.query(Item)
            .filter(
                Item.office_id == office_id,
                Item.operational_status != "DISPOSED",
                Item.current_classification.in_(["NON_MOVING", "OBSOLETE"]),
            )
            .count()
        )

        # Pending condemnation count
        pending_condemnations = (
            db.query(CondemnationRequest)
            .filter(
                CondemnationRequest.office_id == office_id,
                CondemnationRequest.status.in_(["SUBMITTED", "UNDER_REVIEW", "MORE_INFO_REQUIRED"]),
            )
            .count()
        )

        # Active alerts count
        active_alerts = (
            db.query(Alert)
            .filter(Alert.office_id == office_id, Alert.status == "ACTIVE")
            .count()
        )

        return {
            "office": office,
            "total_items": total_items,
            "total_valuation": total_valuation,
            "dead_stock_count": dead_stock_count,
            "pending_condemnations_count": pending_condemnations,
            "active_alerts_count": active_alerts,
        }

    @staticmethod
    def seed_initial_veraval_office(db: Session) -> Office:
        """Seeds the authoritative initial Veraval office record if not present."""
        office = db.query(Office).filter(Office.code == settings.DEFAULT_OFFICE_CODE).first()
        if not office:
            office = Office(
                code=settings.DEFAULT_OFFICE_CODE,
                name=settings.DEFAULT_OFFICE_NAME,
                office_type="DISTRICT_PANCHAYAT",
                district=settings.DEFAULT_DISTRICT,
                taluka=settings.DEFAULT_TALUKA,
                address="District Panchayat Office, Near Bus Station, Veraval, Gir Somnath, Gujarat 362265",
                contact_email="ddo-gir-somnath@gujarat.gov.in",
                contact_phone="02876-240001",
                is_active=True,
            )
            db.add(office)
            db.commit()
            db.refresh(office)
        return office

