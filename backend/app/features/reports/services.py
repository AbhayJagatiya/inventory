"""Reports and Analytics Service

Aggregates operational registers, builds dashboards, and renders CSV, XLSX, and PDF exports.
"""

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
import openpyxl
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.exceptions import ValidationError
from app.features.alerts.models import Alert, Notification
from app.features.audit.models import AuditLog
from app.features.condemnation.models import CondemnationRequest
from app.features.disposal.models import Disposal
from app.features.inventory.models import Item, StockBalance
from app.features.ledger.models import StockTransaction, StockTransactionLine
from app.features.maintenance.models import MaintenanceRecord
from app.features.offices.models import Office
from app.features.procurement.models import Procurement
from app.features.reports.schemas import (
    AdminDashboardOut,
    AlertsSummaryOut,
    OfficerDashboardOut,
    StaffDashboardOut,
)
from app.features.suppliers.models import Supplier
from app.features.users.models import User
from app.features.verification.models import VerificationItem, VerificationSession
from app.features.warranties.models import Warranty


class ReportsService:
    # 1. Dashboards
    @staticmethod
    def get_admin_dashboard(db: Session, admin_user: User) -> AdminDashboardOut:
        # Total registered non-disposed items
        total_registered = db.query(Item).filter(Item.operational_status != "DISPOSED").count()

        # Valuation
        val_res = db.query(func.sum(Item.total_cost)).filter(Item.operational_status != "DISPOSED").scalar()
        active_val = float(val_res or 0.0)

        # Available items count
        avail_count = db.query(Item).filter(Item.operational_status == "AVAILABLE_IN_STORE").count()

        # Dead stock count and valuation
        dead_stock_items = (
            db.query(Item)
            .filter(Item.operational_status != "DISPOSED", Item.current_classification.in_(["NON_MOVING", "OBSOLETE"]))
            .all()
        )
        dead_stock_count = len(dead_stock_items)
        dead_stock_val = sum(float(i.total_cost) for i in dead_stock_items)

        # Pending condemnations
        pending_condemnations = (
            db.query(CondemnationRequest)
            .filter(CondemnationRequest.status.in_(["SUBMITTED", "UNDER_REVIEW", "MORE_INFO_REQUIRED"]))
            .count()
        )

        # Disposals count and proceeds
        disposed_items = db.query(Item).filter(Item.operational_status == "DISPOSED").count()
        proceeds_res = db.query(func.sum(Disposal.total_sale_proceeds)).scalar()
        total_proceeds = float(proceeds_res or 0.0)

        # Recent activities from audit logs
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

        # Office distribution
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
        query = db.query(Alert).filter(Alert.status == "ACTIVE")
        if "SYSTEM_ADMIN" not in current_user.role_names:
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

        unread_notifs = db.query(Notification).filter(Notification.recipient_user_id == current_user.id, Notification.is_read.is_(False)).count()

        return AlertsSummaryOut(
            total_unresolved=total,
            critical_count=crit,
            high_count=high,
            medium_count=med,
            low_count=low,
            by_type=by_type,
            unread_notifications_count=unread_notifs,
        )

    # 2. Standard Reports Data Fetching
    @staticmethod
    def get_report_data(db: Session, report_name: str, office_id: Optional[UUID] = None) -> Tuple[List[str], List[List[Any]]]:
        headers: List[str] = []
        rows: List[List[Any]] = []

        if report_name in ["stock-register", "current-stock"]:
            headers = ["Item Code", "Item Name", "Category", "Location", "UOM", "Available Qty", "Condition", "Status"]
            query = db.query(Item).filter(Item.operational_status != "DISPOSED")
            if office_id:
                query = query.filter(Item.office_id == office_id)
            for it in query.all():
                bal = sum(float(b.available_qty) for b in it.stock_balances) if it.stock_balances else (1.0 if it.operational_status == "AVAILABLE_IN_STORE" else 0.0)
                rows.append([
                    it.item_code,
                    it.item_name,
                    it.category.name if it.category else "",
                    it.location.room_number if it.location else "",
                    it.uom.code if it.uom else "NOS",
                    bal,
                    it.condition,
                    it.operational_status,
                ])

        elif report_name in ["asset-register", "capital-assets"]:
            headers = ["Asset Code", "Name", "Serial No", "Purchase Date", "Cost (₹)", "Supplier", "Location", "Custodian", "Status"]
            query = db.query(Item).filter(Item.item_type == "DURABLE_ASSET")
            if office_id:
                query = query.filter(Item.office_id == office_id)
            for it in query.all():
                rows.append([
                    it.item_code,
                    it.item_name,
                    it.serial_number or "N/A",
                    str(it.purchase_date or "N/A"),
                    float(it.total_cost),
                    it.supplier.name if it.supplier else "N/A",
                    it.location.room_number if it.location else "",
                    it.current_custodian or "Store Pool",
                    it.operational_status,
                ])

        elif report_name in ["asset-valuation", "valuation"]:
            headers = ["Asset Code", "Name", "Category", "Purchase Cost (₹)", "Age (Years)", "Depreciation Rate", "Est. Depreciated Value (₹)"]
            query = db.query(Item).filter(Item.operational_status != "DISPOSED")
            if office_id:
                query = query.filter(Item.office_id == office_id)
            today = datetime.now(timezone.utc).date()
            for it in query.all():
                cost = float(it.total_cost)
                p_date = it.purchase_date or it.created_at.date()
                age_years = max(0.0, (today - p_date).days / 365.25)
                rate = float(it.category.depreciation_rate_pct) if it.category else 15.0
                deprec = cost * (rate / 100.0) * age_years
                est_val = max(0.0, cost - deprec)
                rows.append([
                    it.item_code,
                    it.item_name,
                    it.category.name if it.category else "",
                    cost,
                    round(age_years, 1),
                    f"{rate}%",
                    round(est_val, 2),
                ])

        elif report_name in ["movements", "movement-register"]:
            headers = ["Voucher Number", "Type", "Date", "Office", "Recipient", "Status", "Actor"]
            query = db.query(StockTransaction)
            if office_id:
                query = query.filter(StockTransaction.office_id == office_id)
            for txn in query.order_by(StockTransaction.created_at.desc()).all():
                rows.append([
                    txn.transaction_number,
                    txn.transaction_type,
                    txn.created_at.strftime("%d/%m/%Y"),
                    txn.office.code if txn.office else "",
                    txn.recipient_name or "N/A",
                    txn.status,
                    txn.actor.full_name if txn.actor else "",
                ])

        elif report_name in ["dead-stock", "dead-stock-register"]:
            headers = ["Item Code", "Item Name", "Classification", "Condition", "Recorded Cost (₹)", "Days Inactive", "Location"]
            query = db.query(Item).filter(
                Item.operational_status != "DISPOSED",
                Item.current_classification.in_(["NON_MOVING", "OBSOLETE"]),
            )
            if office_id:
                query = query.filter(Item.office_id == office_id)
            today = datetime.now(timezone.utc).date()
            for it in query.all():
                ref_dt = it.last_movement_date or it.created_at.date()
                days_inact = (today - ref_dt).days
                rows.append([
                    it.item_code,
                    it.item_name,
                    it.current_classification,
                    it.condition,
                    float(it.total_cost),
                    days_inact,
                    it.location.room_number if it.location else "",
                ])

        elif report_name in ["disposals", "disposal-register"]:
            headers = ["Disposal No", "Proposal No", "Method", "Date", "Proceeds (₹)", "Buyer Agency", "Order No"]
            query = db.query(Disposal)
            if office_id:
                query = query.filter(Disposal.office_id == office_id)
            for d in query.order_by(Disposal.disposal_date.desc()).all():
                rows.append([
                    d.disposal_number,
                    d.request.request_number if d.request else "",
                    d.disposal_method,
                    str(d.disposal_date),
                    float(d.total_sale_proceeds),
                    d.recipient_agency,
                    d.reference_order_number,
                ])

        elif report_name in ["condemnations"]:
            headers = ["Proposal No", "Reason", "Status", "Submitted By", "Date", "Items Count"]
            query = db.query(CondemnationRequest)
            if office_id:
                query = query.filter(CondemnationRequest.office_id == office_id)
            for c in query.order_by(CondemnationRequest.created_at.desc()).all():
                rows.append([
                    c.request_number,
                    c.reason_code,
                    c.status,
                    c.submitter.full_name if c.submitter else "",
                    c.created_at.strftime("%d/%m/%Y"),
                    len(c.items),
                ])

        else:
            headers = ["Item Code", "Item Name", "Status", "Date"]
            query = db.query(Item).limit(50)
            for it in query.all():
                rows.append([it.item_code, it.item_name, it.operational_status, str(it.created_at.date())])

        return headers, rows

    # 3. Export Generators
    @staticmethod
    def export_to_csv(headers: List[str], rows: List[List[Any]]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for r in rows:
            writer.writerow(r)
        return output.getvalue()

    @staticmethod
    def export_to_xlsx(title: str, headers: List[str], rows: List[List[Any]]) -> bytes:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = title[:30]

        # Header Title
        ws.append([settings.ORGANIZATION_NAME])
        ws.append([f"Report: {title.replace('-', ' ').title()}"])
        ws.append([f"Generated: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M:%S UTC')}"])
        ws.append([])  # Blank row

        ws.append(headers)
        for row in rows:
            ws.append(row)

        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    @staticmethod
    def export_to_pdf(title: str, headers: List[str], rows: List[List[Any]]) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=30,
            leftMargin=30,
            topMargin=30,
            bottomMargin=30,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "TitleStyle",
            parent=styles["Heading1"],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#1e3a8a"),
            alignment=1,  # Center
        )
        sub_style = ParagraphStyle(
            "SubStyle",
            parent=styles["Normal"],
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#475569"),
            alignment=1,
        )

        elements = []
        elements.append(Paragraph(settings.ORGANIZATION_NAME, title_style))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(f"Official Government Register: {title.replace('-', ' ').title()}", sub_style))
        elements.append(Paragraph(f"Generated at: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')}", sub_style))
        elements.append(Spacer(1, 14))

        # Format Table
        table_data = [headers]
        for r in rows[:150]:  # Limit rows per PDF page block
            table_data.append([str(c) for c in r])

        t = Table(table_data)
        t.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
            ])
        )
        elements.append(t)
        doc.build(elements)
        return buffer.getvalue()

