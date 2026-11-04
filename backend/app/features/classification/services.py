"""Classification Engine Service

Evaluates dead stock candidates using strict 5-tier precedence and manages manual overrides.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import NotFoundError, OfficeAccessDeniedError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.services import AuditService
from app.features.classification.models import Classification
from app.features.classification.schemas import (
    ClassificationOverrideRequest,
    ClassificationReleaseOverrideRequest,
    ClassificationRunResultOut,
    ClassificationSummaryOut,
)
from app.features.inventory.models import Item
from app.features.settings.services import SettingsService
from app.features.users.models import User


class ClassificationService:
    RULE_VERSION = "v1.0"

    @staticmethod
    def evaluate_item(item: Item, db: Session) -> Tuple[str, Dict[str, Any], int, int]:
        """Evaluates an item according to the 5-tier precedence rules.

        Returns: (classification, contributing_factors, days_inactive, item_age_days)
        """
        now_dt = datetime.now(timezone.utc).date()

        # Calculate days inactive (days since last_movement_date or creation)
        ref_movement_date = item.last_movement_date or item.created_at.date()
        days_inactive = max(0, (now_dt - ref_movement_date).days)

        # Calculate item age
        ref_purchase_date = item.purchase_date or item.created_at.date()
        item_age_days = max(0, (now_dt - ref_purchase_date).days)
        item_age_years = item_age_days / 365.25

        # Fetch category-specific thresholds with office/system fallback
        cat = item.category
        slow_moving_thresh = (
            cat.slow_moving_threshold_days
            if cat
            else SettingsService.get_setting(db, "classification.slow_moving_threshold_days", item.office_id) or 90
        )
        inactivity_thresh = (
            cat.inactivity_threshold_days
            if cat
            else SettingsService.get_setting(db, "classification.inactivity_threshold_days", item.office_id) or 180
        )
        obsolescence_years_thresh = (
            cat.obsolescence_years
            if cat
            else SettingsService.get_setting(db, "classification.obsolescence_years", item.office_id) or 5
        )

        factors = {
            "condition": item.condition,
            "days_inactive": days_inactive,
            "item_age_years": round(item_age_years, 2),
            "thresholds": {
                "slow_moving_days": slow_moving_thresh,
                "inactivity_days": inactivity_thresh,
                "obsolescence_years": obsolescence_years_thresh,
            },
        }

        # Precedence 1: Physical Condition (DAMAGED / SCRAP) -> OBSOLETE
        if item.condition in ["DAMAGED", "SCRAP"]:
            factors["matched_rule"] = "Precedence 1: Physical condition is Damaged/Scrap beyond economic repair"
            return "OBSOLETE", factors, days_inactive, item_age_days

        # Precedence 2: Useful Life Lifespan & Sluggish Inactivity -> OBSOLETE
        if item_age_years >= obsolescence_years_thresh and days_inactive >= slow_moving_thresh:
            factors["matched_rule"] = (
                f"Precedence 2: Asset exceeded useful life ({round(item_age_years, 1)} >= {obsolescence_years_thresh} yrs) "
                f"and inactive for {days_inactive} days"
            )
            return "OBSOLETE", factors, days_inactive, item_age_days

        # Precedence 3: Non-Moving Inactivity Threshold -> NON_MOVING
        if days_inactive >= inactivity_thresh:
            factors["matched_rule"] = (
                f"Precedence 3: Inactive for {days_inactive} days without movement (threshold {inactivity_thresh} days)"
            )
            return "NON_MOVING", factors, days_inactive, item_age_days

        # Precedence 4: Sluggish Movement Threshold -> SLOW_MOVING
        if days_inactive >= slow_moving_thresh:
            factors["matched_rule"] = (
                f"Precedence 4: Sluggish movement: inactive for {days_inactive} days (threshold {slow_moving_thresh} days)"
            )
            return "SLOW_MOVING", factors, days_inactive, item_age_days

        # Precedence 5: Default -> ACTIVE
        factors["matched_rule"] = "Precedence 5: Active regular inventory"
        return "ACTIVE", factors, days_inactive, item_age_days

    @staticmethod
    def run_classification(
        db: Session,
        office_id: UUID,
        category_id: Optional[UUID] = None,
        actor: Optional[User] = None,
    ) -> ClassificationRunResultOut:
        """Executes the automated classification engine over non-disposed items."""
        query = db.query(Item).filter(Item.office_id == office_id, Item.operational_status != "DISPOSED")
        if category_id:
            query = query.filter(Item.category_id == category_id)

        items = query.all()
        evaluated_count = len(items)
        updated_count = 0
        overridden_preserved_count = 0

        for it in items:
            calculated_class, factors, days_inactive, item_age_days = ClassificationService.evaluate_item(it, db)

            # Check existing classification record
            class_record = (
                db.query(Classification)
                .filter(Classification.item_id == it.id, Classification.office_id == office_id)
                .first()
            )

            if not class_record:
                class_record = Classification(
                    item_id=it.id,
                    office_id=office_id,
                    calculated_classification=calculated_class,
                    effective_classification=calculated_class,
                    rule_version=ClassificationService.RULE_VERSION,
                    days_inactive=days_inactive,
                    item_age_days=item_age_days,
                    contributing_factors=factors,
                    is_overridden=False,
                )
                db.add(class_record)
                it.current_classification = calculated_class
                updated_count += 1
            else:
                class_record.calculated_classification = calculated_class
                class_record.contributing_factors = factors
                class_record.days_inactive = days_inactive
                class_record.item_age_days = item_age_days
                class_record.calculated_at = datetime.now(timezone.utc)

                if class_record.is_overridden:
                    # STRICT RULE: Preserve manual override!
                    overridden_preserved_count += 1
                    it.current_classification = class_record.effective_classification
                else:
                    class_record.effective_classification = calculated_class
                    it.current_classification = calculated_class
                    updated_count += 1

        db.flush()
        AuditService.log_action(
            db=db,
            action="CLASSIFY",
            module="CLASSIFICATION",
            record_id=str(office_id),
            actor=actor,
            office_id=office_id,
            new_values={
                "evaluated": evaluated_count,
                "updated": updated_count,
                "overridden_preserved": overridden_preserved_count,
            },
        )
        db.commit()

        return ClassificationRunResultOut(
            office_id=office_id,
            evaluated_count=evaluated_count,
            updated_count=updated_count,
            overridden_preserved_count=overridden_preserved_count,
            completed_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def override_classification(
        db: Session,
        item_id: UUID,
        payload: ClassificationOverrideRequest,
        officer: User,
    ) -> Classification:
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise NotFoundError("Item was not found", code="ITEM_NOT_FOUND")

        if ROLE_SYSTEM_ADMIN not in officer.role_names and item.office_id != officer.office_id:
            raise OfficeAccessDeniedError("Cannot override classification for an item outside your office")

        class_record = (
            db.query(Classification)
            .filter(Classification.item_id == item.id, Classification.office_id == item.office_id)
            .first()
        )
        if not class_record:
            calc_class, factors, days_inactive, item_age_days = ClassificationService.evaluate_item(item, db)
            class_record = Classification(
                item_id=item.id,
                office_id=item.office_id,
                calculated_classification=calc_class,
                effective_classification=calc_class,
                rule_version=ClassificationService.RULE_VERSION,
                days_inactive=days_inactive,
                item_age_days=item_age_days,
                contributing_factors=factors,
            )
            db.add(class_record)

        old_class = class_record.effective_classification
        class_record.is_overridden = True
        class_record.effective_classification = payload.new_classification
        class_record.override_reason = payload.override_reason.strip()
        class_record.overridden_by = officer.id
        class_record.overridden_at = datetime.now(timezone.utc)

        # Update denormalized item classification
        item.current_classification = payload.new_classification
        db.flush()

        AuditService.log_action(
            db=db,
            action="OVERRIDE",
            module="CLASSIFICATION",
            record_id=str(item.id),
            actor=officer,
            office_id=item.office_id,
            old_values={"classification": old_class},
            new_values={
                "classification": payload.new_classification,
                "reason": payload.override_reason,
                "overridden_by": officer.username,
            },
        )
        db.commit()
        db.refresh(class_record)
        return class_record

    @staticmethod
    def release_override(
        db: Session,
        item_id: UUID,
        payload: ClassificationReleaseOverrideRequest,
        officer: User,
    ) -> Classification:
        class_record = db.query(Classification).filter(Classification.item_id == item_id).first()
        if not class_record:
            raise NotFoundError("Classification record not found")

        item = db.query(Item).filter(Item.id == item_id).first()
        if item and ROLE_SYSTEM_ADMIN not in officer.role_names and item.office_id != officer.office_id:
            raise OfficeAccessDeniedError("Access denied to item outside assigned office")

        old_effective = class_record.effective_classification
        class_record.is_overridden = False
        class_record.effective_classification = class_record.calculated_classification
        class_record.override_reason = None
        class_record.overridden_by = None
        class_record.overridden_at = None

        if item:
            item.current_classification = class_record.calculated_classification

        db.flush()
        AuditService.log_action(
            db=db,
            action="RELEASE_OVERRIDE",
            module="CLASSIFICATION",
            record_id=str(item_id),
            actor=officer,
            office_id=class_record.office_id,
            old_values={"effective_classification": old_effective},
            new_values={
                "effective_classification": class_record.calculated_classification,
                "release_reason": payload.release_reason,
            },
        )
        db.commit()
        db.refresh(class_record)
        return class_record

    @staticmethod
    def get_classification_summary(db: Session, office_id: Optional[UUID] = None) -> ClassificationSummaryOut:
        query = db.query(Item).filter(Item.operational_status != "DISPOSED")
        if office_id:
            query = query.filter(Item.office_id == office_id)

        items = query.all()
        total = len(items)
        active = sum(1 for i in items if i.current_classification == "ACTIVE")
        slow = sum(1 for i in items if i.current_classification == "SLOW_MOVING")
        non_moving = sum(1 for i in items if i.current_classification == "NON_MOVING")
        obsolete = sum(1 for i in items if i.current_classification == "OBSOLETE")

        overridden_query = db.query(Classification).filter(Classification.is_overridden.is_(True))
        if office_id:
            overridden_query = overridden_query.filter(Classification.office_id == office_id)
        overridden_cnt = overridden_query.count()

        return ClassificationSummaryOut(
            office_id=office_id,
            total_evaluated=total,
            active_count=active,
            slow_moving_count=slow,
            non_moving_count=non_moving,
            obsolete_count=obsolete,
            overridden_count=overridden_cnt,
            calculated_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def get_dead_stock_register(
        db: Session,
        office_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        classification_filter: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Item], int]:
        """Returns the official Dead Stock Register (NON_MOVING or OBSOLETE items)."""
        target_classes = ["NON_MOVING", "OBSOLETE"]
        if classification_filter:
            target_classes = [classification_filter.upper()]

        query = db.query(Item).filter(
            Item.operational_status != "DISPOSED",
            Item.current_classification.in_(target_classes),
        )
        if office_id:
            query = query.filter(Item.office_id == office_id)
        if category_id:
            query = query.filter(Item.category_id == category_id)

        total = query.count()
        candidates = query.order_by(Item.current_classification.desc(), Item.total_cost.desc()).offset((page - 1) * limit).limit(limit).all()
        return candidates, total

