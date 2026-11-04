"""Alerts and In-App Notifications Service

Monitors conditions, generates alerts without duplicates, and delivers notifications.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import NotFoundError, ValidationError
from app.features.alerts.models import Alert, Notification
from app.features.audit.services import AuditService
from app.features.inventory.models import Item, StockBalance
from app.features.maintenance.models import MaintenanceRecord
from app.features.roles.models import Role
from app.features.users.models import User
from app.features.warranties.models import Warranty


class AlertService:
    @staticmethod
    def get_alert(db: Session, alert_id: UUID) -> Alert:
        al = db.query(Alert).filter(Alert.id == alert_id).first()
        if not al:
            raise NotFoundError(f"Alert '{alert_id}' was not found", code="ALERT_NOT_FOUND")
        return al

    @staticmethod
    def list_alerts(
        db: Session,
        office_id: Optional[UUID] = None,
        alert_type: Optional[str] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Alert], int]:
        query = db.query(Alert)
        now_dt = datetime.now(timezone.utc)

        if office_id:
            query = query.filter(Alert.office_id == office_id)
        if alert_type:
            query = query.filter(Alert.alert_type == alert_type.upper())
        if priority:
            query = query.filter(Alert.priority == priority.upper())

        if status:
            if status.upper() == "ACTIVE":
                # Exclude snoozed alerts whose snooze period has not expired
                query = query.filter(
                    Alert.status.in_(["ACTIVE", "SNOOZED"]),
                    (Alert.snoozed_until.is_(None)) | (Alert.snoozed_until <= now_dt),
                )
            else:
                query = query.filter(Alert.status == status.upper())

        total = query.count()
        alerts = query.order_by(Alert.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        return alerts, total

    @staticmethod
    def create_alert_if_not_exists(
        db: Session,
        office_id: UUID,
        alert_type: str,
        priority: str,
        title: str,
        message: str,
        item_id: Optional[UUID] = None,
    ) -> Optional[Alert]:
        """Prevents duplicate active alerts for the same item and type."""
        now_dt = datetime.now(timezone.utc)
        existing = (
            db.query(Alert)
            .filter(
                Alert.office_id == office_id,
                Alert.alert_type == alert_type,
                Alert.item_id == item_id,
                Alert.status.in_(["ACTIVE", "ACKNOWLEDGED", "SNOOZED"]),
            )
            .first()
        )
        if existing:
            # If snoozed and expired, wake it up to ACTIVE
            if existing.status == "SNOOZED" and existing.snoozed_until and existing.snoozed_until <= now_dt:
                existing.status = "ACTIVE"
                existing.snoozed_until = None
                db.flush()
            return existing

        alert = Alert(
            office_id=office_id,
            item_id=item_id,
            alert_type=alert_type,
            priority=priority,
            title=title,
            message=message,
            status="ACTIVE",
        )
        db.add(alert)
        db.flush()

        # Broadcast notification to store officers of this office
        officer_role = db.query(Role).filter(Role.name == "STORE_OFFICER").first()
        officers = (
            db.query(User)
            .join(User.roles)
            .filter(User.office_id == office_id, Role.name == "STORE_OFFICER", User.status == "ACTIVE")
            .all()
        )
        for off in officers:
            notif = Notification(
                recipient_user_id=off.id,
                recipient_role_id=officer_role.id if officer_role else None,
                office_id=office_id,
                alert_id=alert.id,
                notification_type="SYSTEM_ALERT",
                title=title,
                message=message,
                priority=priority,
                related_entity_type="ITEM" if item_id else None,
                related_entity_id=item_id,
                action_url=f"/inventory/{item_id}" if item_id else "/alerts",
                is_read=False,
            )
            db.add(notif)

        db.flush()
        return alert

    @staticmethod
    def run_alert_evaluation_job(db: Session, office_id: Optional[UUID] = None) -> int:
        """Evaluates non-moving items, warranties, maintenance, and stock levels."""
        alerts_generated = 0
        today = datetime.now(timezone.utc).date()

        # 1. Non-Moving & Obsolete items
        item_query = db.query(Item).filter(
            Item.operational_status != "DISPOSED",
            Item.current_classification.in_(["NON_MOVING", "OBSOLETE"]),
        )
        if office_id:
            item_query = item_query.filter(Item.office_id == office_id)

        dead_stock_items = item_query.all()
        for it in dead_stock_items:
            priority = "CRITICAL" if it.current_classification == "OBSOLETE" else "HIGH"
            al = AlertService.create_alert_if_not_exists(
                db=db,
                office_id=it.office_id,
                alert_type="NON_MOVING_INACTIVITY",
                priority=priority,
                title=f"Dead Stock Warning: {it.item_name} ({it.current_classification})",
                message=f"Asset {it.item_code} has been classified as {it.current_classification}. Review for potential condemnation.",
                item_id=it.id,
            )
            if al:
                alerts_generated += 1

        # 2. Expiring Warranties (within 60 days)
        cutoff_date = today + timedelta(days=60)
        war_query = db.query(Warranty).join(Item).filter(
            Warranty.end_date >= today,
            Warranty.end_date <= cutoff_date,
            Item.operational_status != "DISPOSED",
        )
        if office_id:
            war_query = war_query.filter(Item.office_id == office_id)

        for war in war_query.all():
            days_left = (war.end_date - today).days
            al = AlertService.create_alert_if_not_exists(
                db=db,
                office_id=war.item.office_id,
                alert_type="WARRANTY_EXPIRING",
                priority="HIGH" if days_left <= 30 else "MEDIUM",
                title=f"Warranty Expiring in {days_left} Days: {war.item.item_name}",
                message=f"Warranty provided by {war.provider_name} for asset {war.item.item_code} expires on {war.end_date}.",
                item_id=war.item_id,
            )
            if al:
                alerts_generated += 1

        # 3. Unresolved Maintenance Records
        maint_query = db.query(MaintenanceRecord).filter(
            MaintenanceRecord.status.in_(["REPORTED", "UNDER_REVIEW", "IN_REPAIR"])
        )
        if office_id:
            maint_query = maint_query.filter(MaintenanceRecord.office_id == office_id)

        for m in maint_query.all():
            al = AlertService.create_alert_if_not_exists(
                db=db,
                office_id=m.office_id,
                alert_type="MAINTENANCE_DUE",
                priority="MEDIUM",
                title=f"Maintenance Pending: {m.item.item_name if m.item else 'Asset'}",
                message=f"Maintenance ticket for defect '{m.issue_description}' is currently in state '{m.status}'.",
                item_id=m.item_id,
            )
            if al:
                alerts_generated += 1

        # 4. Low Stock Consumables (available_qty <= min_stock_level)
        bal_query = (
            db.query(StockBalance, Item)
            .join(Item, StockBalance.item_id == Item.id)
            .filter(
                Item.item_type == "CONSUMABLE_STOCK",
                Item.min_stock_level > 0,
                StockBalance.available_qty <= Item.min_stock_level,
            )
        )
        if office_id:
            bal_query = bal_query.filter(StockBalance.office_id == office_id)

        for bal, it in bal_query.all():
            al = AlertService.create_alert_if_not_exists(
                db=db,
                office_id=bal.office_id,
                alert_type="LOW_STOCK",
                priority="HIGH",
                title=f"Low Stock Threshold Reached: {it.item_name}",
                message=f"Available stock balance ({bal.available_qty}) has fallen to or below the reorder point ({it.min_stock_level}).",
                item_id=it.id,
            )
            if al:
                alerts_generated += 1

        db.commit()
        return alerts_generated

    @staticmethod
    def acknowledge_alert(db: Session, alert_id: UUID, user: User) -> Alert:
        alert = AlertService.get_alert(db, alert_id)
        alert.status = "ACKNOWLEDGED"
        db.commit()
        db.refresh(alert)
        return alert

    @staticmethod
    def resolve_alert(db: Session, alert_id: UUID, remarks: str, user: User) -> Alert:
        alert = AlertService.get_alert(db, alert_id)
        alert.status = "RESOLVED"
        alert.resolved_by = user.id
        alert.resolved_at = datetime.now(timezone.utc)
        alert.message = f"{alert.message} | Resolution: {remarks}"
        db.commit()
        db.refresh(alert)
        return alert

    @staticmethod
    def snooze_alert(db: Session, alert_id: UUID, snooze_days: int, user: User) -> Alert:
        alert = AlertService.get_alert(db, alert_id)
        alert.status = "SNOOZED"
        alert.snoozed_until = datetime.now(timezone.utc) + timedelta(days=snooze_days)
        db.commit()
        db.refresh(alert)
        return alert

    # Notifications
    @staticmethod
    def list_user_notifications(
        db: Session,
        user: User,
        is_read: Optional[bool] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Notification], int]:
        query = db.query(Notification).filter(Notification.recipient_user_id == user.id)
        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)

        total = query.count()
        notifs = query.order_by(Notification.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        return notifs, total

    @staticmethod
    def get_unread_count(db: Session, user: User) -> int:
        return db.query(Notification).filter(Notification.recipient_user_id == user.id, Notification.is_read.is_(False)).count()

    @staticmethod
    def mark_notification_read(db: Session, notification_id: UUID, user: User) -> Notification:
        notif = db.query(Notification).filter(Notification.id == notification_id, Notification.recipient_user_id == user.id).first()
        if not notif:
            raise NotFoundError("Notification not found")
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notif)
        return notif

    @staticmethod
    def mark_all_notifications_read(db: Session, user: User) -> int:
        count = (
            db.query(Notification)
            .filter(Notification.recipient_user_id == user.id, Notification.is_read.is_(False))
            .update({"is_read": True, "read_at": datetime.now(timezone.utc)}, synchronize_session=False)
        )
        db.commit()
        return count

