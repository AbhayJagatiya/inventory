"""Physical Verification Service

Implements audit session setup, expected inventory snapshots, scan event logging,
duplicate scan detection, live Option B asset updates, and reconciliation workflows.
"""

import csv
import io
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.core.exceptions import NotFoundError, OfficeAccessDeniedError, ValidationError
from app.core.i18n import get_report_title, translate_report_cell, translate_report_header, validate_language
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.services import AuditService
from app.features.categories.models import Category
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


def _format_location_name(loc: Optional[Location]) -> Optional[str]:
    if not loc:
        return None
    if loc.building_name and loc.room_number:
        return f"{loc.building_name} - {loc.room_number}"
    return loc.room_number or loc.building_name


class VerificationService:
    @staticmethod
    def generate_session_number(db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        prefix = f"PVS-{current_year}-"
        count = db.query(VerificationSession).filter(VerificationSession.session_number.like(f"{prefix}%")).count()
        seq = count + 1
        while db.query(VerificationSession).filter(VerificationSession.session_number == f"{prefix}{seq:05d}").first():
            seq += 1
        return f"{prefix}{seq:05d}"

    @staticmethod
    def _enrich_session(db: Session, sess: VerificationSession) -> VerificationSession:
        sess.total_expected_items = db.query(VerificationItem).filter(VerificationItem.session_id == sess.id).count()
        sess.total_scanned_items = (
            db.query(VerificationItem)
            .filter(VerificationItem.session_id == sess.id, VerificationItem.counted_qty > 0)
            .count()
        )
        sess.discrepancy_count = (
            db.query(VerificationItem)
            .filter(
                VerificationItem.session_id == sess.id,
                VerificationItem.discrepancy_type != "NONE",
                VerificationItem.resolution_status == "PENDING",
            )
            .count()
        )
        sess.location_name = _format_location_name(sess.location)
        sess.category_name = sess.category.name if sess.category else None
        sess.lead_verifier_name = sess.lead_verifier.full_name if sess.lead_verifier else None
        return sess

    @staticmethod
    def _enrich_verification_item(v_item: VerificationItem) -> VerificationItem:
        v_item.item_code = v_item.item.item_code if v_item.item else None
        v_item.item_name = v_item.item.item_name if v_item.item else None
        v_item.barcode_number = (v_item.item.barcode_number or v_item.item.item_code) if v_item.item else None
        v_item.item_type = v_item.item.item_type if v_item.item else None
        v_item.expected_location_name = _format_location_name(v_item.expected_location)
        v_item.observed_location_name = _format_location_name(v_item.observed_location)
        v_item.verified_by_name = v_item.verifier.full_name if v_item.verifier else None
        return v_item

    @staticmethod
    def _enrich_scan_event(scan_event: VerificationScanEvent) -> VerificationScanEvent:
        scan_event.item_code = scan_event.item.item_code if scan_event.item else None
        scan_event.item_name = scan_event.item.item_name if scan_event.item else None
        scan_event.scanned_location_name = _format_location_name(scan_event.scanned_location)
        scan_event.scanned_by_name = scan_event.scanner_user.full_name if scan_event.scanner_user else None
        return scan_event

    @staticmethod
    def _sync_item_location_and_balance(db: Session, item: Item, new_location_id: UUID) -> None:
        if item.location_id == new_location_id:
            return

        old_location_id = item.location_id
        if item.item_type == "DURABLE_ASSET":
            old_bal = (
                db.query(StockBalance)
                .filter(
                    StockBalance.office_id == item.office_id,
                    StockBalance.item_id == item.id,
                    StockBalance.location_id == old_location_id,
                )
                .first()
            )
            target_bal = (
                db.query(StockBalance)
                .filter(
                    StockBalance.office_id == item.office_id,
                    StockBalance.item_id == item.id,
                    StockBalance.location_id == new_location_id,
                )
                .first()
            )
            now = datetime.now(timezone.utc)
            if old_bal and target_bal:
                target_bal.available_qty = float(target_bal.available_qty or 0) + float(old_bal.available_qty or 0)
                target_bal.allocated_qty = float(target_bal.allocated_qty or 0) + float(old_bal.allocated_qty or 0)
                target_bal.in_vendor_rma_qty = float(target_bal.in_vendor_rma_qty or 0) + float(old_bal.in_vendor_rma_qty or 0)
                target_bal.disposed_qty = float(target_bal.disposed_qty or 0) + float(old_bal.disposed_qty or 0)
                target_bal.last_reconciled_at = now
                db.delete(old_bal)
            elif old_bal:
                old_bal.location_id = new_location_id
                old_bal.last_reconciled_at = now

        item.location_id = new_location_id

    @staticmethod
    def get_session(db: Session, session_id: UUID) -> VerificationSession:
        sess = (
            db.query(VerificationSession)
            .options(
                joinedload(VerificationSession.location),
                joinedload(VerificationSession.category),
                joinedload(VerificationSession.lead_verifier),
            )
            .filter(VerificationSession.id == session_id)
            .first()
        )
        if not sess:
            raise NotFoundError(f"Verification session '{session_id}' not found", code="SESSION_NOT_FOUND")

        return VerificationService._enrich_session(db, sess)

    @staticmethod
    def list_sessions(
        db: Session,
        office_id: Optional[UUID] = None,
        status: Optional[str] = None,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[VerificationSession], int]:
        query = db.query(VerificationSession).options(
            joinedload(VerificationSession.location),
            joinedload(VerificationSession.category),
            joinedload(VerificationSession.lead_verifier),
        )

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(VerificationSession.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(VerificationSession.office_id == office_id)

        if status:
            query = query.filter(VerificationSession.status == status.upper())

        total = query.count()
        sessions = query.order_by(VerificationSession.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

        for s in sessions:
            VerificationService._enrich_session(db, s)

        return sessions, total

    @staticmethod
    def list_session_items(
        db: Session,
        session_id: UUID,
        discrepancy_only: bool = False,
        discrepancy_type: Optional[str] = None,
        resolution_status: Optional[str] = None,
    ) -> List[VerificationItem]:
        query = (
            db.query(VerificationItem)
            .options(
                joinedload(VerificationItem.item),
                joinedload(VerificationItem.expected_location),
                joinedload(VerificationItem.observed_location),
                joinedload(VerificationItem.verifier),
            )
            .filter(VerificationItem.session_id == session_id)
        )
        if discrepancy_only:
            query = query.filter(VerificationItem.discrepancy_type != "NONE")
        if discrepancy_type:
            query = query.filter(VerificationItem.discrepancy_type == discrepancy_type.upper())
        if resolution_status:
            query = query.filter(VerificationItem.resolution_status == resolution_status.upper())

        items = query.all()
        for v_item in items:
            VerificationService._enrich_verification_item(v_item)
        return items

    @staticmethod
    def create_session(
        db: Session,
        payload: VerificationSessionCreate,
        lead_verifier: User,
    ) -> VerificationSession:
        if ROLE_SYSTEM_ADMIN not in lead_verifier.role_names and payload.office_id != lead_verifier.office_id:
            raise OfficeAccessDeniedError("Cannot start a verification session outside your office")

        if payload.scope_type == "LOCATION":
            if not payload.location_id:
                raise ValidationError("location_id is required when scope_type is LOCATION.")
            loc = db.query(Location).filter(Location.id == payload.location_id).first()
            if not loc:
                raise NotFoundError("Selected location was not found", code="LOCATION_NOT_FOUND")
            if loc.office_id != payload.office_id:
                raise OfficeAccessDeniedError("Cannot start a verification session for another office's location")

        if payload.scope_type == "CATEGORY":
            if not payload.category_id:
                raise ValidationError("category_id is required when scope_type is CATEGORY.")
            cat = db.query(Category).filter(Category.id == payload.category_id).first()
            if not cat:
                raise NotFoundError("Selected category was not found", code="CATEGORY_NOT_FOUND")

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
        return VerificationService.get_session(db, session.id)

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

        observed_loc = db.query(Location).filter(Location.id == payload.scanned_location_id).first()
        if not observed_loc:
            raise NotFoundError("Observed location was not found", code="LOCATION_NOT_FOUND")
        if observed_loc.office_id != session.office_id:
            raise OfficeAccessDeniedError("Observed location belongs to a different office")

        barcode = payload.scanned_barcode.strip()
        lowered = barcode.lower()

        # 1. Resolve barcode / item code / serial number to item within session office
        item = (
            db.query(Item)
            .options(joinedload(Item.location))
            .filter(
                (func.lower(Item.barcode_number) == lowered)
                | (func.lower(Item.item_code) == lowered)
                | (func.lower(Item.serial_number) == lowered),
                Item.office_id == session.office_id,
            )
            .first()
        )

        # 2. Duplicate scan detection (match resolved item_id OR exact scanned code)
        dup_query = db.query(VerificationScanEvent).filter(VerificationScanEvent.session_id == session.id)
        if item:
            existing_scan = dup_query.filter(
                (VerificationScanEvent.item_id == item.id)
                | (func.lower(VerificationScanEvent.scanned_barcode) == lowered)
            ).first()
        else:
            existing_scan = dup_query.filter(func.lower(VerificationScanEvent.scanned_barcode) == lowered).first()

        is_duplicate = existing_scan is not None

        scan_result = "MATCHED_VERIFIED"
        discrepancy = None
        matched_item_id = item.id if item else None
        item_code = item.item_code if item else None
        item_name = item.item_name if item else None
        expected_location_id = item.location_id if item else None
        expected_location_name = _format_location_name(item.location) if item else None
        observed_location_name = _format_location_name(observed_loc)
        expected_condition = item.condition if item else None
        item_updated = False
        updated_fields: List[str] = []

        if is_duplicate:
            scan_result = "DUPLICATE_SCAN_REPEATED"
            discrepancy = "DUPLICATE_SUSPECTED"
            msg = f"Repeated scan detected for '{barcode}'!"
        elif not item:
            scan_result = "UNKNOWN_BARCODE"
            discrepancy = "UNEXPECTED_ITEM"
            msg = f"Unregistered or foreign barcode '{barcode}' scanned!"
        elif item.operational_status == "DISPOSED":
            scan_result = "UNEXPECTED_ITEM"
            discrepancy = "UNEXPECTED_ITEM"
            msg = f"Asset '{item.item_code}' is marked DISPOSED in the system!"
        else:
            # Check baseline snapshot item
            v_item = (
                db.query(VerificationItem)
                .options(joinedload(VerificationItem.expected_location))
                .filter(VerificationItem.session_id == session.id, VerificationItem.item_id == item.id)
                .first()
            )

            if not v_item:
                # Scanned item is outside session scope
                scan_result = "UNEXPECTED_ITEM"
                discrepancy = "UNEXPECTED_ITEM"
                msg = f"Item '{item.item_code}' is outside this session's baseline scope."
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
                expected_location_id = v_item.expected_location_id
                expected_location_name = _format_location_name(v_item.expected_location) or expected_location_name
                expected_condition = v_item.expected_condition

                v_item.observed_location_id = payload.scanned_location_id
                v_item.observed_condition = payload.observed_condition
                v_item.counted_qty = float(v_item.counted_qty) + float(payload.counted_quantity)
                v_item.verified_by = scanner_user.id
                v_item.verified_at = datetime.now(timezone.utc)

                if payload.scanned_location_id != v_item.expected_location_id:
                    scan_result = "LOCATION_MISMATCH"
                    discrepancy = "LOCATION_MISMATCH"
                    v_item.discrepancy_type = "LOCATION_MISMATCH"
                    msg = f"Location mismatch: expected in {expected_location_name or 'N/A'}, observed in {observed_location_name}."
                elif payload.observed_condition != v_item.expected_condition:
                    scan_result = "CONDITION_MISMATCH"
                    discrepancy = "CONDITION_MISMATCH"
                    v_item.discrepancy_type = "CONDITION_MISMATCH"
                    msg = f"Condition updated from '{v_item.expected_condition}' to '{payload.observed_condition}'."
                else:
                    scan_result = "MATCHED_VERIFIED"
                    v_item.discrepancy_type = "NONE"
                    v_item.resolution_status = "RESOLVED"
                    msg = f"Item '{item.item_code}' verified successfully."

            # Option B: Immediately update live item condition / location during audit scan
            old_values = {}
            new_values = {}
            if payload.observed_condition != item.condition:
                old_values["condition"] = item.condition
                item.condition = payload.observed_condition
                new_values["condition"] = payload.observed_condition
                updated_fields.append("condition")

            if payload.scanned_location_id != item.location_id:
                old_values["location_id"] = str(item.location_id)
                VerificationService._sync_item_location_and_balance(db, item, payload.scanned_location_id)
                new_values["location_id"] = str(payload.scanned_location_id)
                updated_fields.append("location_id")

            if updated_fields:
                item.updated_by = scanner_user.id
                item_updated = True
                AuditService.log_action(
                    db=db,
                    action="VERIFY_UPDATE",
                    module="INVENTORY",
                    record_id=str(item.id),
                    actor=scanner_user,
                    office_id=session.office_id,
                    old_values=old_values,
                    new_values={
                        **new_values,
                        "session_number": session.session_number,
                        "remarks": payload.remarks,
                    },
                )
                msg = f"{msg} Live asset record updated ({', '.join(updated_fields)})."

        # Insert immutable scan event
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
            expected_location_id=expected_location_id,
            expected_location_name=expected_location_name,
            observed_location_name=observed_location_name,
            expected_condition=expected_condition,
            observed_condition=payload.observed_condition,
            item_updated=item_updated,
            updated_fields=updated_fields,
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
        query = (
            db.query(VerificationScanEvent)
            .options(
                joinedload(VerificationScanEvent.item),
                joinedload(VerificationScanEvent.scanned_location),
                joinedload(VerificationScanEvent.scanner_user),
            )
            .filter(VerificationScanEvent.session_id == session_id)
        )
        if scan_result:
            query = query.filter(VerificationScanEvent.scan_result == scan_result.upper())
        if is_duplicate is not None:
            query = query.filter(VerificationScanEvent.is_duplicate_scan == is_duplicate)

        total = query.count()
        scans = query.order_by(VerificationScanEvent.scanned_at.desc()).offset((page - 1) * limit).limit(limit).all()
        for ev in scans:
            VerificationService._enrich_scan_event(ev)
        return scans, total

    @staticmethod
    def reconcile_discrepancies(
        db: Session,
        session_id: UUID,
        payload: VerificationReconcileRequest,
        officer: User,
    ) -> VerificationSession:
        session = VerificationService.get_session(db, session_id)
        if session.status in ("COMPLETED", "CANCELLED"):
            raise ValidationError(f"Cannot reconcile session in status '{session.status}'")

        for res in payload.resolutions:
            v_item = (
                db.query(VerificationItem)
                .filter(VerificationItem.id == res.verification_item_id, VerificationItem.session_id == session.id)
                .first()
            )
            if not v_item:
                continue

            v_item.resolution_status = res.resolution_status
            v_item.resolution_remarks = res.remarks.strip()

            # Only apply master record updates when officially RESOLVED (not IGNORED)
            if res.resolution_status == "RESOLVED":
                item = db.query(Item).filter(Item.id == v_item.item_id).first()
                if item and item.operational_status != "DISPOSED":
                    if (
                        v_item.discrepancy_type == "LOCATION_MISMATCH"
                        and v_item.observed_location_id
                        and item.location_id != v_item.observed_location_id
                    ):
                        VerificationService._sync_item_location_and_balance(db, item, v_item.observed_location_id)
                        item.updated_by = officer.id

                    if (
                        v_item.discrepancy_type == "CONDITION_MISMATCH"
                        and v_item.observed_condition
                        and item.condition != v_item.observed_condition
                    ):
                        item.condition = v_item.observed_condition
                        item.updated_by = officer.id

        if session.status == "IN_PROGRESS":
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
        return VerificationService.get_session(db, session.id)

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
        session.notes = f"{session.notes} | Conclusion: {payload.summary_remarks}" if session.notes else f"Conclusion: {payload.summary_remarks}"

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
        return VerificationService.get_session(db, session.id)

    @staticmethod
    def export_session_report_csv(db: Session, session_id: UUID, lang: str = "en") -> Tuple[str, str]:
        active_lang = validate_language(lang)
        session = VerificationService.get_session(db, session_id)
        items = VerificationService.list_session_items(db, session_id)

        def h(label: str) -> str:
            return translate_report_header(label, active_lang)

        def cell(val):
            return translate_report_cell(val, active_lang)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([get_report_title("verification-reconciliation", active_lang)])
        writer.writerow([h("Session Number"), session.session_number, h("Status"), cell(session.status)])
        writer.writerow([h("Scope Type"), cell(session.scope_type), h("Scope Target"), cell(session.location_name or session.category_name or "Full Office")])
        writer.writerow([h("Lead Verifier"), session.lead_verifier_name or str(session.lead_verifier_id), h("Notes"), session.notes or ""])
        writer.writerow([h("Expected Items"), session.total_expected_items, h("Scanned Items"), session.total_scanned_items, h("Pending Discrepancies"), session.discrepancy_count])
        writer.writerow([])

        raw_headers = [
            "Item Code",
            "Item Name",
            "Barcode Number",
            "Expected Location",
            "Observed Location",
            "Expected Condition",
            "Observed Condition",
            "Expected Qty",
            "Counted Qty",
            "Discrepancy Type",
            "Resolution Status",
            "Resolution Remarks",
            "Verified By",
            "Verified At",
        ]
        writer.writerow([h(col) for col in raw_headers])

        for it in items:
            writer.writerow([
                it.item_code or str(it.item_id),
                it.item_name or "",
                it.barcode_number or "",
                it.expected_location_name or str(it.expected_location_id),
                it.observed_location_name or "",
                cell(it.expected_condition),
                cell(it.observed_condition) if it.observed_condition else "",
                it.expected_qty,
                it.counted_qty,
                cell(it.discrepancy_type),
                cell(it.resolution_status),
                it.resolution_remarks or "",
                it.verified_by_name or "",
                it.verified_at.isoformat() if it.verified_at else "",
            ])

        output.seek(0)
        return output.getvalue(), f"verification-report-{session.session_number}.csv"
