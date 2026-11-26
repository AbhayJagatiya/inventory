"""Reports and Analytics Service

Aggregates all 12 official registers, builds dashboards and overview KPIs,
and renders CSV, XLSX, and PDF exports with full pagination and totals.
"""

import csv
import io
import os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
import openpyxl
from openpyxl.styles import Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.core.config import settings
from app.core.i18n import (
    ORG_NAMES,
    REPORT_META_LABELS,
    get_report_title,
    translate_report_cell,
    translate_report_header,
    validate_language,
)
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.alerts.models import Alert, Notification
from app.features.audit.models import AuditLog
from app.features.condemnation.models import CondemnationRequest
from app.features.disposal.models import Disposal
from app.features.inventory.models import Item, StockBalance
from app.features.ledger.models import StockTransaction
from app.features.maintenance.models import MaintenanceRecord
from app.features.offices.models import Office
from app.features.procurement.models import Procurement
from app.features.reports.schemas import (
    AdminDashboardOut,
    AlertsSummaryOut,
    OfficerDashboardOut,
    ReportsOverviewOut,
    StaffDashboardOut,
)
from app.features.users.models import User
from app.features.verification.models import VerificationItem, VerificationSession
from app.features.warranties.models import Warranty


def _parse_date(val: Any) -> Optional[date]:
    if not val:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    try:
        return date.fromisoformat(str(val)[:10])
    except ValueError:
        return None


def _parse_uuid(val: Any) -> Optional[UUID]:
    if not val:
        return None
    if isinstance(val, UUID):
        return val
    try:
        return UUID(str(val))
    except ValueError:
        return None


class ReportsService:
    # 1. Dashboards
    @staticmethod
    def get_admin_dashboard(db: Session, admin_user: User) -> AdminDashboardOut:
        total_registered = db.query(Item).filter(Item.operational_status != "DISPOSED").count()
        val_res = db.query(func.sum(Item.total_cost)).filter(Item.operational_status != "DISPOSED").scalar()
        active_val = float(val_res or 0.0)
        avail_count = db.query(Item).filter(Item.operational_status == "AVAILABLE_IN_STORE").count()

        dead_stock_items = (
            db.query(Item)
            .filter(Item.operational_status != "DISPOSED", Item.current_classification.in_(["NON_MOVING", "OBSOLETE"]))
            .all()
        )
        dead_stock_count = len(dead_stock_items)
        dead_stock_val = sum(float(i.total_cost) for i in dead_stock_items)

        pending_condemnations = (
            db.query(CondemnationRequest)
            .filter(CondemnationRequest.status.in_(["SUBMITTED", "UNDER_REVIEW", "MORE_INFO_REQUIRED"]))
            .count()
        )

        disposed_items = db.query(Item).filter(Item.operational_status == "DISPOSED").count()
        proceeds_res = db.query(func.sum(Disposal.total_sale_proceeds)).scalar()
        total_proceeds = float(proceeds_res or 0.0)

        recent_logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(8).all()
        recent_act = [
            {
                "timestamp": l.timestamp.isoformat(),
                "user": l.username,
                "role": l.role_name,
                "action": l.action,
                "module": l.module,
                "record_id": l.record_id,
                "outcome": l.outcome,
            }
            for l in recent_logs
        ]

        offices = db.query(Office).all()
        office_dist = []
        for off in offices:
            count = db.query(Item).filter(Item.office_id == off.id, Item.operational_status != "DISPOSED").count()
            val = db.query(func.sum(Item.total_cost)).filter(Item.office_id == off.id, Item.operational_status != "DISPOSED").scalar()
            office_dist.append({
                "office_code": off.code,
                "office_name": off.name,
                "item_count": count,
                "valuation": float(val or 0.0),
            })

        return AdminDashboardOut(
            total_registered_assets=total_registered,
            active_stock_value=active_val,
            available_items_count=avail_count,
            dead_stock_candidates_count=dead_stock_count,
            dead_stock_valuation=dead_stock_val,
            pending_condemnation_count=pending_condemnations,
            disposed_items_count=disposed_items,
            total_disposal_proceeds=total_proceeds,
            recent_activity=recent_act,
            office_distribution=office_dist,
            calculated_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def get_officer_dashboard(db: Session, officer: User) -> OfficerDashboardOut:
        office_id = officer.office_id
        office = db.query(Office).filter(Office.id == office_id).first()
        office_name = office.name if office else "Veraval Store"

        total_items = db.query(Item).filter(Item.office_id == office_id, Item.operational_status != "DISPOSED").count()
        val_res = db.query(func.sum(Item.total_cost)).filter(Item.office_id == office_id, Item.operational_status != "DISPOSED").scalar()

        pending_reviews = (
            db.query(CondemnationRequest)
            .filter(CondemnationRequest.office_id == office_id, CondemnationRequest.status.in_(["SUBMITTED", "UNDER_REVIEW"]))
            .count()
        )

        unresolved_discrepancies = (
            db.query(VerificationItem)
            .filter(
                VerificationItem.office_id == office_id,
                VerificationItem.discrepancy_type != "NONE",
                VerificationItem.resolution_status == "PENDING",
            )
            .count()
        )

        maint_pending = (
            db.query(MaintenanceRecord)
            .filter(MaintenanceRecord.office_id == office_id, MaintenanceRecord.status.in_(["REPORTED", "UNDER_REVIEW", "IN_REPAIR"]))
            .count()
        )

        today = datetime.now(timezone.utc).date()
        cutoff_date = today + timedelta(days=60)
        expiring_wars = (
            db.query(Warranty)
            .join(Item)
            .filter(Item.office_id == office_id, Warranty.end_date >= today, Warranty.end_date <= cutoff_date)
            .count()
        )

        active_alerts = db.query(Alert).filter(Alert.office_id == office_id, Alert.status == "ACTIVE").count()

        recent_txns = (
            db.query(StockTransaction)
            .filter(StockTransaction.office_id == office_id)
            .order_by(StockTransaction.created_at.desc())
            .limit(5)
            .all()
        )
        recent_txns_list = [
            {
                "transaction_number": t.transaction_number,
                "type": t.transaction_type,
                "status": t.status,
                "date": t.created_at.isoformat(),
                "actor": t.actor.full_name if t.actor else "User",
            }
            for t in recent_txns
        ]

        return OfficerDashboardOut(
            office_id=office_id,
            office_name=office_name,
            total_office_items=total_items,
            active_stock_value=float(val_res or 0.0),
            pending_condemnation_reviews=pending_reviews,
            active_verification_discrepancies=unresolved_discrepancies,
            maintenance_pending_count=maint_pending,
            expiring_warranties_count=expiring_wars,
            active_alerts_count=active_alerts,
            recent_transactions=recent_txns_list,
            calculated_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def get_staff_dashboard(db: Session, staff: User) -> StaffDashboardOut:
        office_id = staff.office_id
        avail_stock = (
            db.query(Item)
            .filter(Item.office_id == office_id, Item.operational_status == "AVAILABLE_IN_STORE")
            .count()
        )

        receipts_count = (
            db.query(StockTransaction)
            .filter(StockTransaction.actor_id == staff.id, StockTransaction.transaction_type == "RECEIPT")
            .count()
        )
        issues_count = (
            db.query(StockTransaction)
            .filter(StockTransaction.actor_id == staff.id, StockTransaction.transaction_type == "ISSUE")
            .count()
        )
        returns_count = (
            db.query(StockTransaction)
            .filter(StockTransaction.actor_id == staff.id, StockTransaction.transaction_type == "RETURN")
            .count()
        )

        my_txns = (
            db.query(StockTransaction)
            .filter(StockTransaction.actor_id == staff.id)
            .order_by(StockTransaction.created_at.desc())
            .limit(5)
            .all()
        )
        my_txns_list = [
            {
                "transaction_number": t.transaction_number,
                "type": t.transaction_type,
                "status": t.status,
                "date": t.created_at.isoformat(),
                "recipient": t.recipient_name or "N/A",
            }
            for t in my_txns
        ]

        return StaffDashboardOut(
            office_id=office_id,
            available_stock_count=avail_stock,
            my_recent_receipts_count=receipts_count,
            my_recent_issues_count=issues_count,
            pending_returns_count=returns_count,
            recent_my_transactions=my_txns_list,
            calculated_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def get_alerts_summary(db: Session, current_user: User) -> AlertsSummaryOut:
        now_dt = datetime.now(timezone.utc)
        query = db.query(Alert).filter(
            Alert.status.in_(["ACTIVE", "SNOOZED"]),
            (Alert.snoozed_until.is_(None)) | (Alert.snoozed_until <= now_dt),
        )
        if ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(Alert.office_id == current_user.office_id)

        alerts = query.all()
        total = len(alerts)
        crit = sum(1 for a in alerts if a.priority == "CRITICAL")
        high = sum(1 for a in alerts if a.priority == "HIGH")
        med = sum(1 for a in alerts if a.priority == "MEDIUM")
        low = sum(1 for a in alerts if a.priority == "LOW")

        by_type: Dict[str, int] = {}
        for a in alerts:
            by_type[a.alert_type] = by_type.get(a.alert_type, 0) + 1

        unread_notifs = (
            db.query(Notification)
            .filter(Notification.recipient_user_id == current_user.id, Notification.is_read.is_(False))
            .count()
        )

        return AlertsSummaryOut(
            total_unresolved=total,
            critical_count=crit,
            high_count=high,
            medium_count=med,
            low_count=low,
            by_type=by_type,
            unread_notifications_count=unread_notifs,
        )

    @staticmethod
    def get_overview(
        db: Session,
        office_id: Optional[UUID] = None,
        current_user: Optional[User] = None,
    ) -> ReportsOverviewOut:
        scoped_office = office_id
        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            scoped_office = current_user.office_id

        item_q = db.query(Item).options(joinedload(Item.category), joinedload(Item.stock_balances)).filter(
            Item.operational_status != "DISPOSED"
        )
        if scoped_office:
            item_q = item_q.filter(Item.office_id == scoped_office)

        items = item_q.all()
        today = datetime.now(timezone.utc).date()

        total_acq = 0.0
        est_val = 0.0
        stock_qty = 0.0
        dead_count = 0
        dead_val = 0.0

        for it in items:
            cost = float(it.total_cost or 0.0)
            total_acq += cost
            p_date = it.purchase_date or (it.created_at.date() if it.created_at else today)
            age_years = max(0.0, (today - p_date).days / 365.25)
            rate = float(it.category.depreciation_rate_pct) if it.category else 15.0
            est_val += max(0.0, cost - (cost * (rate / 100.0) * age_years))

            if it.stock_balances:
                stock_qty += sum(float(b.available_qty or 0.0) for b in it.stock_balances)
            elif it.item_type == "DURABLE_ASSET" and it.operational_status in ("AVAILABLE_IN_STORE", "IN_USE", "UNDER_MAINTENANCE"):
                stock_qty += 1.0

            if it.current_classification in ("NON_MOVING", "OBSOLETE"):
                dead_count += 1
                dead_val += cost

        txn_q = db.query(StockTransaction).filter(StockTransaction.status == "POSTED")
        disp_q = db.query(Disposal)
        maint_q = db.query(MaintenanceRecord).filter(MaintenanceRecord.status == "COMPLETED")
        war_q = db.query(Warranty).join(Item, Warranty.item_id == Item.id).filter(Item.operational_status != "DISPOSED")

        if scoped_office:
            txn_q = txn_q.filter(StockTransaction.office_id == scoped_office)
            disp_q = disp_q.filter(Disposal.office_id == scoped_office)
            maint_q = maint_q.filter(MaintenanceRecord.office_id == scoped_office)
            war_q = war_q.filter(Item.office_id == scoped_office)

        total_movements = txn_q.count()
        disposals = disp_q.all()
        total_disposals = len(disposals)
        total_proceeds = sum(float(d.total_sale_proceeds or 0.0) for d in disposals)
        maint_exp = float(maint_q.with_entities(func.sum(MaintenanceRecord.actual_cost)).scalar() or 0.0)

        warranties = war_q.all()
        active_w = sum(1 for w in warranties if w.end_date >= today)
        expiring_w = sum(1 for w in warranties if 0 <= (w.end_date - today).days <= 60)
        expired_w = sum(1 for w in warranties if w.end_date < today)

        return ReportsOverviewOut(
            total_registered_assets=len(items),
            current_stock_quantity=round(stock_qty, 2),
            total_acquisition_value=round(total_acq, 2),
            estimated_current_valuation=round(est_val, 2),
            dead_stock_count=dead_count,
            dead_stock_value=round(dead_val, 2),
            total_stock_movements=total_movements,
            total_disposals=total_disposals,
            total_disposal_proceeds=round(total_proceeds, 2),
            maintenance_expenditure=round(maint_exp, 2),
            active_warranties_count=active_w,
            expiring_warranties_count=expiring_w,
            expired_warranties_count=expired_w,
            calculated_at=datetime.now(timezone.utc),
        )

    # 2. All 12 Standard Reports
    @staticmethod
    def get_report_payload(
        db: Session,
        report_name: str,
        office_id: Optional[UUID] = None,
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        limit: int = 50,
        sort_by: Optional[str] = None,
        sort_dir: str = "asc",
    ) -> Dict[str, Any]:
        flt = filters or {}
        date_from = _parse_date(flt.get("date_from"))
        date_to = _parse_date(flt.get("date_to"))
        category_id = _parse_uuid(flt.get("category_id"))
        location_id = _parse_uuid(flt.get("location_id"))
        supplier_id = _parse_uuid(flt.get("supplier_id"))
        status_f = flt.get("status")
        classification_f = flt.get("classification")
        txn_type_f = flt.get("transaction_type")
        disposal_method_f = flt.get("disposal_method")
        search_f = (flt.get("search") or "").strip().lower()

        headers: List[str] = []
        rows: List[List[Any]] = []
        row_links: List[Optional[str]] = []
        summary: Dict[str, Any] = {}
        today = datetime.now(timezone.utc).date()

        if report_name in ("stock-register", "current-stock"):
            headers = ["Item Code", "Item Name", "Category", "Location", "UOM", "Available Qty", "Condition", "Status"]
            query = db.query(Item).options(
                joinedload(Item.category), joinedload(Item.location), joinedload(Item.uom), joinedload(Item.stock_balances)
            ).filter(Item.operational_status != "DISPOSED")
            if office_id:
                query = query.filter(Item.office_id == office_id)
            if category_id:
                query = query.filter(Item.category_id == category_id)
            if location_id:
                query = query.filter(Item.location_id == location_id)
            if status_f:
                query = query.filter(Item.operational_status == status_f.upper())

            total_qty = 0.0
            for it in query.order_by(Item.item_code.asc()).all():
                bal = (
                    sum(float(b.available_qty) for b in it.stock_balances)
                    if it.stock_balances
                    else (1.0 if it.operational_status == "AVAILABLE_IN_STORE" else 0.0)
                )
                row = [
                    it.item_code,
                    it.item_name,
                    it.category.name if it.category else "",
                    it.location.room_number if it.location else "",
                    it.uom.code if it.uom else "NOS",
                    round(bal, 2),
                    it.condition,
                    it.operational_status,
                ]
                if search_f and not any(search_f in str(c).lower() for c in row):
                    continue
                rows.append(row)
                row_links.append(f"/inventory/{it.id}")
                total_qty += bal
            summary = {"total_records": len(rows), "total_available_qty": round(total_qty, 2), "scope": "Active (Excludes Disposed)"}

        elif report_name in ("asset-register", "capital-assets"):
            headers = ["Asset Code", "Name", "Serial No", "Purchase Date", "Cost (₹)", "Supplier", "Location", "Custodian", "Status"]
            query = db.query(Item).options(
                joinedload(Item.supplier), joinedload(Item.location)
            ).filter(Item.item_type == "DURABLE_ASSET")
            if office_id:
                query = query.filter(Item.office_id == office_id)
            if category_id:
                query = query.filter(Item.category_id == category_id)
            if location_id:
                query = query.filter(Item.location_id == location_id)
            if supplier_id:
                query = query.filter(Item.supplier_id == supplier_id)
            if status_f:
                query = query.filter(Item.operational_status == status_f.upper())
            if date_from:
                query = query.filter(Item.purchase_date >= date_from)
            if date_to:
                query = query.filter(Item.purchase_date <= date_to)

            total_cost = 0.0
            for it in query.order_by(Item.item_code.asc()).all():
                cost = float(it.total_cost or 0.0)
                row = [
                    it.item_code,
                    it.item_name,
                    it.serial_number or "N/A",
                    str(it.purchase_date or "N/A"),
                    cost,
                    it.supplier.name if it.supplier else "N/A",
                    it.location.room_number if it.location else "",
                    it.current_custodian or "Store Pool",
                    it.operational_status,
                ]
                if search_f and not any(search_f in str(c).lower() for c in row):
                    continue
                rows.append(row)
                row_links.append(f"/inventory/{it.id}")
                total_cost += cost
            summary = {"total_assets": len(rows), "total_acquisition_cost": round(total_cost, 2)}

        elif report_name == "stock-quantity":
            headers = ["Item Code", "Item Name", "Category", "Office", "Location", "Available Qty", "Allocated Qty", "Vendor RMA Qty", "Disposed Qty"]
            query = db.query(StockBalance).options(
                joinedload(StockBalance.item).joinedload(Item.category),
                joinedload(StockBalance.office),
                joinedload(StockBalance.location),
            )
            if office_id:
                query = query.filter(StockBalance.office_id == office_id)
            if location_id:
                query = query.filter(StockBalance.location_id == location_id)

            sum_avail = sum_alloc = sum_rma = sum_disp = 0.0
            for b in query.all():
                if category_id and b.item and b.item.category_id != category_id:
                    continue
                av = float(b.available_qty or 0.0)
                al = float(b.allocated_qty or 0.0)
                rm = float(b.in_vendor_rma_qty or 0.0)
                dp = float(b.disposed_qty or 0.0)
                row = [
                    b.item.item_code if b.item else "",
                    b.item.item_name if b.item else "",
                    b.item.category.name if b.item and b.item.category else "",
                    b.office.name if b.office else "",
                    b.location.room_number if b.location else "",
                    round(av, 2),
                    round(al, 2),
                    round(rm, 2),
                    round(dp, 2),
                ]
                if search_f and not any(search_f in str(c).lower() for c in row):
                    continue
                rows.append(row)
                row_links.append(f"/inventory/{b.item_id}" if b.item_id else None)
                sum_avail += av
                sum_alloc += al
                sum_rma += rm
                sum_disp += dp
            summary = {
                "total_rows": len(rows),
                "total_available_qty": round(sum_avail, 2),
                "total_allocated_qty": round(sum_alloc, 2),
                "total_rma_qty": round(sum_rma, 2),
                "total_disposed_qty": round(sum_disp, 2),
            }

        elif report_name in ("asset-valuation", "valuation"):
            headers = ["Asset Code", "Name", "Category", "Purchase Cost (₹)", "Age (Years)", "Depreciation Rate", "Est. Depreciated Value (₹)"]
            query = db.query(Item).options(joinedload(Item.category)).filter(Item.operational_status != "DISPOSED")
            if office_id:
                query = query.filter(Item.office_id == office_id)
            if category_id:
                query = query.filter(Item.category_id == category_id)

            total_hist = 0.0
            total_est = 0.0
            for it in query.order_by(Item.item_code.asc()).all():
                cost = float(it.total_cost or 0.0)
                p_date = it.purchase_date or (it.created_at.date() if it.created_at else today)
                age_years = max(0.0, (today - p_date).days / 365.25)
                rate = float(it.category.depreciation_rate_pct) if it.category else 15.0
                est_val = max(0.0, cost - (cost * (rate / 100.0) * age_years))
                row = [
                    it.item_code,
                    it.item_name,
                    it.category.name if it.category else "",
                    round(cost, 2),
                    round(age_years, 1),
                    f"{rate}%",
                    round(est_val, 2),
                ]
                if search_f and not any(search_f in str(c).lower() for c in row):
                    continue
                rows.append(row)
                row_links.append(f"/inventory/{it.id}")
                total_hist += cost
                total_est += est_val
            summary = {
                "total_records": len(rows),
                "total_historical_cost": round(total_hist, 2),
                "total_estimated_depreciated_value": round(total_est, 2),
                "valuation_basis": "Historical Acquisition Cost & Straight-Line Category Estimate (Not Official Government Book Value)",
            }

        elif report_name in ("movements", "movement-register"):
            headers = ["Voucher Number", "Type", "Date", "Office", "Recipient", "Status", "Actor"]
            query = db.query(StockTransaction).options(joinedload(StockTransaction.office), joinedload(StockTransaction.actor))
            if office_id:
                query = query.filter(StockTransaction.office_id == office_id)
            if txn_type_f:
                query = query.filter(StockTransaction.transaction_type == txn_type_f.upper())
            if status_f:
                query = query.filter(StockTransaction.status == status_f.upper())
            if date_from:
                query = query.filter(StockTransaction.created_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc))
            if date_to:
                query = query.filter(StockTransaction.created_at <= datetime.combine(date_to, datetime.max.time(), tzinfo=timezone.utc))

            for txn in query.order_by(StockTransaction.created_at.desc()).all():
                row = [
                    txn.transaction_number,
                    txn.transaction_type,
                    txn.created_at.strftime("%d/%m/%Y"),
                    txn.office.code if txn.office else "",
                    txn.recipient_name or "N/A",
                    txn.status,
                    txn.actor.full_name if txn.actor else "",
                ]
                if search_f and not any(search_f in str(c).lower() for c in row):
                    continue
                rows.append(row)
                row_links.append("/transactions")
            summary = {"total_movements": len(rows)}

        elif report_name in ("dead-stock", "dead-stock-register"):
            headers = ["Item Code", "Item Name", "Classification", "Condition", "Recorded Cost (₹)", "Days Inactive", "Location"]
            query = db.query(Item).options(joinedload(Item.location)).filter(
                Item.operational_status != "DISPOSED",
                Item.current_classification.in_(["NON_MOVING", "OBSOLETE"]),
            )
            if office_id:
                query = query.filter(Item.office_id == office_id)
            if category_id:
                query = query.filter(Item.category_id == category_id)
            if classification_f:
                query = query.filter(Item.current_classification == classification_f.upper())

            total_val = 0.0
            for it in query.order_by(Item.item_code.asc()).all():
                ref_dt = it.last_movement_date or (it.created_at.date() if it.created_at else today)
                days_inact = (today - ref_dt).days
                cost = float(it.total_cost or 0.0)
                row = [
                    it.item_code,
                    it.item_name,
                    it.current_classification,
                    it.condition,
                    round(cost, 2),
                    days_inact,
                    it.location.room_number if it.location else "",
                ]
                if search_f and not any(search_f in str(c).lower() for c in row):
                    continue
                rows.append(row)
                row_links.append(f"/inventory/{it.id}")
                total_val += cost
            summary = {"total_dead_stock_items": len(rows), "total_recorded_value": round(total_val, 2)}

        elif report_name == "condemnations":
            headers = ["Proposal No", "Reason", "Status", "Submitted By", "Date", "Items Count"]
            query = db.query(CondemnationRequest).options(
                joinedload(CondemnationRequest.submitter), joinedload(CondemnationRequest.items)
            )
            if office_id:
                query = query.filter(CondemnationRequest.office_id == office_id)
            if status_f:
                query = query.filter(CondemnationRequest.status == status_f.upper())
            if date_from:
                query = query.filter(CondemnationRequest.created_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc))
            if date_to:
                query = query.filter(CondemnationRequest.created_at <= datetime.combine(date_to, datetime.max.time(), tzinfo=timezone.utc))

            total_items = 0
            for c in query.order_by(CondemnationRequest.created_at.desc()).all():
                icount = len(c.items)
                row = [
                    c.request_number,
                    c.reason_code,
                    c.status,
                    c.submitter.full_name if c.submitter else "",
                    c.created_at.strftime("%d/%m/%Y"),
                    icount,
                ]
                if search_f and not any(search_f in str(col).lower() for col in row):
                    continue
                rows.append(row)
                row_links.append(f"/dead-stock/condemnations/{c.id}")
                total_items += icount
            summary = {"total_proposals": len(rows), "total_nominated_items": total_items}

        elif report_name in ("disposals", "disposal-register"):
            headers = ["Disposal No", "Proposal No", "Method", "Date", "Proceeds (₹)", "Buyer Agency", "Order No"]
            query = db.query(Disposal).options(joinedload(Disposal.request))
            if office_id:
                query = query.filter(Disposal.office_id == office_id)
            if disposal_method_f:
                query = query.filter(Disposal.disposal_method == disposal_method_f.upper())
            if date_from:
                query = query.filter(Disposal.disposal_date >= date_from)
            if date_to:
                query = query.filter(Disposal.disposal_date <= date_to)

            total_proceeds = 0.0
            for d in query.order_by(Disposal.disposal_date.desc()).all():
                proc = float(d.total_sale_proceeds or 0.0)
                row = [
                    d.disposal_number,
                    d.request.request_number if d.request else "",
                    d.disposal_method,
                    str(d.disposal_date),
                    round(proc, 2),
                    d.recipient_agency,
                    d.reference_order_number,
                ]
                if search_f and not any(search_f in str(c).lower() for c in row):
                    continue
                rows.append(row)
                row_links.append("/dead-stock/disposals")
                total_proceeds += proc
            summary = {"total_disposals": len(rows), "total_sale_proceeds": round(total_proceeds, 2)}

        elif report_name == "suppliers-procurement":
            headers = ["Procurement No", "Supplier", "Supplier Code", "Order Date", "Invoice No", "Total Amount (₹)", "Status", "Office"]
            query = db.query(Procurement).options(joinedload(Procurement.supplier), joinedload(Procurement.office))
            if office_id:
                query = query.filter(Procurement.office_id == office_id)
            if supplier_id:
                query = query.filter(Procurement.supplier_id == supplier_id)
            if status_f:
                query = query.filter(Procurement.status == status_f.upper())
            if date_from:
                query = query.filter(Procurement.order_date >= date_from)
            if date_to:
                query = query.filter(Procurement.order_date <= date_to)

            total_amt = 0.0
            for p in query.order_by(Procurement.order_date.desc()).all():
                amt = float(p.total_amount or 0.0)
                row = [
                    p.procurement_number,
                    p.supplier.name if p.supplier else "",
                    p.supplier.supplier_code if p.supplier else "",
                    str(p.order_date),
                    p.invoice_number or "N/A",
                    round(amt, 2),
                    p.status,
                    p.office.name if p.office else "",
                ]
                if search_f and not any(search_f in str(c).lower() for c in row):
                    continue
                rows.append(row)
                row_links.append(f"/suppliers/procurement/{p.id}")
                total_amt += amt
            summary = {"total_orders": len(rows), "total_procurement_amount": round(total_amt, 2)}

        elif report_name == "warranties":
            headers = ["Asset Code", "Asset Name", "Supplier", "Warranty Provider", "Start Date", "End Date", "Status", "Remaining Days"]
            query = db.query(Warranty).join(Item, Warranty.item_id == Item.id).options(
                joinedload(Warranty.item), joinedload(Warranty.supplier)
            )
            if office_id:
                query = query.filter(Item.office_id == office_id)
            if supplier_id:
                query = query.filter(Warranty.supplier_id == supplier_id)
            if date_from:
                query = query.filter(Warranty.end_date >= date_from)
            if date_to:
                query = query.filter(Warranty.end_date <= date_to)

            active_cnt = expiring_cnt = expired_cnt = 0
            for w in query.order_by(Warranty.end_date.asc()).all():
                rem = (w.end_date - today).days
                w_status = "EXPIRED" if rem < 0 else ("EXPIRING_SOON" if rem <= 30 else "ACTIVE")
                if status_f and w_status != status_f.upper():
                    continue
                row = [
                    w.item.item_code if w.item else "",
                    w.item.item_name if w.item else "",
                    w.supplier.name if w.supplier else "N/A",
                    w.provider_name,
                    str(w.start_date),
                    str(w.end_date),
                    w_status,
                    rem,
                ]
                if search_f and not any(search_f in str(c).lower() for c in row):
                    continue
                rows.append(row)
                row_links.append("/maintenance/warranties")
                if w_status == "EXPIRED":
                    expired_cnt += 1
                elif w_status == "EXPIRING_SOON":
                    expiring_cnt += 1
                else:
                    active_cnt += 1
            summary = {
                "total_warranties": len(rows),
                "active_count": active_cnt,
                "expiring_soon_count": expiring_cnt,
                "expired_count": expired_cnt,
            }

        elif report_name == "maintenance":
            headers = ["Ticket Ref", "Asset Code", "Asset Name", "Service Provider", "Reported Date", "Completion Date", "Estimated Cost (₹)", "Actual Cost (₹)", "Status"]
            query = db.query(MaintenanceRecord).options(joinedload(MaintenanceRecord.item))
            if office_id:
                query = query.filter(MaintenanceRecord.office_id == office_id)
            if status_f:
                query = query.filter(MaintenanceRecord.status == status_f.upper())
            if date_from:
                query = query.filter(MaintenanceRecord.reported_date >= date_from)
            if date_to:
                query = query.filter(MaintenanceRecord.reported_date <= date_to)

            tot_est = tot_act = 0.0
            for m in query.order_by(MaintenanceRecord.reported_date.desc()).all():
                if category_id and m.item and m.item.category_id != category_id:
                    continue
                est = float(m.estimated_cost or 0.0)
                act = float(m.actual_cost or 0.0)
                row = [
                    f"MNT-{str(m.id).split('-')[0].upper()}",
                    m.item.item_code if m.item else "",
                    m.item.item_name if m.item else "",
                    m.service_provider,
                    str(m.reported_date),
                    str(m.completion_date) if m.completion_date else "Pending",
                    round(est, 2),
                    round(act, 2),
                    m.status,
                ]
                if search_f and not any(search_f in str(c).lower() for c in row):
                    continue
                rows.append(row)
                row_links.append("/maintenance")
                tot_est += est
                if m.status == "COMPLETED":
                    tot_act += act
            summary = {
                "total_tickets": len(rows),
                "total_estimated_cost": round(tot_est, 2),
                "total_actual_cost": round(tot_act, 2),
            }

        elif report_name in ("physical-verification", "verification-reconciliation"):
            headers = ["Session Number", "Scope Type", "Lead Verifier", "Status", "Expected Items", "Scanned Items", "Discrepancies", "Started At", "Completed At"]
            query = db.query(VerificationSession).options(
                joinedload(VerificationSession.lead_verifier),
                joinedload(VerificationSession.items),
            )
            if office_id:
                query = query.filter(VerificationSession.office_id == office_id)
            if status_f:
                query = query.filter(VerificationSession.status == status_f.upper())
            if date_from:
                query = query.filter(VerificationSession.created_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc))
            if date_to:
                query = query.filter(VerificationSession.created_at <= datetime.combine(date_to, datetime.max.time(), tzinfo=timezone.utc))

            total_discrepancies = 0
            for s in query.order_by(VerificationSession.created_at.desc()).all():
                exp_cnt = len(s.items)
                scanned_cnt = sum(1 for vi in s.items if float(vi.counted_qty or 0) > 0)
                disc_cnt = sum(1 for vi in s.items if vi.discrepancy_type != "NONE")
                row = [
                    s.session_number,
                    s.scope_type,
                    s.lead_verifier.full_name if s.lead_verifier else "",
                    s.status,
                    exp_cnt,
                    scanned_cnt,
                    disc_cnt,
                    s.started_at.strftime("%d/%m/%Y") if s.started_at else "N/A",
                    s.completed_at.strftime("%d/%m/%Y") if s.completed_at else "N/A",
                ]
                if search_f and not any(search_f in str(c).lower() for c in row):
                    continue
                rows.append(row)
                row_links.append(f"/verification/sessions/{s.id}")
                total_discrepancies += disc_cnt
            summary = {"total_sessions": len(rows), "total_discrepancies": total_discrepancies}

        # Sorting
        if sort_by and sort_by in headers:
            col_idx = headers.index(sort_by)
            paired = list(zip(rows, row_links))
            paired.sort(
                key=lambda pair: (str(pair[0][col_idx]) if pair[0][col_idx] is not None else ""),
                reverse=(sort_dir.lower() == "desc"),
            )
            rows = [p[0] for p in paired]
            row_links = [p[1] for p in paired]

        total = len(rows)
        start = (page - 1) * limit
        end = start + limit
        paged_rows = rows[start:end]
        paged_links = row_links[start:end]

        return {
            "report_name": report_name,
            "headers": headers,
            "rows": paged_rows,
            "row_links": paged_links,
            "all_rows": rows,
            "summary": summary,
            "total": total,
            "page": page,
            "limit": limit,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "applied_filters": flt,
        }

    @staticmethod
    def get_report_data(
        db: Session,
        report_name: str,
        office_id: Optional[UUID] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[str], List[List[Any]]]:
        payload = ReportsService.get_report_payload(
            db=db,
            report_name=report_name,
            office_id=office_id,
            filters=filters,
            page=1,
            limit=100000,
        )
        return payload["headers"], payload["all_rows"]

    # 3. Export Generators
    @staticmethod
    def _register_unicode_fonts() -> Tuple[str, str]:
        """Register Unicode TTF/TTC fonts (Nirmala UI) for Devanagari & Gujarati PDF rendering."""
        regular_name = "NirmalaUI"
        bold_name = "NirmalaUIBold"
        registered = pdfmetrics.getRegisteredFontNames()
        if regular_name in registered and bold_name in registered:
            return regular_name, bold_name

        font_candidates = [
            r"C:\Windows\Fonts\Nirmala.ttc",
            "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
        ]
        for path in font_candidates:
            if os.path.exists(path):
                try:
                    if path.lower().endswith(".ttc"):
                        pdfmetrics.registerFont(TTFont(regular_name, path, subfontIndex=0))
                        try:
                            pdfmetrics.registerFont(TTFont(bold_name, path, subfontIndex=1))
                        except Exception:
                            bold_name = regular_name
                    else:
                        pdfmetrics.registerFont(TTFont(regular_name, path))
                        bold_name = regular_name
                    return regular_name, bold_name
                except Exception:
                    continue
        return "Helvetica", "Helvetica-Bold"

    @staticmethod
    def export_to_csv(headers: List[str], rows: List[List[Any]], lang: str = "en") -> str:
        active_lang = validate_language(lang)
        loc_headers = [translate_report_header(h, active_lang) for h in headers]
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(loc_headers)
        for r in rows:
            writer.writerow([translate_report_cell(c, active_lang) for c in r])
        return output.getvalue()

    @staticmethod
    def export_to_xlsx(
        title: str,
        headers: List[str],
        rows: List[List[Any]],
        lang: str = "en",
        summary: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        active_lang = validate_language(lang)
        loc_title = get_report_title(title, active_lang)
        loc_org = ORG_NAMES.get(active_lang, settings.ORGANIZATION_NAME)
        loc_report_label = REPORT_META_LABELS["report"].get(active_lang, "Report")
        loc_gen_label = REPORT_META_LABELS["generated"].get(active_lang, "Generated")
        loc_headers = [translate_report_header(h, active_lang) for h in headers]

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = loc_title[:30]

        ws.append([loc_org])
        ws["A1"].font = Font(bold=True, size=13)
        ws.append([f"{loc_report_label}: {loc_title}"])
        ws["A2"].font = Font(bold=True, size=11)
        ws.append([f"{loc_gen_label}: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M:%S UTC')}"])
        ws.append([])

        ws.append(loc_headers)
        header_row_idx = ws.max_row
        header_fill = PatternFill(start_color="075443", end_color="075443", fill_type="solid")
        for col_idx in range(1, len(loc_headers) + 1):
            cell = ws.cell(row=header_row_idx, column=col_idx)
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = header_fill

        for row in rows:
            ws.append([translate_report_cell(c, active_lang) for c in row])

        if summary:
            ws.append([])
            ws.append(["Summary", ", ".join(f"{k}: {v}" for k, v in summary.items())])

        for col in ws.columns:
            max_len = max((len(str(c.value or "")) for c in col), default=10)
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 42)

        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    @staticmethod
    def export_to_pdf(
        title: str,
        headers: List[str],
        rows: List[List[Any]],
        lang: str = "en",
        summary: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        active_lang = validate_language(lang)
        font_regular, font_bold = ReportsService._register_unicode_fonts()
        loc_title = get_report_title(title, active_lang)
        loc_org = ORG_NAMES.get(active_lang, settings.ORGANIZATION_NAME)
        loc_reg_label = REPORT_META_LABELS["official_register"].get(active_lang, "Official Government Register")
        loc_gen_label = REPORT_META_LABELS["generated"].get(active_lang, "Generated")
        loc_headers = [translate_report_header(h, active_lang) for h in headers]

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=24,
            leftMargin=24,
            topMargin=28,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "TitleStyle",
            parent=styles["Heading1"],
            fontName=font_bold,
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#075443"),
            alignment=1,
        )
        sub_style = ParagraphStyle(
            "SubStyle",
            parent=styles["Normal"],
            fontName=font_regular,
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#475569"),
            alignment=1,
        )
        cell_style = ParagraphStyle(
            "CellStyle",
            parent=styles["Normal"],
            fontName=font_regular,
            fontSize=7.5,
            leading=9.5,
            textColor=colors.HexColor("#0f172a"),
        )
        header_cell_style = ParagraphStyle(
            "HeaderCellStyle",
            parent=styles["Normal"],
            fontName=font_bold,
            fontSize=8,
            leading=10,
            textColor=colors.whitesmoke,
        )

        elements = [
            Paragraph(loc_org, title_style),
            Spacer(1, 3),
            Paragraph(f"{loc_reg_label}: {loc_title}", sub_style),
            Paragraph(f"{loc_gen_label}: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')}", sub_style),
            Spacer(1, 10),
        ]

        table_data = [[Paragraph(str(h), header_cell_style) for h in loc_headers]]
        for r in rows:
            table_data.append([Paragraph(str(translate_report_cell(c, active_lang)), cell_style) for c in r])

        if len(table_data) == 1:
            table_data.append([Paragraph("No records found", cell_style)] + [Paragraph("", cell_style)] * (len(loc_headers) - 1))

        avail_width = landscape(A4)[0] - 48
        col_widths = [avail_width / max(len(loc_headers), 1)] * len(loc_headers)

        t = Table(table_data, colWidths=col_widths, repeatRows=1)
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#075443")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTNAME", (0, 0), (-1, 0), font_bold),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("TOPPADDING", (0, 0), (-1, 0), 6),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ])
        )
        elements.append(t)

        if summary:
            elements.append(Spacer(1, 10))
            summary_text = " | ".join(f"<b>{k.replace('_', ' ').title()}:</b> {v}" for k, v in summary.items())
            elements.append(Paragraph(summary_text, sub_style))

        def draw_footer(canvas_obj, doc_obj):
            canvas_obj.saveState()
            canvas_obj.setFont(font_regular, 8)
            canvas_obj.setFillColor(colors.HexColor("#64748b"))
            canvas_obj.drawString(24, 18, f"DSIMS - {loc_org}")
            canvas_obj.drawRightString(landscape(A4)[0] - 24, 18, f"Page {doc_obj.page}")
            canvas_obj.restoreState()

        doc.build(elements, onFirstPage=draw_footer, onLaterPages=draw_footer)
        return buffer.getvalue()
