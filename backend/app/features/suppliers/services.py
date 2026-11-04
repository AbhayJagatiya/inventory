"""Suppliers Service

Manages vendor registration, duplicate GSTIN/code validation, and supplier directory.
"""

from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import ConflictError, NotFoundError
from app.features.audit.services import AuditService
from app.features.suppliers.models import Supplier
from app.features.suppliers.schemas import SupplierCreate, SupplierUpdate
from app.features.users.models import User


class SupplierService:
    @staticmethod
    def get_supplier(db: Session, supplier_id: UUID) -> Supplier:
        supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if not supplier:
            raise NotFoundError(f"Supplier with ID '{supplier_id}' was not found", code="SUPPLIER_NOT_FOUND")
        return supplier

    @staticmethod
    def list_suppliers(
        db: Session,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Supplier], int]:
        query = db.query(Supplier)
        if is_active is not None:
            query = query.filter(Supplier.is_active == is_active)
        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(
                (Supplier.name.ilike(pattern))
                | (Supplier.supplier_code.ilike(pattern))
                | (Supplier.gstin.ilike(pattern))
                | (Supplier.contact_person.ilike(pattern))
            )

        total = query.count()
        suppliers = query.order_by(Supplier.name.asc()).offset((page - 1) * limit).limit(limit).all()
        return suppliers, total

    @staticmethod
    def create_supplier(db: Session, payload: SupplierCreate, creator: Optional[User] = None) -> Supplier:
        code_clean = payload.supplier_code.strip().upper()
        if db.query(Supplier).filter(Supplier.supplier_code == code_clean).first():
            raise ConflictError(f"Supplier code '{code_clean}' already exists", code="DUPLICATE_SUPPLIER_CODE")

        if payload.gstin:
            gstin_clean = payload.gstin.strip().upper()
            if db.query(Supplier).filter(Supplier.gstin == gstin_clean).first():
                raise ConflictError(f"Supplier with GSTIN '{gstin_clean}' already exists", code="DUPLICATE_SUPPLIER_GSTIN")

        supplier = Supplier(
            supplier_code=code_clean,
            name=payload.name.strip(),
            contact_person=payload.contact_person.strip() if payload.contact_person else None,
            phone=payload.phone.strip(),
            email=payload.email,
            address=payload.address.strip(),
            gstin=payload.gstin.strip().upper() if payload.gstin else None,
            pan=payload.pan.strip().upper() if payload.pan else None,
            is_active=True,
        )
        db.add(supplier)
        db.flush()

        AuditService.log_action(
            db=db,
            action="CREATE",
            module="SUPPLIERS",
            record_id=str(supplier.id),
            actor=creator,
            new_values={"code": supplier.supplier_code, "name": supplier.name},
        )
        db.commit()
        db.refresh(supplier)
        return supplier

    @staticmethod
    def update_supplier(
        db: Session,
        supplier_id: UUID,
        payload: SupplierUpdate,
        updater: Optional[User] = None,
    ) -> Supplier:
        supplier = SupplierService.get_supplier(db, supplier_id)
        old_values = {
            "name": supplier.name,
            "phone": supplier.phone,
            "is_active": supplier.is_active,
        }

        update_dict = payload.model_dump(exclude_unset=True)
        if "gstin" in update_dict and update_dict["gstin"]:
            gstin_clean = update_dict["gstin"].strip().upper()
            dup = db.query(Supplier).filter(Supplier.gstin == gstin_clean, Supplier.id != supplier.id).first()
            if dup:
                raise ConflictError(f"Another supplier with GSTIN '{gstin_clean}' already exists", code="DUPLICATE_SUPPLIER_GSTIN")
            update_dict["gstin"] = gstin_clean

        for field, value in update_dict.items():
            setattr(supplier, field, value)

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="SUPPLIERS",
            record_id=str(supplier.id),
            actor=updater,
            old_values=old_values,
            new_values=update_dict,
        )
        db.commit()
        db.refresh(supplier)
        return supplier

