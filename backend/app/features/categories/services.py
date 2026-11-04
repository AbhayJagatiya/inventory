"""Categories and Units of Measure Service

Manages item categories, classification thresholds, and units of measure.
"""

from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.features.audit.services import AuditService
from app.features.categories.models import Category, UnitOfMeasure
from app.features.categories.schemas import CategoryCreate, CategoryUpdate, UnitOfMeasureCreate
from app.features.inventory.models import Item
from app.features.users.models import User

DEFAULT_CATEGORIES = [
    {
        "code": "IT_EQUIPMENT",
        "name": "Information Technology Equipment",
        "slow_moving_threshold_days": 90,
        "inactivity_threshold_days": 180,
        "obsolescence_years": 5,
        "depreciation_rate_pct": 20.00,
    },
    {
        "code": "OFFICE_FURNITURE",
        "name": "Office Furniture & Fixtures",
        "slow_moving_threshold_days": 120,
        "inactivity_threshold_days": 240,
        "obsolescence_years": 10,
        "depreciation_rate_pct": 10.00,
    },
    {
        "code": "OFFICE_MACHINERY",
        "name": "Office Machinery & Appliances",
        "slow_moving_threshold_days": 90,
        "inactivity_threshold_days": 180,
        "obsolescence_years": 7,
        "depreciation_rate_pct": 15.00,
    },
    {
        "code": "OFFICE_STATIONERY",
        "name": "Office Stationery & Consumables",
        "slow_moving_threshold_days": 60,
        "inactivity_threshold_days": 120,
        "obsolescence_years": 2,
        "depreciation_rate_pct": 0.00,
    },
    {
        "code": "VEHICLES_TRANSPORT",
        "name": "Vehicles & Transport Equipment",
        "slow_moving_threshold_days": 60,
        "inactivity_threshold_days": 180,
        "obsolescence_years": 10,
        "depreciation_rate_pct": 15.00,
    },
]

DEFAULT_UOMS = [
    ("NOS", "Numbers / Units"),
    ("BOX", "Box / Carton"),
    ("PACKET", "Packet / Ream"),
    ("SET", "Set / Pair"),
    ("KG", "Kilogram"),
    ("MTR", "Meter"),
]


class CategoryService:
    @staticmethod
    def get_category(db: Session, category_id: UUID) -> Category:
        cat = db.query(Category).filter(Category.id == category_id).first()
        if not cat:
            raise NotFoundError(f"Category with ID '{category_id}' was not found", code="CATEGORY_NOT_FOUND")
        return cat

    @staticmethod
    def list_categories(
        db: Session,
        parent_id: Optional[UUID] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[Category]:
        query = db.query(Category)
        if parent_id is not None:
            query = query.filter(Category.parent_id == parent_id)
        if is_active is not None:
            query = query.filter(Category.is_active == is_active)
        if search:
            query = query.filter(
                (Category.name.ilike(f"%{search}%")) | (Category.code.ilike(f"%{search}%"))
            )
        categories = query.order_by(Category.name.asc()).all()

        # Attach item_count dynamically
        for c in categories:
            c.item_count = db.query(Item).filter(Item.category_id == c.id, Item.operational_status != "DISPOSED").count()
        return categories

    @staticmethod
    def create_category(db: Session, payload: CategoryCreate, creator: Optional[User] = None) -> Category:
        clean_code = payload.code.strip().upper()
        if db.query(Category).filter(Category.code == clean_code).first():
            raise ConflictError(f"Category code '{clean_code}' already exists", code="DUPLICATE_CATEGORY_CODE")

        if payload.parent_id:
            parent = db.query(Category).filter(Category.id == payload.parent_id).first()
            if not parent:
                raise NotFoundError("Parent category not found", code="PARENT_CATEGORY_NOT_FOUND")

        category = Category(
            code=clean_code,
            name=payload.name.strip(),
            parent_id=payload.parent_id,
            slow_moving_threshold_days=payload.slow_moving_threshold_days,
            inactivity_threshold_days=payload.inactivity_threshold_days,
            obsolescence_years=payload.obsolescence_years,
            depreciation_rate_pct=payload.depreciation_rate_pct,
            is_active=True,
        )
        db.add(category)
        db.flush()

        AuditService.log_action(
            db=db,
            action="CREATE",
            module="CATEGORIES",
            record_id=str(category.id),
            actor=creator,
            new_values={"code": category.code, "name": category.name},
        )
        db.commit()
        db.refresh(category)
        category.item_count = 0
        return category

    @staticmethod
    def update_category(
        db: Session,
        category_id: UUID,
        payload: CategoryUpdate,
        updater: Optional[User] = None,
    ) -> Category:
        category = CategoryService.get_category(db, category_id)
        old_values = {
            "name": category.name,
            "slow_moving_threshold_days": category.slow_moving_threshold_days,
            "inactivity_threshold_days": category.inactivity_threshold_days,
            "obsolescence_years": category.obsolescence_years,
            "depreciation_rate_pct": float(category.depreciation_rate_pct),
            "is_active": category.is_active,
        }

        update_dict = payload.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(category, field, value)

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="CATEGORIES",
            record_id=str(category.id),
            actor=updater,
            old_values=old_values,
            new_values=update_dict,
        )
        db.commit()
        db.refresh(category)
        category.item_count = db.query(Item).filter(Item.category_id == category.id, Item.operational_status != "DISPOSED").count()
        return category

    @staticmethod
    def delete_category(db: Session, category_id: UUID, actor: Optional[User] = None) -> None:
        category = CategoryService.get_category(db, category_id)
        active_items = db.query(Item).filter(Item.category_id == category.id, Item.operational_status != "DISPOSED").count()
        if active_items > 0:
            raise ValidationError(f"Cannot deactivate category: {active_items} active items belong to this category.")

        category.is_active = False
        db.flush()
        AuditService.log_action(
            db=db,
            action="DELETE",
            module="CATEGORIES",
            record_id=str(category.id),
            actor=actor,
            new_values={"is_active": False},
        )
        db.commit()

    @staticmethod
    def list_uoms(db: Session) -> List[UnitOfMeasure]:
        return db.query(UnitOfMeasure).order_by(UnitOfMeasure.code.asc()).all()

    @staticmethod
    def create_uom(db: Session, payload: UnitOfMeasureCreate, creator: Optional[User] = None) -> UnitOfMeasure:
        clean_code = payload.code.strip().upper()
        if db.query(UnitOfMeasure).filter(UnitOfMeasure.code == clean_code).first():
            raise ConflictError(f"Unit of measure '{clean_code}' already exists", code="DUPLICATE_UOM")

        uom = UnitOfMeasure(code=clean_code, name=payload.name.strip())
        db.add(uom)
        db.commit()
        db.refresh(uom)
        return uom

    @staticmethod
    def seed_default_categories_and_uoms(db: Session) -> None:
        # Seed UOMs
        for code, name in DEFAULT_UOMS:
            if not db.query(UnitOfMeasure).filter(UnitOfMeasure.code == code).first():
                db.add(UnitOfMeasure(code=code, name=name))

        # Seed Categories
        for cat_data in DEFAULT_CATEGORIES:
            if not db.query(Category).filter(Category.code == cat_data["code"]).first():
                db.add(Category(**cat_data, is_active=True))

        db.commit()

