"""Disposal Management Service

Executes auction/scrap write-offs, derecognizes assets, posts ledger entries, and records sale revenue.
"""

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import ConflictError, NotFoundError, OfficeAccessDeniedError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.services import AuditService
from app.features.condemnation.models import CondemnationRequest
from app.features.disposal.models import Disposal, DisposalItem
from app.features.disposal.schemas import DisposalCreate
from app.features.inventory.models import Item, StockBalance
from app.features.ledger.models import StockTransaction, StockTransactionLine
from app.features.users.models import User


class DisposalService:
    @staticmethod
    def generate_disposal_number(db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        count = db.query(Disposal).filter(Disposal.disposal_number.like(f"DSP-{current_year}-%")).count()
        return f"DSP-{current_year}-{count + 1:05d}"

    @staticmethod
    def get_disposal(db: Session, disposal_id: UUID) -> Disposal:
        disp = db.query(Disposal).filter(Disposal.id == disposal_id).first()
        if not disp:
            raise NotFoundError(f"Disposal voucher '{disposal_id}' was not found", code="DISPOSAL_NOT_FOUND")
        return disp

    @staticmethod
    def list_disposals(
        db: Session,
        office_id: Optional[UUID] = None,
        disposal_method: Optional[str] = None,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Disposal], int]:
        query = db.query(Disposal)

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(Disposal.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(Disposal.office_id == office_id)

        if disposal_method:
            query = query.filter(Disposal.disposal_method == disposal_method.upper())

        total = query.count()
        disposals = query.order_by(Disposal.disposal_date.desc()).offset((page - 1) * limit).limit(limit).all()
        return disposals, total

    @staticmethod
    def execute_disposal(db: Session, payload: DisposalCreate, executor: User) -> Disposal:
        if ROLE_SYSTEM_ADMIN not in executor.role_names and payload.office_id != executor.office_id:
            raise OfficeAccessDeniedError("Cannot execute disposal outside your assigned office")

        # 1. Verify condemnation request is APPROVED
        request = (
            db.query(CondemnationRequest)
            .filter(CondemnationRequest.id == payload.request_id)
            .first()
        )
        if not request:
            raise NotFoundError("Condemnation proposal not found", code="CONDEMNATION_NOT_FOUND")
        if request.status != "APPROVED":
            raise ValidationError(
                f"Cannot execute disposal for proposal in status '{request.status}'. Proposal must be APPROVED first."
            )
        if request.disposal is not None:
            raise ConflictError("Disposal has already been executed for this proposal", code="DUPLICATE_DISPOSAL")

        disp_no = DisposalService.generate_disposal_number(db)
        disposal = Disposal(
            disposal_number=disp_no,
            request_id=payload.request_id,
            office_id=payload.office_id,
            disposal_method=payload.disposal_method,
            disposal_date=payload.disposal_date,
            total_sale_proceeds=payload.total_sale_proceeds,
            recipient_agency=payload.recipient_agency.strip(),
            reference_order_number=payload.reference_order_number.strip(),
            certificate_document_id=payload.certificate_document_id,
            executed_by=executor.id,
        )
        db.add(disposal)
        db.flush()

        # Create movement ledger write-off voucher
        current_year = datetime.now(timezone.utc).year
        cnt = db.query(StockTransaction).filter(StockTransaction.transaction_number.like(f"DSP-{current_year}-%")).count()
        ledger_txn = StockTransaction(
            transaction_number=f"DSP-{current_year}-{cnt + 1:05d}",
            transaction_type="DISPOSAL_WRITEOFF",
            office_id=payload.office_id,
            reference_document=payload.reference_order_number,
            status="POSTED",
            actor_id=executor.id,
            remarks=f"Disposal execution via {payload.disposal_method} to {payload.recipient_agency}. Proceeds: ₹{payload.total_sale_proceeds}",
            posted_at=datetime.now(timezone.utc),
        )
        db.add(ledger_txn)
        db.flush()

        # Process each item
        for it_data in payload.items:
            item = db.query(Item).filter(Item.id == it_data.item_id).first()
            if not item:
                raise NotFoundError(f"Item '{it_data.item_id}' not found", code="ITEM_NOT_FOUND")

            # Mark item permanently DISPOSED
            item.operational_status = "DISPOSED"

            # Adjust stock balances
            balance = (
                db.query(StockBalance)
                .filter(StockBalance.item_id == item.id, StockBalance.office_id == payload.office_id)
                .with_for_update()
                .first()
            )
            if balance:
                balance.available_qty = max(0.00, float(balance.available_qty) - float(it_data.disposed_qty))
                balance.disposed_qty += it_data.disposed_qty

            # Add disposal item line
            d_item = DisposalItem(
                disposal_id=disposal.id,
                item_id=item.id,
                disposed_qty=it_data.disposed_qty,
                realized_amount=it_data.realized_amount,
            )
            db.add(d_item)

            # Add ledger line
            line = StockTransactionLine(
                transaction_id=ledger_txn.id,
                item_id=item.id,
                quantity=it_data.disposed_qty,
                unit_cost=float(item.unit_purchase_cost),
                total_cost=float(it_data.realized_amount),
                condition_observed="SCRAP",
                remarks=f"Derecognized via {payload.disposal_method}",
            )
            db.add(line)

        # Mark condemnation request DISPOSED
        request.status = "DISPOSED"
        db.flush()

        AuditService.log_action(
            db=db,
            action="DISPOSE",
            module="DISPOSAL",
            record_id=str(disposal.id),
            actor=executor,
            office_id=disposal.office_id,
            new_values={
                "disposal_number": disposal.disposal_number,
                "method": disposal.disposal_method,
                "proceeds": float(disposal.total_sale_proceeds),
                "items_count": len(payload.items),
            },
        )
        db.commit()
        db.refresh(disposal)
        return disposal

