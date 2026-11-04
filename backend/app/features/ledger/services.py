"""Inventory Movement Ledger Service

Manages immutable stock transaction vouchers: Receipts, Issues, Returns, Transfers, and Reversals.
Enforces atomic row locking, positive balance integrity, and audit traceability.
"""

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID
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
from app.features.inventory.models import Item, StockBalance
from app.features.ledger.models import StockTransaction, StockTransactionLine
from app.features.ledger.schemas import (
    IssueCreate,
    ReceiptCreate,
    ReturnCreate,
    TransferCreate,
)
from app.features.locations.models import Location
from app.features.procurement.models import Procurement, ProcurementItem
from app.features.users.models import User


class LedgerService:
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
        if status:
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
    def create_receipt(db: Session, payload: ReceiptCreate, creator: User) -> StockTransaction:
        if ROLE_SYSTEM_ADMIN not in creator.role_names and payload.office_id != creator.office_id:
            raise OfficeAccessDeniedError("Cannot create receipt for an office other than your assigned office")

        if payload.idempotency_key:
            existing = db.query(StockTransaction).filter(StockTransaction.idempotency_key == payload.idempotency_key).first()
            if existing:
                return existing

        txn_no = LedgerService.generate_transaction_number(db, "RECEIPT")
        lines = []
        for line_data in payload.lines:
            item = db.query(Item).filter(Item.id == line_data.item_id).first()
            if not item:
                raise NotFoundError(f"Item '{line_data.item_id}' not found", code="ITEM_NOT_FOUND")
            if item.office_id != payload.office_id:
                raise ConflictError("Item belongs to another office")

            unit_cost = line_data.unit_cost or float(item.unit_purchase_cost)
            total_cost = round(unit_cost * float(line_data.quantity), 2)

            line = StockTransactionLine(
                item_id=line_data.item_id,
                procurement_item_id=line_data.procurement_item_id,
                quantity=line_data.quantity,
                cumulative_returned_qty=0.00,
                unit_cost=unit_cost,
                total_cost=total_cost,
                condition_observed=line_data.condition_observed or item.condition,
                remarks=line_data.remarks,
            )
            lines.append(line)

        txn = StockTransaction(
            transaction_number=txn_no,
            idempotency_key=payload.idempotency_key,
            transaction_type="RECEIPT",
            office_id=payload.office_id,
            reference_document=payload.reference_document,
            status="DRAFT",
            actor_id=creator.id,
            remarks=payload.remarks,
            lines=lines,
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return txn

    @staticmethod
    def post_receipt(db: Session, transaction_id: UUID, actor: User) -> StockTransaction:
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

                    # Check header fulfillment
                    proc = db.query(Procurement).filter(Procurement.id == proc_item.procurement_id).first()
                    if proc:
                        all_fulfilled = all(
                            float(it.quantity_received) >= float(it.quantity_ordered) for it in proc.items
                        )
                        proc.status = "FULLY_RECEIVED" if all_fulfilled else "PARTIALLY_RECEIVED"

            # Update stock balances with row lock
            balance = (
                db.query(StockBalance)
                .filter(
                    StockBalance.office_id == txn.office_id,
                    StockBalance.item_id == line.item_id,
                    StockBalance.location_id == item.location_id,
                )
                .with_for_update()
                .first()
            )
            if not balance:
                balance = StockBalance(
                    office_id=txn.office_id,
                    item_id=line.item_id,
                    location_id=item.location_id,
                    available_qty=0.00,
                    allocated_qty=0.00,
                    in_vendor_rma_qty=0.00,
                    disposed_qty=0.00,
                )
                db.add(balance)

            balance.available_qty += line.quantity
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
    def create_issue(db: Session, payload: IssueCreate, creator: User) -> StockTransaction:
        if ROLE_SYSTEM_ADMIN not in creator.role_names and payload.office_id != creator.office_id:
            raise OfficeAccessDeniedError("Cannot create stock issue for an office other than your assigned office")

        if payload.idempotency_key:
            existing = db.query(StockTransaction).filter(StockTransaction.idempotency_key == payload.idempotency_key).first()
            if existing:
                return existing

        txn_no = LedgerService.generate_transaction_number(db, "ISSUE")
        lines = []
        for line_data in payload.lines:
            item = db.query(Item).filter(Item.id == line_data.item_id).first()
            if not item:
                raise NotFoundError(f"Item '{line_data.item_id}' not found", code="ITEM_NOT_FOUND")
            if item.office_id != payload.office_id:
                raise ConflictError("Item belongs to another office")

            line = StockTransactionLine(
                item_id=line_data.item_id,
                quantity=line_data.quantity,
                cumulative_returned_qty=0.00,
                unit_cost=float(item.unit_purchase_cost),
                total_cost=round(float(item.unit_purchase_cost) * float(line_data.quantity), 2),
                condition_observed=item.condition,
                remarks=line_data.remarks,
            )
            lines.append(line)

        txn = StockTransaction(
            transaction_number=txn_no,
            idempotency_key=payload.idempotency_key,
            transaction_type="ISSUE",
            office_id=payload.office_id,
            source_location_id=payload.source_location_id,
            recipient_name=payload.recipient_name.strip(),
            recipient_department=payload.recipient_department.strip() if payload.recipient_department else None,
            reference_document=payload.reference_document,
            status="DRAFT",
            actor_id=creator.id,
            remarks=payload.remarks,
            lines=lines,
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return txn

    @staticmethod
    def post_issue(db: Session, transaction_id: UUID, actor: User) -> StockTransaction:
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

            # Concurrency row-level lock on stock balance
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
            if not balance or float(balance.available_qty) < float(line.quantity):
                avail = float(balance.available_qty) if balance else 0.00
                raise InsufficientStockError(
                    f"Requested issue quantity ({line.quantity}) exceeds available balance ({avail}) for '{item.item_name}'."
                )

            # Atomic balance adjustment
            balance.available_qty -= line.quantity
            balance.allocated_qty += line.quantity
            balance.last_reconciled_at = datetime.now(timezone.utc)

            # For durable assets: change operational status and assign custodian
            if item.item_type == "DURABLE_ASSET":
                if item.operational_status != "AVAILABLE_IN_STORE":
                    raise ValidationError(f"Durable asset '{item.item_code}' is currently '{item.operational_status}' and not available for issue.")
                item.operational_status = "IN_USE"
                item.current_custodian = txn.recipient_name
                item.current_department = txn.recipient_department

            item.last_movement_date = today

        txn.status = "POSTED"
        txn.posted_at = datetime.now(timezone.utc)
        db.flush()

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

    # 3. Stock Internal Returns (with Partial & Multiple Return Protection)
    @staticmethod
    def create_return(db: Session, payload: ReturnCreate, creator: User) -> StockTransaction:
        orig_txn = LedgerService.get_transaction(db, payload.original_transaction_id)
        if orig_txn.transaction_type != "ISSUE":
            raise ValidationError("Returns can only be created against an original ISSUE voucher.")

        if payload.idempotency_key:
            existing = db.query(StockTransaction).filter(StockTransaction.idempotency_key == payload.idempotency_key).first()
            if existing:
                return existing

        txn_no = LedgerService.generate_transaction_number(db, "RETURN")
        lines = []
        for line_data in payload.lines:
            if not line_data.original_line_id:
                raise ValidationError("Each return line must link to the original issue line (original_line_id)")

            orig_line = (
                db.query(StockTransactionLine)
                .filter(StockTransactionLine.id == line_data.original_line_id)
                .first()
            )
            if not orig_line or orig_line.transaction_id != orig_txn.id:
                raise NotFoundError("Original issue line not found on referenced transaction")

            item = db.query(Item).filter(Item.id == orig_line.item_id).first()
            line = StockTransactionLine(
                item_id=orig_line.item_id,
                original_line_id=orig_line.id,
                quantity=line_data.quantity,
                cumulative_returned_qty=0.00,
                unit_cost=float(orig_line.unit_cost),
                total_cost=round(float(orig_line.unit_cost) * float(line_data.quantity), 2),
                condition_observed=line_data.condition_observed or item.condition,
                remarks=line_data.remarks,
            )
            lines.append(line)

        txn = StockTransaction(
            transaction_number=txn_no,
            idempotency_key=payload.idempotency_key,
            transaction_type="RETURN",
            office_id=payload.office_id,
            original_transaction_id=orig_txn.id,
            destination_location_id=payload.destination_location_id,
            recipient_name=payload.recipient_name or orig_txn.recipient_name,
            reference_document=payload.reference_document or orig_txn.transaction_number,
            status="DRAFT",
            actor_id=creator.id,
            remarks=payload.remarks,
            lines=lines,
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return txn

    @staticmethod
    def post_return(db: Session, transaction_id: UUID, actor: User) -> StockTransaction:
        txn = LedgerService.get_transaction(db, transaction_id)
        if txn.status == "POSTED":
            raise ImmutableRecordError("Return voucher is already posted and immutable.")

        today = datetime.now(timezone.utc).date()

        for line in txn.lines:
            # Lock original issue line FOR UPDATE to enforce safe partial returns
            orig_line = (
                db.query(StockTransactionLine)
                .filter(StockTransactionLine.id == line.original_line_id)
                .with_for_update()
                .first()
            )
            if not orig_line:
                raise NotFoundError("Original issue line was not found")

            issued_qty = float(orig_line.quantity)
            current_cumul = float(orig_line.cumulative_returned_qty)
            return_qty = float(line.quantity)

            if current_cumul + return_qty > issued_qty:
                max_returnable = issued_qty - current_cumul
                raise ValidationError(
                    f"Return quantity ({return_qty}) exceeds outstanding returnable quantity ({max_returnable}) for line {orig_line.id}",
                    code="EXCEEDS_ISSUED_QUANTITY",
                )

            orig_line.cumulative_returned_qty += return_qty

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

            # Decrement allocated quantity
            balance.allocated_qty = max(0.00, float(balance.allocated_qty) - return_qty)

            cond = (line.condition_observed or "GOOD").upper()
            if cond in ["NEW", "GOOD", "FAIR"]:
                balance.available_qty += return_qty
                if item.item_type == "DURABLE_ASSET":
                    item.operational_status = "AVAILABLE_IN_STORE"
                    item.current_custodian = None
                    item.condition = cond
            else:
                # DAMAGED or SCRAP: not available for issue, route to maintenance or condemnation
                if item.item_type == "DURABLE_ASSET":
                    item.operational_status = "DAMAGED"
                    item.current_custodian = None
                    item.condition = "DAMAGED"

            item.location_id = dest_loc
            item.last_movement_date = today

        txn.status = "POSTED"
        txn.posted_at = datetime.now(timezone.utc)
        db.flush()

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
    def create_transfer(db: Session, payload: TransferCreate, creator: User) -> StockTransaction:
        if ROLE_SYSTEM_ADMIN not in creator.role_names and payload.source_office_id != creator.office_id:
            raise OfficeAccessDeniedError("Cannot transfer stock out of an office other than your assigned office")

        if payload.idempotency_key:
            existing = db.query(StockTransaction).filter(StockTransaction.idempotency_key == payload.idempotency_key).first()
            if existing:
                return existing

        txn_no = LedgerService.generate_transaction_number(db, "TRANSFER")
        lines = []
        for line_data in payload.lines:
            item = db.query(Item).filter(Item.id == line_data.item_id).first()
            if not item:
                raise NotFoundError(f"Item '{line_data.item_id}' not found", code="ITEM_NOT_FOUND")
            if item.office_id != payload.source_office_id:
                raise ConflictError("Item does not belong to the source office")

            line = StockTransactionLine(
                item_id=line_data.item_id,
                quantity=line_data.quantity,
                cumulative_returned_qty=0.00,
                unit_cost=float(item.unit_purchase_cost),
                total_cost=round(float(item.unit_purchase_cost) * float(line_data.quantity), 2),
                condition_observed=item.condition,
                remarks=line_data.remarks,
            )
            lines.append(line)

        txn = StockTransaction(
            transaction_number=txn_no,
            idempotency_key=payload.idempotency_key,
            transaction_type="TRANSFER",
            office_id=payload.source_office_id,
            source_office_id=payload.source_office_id,
            destination_office_id=payload.destination_office_id,
            source_location_id=payload.source_location_id,
            destination_location_id=payload.destination_location_id,
            status="SUBMITTED",
            actor_id=creator.id,
            remarks=payload.reason,
            lines=lines,
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return txn

    @staticmethod
    def approve_transfer(db: Session, transaction_id: UUID, remarks: Optional[str], approver: User) -> StockTransaction:
        txn = LedgerService.get_transaction(db, transaction_id)
        if txn.status != "SUBMITTED":
            raise ValidationError(f"Cannot approve transfer in status '{txn.status}'")

        txn.status = "APPROVED"
        if remarks:
            txn.remarks = f"{txn.remarks or ''} | Approval: {remarks}"

        db.flush()
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
        remarks: Optional[str],
        destination_location_id: Optional[UUID],
        receiver: User,
    ) -> StockTransaction:
        txn = LedgerService.get_transaction(db, transaction_id)
        if txn.status not in ["APPROVED", "SUBMITTED"]:
            raise ValidationError(f"Cannot complete transfer in status '{txn.status}'")

        dest_loc_id = destination_location_id or txn.destination_location_id
        today = datetime.now(timezone.utc).date()

        for line in txn.lines:
            item = db.query(Item).filter(Item.id == line.item_id).first()

            # Deduct from source balance
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

            src_bal.available_qty -= line.quantity

            # Add to destination balance
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

            dest_bal.available_qty += line.quantity

            # If durable asset, update its location & office
            if item.item_type == "DURABLE_ASSET":
                item.office_id = txn.destination_office_id
                item.location_id = dest_loc_id
            item.last_movement_date = today

        txn.status = "POSTED"
        txn.posted_at = datetime.now(timezone.utc)
        if remarks:
            txn.remarks = f"{txn.remarks or ''} | Completed: {remarks}"

        db.flush()
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
        actor: User,
    ) -> StockTransaction:
        orig_txn = LedgerService.get_transaction(db, transaction_id)
        if orig_txn.status != "POSTED":
            raise ValidationError("Only POSTED transactions can be reversed.")
        if orig_txn.transaction_type == "REVERSAL_CORRECTION":
            raise ValidationError("A reversal voucher cannot be reversed.")

        # Check if already reversed
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

            # Reverse the balance effects atomically
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
                    balance.available_qty = max(0.00, float(balance.available_qty) - float(orig_line.quantity))
            elif orig_txn.transaction_type == "ISSUE":
                if balance:
                    balance.available_qty += float(orig_line.quantity)
                    balance.allocated_qty = max(0.00, float(balance.allocated_qty) - float(orig_line.quantity))
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
            actor_id=actor.id,
            reversal_reason=reversal_reason.strip(),
            remarks=f"Offsetting correction voucher reversing {orig_txn.transaction_number}. Reason: {reversal_reason}",
            posted_at=datetime.now(timezone.utc),
            lines=lines,
        )
        db.add(rev_txn)
        db.flush()

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

