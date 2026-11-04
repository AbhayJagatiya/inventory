"""Inventory Movement Ledger Service

Manages immutable stock transaction vouchers: Receipts, Issues, Returns, Transfers, and Reversals.
Enforces atomic row locking, positive balance integrity, and audit traceability.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.exceptions import (
    ConflictError,
    ImmutableRecordError,
    InsufficientStockError,
    NotFoundError,
    OfficeAccessDeniedError,
    ValidationError,
)
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.services import AuditService
from app.features.categories.models import Category, UnitOfMeasure
from app.features.inventory.models import Item, StockBalance
from app.features.inventory.services import InventoryService
from app.features.ledger.models import StockTransaction, StockTransactionLine
from app.features.ledger.schemas import (
    IssueCreate,
    ReceiptCreate,
    ReturnCreate,
    StockTransactionOut,
    TransactionLineOut,
    TransferAction,
    TransferCreate,
)
from app.features.locations.models import Location
from app.features.offices.models import Office
from app.features.procurement.models import Procurement, ProcurementItem
from app.features.users.models import User


class LedgerService:
    @staticmethod
    def build_transaction_out(txn: StockTransaction) -> StockTransactionOut:
        """Enrich a StockTransaction model into a full StockTransactionOut with items and UI aliases."""
        lines_out = []
        total_accepted_val = 0.0

        for line in txn.lines:
            item = line.item
            item_name = item.item_name if item else "Store Item"
            item_code = item.item_code if item else ""
            item_type = item.item_type if item else "DURABLE_ASSET"
            uom_str = item.uom.code if (item and hasattr(item, "uom") and item.uom) else "NOS"
            serial = item.serial_number if item else None

            qty = float(line.quantity)
            cumul_ret = float(line.cumulative_returned_qty or 0.0)
            u_cost = float(line.unit_cost or 0.0)
            t_cost = float(line.total_cost or (qty * u_cost))
            total_accepted_val += t_cost

            line_out = TransactionLineOut(
                id=line.id,
                transaction_id=line.transaction_id,
                original_line_id=line.original_line_id,
                procurement_item_id=line.procurement_item_id,
                item_id=line.item_id,
                quantity=qty,
                cumulative_returned_qty=cumul_ret,
                unit_cost=u_cost,
                total_cost=t_cost,
                condition_observed=line.condition_observed,
                remarks=line.remarks,
                item_name=item_name,
                item_code=item_code,
                item_type=item_type,
                uom=uom_str,
                serial_number=serial,
                serial_numbers=[serial] if serial else [],
                quantity_received=qty,
                quantity_accepted=qty,
                quantity_ordered=qty,
                quantity_rejected=0.0,
                quantity_issued=qty,
                quantity_returned=cumul_ret,
                remaining_unreturned=max(0.0, qty - cumul_ret),
                total_accepted_cost=t_cost,
            )
            lines_out.append(line_out)

        created_iso = txn.created_at.date().isoformat() if txn.created_at else None

        # Extract supplier details if stored in remarks
        supplier_str = None
        supplier_contact_str = None
        if txn.remarks and "Supplier: " in txn.remarks:
            parts = txn.remarks.split("Supplier: ")
            if len(parts) > 1:
                supplier_part = parts[1].split("|")[0].strip()
                supplier_str = supplier_part
        if txn.remarks and "Contact: " in txn.remarks:
            parts = txn.remarks.split("Contact: ")
            if len(parts) > 1:
                contact_part = parts[1].split("|")[0].strip()
                supplier_contact_str = contact_part

        from_name = txn.source_office.name if txn.source_office else (txn.office.name if txn.office else "District Store")
        to_name = txn.destination_office.name if txn.destination_office else None
        loc = txn.destination_location or txn.source_location
        rec_loc_name = f"{loc.room_number} ({loc.building_name})" if loc else "Central Store"

        return StockTransactionOut(
            id=txn.id,
            transaction_number=txn.transaction_number,
            idempotency_key=txn.idempotency_key,
            transaction_type=txn.transaction_type,
            office_id=txn.office_id,
            source_office_id=txn.source_office_id,
            destination_office_id=txn.destination_office_id,
            source_location_id=txn.source_location_id,
            destination_location_id=txn.destination_location_id,
            original_transaction_id=txn.original_transaction_id,
            recipient_name=txn.recipient_name,
            recipient_department=txn.recipient_department,
            reference_document=txn.reference_document,
            status=txn.status,
            actor_id=txn.actor_id,
            remarks=txn.remarks,
            reversal_reason=txn.reversal_reason,
            posted_at=txn.posted_at,
            created_at=txn.created_at,
            lines=lines_out,
            # UI Aliases
            voucher_number=txn.transaction_number,
            transfer_number=txn.transaction_number,
            receipt_date=created_iso,
            issue_date=created_iso,
            return_date=created_iso,
            request_date=created_iso,
            department=txn.recipient_department,
            receiving_employee=txn.recipient_name,
            receiving_person=txn.recipient_name,
            returned_by_person=txn.recipient_name,
            supplier_name=supplier_str or "District Panchayat Stores",
            supplier_contact=supplier_contact_str or "",
            po_number=txn.reference_document,
            invoice_number=txn.reference_document,
            invoice_date=created_iso,
            sanction_order_number=txn.reference_document,
            order_reference=txn.reference_document,
            receiving_office=txn.office.name if txn.office else "District Panchayat Central Store, Veraval",
            receiving_location=rec_loc_name,
            from_office_name=from_name,
            to_office_name=to_name,
            items=lines_out,
            total_accepted_value=total_accepted_val,
        )

    @staticmethod
    def generate_transaction_number(db: Session, txn_type: str) -> str:
        current_year = datetime.now(timezone.utc).year
        type_prefix_map = {
            "RECEIPT": "REC",
            "ISSUE": "ISS",
            "RETURN": "RET",
            "TRANSFER": "TRF",
            "REVERSAL_CORRECTION": "REV",
            "DISPOSAL_WRITEOFF": "DSP",
        }
        prefix = type_prefix_map.get(txn_type, "TXN")
        count = db.query(StockTransaction).filter(StockTransaction.transaction_number.like(f"{prefix}-{current_year}-%")).count()
        return f"{prefix}-{current_year}-{count + 1:05d}"

    @staticmethod
    def get_transaction(db: Session, transaction_id: UUID) -> StockTransaction:
        txn = db.query(StockTransaction).filter(StockTransaction.id == transaction_id).first()
        if not txn:
            raise NotFoundError(f"Transaction with ID '{transaction_id}' was not found", code="TRANSACTION_NOT_FOUND")
        return txn

    @staticmethod
    def list_transactions(
        db: Session,
        txn_type: Optional[str] = None,
        office_id: Optional[UUID] = None,
        status: Optional[str] = None,
        recipient_name: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[StockTransaction], int]:
        query = db.query(StockTransaction)

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(
                (StockTransaction.office_id == current_user.office_id)
                | (StockTransaction.source_office_id == current_user.office_id)
                | (StockTransaction.destination_office_id == current_user.office_id)
            )
        elif office_id:
            query = query.filter(
                (StockTransaction.office_id == office_id)
                | (StockTransaction.source_office_id == office_id)
                | (StockTransaction.destination_office_id == office_id)
            )

        if txn_type:
            query = query.filter(StockTransaction.transaction_type == txn_type.upper())
        if status and status.upper() != "ALL":
            query = query.filter(StockTransaction.status == status.upper())
        if recipient_name:
            query = query.filter(StockTransaction.recipient_name.ilike(f"%{recipient_name.strip()}%"))
        if start_date:
            query = query.filter(StockTransaction.created_at >= start_date)
        if end_date:
            query = query.filter(StockTransaction.created_at <= end_date)

        total = query.count()
        txns = query.order_by(StockTransaction.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        return txns, total

    # 1. Stock Inward Receipts
    @staticmethod
    def create_receipt(db: Session, payload: ReceiptCreate, actor: Optional[User] = None, creator: Optional[User] = None) -> StockTransaction:
        user = creator or actor
        office_id = payload.office_id or (user.office_id if user else None)
        if not office_id:
            first_off = db.query(Office).first()
            office_id = first_off.id if first_off else None

        if user and ROLE_SYSTEM_ADMIN not in user.role_names and payload.office_id and payload.office_id != user.office_id:
            raise OfficeAccessDeniedError("Cannot create receipt for an office other than your assigned office")

        if payload.idempotency_key:
            existing = db.query(StockTransaction).filter(StockTransaction.idempotency_key == payload.idempotency_key).first()
            if existing:
                return existing

        txn_no = LedgerService.generate_transaction_number(db, "RECEIPT")

        # Composite remarks
        remarks_parts = []
        if payload.supplier_name:
            remarks_parts.append(f"Supplier: {payload.supplier_name.strip()}")
        if payload.supplier_contact:
            remarks_parts.append(f"Contact: {payload.supplier_contact.strip()}")
        if payload.remarks:
            remarks_parts.append(payload.remarks.strip())
        composite_remarks = " | ".join(remarks_parts) if remarks_parts else None

        ref_doc = payload.invoice_number or payload.po_number or payload.reference_document

        raw_lines = payload.lines or payload.items or []
        if not raw_lines:
            raise ValidationError("A stock receipt must have at least one line item.", code="EMPTY_LINES")

        # Resolve location
        default_location = None
        if payload.receiving_location_id:
            default_location = db.query(Location).filter(Location.id == payload.receiving_location_id).first()
        if not default_location and payload.receiving_location:
            default_location = db.query(Location).filter(
                Location.office_id == office_id,
                (Location.room_number.ilike(f"%{payload.receiving_location.strip()}%")) |
                (Location.building_name.ilike(f"%{payload.receiving_location.strip()}%"))
            ).first()
        if not default_location:
            default_location = db.query(Location).filter(Location.office_id == office_id).first()

        lines = []
        for line_data in raw_lines:
            item = None
            if line_data.item_id:
                item = db.query(Item).filter(Item.id == line_data.item_id).first()

            if not item and line_data.item_name:
                # Search by item_name in office
                item = db.query(Item).filter(
                    Item.office_id == office_id,
                    Item.item_name.ilike(line_data.item_name.strip())
                ).first()

                if not item:
                    item_type = line_data.item_type or "DURABLE_ASSET"
                    new_code = InventoryService.generate_item_code(db, item_type, office_id)
                    new_barcode = InventoryService.generate_barcode_number(db, item_type)

                    cat = None
                    if line_data.category_name:
                        cat = db.query(Category).filter(
                            (Category.name.ilike(line_data.category_name.strip())) |
                            (Category.code.ilike(line_data.category_name.strip()))
                        ).first()
                    if not cat:
                        cat = db.query(Category).first()

                    uom_obj = None
                    if line_data.uom:
                        uom_obj = db.query(UnitOfMeasure).filter(
                            UnitOfMeasure.code.ilike(line_data.uom.strip())
                        ).first()
                    if not uom_obj:
                        uom_obj = db.query(UnitOfMeasure).first()

                    unit_purchase_cost = float(line_data.unit_cost or 0.0)

                    sn = None
                    if line_data.serial_numbers and len(line_data.serial_numbers) > 0:
                        sn = line_data.serial_numbers[0]
                    elif line_data.serial_number:
                        sn = line_data.serial_number

                    item = Item(
                        office_id=office_id,
                        category_id=cat.id if cat else None,
                        uom_id=uom_obj.id if uom_obj else None,
                        location_id=default_location.id if default_location else None,
                        item_code=new_code,
                        barcode_number=new_barcode,
                        item_type=item_type,
                        item_name=line_data.item_name.strip(),
                        serial_number=sn,
                        model_number=None,
                        brand=None,
                        unit_purchase_cost=unit_purchase_cost,
                        total_cost=unit_purchase_cost,
                        operational_status="AVAILABLE_IN_STORE",
                        condition="NEW",
                        current_classification="ACTIVE",
                        created_by=user.id if user else None,
                    )
                    db.add(item)
                    db.flush()

            if not item:
                raise NotFoundError(f"Item not found or could not be created for line '{line_data.item_name}'", code="ITEM_NOT_FOUND")

            qty = float(line_data.quantity or line_data.quantity_accepted or line_data.quantity_received or 1.0)
            unit_cost = float(line_data.unit_cost if line_data.unit_cost is not None else item.unit_purchase_cost)
            total_cost = round(unit_cost * qty, 2)

            line = StockTransactionLine(
                item_id=item.id,
                procurement_item_id=line_data.procurement_item_id,
                quantity=qty,
                cumulative_returned_qty=0.00,
                unit_cost=unit_cost,
                total_cost=total_cost,
                condition_observed=line_data.condition_observed or line_data.condition or item.condition,
                remarks=line_data.remarks or (line_data.rejection_reason if line_data.quantity_rejected else None),
            )
            lines.append(line)

        actor_id = user.id if user else None
        if not actor_id:
            first_user = db.query(User).first()
            actor_id = first_user.id if first_user else None

        txn = StockTransaction(
            transaction_number=txn_no,
            idempotency_key=payload.idempotency_key,
            transaction_type="RECEIPT",
            office_id=office_id,
            destination_location_id=default_location.id if default_location else None,
            reference_document=ref_doc,
            status="DRAFT",
            actor_id=actor_id,
            remarks=composite_remarks,
            lines=lines,
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

        if payload.status == "POSTED":
            txn = LedgerService.post_receipt(db, txn.id, actor=user)

        return txn

    @staticmethod
    def post_receipt(db: Session, transaction_id: UUID, actor: Optional[User] = None) -> StockTransaction:
        txn = LedgerService.get_transaction(db, transaction_id)
        if txn.status == "POSTED":
            raise ImmutableRecordError("Receipt voucher is already posted and immutable.")
        if txn.status == "CANCELLED":
            raise ValidationError("Cancelled vouchers cannot be posted.")

        today = datetime.now(timezone.utc).date()

        for line in txn.lines:
            item = db.query(Item).filter(Item.id == line.item_id).first()

            # Link to procurement item if present
            if line.procurement_item_id:
                proc_item = (
                    db.query(ProcurementItem)
                    .filter(ProcurementItem.id == line.procurement_item_id)
                    .with_for_update()
                    .first()
                )
                if proc_item:
                    new_received = float(proc_item.quantity_received) + float(line.quantity)
                    if new_received > float(proc_item.quantity_ordered):
                        raise ValidationError(
                            f"Inward quantity ({line.quantity}) exceeds pending order balance on procurement line",
                            code="EXCEEDS_ORDERED_QUANTITY",
                        )
                    proc_item.quantity_received = new_received

                    proc = db.query(Procurement).filter(Procurement.id == proc_item.procurement_id).first()
                    if proc:
                        all_fulfilled = all(
                            float(it.quantity_received) >= float(it.quantity_ordered) for it in proc.items
                        )
                        proc.status = "FULLY_RECEIVED" if all_fulfilled else "PARTIALLY_RECEIVED"

            # Update stock balances with row lock
            dest_loc = txn.destination_location_id or item.location_id
            balance = (
                db.query(StockBalance)
                .filter(
                    StockBalance.office_id == txn.office_id,
                    StockBalance.item_id == line.item_id,
                    StockBalance.location_id == dest_loc,
                )
                .with_for_update()
                .first()
            )
            if not balance:
                balance = StockBalance(
                    office_id=txn.office_id,
                    item_id=line.item_id,
                    location_id=dest_loc,
                    available_qty=0.00,
                    allocated_qty=0.00,
                    in_vendor_rma_qty=0.00,
                    disposed_qty=0.00,
                )
                db.add(balance)

            balance.available_qty = Decimal(str(balance.available_qty or 0)) + Decimal(str(line.quantity))
            balance.last_reconciled_at = datetime.now(timezone.utc)

            # Update item metadata
            item.last_movement_date = today
            if item.operational_status != "AVAILABLE_IN_STORE":
                item.operational_status = "AVAILABLE_IN_STORE"
            if line.condition_observed:
                item.condition = line.condition_observed

        txn.status = "POSTED"
        txn.posted_at = datetime.now(timezone.utc)
        db.flush()

        if actor:
            AuditService.log_action(
                db=db,
                action="POST",
                module="STOCK_RECEIPTS",
                record_id=str(txn.id),
                actor=actor,
                office_id=txn.office_id,
                new_values={"voucher": txn.transaction_number, "status": "POSTED"},
            )
        db.commit()
        db.refresh(txn)
        return txn

    # 2. Stock Outward Issues
    @staticmethod
    def create_issue(db: Session, payload: IssueCreate, actor: Optional[User] = None, creator: Optional[User] = None) -> StockTransaction:
        user = creator or actor
        office_id = payload.office_id or (user.office_id if user else None)
        if not office_id:
            first_off = db.query(Office).first()
            office_id = first_off.id if first_off else None

        if user and ROLE_SYSTEM_ADMIN not in user.role_names and payload.office_id and payload.office_id != user.office_id:
            raise OfficeAccessDeniedError("Cannot create stock issue for an office other than your assigned office")

        if payload.idempotency_key:
            existing = db.query(StockTransaction).filter(StockTransaction.idempotency_key == payload.idempotency_key).first()
            if existing:
                return existing

        txn_no = LedgerService.generate_transaction_number(db, "ISSUE")
        raw_lines = payload.lines or payload.items or []
        if not raw_lines:
            raise ValidationError("An issue voucher must have at least one line item.", code="EMPTY_LINES")

        src_loc_id = payload.source_location_id
        if not src_loc_id:
            loc = db.query(Location).filter(Location.office_id == office_id).first()
            if loc:
                src_loc_id = loc.id

        recipient_name = (payload.recipient_name or payload.receiving_employee or "Staff").strip()
        recipient_dept = (payload.recipient_department or payload.department or "Administration").strip()
        ref_doc = payload.reference_document or payload.sanction_order_number

        lines = []
        for line_data in raw_lines:
            item_id = line_data.item_id
            item = db.query(Item).filter(Item.id == item_id).first()
            if not item:
                raise NotFoundError(f"Item '{item_id}' not found", code="ITEM_NOT_FOUND")
            if item.office_id != office_id:
                raise ConflictError("Item belongs to another office")

            qty = float(line_data.quantity or line_data.quantity_issued or 1.0)
            u_cost = float(item.unit_purchase_cost)
            t_cost = round(u_cost * qty, 2)

            line = StockTransactionLine(
                item_id=item.id,
                quantity=qty,
                cumulative_returned_qty=0.00,
                unit_cost=u_cost,
                total_cost=t_cost,
                condition_observed=item.condition,
                remarks=line_data.remarks,
            )
            lines.append(line)

        remarks_str = payload.remarks
        if payload.purpose:
            remarks_str = f"Purpose: {payload.purpose.strip()} | {remarks_str or ''}".strip(" |")

        actor_id = user.id if user else None
        if not actor_id:
            first_user = db.query(User).first()
            actor_id = first_user.id if first_user else None

        txn = StockTransaction(
            transaction_number=txn_no,
            idempotency_key=payload.idempotency_key,
            transaction_type="ISSUE",
            office_id=office_id,
            source_location_id=src_loc_id,
            recipient_name=recipient_name,
            recipient_department=recipient_dept,
            reference_document=ref_doc,
            status="DRAFT",
            actor_id=actor_id,
            remarks=remarks_str,
            lines=lines,
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

        if payload.status == "POSTED":
            txn = LedgerService.post_issue(db, txn.id, actor=user)

        return txn

    @staticmethod
    def post_issue(db: Session, transaction_id: UUID, actor: Optional[User] = None) -> StockTransaction:
        txn = LedgerService.get_transaction(db, transaction_id)
        if txn.status == "POSTED":
            raise ImmutableRecordError("Issue voucher is already posted and immutable.")
        if txn.status == "CANCELLED":
            raise ValidationError("Cancelled vouchers cannot be posted.")

        today = datetime.now(timezone.utc).date()

        for line in txn.lines:
            item = db.query(Item).filter(Item.id == line.item_id).first()

            if item.operational_status == "DISPOSED":
                raise ValidationError(f"Item '{item.item_code}' is DISPOSED and cannot be issued.")

            balance = (
                db.query(StockBalance)
                .filter(
                    StockBalance.office_id == txn.office_id,
                    StockBalance.item_id == line.item_id,
                    StockBalance.location_id == (txn.source_location_id or item.location_id),
                )
                .with_for_update()
                .first()
            )
            if not balance:
                # If balance record doesn't exist yet, initialize it
                balance = StockBalance(
                    office_id=txn.office_id,
                    item_id=line.item_id,
                    location_id=(txn.source_location_id or item.location_id),
                    available_qty=float(line.quantity),
                    allocated_qty=0.00,
                    in_vendor_rma_qty=0.00,
                    disposed_qty=0.00,
                )
                db.add(balance)

            if float(balance.available_qty) < float(line.quantity):
                avail = float(balance.available_qty)
                raise InsufficientStockError(
                    f"Requested issue quantity ({line.quantity}) exceeds available balance ({avail}) for '{item.item_name}'."
                )

            balance.available_qty = Decimal(str(balance.available_qty)) - Decimal(str(line.quantity))
            balance.allocated_qty = Decimal(str(balance.allocated_qty or 0)) + Decimal(str(line.quantity))
            balance.last_reconciled_at = datetime.now(timezone.utc)

            if item.item_type == "DURABLE_ASSET":
                item.operational_status = "IN_USE"
                item.current_custodian = txn.recipient_name
                item.current_department = txn.recipient_department

            item.last_movement_date = today

        txn.status = "POSTED"
        txn.posted_at = datetime.now(timezone.utc)
        db.flush()

        if actor:
            AuditService.log_action(
                db=db,
                action="POST",
                module="STOCK_ISSUES",
                record_id=str(txn.id),
                actor=actor,
                office_id=txn.office_id,
                new_values={"voucher": txn.transaction_number, "status": "POSTED", "recipient": txn.recipient_name},
            )
        db.commit()
        db.refresh(txn)
        return txn

    # 3. Stock Internal Returns
    @staticmethod
    def create_return(db: Session, payload: ReturnCreate, actor: Optional[User] = None, creator: Optional[User] = None) -> StockTransaction:
        user = creator or actor
        orig_txn_id = payload.original_transaction_id or payload.original_issue_id
        if not orig_txn_id:
            raise ValidationError("Original issue voucher ID is required to create a return.")

        orig_txn = LedgerService.get_transaction(db, orig_txn_id)
        if orig_txn.transaction_type != "ISSUE":
            raise ValidationError("Returns can only be created against an original ISSUE voucher.")

        office_id = payload.office_id or orig_txn.office_id or (user.office_id if user else None)

        if payload.idempotency_key:
            existing = db.query(StockTransaction).filter(StockTransaction.idempotency_key == payload.idempotency_key).first()
            if existing:
                return existing

        txn_no = LedgerService.generate_transaction_number(db, "RETURN")
        raw_lines = payload.lines or payload.items or []
        if not raw_lines:
            raise ValidationError("A return voucher must have at least one line item.", code="EMPTY_LINES")

        dest_loc_id = payload.destination_location_id or orig_txn.source_location_id
        if not dest_loc_id:
            loc = db.query(Location).filter(Location.office_id == office_id).first()
            if loc:
                dest_loc_id = loc.id

        lines = []
        for line_data in raw_lines:
            orig_line = None
            if line_data.original_line_id:
                orig_line = db.query(StockTransactionLine).filter(
                    StockTransactionLine.id == line_data.original_line_id
                ).first()

            if not orig_line and line_data.item_id:
                orig_line = db.query(StockTransactionLine).filter(
                    StockTransactionLine.transaction_id == orig_txn.id,
                    StockTransactionLine.item_id == line_data.item_id
                ).first()

            if not orig_line:
                orig_line = orig_txn.lines[0] if orig_txn.lines else None

            if not orig_line:
                raise NotFoundError("Original issue line not found on referenced transaction")

            item = db.query(Item).filter(Item.id == orig_line.item_id).first()
            qty = float(line_data.quantity or line_data.quantity_returned or 1.0)
            u_cost = float(orig_line.unit_cost)
            t_cost = round(u_cost * qty, 2)

            cond = line_data.condition_observed or line_data.condition or item.condition
            rem = line_data.remarks

            line = StockTransactionLine(
                item_id=orig_line.item_id,
                original_line_id=orig_line.id,
                quantity=qty,
                cumulative_returned_qty=0.00,
                unit_cost=u_cost,
                total_cost=t_cost,
                condition_observed=cond,
                remarks=rem,
            )
            lines.append(line)

        remarks_str = payload.remarks
        if payload.return_reason:
            remarks_str = f"Reason: {payload.return_reason.strip()} | {remarks_str or ''}".strip(" |")

        rec_name = payload.recipient_name or payload.returning_employee or orig_txn.recipient_name
        ref_doc = payload.reference_document or payload.original_issue_voucher or orig_txn.transaction_number

        actor_id = user.id if user else None
        if not actor_id:
            first_user = db.query(User).first()
            actor_id = first_user.id if first_user else None

        txn = StockTransaction(
            transaction_number=txn_no,
            idempotency_key=payload.idempotency_key,
            transaction_type="RETURN",
            office_id=office_id,
            original_transaction_id=orig_txn.id,
            destination_location_id=dest_loc_id,
            recipient_name=rec_name,
            recipient_department=payload.returning_department or orig_txn.recipient_department,
            reference_document=ref_doc,
            status="DRAFT",
            actor_id=actor_id,
            remarks=remarks_str,
            lines=lines,
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

        if payload.status == "POSTED":
            txn = LedgerService.post_return(db, txn.id, actor=user)

        return txn

    @staticmethod
    def post_return(db: Session, transaction_id: UUID, actor: Optional[User] = None) -> StockTransaction:
        txn = LedgerService.get_transaction(db, transaction_id)
        if txn.status == "POSTED":
            raise ImmutableRecordError("Return voucher is already posted and immutable.")

        today = datetime.now(timezone.utc).date()

        for line in txn.lines:
            orig_line = (
                db.query(StockTransactionLine)
                .filter(StockTransactionLine.id == line.original_line_id)
                .with_for_update()
                .first()
            ) if line.original_line_id else None

            if orig_line:
                issued_qty = float(orig_line.quantity)
                # Compute cumulative returned from posted return vouchers dynamically (immutability preserved)
                current_cumul = float(
                    db.query(func.coalesce(func.sum(StockTransactionLine.quantity), 0.0))
                    .join(StockTransaction, StockTransaction.id == StockTransactionLine.transaction_id)
                    .filter(
                        StockTransactionLine.original_line_id == orig_line.id,
                        StockTransaction.status == "POSTED",
                        StockTransaction.transaction_type == "RETURN",
                    )
                    .scalar() or 0.0
                )
                return_qty = float(line.quantity)

                if current_cumul + return_qty > issued_qty:
                    max_returnable = issued_qty - current_cumul
                    raise ValidationError(
                        f"Return quantity ({return_qty}) exceeds outstanding returnable quantity ({max_returnable}) for line {orig_line.id}",
                        code="EXCEEDS_ISSUED_QUANTITY",
                    )
            else:
                return_qty = float(line.quantity)

            item = db.query(Item).filter(Item.id == line.item_id).first()
            dest_loc = txn.destination_location_id or item.location_id

            balance = (
                db.query(StockBalance)
                .filter(
                    StockBalance.office_id == txn.office_id,
                    StockBalance.item_id == line.item_id,
                    StockBalance.location_id == dest_loc,
                )
                .with_for_update()
                .first()
            )
            if not balance:
                balance = StockBalance(
                    office_id=txn.office_id,
                    item_id=line.item_id,
                    location_id=dest_loc,
                    available_qty=0.00,
                    allocated_qty=0.00,
                    in_vendor_rma_qty=0.00,
                    disposed_qty=0.00,
                )
                db.add(balance)

            balance.allocated_qty = max(Decimal("0.00"), Decimal(str(balance.allocated_qty or 0)) - Decimal(str(return_qty)))

            cond = (line.condition_observed or "GOOD").upper()
            if cond in ["NEW", "GOOD", "FAIR"]:
                balance.available_qty = Decimal(str(balance.available_qty or 0)) + Decimal(str(return_qty))
                if item.item_type == "DURABLE_ASSET":
                    item.operational_status = "AVAILABLE_IN_STORE"
                    item.current_custodian = None
                    item.condition = cond
            else:
                if item.item_type == "DURABLE_ASSET":
                    item.operational_status = "DAMAGED"
                    item.current_custodian = None
                    item.condition = "DAMAGED"

            item.location_id = dest_loc
            item.last_movement_date = today

        txn.status = "POSTED"
        txn.posted_at = datetime.now(timezone.utc)
        db.flush()

        if actor:
            AuditService.log_action(
                db=db,
                action="POST",
                module="STOCK_RETURNS",
                record_id=str(txn.id),
                actor=actor,
                office_id=txn.office_id,
                new_values={"voucher": txn.transaction_number, "status": "POSTED"},
            )
        db.commit()
        db.refresh(txn)
        return txn

    # 4. Stock Transfers
    @staticmethod
    def create_transfer(db: Session, payload: TransferCreate, actor: Optional[User] = None, creator: Optional[User] = None) -> StockTransaction:
        user = creator or actor
        src_office_id = payload.source_office_id or (user.office_id if user else None)
        if not src_office_id:
            first_off = db.query(Office).first()
            src_office_id = first_off.id if first_off else None

        dest_office_id = payload.destination_office_id
        if not dest_office_id and payload.destination_office:
            target_off = db.query(Office).filter(Office.name.ilike(f"%{payload.destination_office.strip()}%")).first()
            if target_off:
                dest_office_id = target_off.id

        if not dest_office_id:
            other_off = db.query(Office).filter(Office.id != src_office_id).first()
            dest_office_id = other_off.id if other_off else src_office_id

        src_loc_id = payload.source_location_id
        if not src_loc_id:
            loc = db.query(Location).filter(Location.office_id == src_office_id).first()
            if loc:
                src_loc_id = loc.id

        dest_loc_id = payload.destination_location_id
        if not dest_loc_id:
            loc = db.query(Location).filter(Location.office_id == dest_office_id).first()
            if loc:
                dest_loc_id = loc.id

        if payload.idempotency_key:
            existing = db.query(StockTransaction).filter(StockTransaction.idempotency_key == payload.idempotency_key).first()
            if existing:
                return existing

        txn_no = LedgerService.generate_transaction_number(db, "TRANSFER")
        raw_lines = payload.lines or payload.items or []
        if not raw_lines:
            raise ValidationError("A transfer request must have at least one line item.", code="EMPTY_LINES")

        lines = []
        for line_data in raw_lines:
            item_id = line_data.item_id
            item = db.query(Item).filter(Item.id == item_id).first()
            if not item:
                raise NotFoundError(f"Item '{item_id}' not found", code="ITEM_NOT_FOUND")

            qty = float(line_data.quantity or 1.0)
            u_cost = float(item.unit_purchase_cost)
            t_cost = round(u_cost * qty, 2)

            line = StockTransactionLine(
                item_id=item.id,
                quantity=qty,
                cumulative_returned_qty=0.00,
                unit_cost=u_cost,
                total_cost=t_cost,
                condition_observed=item.condition,
                remarks=line_data.remarks,
            )
            lines.append(line)

        ref_doc = payload.order_reference
        reason_str = payload.reason
        if payload.transfer_type:
            reason_str = f"Type: {payload.transfer_type} | {reason_str or ''}".strip(" |")

        actor_id = user.id if user else None
        if not actor_id:
            first_user = db.query(User).first()
            actor_id = first_user.id if first_user else None

        txn = StockTransaction(
            transaction_number=txn_no,
            idempotency_key=payload.idempotency_key,
            transaction_type="TRANSFER",
            office_id=src_office_id,
            source_office_id=src_office_id,
            destination_office_id=dest_office_id,
            source_location_id=src_loc_id,
            destination_location_id=dest_loc_id,
            status="SUBMITTED",
            actor_id=actor_id,
            reference_document=ref_doc,
            remarks=reason_str,
            lines=lines,
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return txn

    @staticmethod
    def approve_transfer(db: Session, transaction_id: UUID, remarks: Optional[str] = None, approver: Optional[User] = None) -> StockTransaction:
        txn = LedgerService.get_transaction(db, transaction_id)
        if txn.status != "SUBMITTED":
            raise ValidationError(f"Cannot approve transfer in status '{txn.status}'")

        txn.status = "APPROVED"
        if remarks:
            txn.remarks = f"{txn.remarks or ''} | Approval: {remarks}"

        db.flush()
        if approver:
            AuditService.log_action(
                db=db,
                action="APPROVE",
                module="STOCK_TRANSFERS",
                record_id=str(txn.id),
                actor=approver,
                office_id=txn.office_id,
                new_values={"status": "APPROVED"},
            )
        db.commit()
        db.refresh(txn)
        return txn

    @staticmethod
    def complete_transfer(
        db: Session,
        transaction_id: UUID,
        remarks: Optional[str] = None,
        destination_location_id: Optional[UUID] = None,
        receiver: Optional[User] = None,
    ) -> StockTransaction:
        txn = LedgerService.get_transaction(db, transaction_id)
        if txn.status not in ["APPROVED", "SUBMITTED"]:
            raise ValidationError(f"Cannot complete transfer in status '{txn.status}'")

        dest_loc_id = destination_location_id or txn.destination_location_id
        today = datetime.now(timezone.utc).date()

        for line in txn.lines:
            item = db.query(Item).filter(Item.id == line.item_id).first()

            src_bal = (
                db.query(StockBalance)
                .filter(
                    StockBalance.office_id == txn.source_office_id,
                    StockBalance.item_id == line.item_id,
                    StockBalance.location_id == txn.source_location_id,
                )
                .with_for_update()
                .first()
            )
            if not src_bal or float(src_bal.available_qty) < float(line.quantity):
                raise InsufficientStockError("Insufficient available quantity at source location to complete transfer")

            src_bal.available_qty = Decimal(str(src_bal.available_qty)) - Decimal(str(line.quantity))

            dest_bal = (
                db.query(StockBalance)
                .filter(
                    StockBalance.office_id == txn.destination_office_id,
                    StockBalance.item_id == line.item_id,
                    StockBalance.location_id == dest_loc_id,
                )
                .with_for_update()
                .first()
            )
            if not dest_bal:
                dest_bal = StockBalance(
                    office_id=txn.destination_office_id,
                    item_id=line.item_id,
                    location_id=dest_loc_id,
                    available_qty=0.00,
                    allocated_qty=0.00,
                    in_vendor_rma_qty=0.00,
                    disposed_qty=0.00,
                )
                db.add(dest_bal)

            dest_bal.available_qty = Decimal(str(dest_bal.available_qty or 0)) + Decimal(str(line.quantity))

            if item.item_type == "DURABLE_ASSET":
                item.office_id = txn.destination_office_id
                item.location_id = dest_loc_id
            item.last_movement_date = today

        txn.status = "POSTED"
        txn.posted_at = datetime.now(timezone.utc)
        if remarks:
            txn.remarks = f"{txn.remarks or ''} | Completed: {remarks}"

        db.flush()
        if receiver:
            AuditService.log_action(
                db=db,
                action="COMPLETE",
                module="STOCK_TRANSFERS",
                record_id=str(txn.id),
                actor=receiver,
                office_id=txn.destination_office_id,
                new_values={"status": "POSTED"},
            )
        db.commit()
        db.refresh(txn)
        return txn

    # 5. Offsetting Reversal & Correction Voucher
    @staticmethod
    def create_reversal_voucher(
        db: Session,
        transaction_id: UUID,
        reversal_reason: str,
        actor: Optional[User] = None,
    ) -> StockTransaction:
        orig_txn = LedgerService.get_transaction(db, transaction_id)
        if orig_txn.status != "POSTED":
            raise ValidationError("Only POSTED transactions can be reversed.")
        if orig_txn.transaction_type == "REVERSAL_CORRECTION":
            raise ValidationError("A reversal voucher cannot be reversed.")

        already_reversed = (
            db.query(StockTransaction)
            .filter(
                StockTransaction.original_transaction_id == orig_txn.id,
                StockTransaction.transaction_type == "REVERSAL_CORRECTION",
            )
            .first()
        )
        if already_reversed:
            raise ConflictError(
                f"Transaction {orig_txn.transaction_number} was already reversed by {already_reversed.transaction_number}"
            )

        rev_no = LedgerService.generate_transaction_number(db, "REVERSAL_CORRECTION")
        lines = []

        for orig_line in orig_txn.lines:
            line = StockTransactionLine(
                item_id=orig_line.item_id,
                original_line_id=orig_line.id,
                quantity=orig_line.quantity,
                cumulative_returned_qty=0.00,
                unit_cost=float(orig_line.unit_cost),
                total_cost=float(orig_line.total_cost),
                condition_observed=orig_line.condition_observed,
                remarks=f"Reversal of line {orig_line.id}",
            )
            lines.append(line)

            item = db.query(Item).filter(Item.id == orig_line.item_id).first()
            balance = (
                db.query(StockBalance)
                .filter(
                    StockBalance.office_id == orig_txn.office_id,
                    StockBalance.item_id == orig_line.item_id,
                    StockBalance.location_id == (orig_txn.source_location_id or orig_txn.destination_location_id or item.location_id),
                )
                .with_for_update()
                .first()
            )

            if orig_txn.transaction_type == "RECEIPT":
                if balance:
                    balance.available_qty = max(Decimal("0.00"), Decimal(str(balance.available_qty or 0)) - Decimal(str(orig_line.quantity)))
            elif orig_txn.transaction_type == "ISSUE":
                if balance:
                    balance.available_qty = Decimal(str(balance.available_qty or 0)) + Decimal(str(orig_line.quantity))
                    balance.allocated_qty = max(Decimal("0.00"), Decimal(str(balance.allocated_qty or 0)) - Decimal(str(orig_line.quantity)))
                if item.item_type == "DURABLE_ASSET":
                    item.operational_status = "AVAILABLE_IN_STORE"
                    item.current_custodian = None

        rev_txn = StockTransaction(
            transaction_number=rev_no,
            transaction_type="REVERSAL_CORRECTION",
            office_id=orig_txn.office_id,
            original_transaction_id=orig_txn.id,
            reference_document=orig_txn.transaction_number,
            status="POSTED",
            actor_id=actor.id if actor else orig_txn.actor_id,
            reversal_reason=reversal_reason.strip(),
            remarks=f"Offsetting correction voucher reversing {orig_txn.transaction_number}. Reason: {reversal_reason}",
            posted_at=datetime.now(timezone.utc),
            lines=lines,
        )
        db.add(rev_txn)
        db.flush()

        if actor:
            AuditService.log_action(
                db=db,
                action="REVERSAL",
                module="STOCK_TRANSACTIONS",
                record_id=str(rev_txn.id),
                actor=actor,
                office_id=rev_txn.office_id,
                new_values={
                    "reversal_voucher": rev_txn.transaction_number,
                    "reversed_voucher": orig_txn.transaction_number,
                    "reason": reversal_reason,
                },
            )
        db.commit()
        db.refresh(rev_txn)
        return rev_txn

    # Alias for router compatibility
    reversal_voucher = create_reversal_voucher
