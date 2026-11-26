"""Alerts and In-App Notifications Service

Monitors conditions using configurable thresholds, generates alerts without duplicates,
and delivers in-app notifications.
"""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from app.core.exceptions import NotFoundError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.alerts.models import Alert, Notification
from app.features.alerts.schemas import AlertOut, AlertSummaryOut
from app.features.audit.services import AuditService
from app.features.inventory.models import Item, StockBalance
from app.features.maintenance.models import MaintenanceRecord
from app.features.roles.models import Role
from app.features.settings.services import SettingsService
from app.features.users.models import User
from app.features.warranties.models import Warranty

ALERT_TYPE_ALIASES = {
    "INACTIVITY": "NON_MOVING_INACTIVITY",
    "WARRANTY": "WARRANTY_EXPIRING",
    "MAINTENANCE": "MAINTENANCE_DUE",
    "STOCK": "LOW_STOCK",
}


def _alert_ref(alert_id: UUID) -> str:
    return f"ALT-{str(alert_id).split('-')[0].upper()}"


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


class AlertService:
    @staticmethod
    def _serialize(al: Alert) -> AlertOut:
        return AlertOut(
            id=al.id,
            alert_reference=_alert_ref(al.id),
            office_id=al.office_id,
            office_name=al.office.name if al.office else None,
            item_id=al.item_id,
            item_code=al.item.item_code if al.item else None,
            item_name=al.item.item_name if al.item else None,
            alert_type=al.alert_type,
            priority=al.priority,
            title=al.title,
            message=al.message,
            status=al.status,
            snoozed_until=al.snoozed_until,
            resolved_by=al.resolved_by,
            resolver_name=al.resolver.full_name if al.resolver else None,
            resolved_at=al.resolved_at,
            created_at=al.created_at,
        )

    @staticmethod
    def get_alert_model(db: Session, alert_id: UUID) -> Alert:
        al = (
            db.query(Alert)
            .options(
                joinedload(Alert.office),
                joinedload(Alert.item),
                joinedload(Alert.resolver),
            )
            .filter(Alert.id == alert_id)
            .first()
        )
        if not al:
            raise NotFoundError(f"Alert '{alert_id}' was not found", code="ALERT_NOT_FOUND")
        return al

    @staticmethod
    def get_alert(db: Session, alert_id: UUID) -> AlertOut:
        return AlertService._serialize(AlertService.get_alert_model(db, alert_id))

    @staticmethod
    def list_alerts(
        db: Session,
        office_id: Optional[UUID] = None,
        alert_type: Optional[str] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[AlertOut], int]:
        query = db.query(Alert).options(
            joinedload(Alert.office),
            joinedload(Alert.item),
            joinedload(Alert.resolver),
        )
        now_dt = datetime.now(timezone.utc)

        if office_id:
            query = query.filter(Alert.office_id == office_id)
        if alert_type:
            normalized_type = ALERT_TYPE_ALIASES.get(alert_type.upper(), alert_type.upper())
            query = query.filter(Alert.alert_type == normalized_type)
        if priority:
            query = query.filter(Alert.priority == priority.upper())

        if status:
            st = status.upper()
            if st == "ACTIVE":
                query = query.filter(
                    Alert.status.in_(["ACTIVE", "SNOOZED"]),
                    (Alert.snoozed_until.is_(None)) | (Alert.snoozed_until <= now_dt),
                )
            elif st == "SNOOZED":
                query = query.filter(
                    Alert.status == "SNOOZED",
                    Alert.snoozed_until > now_dt,
                )
            else:
                query = query.filter(Alert.status == st)

        if date_from:
            query = query.filter(Alert.created_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc))
        if date_to:
            query = query.filter(Alert.created_at <= datetime.combine(date_to, datetime.max.time(), tzinfo=timezone.utc))

        if search and search.strip():
            term = f"%{search.strip()}%"
            clean_q = search.strip().upper().replace("ALT-", "")
            query = query.outerjoin(Item, Alert.item_id == Item.id).filter(
                or_(
                    Alert.title.ilike(term),
                    Alert.message.ilike(term),
                    Item.item_code.ilike(term),
                    Item.item_name.ilike(term),
                    func.cast(Alert.id, Item.item_code.type).ilike(f"{clean_q}%"),
                )
            )

        total = query.count()

        sort_map = {
            "created_at": Alert.created_at,
            "priority": Alert.priority,
            "status": Alert.status,
            "alert_type": Alert.alert_type,
        }
        sort_col = sort_map.get(sort_by, Alert.created_at)
        order_expr = sort_col.asc() if sort_dir.lower() == "asc" else sort_col.desc()

        alerts = (
            query.order_by(order_expr)
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return [AlertService._serialize(a) for a in alerts], total

    @staticmethod
    def get_summary(
        db: Session,
        office_id: Optional[UUID] = None,
        current_user: Optional[User] = None,
    ) -> AlertSummaryOut:
        query = db.query(Alert).options(
            joinedload(Alert.office),
            joinedload(Alert.item),
            joinedload(Alert.resolver),
        )
        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(Alert.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(Alert.office_id == office_id)

        all_alerts = query.order_by(Alert.created_at.desc()).all()
        now_dt = datetime.now(timezone.utc)

        active_alerts: List[Alert] = []
        unack = 0
        ack = 0
        snoozed = 0
        resolved = 0
        by_type: Dict[str, int] = defaultdict(int)
        by_prio: Dict[str, int] = defaultdict(int)

        for a in all_alerts:
            snooze_dt = _to_utc(a.snoozed_until)
            is_actively_snoozed = a.status == "SNOOZED" and snooze_dt is not None and snooze_dt > now_dt
            if is_actively_snoozed:
                snoozed += 1
            elif a.status == "RESOLVED":
                resolved += 1
            elif a.status == "ACKNOWLEDGED":
                ack += 1
                active_alerts.append(a)
                by_type[a.alert_type] += 1
                by_prio[a.priority] += 1
            else:
                # ACTIVE or expired SNOOZED
                unack += 1
                active_alerts.append(a)
                by_type[a.alert_type] += 1
                by_prio[a.priority] += 1

        return AlertSummaryOut(
            total_active=len(active_alerts),
            critical_count=by_prio["CRITICAL"],
            high_count=by_prio["HIGH"],
            medium_count=by_prio["MEDIUM"],
            low_count=by_prio["LOW"],
            unacknowledged_count=unack,
            acknowledged_count=ack,
            snoozed_count=snoozed,
            resolved_count=resolved,
            by_type=dict(by_type),
            recent_alerts=[AlertService._serialize(a) for a in all_alerts[:6]],
        )

    @staticmethod
    def _create_or_wake_alert(
        db: Session,
        office_id: UUID,
        alert_type: str,
        priority: str,
        title: str,
        message: str,
        item_id: Optional[UUID] = None,
    ) -> Tuple[Alert, bool]:
        """Prevents duplicate active/acknowledged/snoozed alerts for the same item and type."""
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
            snooze_dt = _to_utc(existing.snoozed_until)
            if existing.status == "SNOOZED" and snooze_dt is not None and snooze_dt <= now_dt:
                existing.status = "ACTIVE"
                existing.snoozed_until = None
                db.flush()
                return existing, True
            return existing, False

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

        # Broadcast notification to store officers (and system admins) of this office
        officer_role = db.query(Role).filter(Role.name == "STORE_OFFICER").first()
        officers = (
            db.query(User)
            .join(User.roles)
            .filter(User.office_id == office_id, Role.name == "STORE_OFFICER", User.status == "ACTIVE")
            .all()
        )
        action_url = f"/inventory/{item_id}" if item_id else "/alerts"
        if alert_type == "WARRANTY_EXPIRING":
            action_url = "/maintenance/warranties"
        elif alert_type == "MAINTENANCE_DUE":
            action_url = "/maintenance"

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
                related_entity_type="ITEM" if item_id else "ALERT",
                related_entity_id=item_id or alert.id,
                action_url=action_url,
                is_read=False,
            )
            db.add(notif)

        db.flush()
        return alert, True

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
        alert, _ = AlertService._create_or_wake_alert(
            db=db,
            office_id=office_id,
            alert_type=alert_type,
            priority=priority,
            title=title,
            message=message,
            item_id=item_id,
        )
        return alert

    @staticmethod
    def _get_office_thresholds(db: Session, office_id: UUID) -> Dict[str, Any]:
        inactivity_days = SettingsService.get_setting(db, "classification.inactivity_threshold_days", office_id=office_id)
        warranty_leads = SettingsService.get_setting(db, "notifications.lead_days_warranty", office_id=office_id)
        overdue_days = SettingsService.get_setting(db, "maintenance.overdue_days", office_id=office_id)

        try:
            inact_int = int(inactivity_days) if inactivity_days is not None else 180
        except (TypeError, ValueError):
            inact_int = 180

        if isinstance(warranty_leads, list) and warranty_leads:
            max_lead = max(int(x) for x in warranty_leads)
        elif isinstance(warranty_leads, (int, float)):
            max_lead = int(warranty_leads)
        else:
            max_lead = 60

        try:
            overdue_int = int(overdue_days) if overdue_days is not None else 14
        except (TypeError, ValueError):
            overdue_int = 14

        return {
            "inactivity_days": inact_int,
            "warranty_lead_days": max_lead,
            "maintenance_overdue_days": overdue_int,
        }

    @staticmethod
    def run_alert_evaluation_job(
        db: Session,
        office_id: Optional[UUID] = None,
        actor: Optional[User] = None,
    ) -> int:
        """Evaluates non-moving/inactivity items, warranties, maintenance, and stock levels/conditions."""
        alerts_generated = 0
        today = datetime.now(timezone.utc).date()
        thresholds_cache: Dict[UUID, Dict[str, Any]] = {}

        def get_thresh(oid: UUID) -> Dict[str, Any]:
            if oid not in thresholds_cache:
                thresholds_cache[oid] = AlertService._get_office_thresholds(db, oid)
            return thresholds_cache[oid]

        # 1. Non-Moving / Obsolete / Inactivity items
        item_query = db.query(Item).filter(Item.operational_status != "DISPOSED")
        if office_id:
            item_query = item_query.filter(Item.office_id == office_id)

        for it in item_query.all():
            t = get_thresh(it.office_id)
            ref_date = it.last_movement_date or (it.created_at.date() if it.created_at else today)
            days_inactive = (today - ref_date).days
            is_dead_class = it.current_classification in ("NON_MOVING", "OBSOLETE")
            is_inactive_threshold = days_inactive >= t["inactivity_days"]

            if is_dead_class or is_inactive_threshold:
                priority = "CRITICAL" if it.current_classification == "OBSOLETE" else "HIGH"
                reason = (
                    f"classified as {it.current_classification}"
                    if is_dead_class
                    else f"inactive for {days_inactive} days (threshold: {t['inactivity_days']} days)"
                )
                _, created = AlertService._create_or_wake_alert(
                    db=db,
                    office_id=it.office_id,
                    alert_type="NON_MOVING_INACTIVITY",
                    priority=priority,
                    title=f"Inactivity / Dead Stock Warning: {it.item_name}",
                    message=f"Asset {it.item_code} is {reason}. Review for potential reallocation or condemnation.",
                    item_id=it.id,
                )
                if created:
                    alerts_generated += 1

        # 2. Expiring Warranties (using configured lead days)
        war_query = (
            db.query(Warranty)
            .join(Item, Warranty.item_id == Item.id)
            .options(joinedload(Warranty.item))
            .filter(
                Warranty.end_date >= today,
                Item.operational_status != "DISPOSED",
            )
        )
        if office_id:
            war_query = war_query.filter(Item.office_id == office_id)

        for war in war_query.all():
            t = get_thresh(war.item.office_id)
            days_left = (war.end_date - today).days
            if days_left <= t["warranty_lead_days"]:
                priority = "CRITICAL" if days_left <= 7 else ("HIGH" if days_left <= 30 else "MEDIUM")
                _, created = AlertService._create_or_wake_alert(
                    db=db,
                    office_id=war.item.office_id,
                    alert_type="WARRANTY_EXPIRING",
                    priority=priority,
                    title=f"Warranty Expiring in {days_left} Days: {war.item.item_name}",
                    message=f"Warranty provided by {war.provider_name} for asset {war.item.item_code} expires on {war.end_date}.",
                    item_id=war.item_id,
                )
                if created:
                    alerts_generated += 1

        # 3. Unresolved / Overdue Maintenance Records
        maint_query = (
            db.query(MaintenanceRecord)
            .options(joinedload(MaintenanceRecord.item))
            .filter(
                MaintenanceRecord.status.in_(["REPORTED", "UNDER_REVIEW", "APPROVED", "IN_REPAIR"])
            )
        )
        if office_id:
            maint_query = maint_query.filter(MaintenanceRecord.office_id == office_id)

        for m in maint_query.all():
            t = get_thresh(m.office_id)
            days_open = (today - m.reported_date).days if m.reported_date else 0
            is_overdue = days_open >= t["maintenance_overdue_days"]
            priority = "HIGH" if is_overdue else "MEDIUM"
            prefix = "Maintenance Overdue" if is_overdue else "Maintenance Pending"
            _, created = AlertService._create_or_wake_alert(
                db=db,
                office_id=m.office_id,
                alert_type="MAINTENANCE_DUE",
                priority=priority,
                title=f"{prefix}: {m.item.item_name if m.item else 'Asset'}",
                message=f"Maintenance ticket ({days_open}d open) for '{m.issue_description}' is in state '{m.status}'.",
                item_id=m.item_id,
            )
            if created:
                alerts_generated += 1

        # 4. Low Stock Consumables & Damaged/Scrap Stock Conditions
        bal_query = (
            db.query(StockBalance, Item)
            .join(Item, StockBalance.item_id == Item.id)
            .filter(
                Item.item_type == "CONSUMABLE_STOCK",
                Item.operational_status != "DISPOSED",
                Item.min_stock_level > 0,
                StockBalance.available_qty <= Item.min_stock_level,
            )
        )
        if office_id:
            bal_query = bal_query.filter(StockBalance.office_id == office_id)

        for bal, it in bal_query.all():
            priority = "CRITICAL" if float(bal.available_qty) <= 0 else "HIGH"
            _, created = AlertService._create_or_wake_alert(
                db=db,
                office_id=bal.office_id,
                alert_type="LOW_STOCK",
                priority=priority,
                title=f"Low Stock Threshold Reached: {it.item_name}",
                message=f"Available stock balance ({bal.available_qty}) is at or below reorder level ({it.min_stock_level}).",
                item_id=it.id,
            )
            if created:
                alerts_generated += 1

        # Stock condition alert for DAMAGED/SCRAP items not yet in condemnation/disposal
        cond_query = db.query(Item).filter(
            Item.condition.in_(["DAMAGED", "SCRAP"]),
            Item.operational_status.in_(["AVAILABLE_IN_STORE", "IN_USE", "DAMAGED", "NON_FUNCTIONAL"]),
        )
        if office_id:
            cond_query = cond_query.filter(Item.office_id == office_id)

        for it in cond_query.all():
            _, created = AlertService._create_or_wake_alert(
                db=db,
                office_id=it.office_id,
                alert_type="LOW_STOCK",
                priority="HIGH",
                title=f"Stock Condition Alert ({it.condition}): {it.item_name}",
                message=f"Item {it.item_code} is marked '{it.condition}' and requires repair or condemnation review.",
                item_id=it.id,
            )
            if created:
                alerts_generated += 1

        AuditService.log_action(
            db=db,
            action="RUN_ALERT_CHECK",
            module="ALERTS",
            record_id=str(office_id) if office_id else "ALL_OFFICES",
            actor=actor,
            office_id=office_id or (actor.office_id if actor else None),
            new_values={"alerts_generated": alerts_generated},
        )
        db.commit()
        return alerts_generated

    @staticmethod
    def acknowledge_alert(db: Session, alert_id: UUID, user: User) -> AlertOut:
        alert = AlertService.get_alert_model(db, alert_id)
        if alert.status == "RESOLVED":
            raise ValidationError("Cannot acknowledge an already resolved alert", code="INVALID_ALERT_STATE")
        old_status = alert.status
        alert.status = "ACKNOWLEDGED"
        alert.snoozed_until = None
        db.flush()
        AuditService.log_action(
            db=db,
            action="ACKNOWLEDGE",
            module="ALERTS",
            record_id=str(alert.id),
            actor=user,
            office_id=alert.office_id,
            old_values={"status": old_status},
            new_values={"status": "ACKNOWLEDGED"},
        )
        db.commit()
        return AlertService._serialize(AlertService.get_alert_model(db, alert.id))

    @staticmethod
    def resolve_alert(db: Session, alert_id: UUID, remarks: str, user: User) -> AlertOut:
        alert = AlertService.get_alert_model(db, alert_id)
        if alert.status == "RESOLVED":
            raise ValidationError("Alert is already resolved", code="INVALID_ALERT_STATE")
        old_status = alert.status
        alert.status = "RESOLVED"
        alert.snoozed_until = None
        alert.resolved_by = user.id
        alert.resolved_at = datetime.now(timezone.utc)
        alert.message = f"{alert.message} | Resolution: {remarks.strip()}"
        db.flush()
        AuditService.log_action(
            db=db,
            action="RESOLVE",
            module="ALERTS",
            record_id=str(alert.id),
            actor=user,
            office_id=alert.office_id,
            old_values={"status": old_status},
            new_values={"status": "RESOLVED", "resolution_remarks": remarks.strip()},
        )
        db.commit()
        return AlertService._serialize(AlertService.get_alert_model(db, alert.id))

    @staticmethod
    def snooze_alert(db: Session, alert_id: UUID, snooze_days: int, user: User) -> AlertOut:
        alert = AlertService.get_alert_model(db, alert_id)
        if alert.status == "RESOLVED":
            raise ValidationError("Cannot snooze an already resolved alert", code="INVALID_ALERT_STATE")
        old_status = alert.status
        snoozed_until = datetime.now(timezone.utc) + timedelta(days=snooze_days)
        alert.status = "SNOOZED"
        alert.snoozed_until = snoozed_until
        db.flush()
        AuditService.log_action(
            db=db,
            action="SNOOZE",
            module="ALERTS",
            record_id=str(alert.id),
            actor=user,
            office_id=alert.office_id,
            old_values={"status": old_status},
            new_values={"status": "SNOOZED", "snooze_days": snooze_days, "snoozed_until": snoozed_until.isoformat()},
        )
        db.commit()
        return AlertService._serialize(AlertService.get_alert_model(db, alert.id))

    # Notifications
    @staticmethod
    def list_user_notifications(
        db: Session,
        user: User,
        is_read: Optional[bool] = None,
        notification_type: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Notification], int]:
        query = db.query(Notification).filter(Notification.recipient_user_id == user.id)
        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)
        if notification_type:
            query = query.filter(Notification.notification_type == notification_type.upper())

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
