"""Physical Verification Service

Implements audit session setup, expected inventory snapshots, scan event logging,
duplicate scan detection, and reconciliation workflows.
"""

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import ConflictError, NotFoundError, OfficeAccessDeniedError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.services import AuditService
from app.features.inventory.models import Item, StockBalance
from app.features.locations.models import Location
from app.features.users.models import User
from app.features.verification.models import VerificationItem, VerificationScanEvent, VerificationSession
from app.features.verification.schemas import (
    VerificationCompleteRequest,
    VerificationReconcileRequest,
    VerificationScanRequest,
    VerificationScanResponse,
    VerificationSessionCreate,
)


class VerificationService:
    @staticmethod
    def generate_session_number(db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        count = db.query(VerificationSession).filter(VerificationSession.session_number.like(f"PVS-{current_year}-%")).count()
        return f"PVS-{current_year}-{count + 1:05d}"

    @staticmethod
    def get_session(db: Session, session_id: UUID) -> VerificationSession:
        sess = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
        if not sess:
            raise NotFoundError(f"Verification session '{session_id}' not found", code="SESSION_NOT_FOUND")

        sess.total_expected_items = db.query(VerificationItem).filter(VerificationItem.session_id == sess.id).count()
        sess.total_scanned_items = db.query(VerificationItem).filter(VerificationItem.session_id == sess.id, VerificationItem.counted_qty > 0).count()
        sess.discrepancy_count = db.query(VerificationItem).filter(
            VerificationItem.session_id == sess.id,
            VerificationItem.discrepancy_type != "NONE",
            VerificationItem.resolution_status == "PENDING",
        ).count()
        return sess

    @staticmethod
    def list_sessions(
        db: Session,
        office_id: Optional[UUID] = None,
        status: Optional[str] = None,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[VerificationSession], int]:
        query = db.query(VerificationSession)

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(VerificationSession.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(VerificationSession.office_id == office_id)

        if status:
            query = query.filter(VerificationSession.status == status.upper())

        total = query.count()
        sessions = query.order_by(VerificationSession.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

        for s in sessions:
            s.total_expected_items = db.query(VerificationItem).filter(VerificationItem.session_id == s.id).count()
            s.total_scanned_items = db.query(VerificationItem).filter(VerificationItem.session_id == s.id, VerificationItem.counted_qty > 0).count()
            s.discrepancy_count = db.query(VerificationItem).filter(
                VerificationItem.session_id == s.id,
                VerificationItem.discrepancy_type != "NONE",
                VerificationItem.resolution_status == "PENDING",
            ).count()

        return sessions, total

    @staticmethod
    def create_session(
        db: Session,
        payload: VerificationSessionCreate,
        lead_verifier: User,
    ) -> VerificationSession:
        if ROLE_SYSTEM_ADMIN not in lead_verifier.role_names and payload.office_id != lead_verifier.office_id:
            raise OfficeAccessDeniedError("Cannot start a verification session outside your office")

        session_no = VerificationService.generate_session_number(db)
        session = VerificationSession(
            session_number=session_no,
            office_id=payload.office_id,
            scope_type=payload.scope_type,
            location_id=payload.location_id,
            category_id=payload.category_id,
            status="IN_PROGRESS",
            notes=payload.notes,
            lead_verifier_id=lead_verifier.id,
            started_at=datetime.now(timezone.utc),
        )
        db.add(session)
        db.flush()

        # Freeze baseline snapshot into verification_items
        query = db.query(Item).filter(Item.office_id == payload.office_id, Item.operational_status != "DISPOSED")
        if payload.scope_type == "LOCATION" and payload.location_id:
            query = query.filter(Item.location_id == payload.location_id)
        elif payload.scope_type == "CATEGORY" and payload.category_id:
            query = query.filter(Item.category_id == payload.category_id)

        candidate_items = query.all()
        for it in candidate_items:
            expected_qty = 1.00 if it.item_type == "DURABLE_ASSET" else 0.00
            bal = db.query(StockBalance).filter(StockBalance.item_id == it.id, StockBalance.location_id == it.location_id).first()
            if bal:
                expected_qty = float(bal.available_qty + bal.allocated_qty)

            v_item = VerificationItem(
                session_id=session.id,
                office_id=payload.office_id,
                item_id=it.id,
                expected_location_id=it.location_id,
                expected_condition=it.condition,
                expected_qty=expected_qty,
                counted_qty=0.00,
                discrepancy_type="NONE",
                resolution_status="PENDING",
            )
            db.add(v_item)

        db.flush()
        AuditService.log_action(
            db=db,
            action="CREATE",
            module="VERIFICATION",
            record_id=str(session.id),
            actor=lead_verifier,
            office_id=session.office_id,
            new_values={"session_number": session.session_number, "baseline_items": len(candidate_items)},
        )
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def process_scan(
        db: Session,
        session_id: UUID,
        payload: VerificationScanRequest,
        scanner_user: User,
    ) -> VerificationScanResponse:
        session = VerificationService.get_session(db, session_id)
        if session.status != "IN_PROGRESS":
            raise ValidationError(f"Cannot record scans for session in status '{session.status}'")

        barcode = payload.scanned_barcode.strip()

        # 1. Check duplicate scan detection
        existing_scan = (
            db.query(VerificationScanEvent)
            .filter(
                VerificationScanEvent.session_id == session.id,
                VerificationScanEvent.scanned_barcode == barcode,
            )
            .first()
        )
        is_duplicate = existing_scan is not None

        # 2. Resolve barcode to item
        item = (
            db.query(Item)
            .filter(
                (Item.barcode_number == barcode) | (Item.item_code == barcode) | (Item.serial_number == barcode),
                Item.office_id == session.office_id,
            )
            .first()
        )

        scan_result = "MATCHED_VERIFIED"
        discrepancy = None
        matched_item_id = item.id if item else None
        item_code = item.item_code if item else None
        item_name = item.item_name if item else None

        if is_duplicate:
            scan_result = "DUPLICATE_SCAN_REPEATED"
            discrepancy = "DUPLICATE_SUSPECTED"
            msg = f"Repeated scan detected for barcode '{barcode}'!"
        elif not item:
            scan_result = "UNKNOWN_BARCODE"
            discrepancy = "UNEXPECTED_ITEM"
            msg = f"Unregistered or foreign barcode '{barcode}' scanned!"
        else:
            # Check baseline snapshot item
            v_item = (
                db.query(VerificationItem)
                .filter(VerificationItem.session_id == session.id, VerificationItem.item_id == item.id)
                .first()
            )

            if not v_item:
                # Scanned item is outside session scope
                scan_result = "UNEXPECTED_ITEM"
                discrepancy = "UNEXPECTED_ITEM"
                msg = f"Item '{item.item_code}' is not part of this session's expected baseline scope."
                # Add it to verification items with discrepancy
                v_item = VerificationItem(
                    session_id=session.id,
                    office_id=session.office_id,
                    item_id=item.id,
                    expected_location_id=item.location_id,
                    observed_location_id=payload.scanned_location_id,
                    expected_condition=item.condition,
                    observed_condition=payload.observed_condition,
                    expected_qty=0.00,
                    counted_qty=payload.counted_quantity,
                    discrepancy_type="UNEXPECTED_ITEM",
                    resolution_status="PENDING",
                    verified_by=scanner_user.id,
                    verified_at=datetime.now(timezone.utc),
                )
                db.add(v_item)
            else:
                # Compare attributes
                v_item.observed_location_id = payload.scanned_location_id
                v_item.observed_condition = payload.observed_condition
                v_item.counted_qty = float(v_item.counted_qty) + float(payload.counted_quantity)
                v_item.verified_by = scanner_user.id
                v_item.verified_at = datetime.now(timezone.utc)

                if payload.scanned_location_id != v_item.expected_location_id:
                    scan_result = "LOCATION_MISMATCH"
                    discrepancy = "LOCATION_MISMATCH"
                    v_item.discrepancy_type = "LOCATION_MISMATCH"
                    msg = f"Location mismatch: expected in {v_item.expected_location.room_number if v_item.expected_location else 'N/A'}"
                elif payload.observed_condition != v_item.expected_condition:
                    scan_result = "CONDITION_MISMATCH"
                    discrepancy = "CONDITION_MISMATCH"
                    v_item.discrepancy_type = "CONDITION_MISMATCH"
                    msg = f"Condition changed from '{v_item.expected_condition}' to '{payload.observed_condition}'"
                else:
                    scan_result = "MATCHED_VERIFIED"
                    v_item.discrepancy_type = "NONE"
                    v_item.resolution_status = "RESOLVED"
                    msg = f"Item '{item.item_code}' verified successfully."

        # Insert into verification_scan_events
        scan_event = VerificationScanEvent(
            session_id=session.id,
            office_id=session.office_id,
            scanned_barcode=barcode,
            item_id=matched_item_id,
            scanned_location_id=payload.scanned_location_id,
            observed_condition=payload.observed_condition,
            counted_quantity=payload.counted_quantity,
            scan_result=scan_result,
            is_duplicate_scan=is_duplicate,
            scanned_by=scanner_user.id,
            device_info=payload.device_info,
            remarks=payload.remarks,
        )
        db.add(scan_event)
        db.commit()

        return VerificationScanResponse(
            scan_result=scan_result,
            is_duplicate_scan=is_duplicate,
            matched_item_id=matched_item_id,
            item_code=item_code,
            item_name=item_name,
            discrepancy_detected=discrepancy,
            message=msg,
        )

    @staticmethod
    def list_session_scans(
        db: Session,
        session_id: UUID,
        scan_result: Optional[str] = None,
        is_duplicate: Optional[bool] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[VerificationScanEvent], int]:
        query = db.query(VerificationScanEvent).filter(VerificationScanEvent.session_id == session_id)
        if scan_result:
            query = query.filter(VerificationScanEvent.scan_result == scan_result.upper())
        if is_duplicate is not None:
            query = query.filter(VerificationScanEvent.is_duplicate_scan == is_duplicate)

        total = query.count()
        scans = query.order_by(VerificationScanEvent.scanned_at.desc()).offset((page - 1) * limit).limit(limit).all()
        return scans, total

    @staticmethod
    def reconcile_discrepancies(
        db: Session,
        session_id: UUID,
        payload: VerificationReconcileRequest,
        officer: User,
    ) -> VerificationSession:
        session = VerificationService.get_session(db, session_id)

        for res in payload.resolutions:
            v_item = (
                db.query(VerificationItem)
                .filter(VerificationItem.id == res.verification_item_id, VerificationItem.session_id == session.id)
                .first()
            )
            if v_item:
                v_item.resolution_status = res.resolution_status
                v_item.resolution_remarks = res.remarks.strip()

                # If location mismatch resolved, update item's actual location
                if v_item.discrepancy_type == "LOCATION_MISMATCH" and v_item.observed_location_id:
                    item = db.query(Item).filter(Item.id == v_item.item_id).first()
                    if item:
                        item.location_id = v_item.observed_location_id

        session.status = "UNDER_REVIEW"
        db.flush()

        AuditService.log_action(
            db=db,
            action="RECONCILE",
            module="VERIFICATION",
            record_id=str(session.id),
            actor=officer,
            office_id=session.office_id,
            new_values={"resolved_items_count": len(payload.resolutions)},
        )
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def complete_session(
        db: Session,
        session_id: UUID,
        payload: VerificationCompleteRequest,
        officer: User,
    ) -> VerificationSession:
        session = VerificationService.get_session(db, session_id)
        if session.status == "COMPLETED":
            raise ValidationError("Session is already completed.")

        # Flag any remaining unscanned items as NOT_FOUND
        unscanned_items = (
            db.query(VerificationItem)
            .filter(
                VerificationItem.session_id == session.id,
                VerificationItem.counted_qty == 0.00,
                VerificationItem.discrepancy_type == "NONE",
            )
            .all()
        )
        for un in unscanned_items:
            un.discrepancy_type = "NOT_FOUND"

        session.status = "COMPLETED"
        session.completed_at = datetime.now(timezone.utc)
        session.notes = f"{session.notes or ''} | Conclusion: {payload.summary_remarks}"

        db.flush()
        AuditService.log_action(
            db=db,
            action="COMPLETE",
            module="VERIFICATION",
            record_id=str(session.id),
            actor=officer,
            office_id=session.office_id,
            new_values={"status": "COMPLETED", "summary": payload.summary_remarks},
        )
        db.commit()
        db.refresh(session)
        return session

