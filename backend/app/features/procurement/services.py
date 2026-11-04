"""Procurement and Supplier Return (RMA) Service

Manages purchase orders, line items, and the vendor RMA lifecycle.
"""

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import ConflictError, NotFoundError, OfficeAccessDeniedError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.services import AuditService
from app.features.categories.models import Category
from app.features.inventory.models import Item, StockBalance
from app.features.offices.models import Office
from app.features.procurement.models import Procurement, ProcurementItem, SupplierReturn
from app.features.procurement.schemas import (
    ProcurementCreate,
    ProcurementUpdate,
    SupplierReturnCreate,
    SupplierReturnDispatch,
    SupplierReturnResolve,
    SupplierReturnVendorResponse,
)
from app.features.suppliers.models import Supplier
from app.features.users.models import User
from app.features.warranties.models import Warranty


class ProcurementService:
    @staticmethod
    def generate_procurement_number(db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        count = db.query(Procurement).filter(Procurement.procurement_number.like(f"PRC-{current_year}-%")).count()
        return f"PRC-{current_year}-{count + 1:05d}"

    @staticmethod
    def generate_return_number(db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        count = db.query(SupplierReturn).filter(SupplierReturn.return_number.like(f"SRM-{current_year}-%")).count()
        return f"SRM-{current_year}-{count + 1:05d}"

    @staticmethod
    def get_procurement(db: Session, procurement_id: UUID) -> Procurement:
        proc = db.query(Procurement).filter(Procurement.id == procurement_id).first()
        if not proc:
            raise NotFoundError(f"Procurement with ID '{procurement_id}' was not found", code="PROCUREMENT_NOT_FOUND")
        return proc

    @staticmethod
    def list_procurements(
        db: Session,
        office_id: Optional[UUID] = None,
        supplier_id: Optional[UUID] = None,
        status: Optional[str] = None,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Procurement], int]:
        query = db.query(Procurement)

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(Procurement.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(Procurement.office_id == office_id)

        if supplier_id:
            query = query.filter(Procurement.supplier_id == supplier_id)
        if status:
            query = query.filter(Procurement.status == status.upper())

        total = query.count()
        procurements = query.order_by(Procurement.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        return procurements, total

    @staticmethod
    def create_procurement(db: Session, payload: ProcurementCreate, creator: User) -> Procurement:
        # Check office scope
        if ROLE_SYSTEM_ADMIN not in creator.role_names and payload.office_id != creator.office_id:
            raise OfficeAccessDeniedError("Cannot create a procurement order for an office other than your assigned office")

        supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
        if not supplier:
            raise NotFoundError("Supplier was not found", code="SUPPLIER_NOT_FOUND")

        proc_number = ProcurementService.generate_procurement_number(db)
        total_order_amount = 0.0
        line_records = []

        for item_data in payload.items:
            category = db.query(Category).filter(Category.id == item_data.category_id).first()
            if not category:
                raise NotFoundError(f"Category '{item_data.category_id}' not found", code="CATEGORY_NOT_FOUND")

            tax_multiplier = 1.0 + (item_data.tax_rate_pct / 100.0)
            item_total = float(item_data.quantity_ordered) * float(item_data.unit_price) * tax_multiplier
            total_order_amount += item_total

            line = ProcurementItem(
                category_id=item_data.category_id,
                item_description=item_data.item_description.strip(),
                item_type=item_data.item_type,
                quantity_ordered=item_data.quantity_ordered,
                quantity_received=0.00,
                unit_price=item_data.unit_price,
                tax_rate_pct=item_data.tax_rate_pct,
                total_price=round(item_total, 2),
            )
            line_records.append(line)

        procurement = Procurement(
            procurement_number=proc_number,
            office_id=payload.office_id,
            supplier_id=payload.supplier_id,
            order_date=payload.order_date,
            invoice_number=payload.invoice_number.strip() if payload.invoice_number else None,
            total_amount=round(total_order_amount, 2),
            status="PENDING",
            created_by=creator.id,
            items=line_records,
        )
        db.add(procurement)
        db.flush()

        AuditService.log_action(
            db=db,
            action="CREATE",
            module="PROCUREMENT",
            record_id=str(procurement.id),
            actor=creator,
            office_id=procurement.office_id,
            new_values={"procurement_number": procurement.procurement_number, "total_amount": float(procurement.total_amount)},
        )
        db.commit()
        db.refresh(procurement)
        return procurement

    @staticmethod
    def update_procurement(
        db: Session,
        procurement_id: UUID,
        payload: ProcurementUpdate,
        updater: Optional[User] = None,
    ) -> Procurement:
        proc = ProcurementService.get_procurement(db, procurement_id)
        update_dict = payload.model_dump(exclude_unset=True)

        for field, value in update_dict.items():
            setattr(proc, field, value)

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="PROCUREMENT",
            record_id=str(proc.id),
            actor=updater,
            office_id=proc.office_id,
            new_values=update_dict,
        )
        db.commit()
        db.refresh(proc)
        return proc

    # Supplier Return / RMA Operations
    @staticmethod
    def get_supplier_return(db: Session, return_id: UUID) -> SupplierReturn:
        ret = db.query(SupplierReturn).filter(SupplierReturn.id == return_id).first()
        if not ret:
            raise NotFoundError(f"Supplier return with ID '{return_id}' was not found", code="RETURN_NOT_FOUND")
        return ret

    @staticmethod
    def list_supplier_returns(
        db: Session,
        office_id: Optional[UUID] = None,
        supplier_id: Optional[UUID] = None,
        status: Optional[str] = None,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[SupplierReturn], int]:
        query = db.query(SupplierReturn)

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(SupplierReturn.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(SupplierReturn.office_id == office_id)

        if supplier_id:
            query = query.filter(SupplierReturn.supplier_id == supplier_id)
        if status:
            query = query.filter(SupplierReturn.status == status.upper())

        total = query.count()
        returns = query.order_by(SupplierReturn.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        return returns, total

    @staticmethod
    def create_supplier_return(db: Session, payload: SupplierReturnCreate, creator: User) -> SupplierReturn:
        if ROLE_SYSTEM_ADMIN not in creator.role_names and payload.office_id != creator.office_id:
            raise OfficeAccessDeniedError("Cannot create a supplier return outside assigned office")

        item = db.query(Item).filter(Item.id == payload.item_id).first()
        if not item:
            raise NotFoundError("Item not found", code="ITEM_NOT_FOUND")
        if item.office_id != payload.office_id:
            raise ConflictError("Item does not belong to the return office")
        if item.operational_status == "DISPOSED":
            raise ValidationError("Disposed assets cannot be returned to supplier")

        return_no = ProcurementService.generate_return_number(db)
        rma = SupplierReturn(
            return_number=return_no,
            office_id=payload.office_id,
            supplier_id=payload.supplier_id,
            item_id=payload.item_id,
            procurement_id=payload.procurement_id,
            warranty_id=payload.warranty_id,
            return_date=payload.return_date,
            quantity=payload.quantity,
            reason=payload.reason,
            status="INITIATED",
            rma_reference_number=payload.rma_reference_number,
            created_by=creator.id,
        )
        db.add(rma)
        db.flush()

        AuditService.log_action(
            db=db,
            action="CREATE",
            module="SUPPLIER_RMA",
            record_id=str(rma.id),
            actor=creator,
            office_id=rma.office_id,
            new_values={"return_number": rma.return_number, "reason": rma.reason},
        )
        db.commit()
        db.refresh(rma)
        return rma

    @staticmethod
    def dispatch_supplier_return(
        db: Session,
        return_id: UUID,
        payload: SupplierReturnDispatch,
        actor: User,
    ) -> SupplierReturn:
        rma = ProcurementService.get_supplier_return(db, return_id)
        if rma.status != "INITIATED":
            raise ValidationError(f"Cannot dispatch return in status '{rma.status}' (must be INITIATED)")

        rma.dispatch_date = payload.dispatch_date
        rma.return_tracking_number = payload.return_tracking_number
        rma.carrier_name = payload.carrier_name
        rma.status = "DISPATCHED_TO_VENDOR"

        # Update item status / stock balance
        item = db.query(Item).filter(Item.id == rma.item_id).first()
        if item:
            if item.item_type == "DURABLE_ASSET":
                item.operational_status = "DISPATCHED_TO_VENDOR"
                item.current_custodian = f"Supplier: {rma.supplier.name}"
            else:
                # Consumable: move quantity from available to in_vendor_rma_qty
                balance = db.query(StockBalance).filter(StockBalance.item_id == item.id).first()
                if balance:
                    if balance.available_qty < rma.quantity:
                        raise ValidationError("Insufficient available quantity to dispatch RMA")
                    balance.available_qty -= rma.quantity
                    balance.in_vendor_rma_qty += rma.quantity

        db.flush()
        AuditService.log_action(
            db=db,
            action="DISPATCH",
            module="SUPPLIER_RMA",
            record_id=str(rma.id),
            actor=actor,
            office_id=rma.office_id,
            new_values={"status": rma.status, "tracking": rma.return_tracking_number},
        )
        db.commit()
        db.refresh(rma)
        return rma

    @staticmethod
    def record_vendor_response(
        db: Session,
        return_id: UUID,
        payload: SupplierReturnVendorResponse,
        actor: User,
    ) -> SupplierReturn:
        rma = ProcurementService.get_supplier_return(db, return_id)
        if rma.status not in ["DISPATCHED_TO_VENDOR", "UNDER_VENDOR_ASSESSMENT"]:
            raise ValidationError(f"Cannot record vendor response for return in status '{rma.status}'")

        rma.vendor_acknowledgement_date = payload.vendor_acknowledgement_date
        if payload.response == "ACCEPT":
            rma.status = "UNDER_VENDOR_ASSESSMENT"
        else:
            rma.status = "REJECTED_BY_VENDOR"
            rma.vendor_rejection_reason = payload.rejection_reason

            # Reverse RMA hold back to store as DAMAGED
            item = db.query(Item).filter(Item.id == rma.item_id).first()
            if item:
                if item.item_type == "DURABLE_ASSET":
                    item.operational_status = "DAMAGED"
                    item.condition = "DAMAGED"
                    item.current_custodian = None
                else:
                    balance = db.query(StockBalance).filter(StockBalance.item_id == item.id).first()
                    if balance:
                        balance.in_vendor_rma_qty -= rma.quantity
                        balance.available_qty += rma.quantity

        db.flush()
        AuditService.log_action(
            db=db,
            action="VENDOR_RESPONSE",
            module="SUPPLIER_RMA",
            record_id=str(rma.id),
            actor=actor,
            office_id=rma.office_id,
            new_values={"status": rma.status, "response": payload.response},
        )
        db.commit()
        db.refresh(rma)
        return rma

    @staticmethod
    def resolve_supplier_return(
        db: Session,
        return_id: UUID,
        payload: SupplierReturnResolve,
        actor: User,
    ) -> SupplierReturn:
        rma = ProcurementService.get_supplier_return(db, return_id)
        if rma.status in ["COMPLETED_CLOSED", "CANCELLED"]:
            raise ValidationError(f"Return is already {rma.status}")

        rma.resolution_type = payload.resolution_type
        rma.resolution_remarks = payload.resolution_remarks
        rma.resolution_date = datetime.now(timezone.utc).date()
        rma.status = "COMPLETED_CLOSED"

        item = db.query(Item).filter(Item.id == rma.item_id).first()
        balance = db.query(StockBalance).filter(StockBalance.item_id == rma.item_id).first() if item else None

        if payload.resolution_type == "REPLACEMENT":
            rma.replacement_item_id = payload.replacement_item_id
            if item:
                # Old item marked disposed
                item.operational_status = "DISPOSED"
                if balance:
                    balance.in_vendor_rma_qty -= rma.quantity
                    balance.disposed_qty += rma.quantity

        elif payload.resolution_type == "REPAIRED_RETURN":
            if item:
                item.operational_status = "AVAILABLE_IN_STORE"
                item.condition = "GOOD"
                item.current_custodian = None
                if balance:
                    balance.in_vendor_rma_qty -= rma.quantity
                    balance.available_qty += rma.quantity

        elif payload.resolution_type in ["CREDIT_NOTE", "REFUND"]:
            rma.credit_note_number = payload.credit_note_number
            rma.credit_amount = payload.credit_amount or 0.0
            rma.refund_reference_number = payload.refund_reference_number
            rma.refund_amount = payload.refund_amount or 0.0
            if item:
                item.operational_status = "DISPOSED"
                if balance:
                    balance.in_vendor_rma_qty -= rma.quantity
                    balance.disposed_qty += rma.quantity

        db.flush()
        AuditService.log_action(
            db=db,
            action="RESOLVE",
            module="SUPPLIER_RMA",
            record_id=str(rma.id),
            actor=actor,
            office_id=rma.office_id,
            new_values={"status": rma.status, "resolution_type": rma.resolution_type},
        )
        db.commit()
        db.refresh(rma)
        return rma

