"""Inventory Management Service

Handles dual-tracking asset registration, stock balances, item history, and bulk operations.
"""

import csv
import io
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from sqlalchemy import desc, func
from sqlalchemy.orm import Session
from app.core.exceptions import ConflictError, NotFoundError, OfficeAccessDeniedError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.services import AuditService
from app.features.categories.models import Category, UnitOfMeasure
from app.features.inventory.models import Item, StockBalance
from app.features.inventory.schemas import ItemCreate, ItemHistoryEventOut, ItemUpdate
from app.features.ledger.models import StockTransaction, StockTransactionLine
from app.features.locations.models import Location
from app.features.maintenance.models import MaintenanceRecord
from app.features.offices.models import Office
from app.features.suppliers.models import Supplier
from app.features.users.models import User
from app.features.verification.models import VerificationScanEvent


class InventoryService:
    @staticmethod
    def generate_item_code(db: Session, item_type: str, office_id: UUID) -> str:
        current_year = datetime.now(timezone.utc).year
        if item_type == "DURABLE_ASSET":
            prefix = f"AST-GS-VRV-{current_year}-"
        else:
            prefix = "ITM-GS-VRV-"

        count = db.query(Item).filter(Item.item_code.like(f"{prefix}%")).count()
        return f"{prefix}{count + 1:05d}"

    @staticmethod
    def generate_barcode_number(db: Session, item_type: str) -> str:
        prefix = "BC-AST-" if item_type == "DURABLE_ASSET" else "BC-ITM-"
        count = db.query(Item).filter(Item.barcode_number.like(f"{prefix}%")).count()
        return f"{prefix}{count + 1:06d}"

    @staticmethod
    def get_item(db: Session, item_id: UUID, current_user: Optional[User] = None) -> Item:
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise NotFoundError(f"Item with ID '{item_id}' was not found", code="ITEM_NOT_FOUND")

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            if item.office_id != current_user.office_id:
                raise OfficeAccessDeniedError("Access to item belonging to another office is denied")

        return item

    @staticmethod
    def get_item_by_barcode(db: Session, barcode: str, office_id: Optional[UUID] = None) -> Optional[Item]:
        query = db.query(Item).filter(Item.barcode_number == barcode.strip())
        if office_id:
            query = query.filter(Item.office_id == office_id)
        return query.first()

    @staticmethod
    def list_items(
        db: Session,
        office_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None,
        item_type: Optional[str] = None,
        condition: Optional[str] = None,
        operational_status: Optional[str] = None,
        classification: Optional[str] = None,
        supplier_id: Optional[UUID] = None,
        search: Optional[str] = None,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Tuple[List[Item], int]:
        query = db.query(Item)

        # Scoping rule
        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(Item.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(Item.office_id == office_id)

        if category_id:
            query = query.filter(Item.category_id == category_id)
        if location_id:
            query = query.filter(Item.location_id == location_id)
        if item_type:
            query = query.filter(Item.item_type == item_type.upper())
        if condition:
            query = query.filter(Item.condition == condition.upper())
        if operational_status:
            query = query.filter(Item.operational_status == operational_status.upper())
        if classification:
            query = query.filter(Item.current_classification == classification.upper())
        if supplier_id:
            query = query.filter(Item.supplier_id == supplier_id)

        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(
                (Item.item_code.ilike(pattern))
                | (Item.item_name.ilike(pattern))
                | (Item.barcode_number.ilike(pattern))
                | (Item.serial_number.ilike(pattern))
                | (Item.brand.ilike(pattern))
                | (Item.model_number.ilike(pattern))
                | (Item.current_custodian.ilike(pattern))
                | (Item.current_department.ilike(pattern))
            )

        total = query.count()

        # Sorting
        sort_col = getattr(Item, sort_by, Item.created_at)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_col))
        else:
            query = query.order_by(sort_col)

        items = query.offset((page - 1) * limit).limit(limit).all()
        return items, total

    @staticmethod
    def create_item(db: Session, payload: ItemCreate, creator: User) -> Item:
        # Auto-resolve office_id if not explicitly provided
        if not payload.office_id:
            payload.office_id = creator.office_id

        # Auto-resolve uom_id from code or fallback
        if not payload.uom_id:
            if payload.uom:
                uom_rec = db.query(UnitOfMeasure).filter(UnitOfMeasure.code == payload.uom.upper()).first()
                if uom_rec:
                    payload.uom_id = uom_rec.id
            if not payload.uom_id:
                first_uom = db.query(UnitOfMeasure).first()
                if first_uom:
                    payload.uom_id = first_uom.id

        # Resolve quantity
        if payload.quantity is not None and (payload.initial_quantity == 1.00 or payload.initial_quantity is None):
            payload.initial_quantity = float(payload.quantity)

        # Resolve supplier if name provided
        if not payload.supplier_id and payload.supplier_name:
            sup = db.query(Supplier).filter(Supplier.name.ilike(f"%{payload.supplier_name.strip()}%")).first()
            if sup:
                payload.supplier_id = sup.id

        # Enforce office authorization
        if ROLE_SYSTEM_ADMIN not in creator.role_names and payload.office_id != creator.office_id:
            raise OfficeAccessDeniedError("Cannot create inventory records for an office outside your assigned scope")

        # Validate composite location constraint: location.office_id MUST equal item.office_id
        location = db.query(Location).filter(Location.id == payload.location_id).first()
        if not location:
            raise NotFoundError("Location not found", code="LOCATION_NOT_FOUND")
        if location.office_id != payload.office_id:
            raise ValidationError(
                f"Location '{location.room_number}' belongs to office '{location.office_id}', not '{payload.office_id}'"
            )

        category = db.query(Category).filter(Category.id == payload.category_id).first()
        if not category:
            raise NotFoundError("Category not found", code="CATEGORY_NOT_FOUND")

        uom = db.query(UnitOfMeasure).filter(UnitOfMeasure.id == payload.uom_id).first()
        if not uom:
            raise NotFoundError("Unit of measure not found", code="UOM_NOT_FOUND")

        if payload.supplier_id:
            supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
            if not supplier:
                raise NotFoundError("Supplier not found", code="SUPPLIER_NOT_FOUND")

        item_code = InventoryService.generate_item_code(db, payload.item_type, payload.office_id)
        barcode_num = InventoryService.generate_barcode_number(db, payload.item_type)

        qty = payload.initial_quantity
        total_purchase_val = float(payload.unit_purchase_cost) * float(qty)

        item = Item(
            office_id=payload.office_id,
            category_id=payload.category_id,
            location_id=payload.location_id,
            supplier_id=payload.supplier_id,
            procurement_item_id=payload.procurement_item_id,
            uom_id=payload.uom_id,
            item_code=item_code,
            item_name=payload.item_name.strip(),
            item_type=payload.item_type,
            barcode_number=barcode_num,
            brand=payload.brand.strip() if payload.brand else None,
            model_number=payload.model_number.strip() if payload.model_number else None,
            serial_number=payload.serial_number.strip() if payload.serial_number else None,
            purchase_date=payload.purchase_date,
            invoice_number=payload.invoice_number.strip() if payload.invoice_number else None,
            unit_purchase_cost=payload.unit_purchase_cost,
            total_cost=round(total_purchase_val, 2),
            condition=payload.condition,
            operational_status="AVAILABLE_IN_STORE",
            current_classification="ACTIVE",
            current_custodian=payload.current_custodian,
            current_department=payload.current_department,
            last_movement_date=payload.purchase_date or datetime.now(timezone.utc).date(),
            min_stock_level=payload.min_stock_level,
            is_legacy=payload.is_legacy,
            legacy_reference_number=payload.legacy_reference_number,
            created_by=creator.id,
            updated_by=creator.id,
        )
        db.add(item)
        db.flush()

        # Initialize stock balance record
        balance = StockBalance(
            office_id=payload.office_id,
            item_id=item.id,
            location_id=payload.location_id,
            available_qty=qty,
            allocated_qty=0.00,
            in_vendor_rma_qty=0.00,
            disposed_qty=0.00,
        )
        db.add(balance)
        db.flush()

        AuditService.log_action(
            db=db,
            action="CREATE",
            module="INVENTORY",
            record_id=str(item.id),
            actor=creator,
            office_id=item.office_id,
            new_values={
                "item_code": item.item_code,
                "name": item.item_name,
                "barcode": item.barcode_number,
                "available_qty": float(qty),
            },
        )
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def update_item(db: Session, item_id: UUID, payload: ItemUpdate, updater: Optional[User] = None, updated_by: Optional[User] = None) -> Item:
        user = updater or updated_by
        updater = user
        item = InventoryService.get_item(db, item_id, current_user=updater)
        if item.operational_status == "DISPOSED":
            raise ValidationError("Disposed items are archived and immutable; further modifications are prohibited.")

        old_values = {
            "item_name": item.item_name,
            "condition": item.condition,
            "custodian": item.current_custodian,
            "location_id": str(item.location_id),
        }

        update_dict = payload.model_dump(exclude_unset=True)

        if "location_id" in update_dict and update_dict["location_id"]:
            new_loc = db.query(Location).filter(Location.id == update_dict["location_id"]).first()
            if not new_loc:
                raise NotFoundError("New location was not found", code="LOCATION_NOT_FOUND")
            if new_loc.office_id != item.office_id:
                raise ValidationError("Cannot move item to a location belonging to another office")
            item.location_id = update_dict["location_id"]

        for field, value in update_dict.items():
            if field != "location_id":
                setattr(item, field, value)

        item.updated_by = updater.id
        db.flush()

        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="INVENTORY",
            record_id=str(item.id),
            actor=updater,
            office_id=item.office_id,
            old_values=old_values,
            new_values=update_dict,
        )
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get_item_history(db: Session, item_id: UUID, current_user: Optional[User] = None) -> List[ItemHistoryEventOut]:
        item = InventoryService.get_item(db, item_id, current_user=current_user)
        events: List[ItemHistoryEventOut] = []

        # 1. Stock movements (Receipts, Issues, Returns, Transfers)
        txn_lines = (
            db.query(StockTransactionLine)
            .join(StockTransaction)
            .filter(StockTransactionLine.item_id == item.id)
            .all()
        )
        for line in txn_lines:
            txn = line.transaction
            events.append(
                ItemHistoryEventOut(
                    event_type=txn.transaction_type,
                    event_date=txn.posted_at or txn.created_at,
                    reference_number=txn.transaction_number,
                    actor_name=txn.actor.full_name if txn.actor else "System",
                    details=f"{txn.transaction_type} voucher: {line.quantity} units. {txn.remarks or ''}",
                    quantity=float(line.quantity),
                    condition=line.condition_observed,
                )
            )

        # 2. Maintenance & Repairs
        maints = db.query(MaintenanceRecord).filter(MaintenanceRecord.item_id == item.id).all()
        for m in maints:
            events.append(
                ItemHistoryEventOut(
                    event_type="MAINTENANCE",
                    event_date=datetime.combine(m.reported_date, datetime.min.time(), tzinfo=timezone.utc),
                    reference_number=m.invoice_reference,
                    actor_name=m.reporter.full_name if m.reporter else "Technician",
                    details=f"Status: {m.status}. {m.issue_description}. Work: {m.work_performed or 'N/A'}. Cost: ₹{m.actual_cost}",
                )
            )

        # 3. Verification Scan Events
        scans = db.query(VerificationScanEvent).filter(VerificationScanEvent.item_id == item.id).all()
        for s in scans:
            events.append(
                ItemHistoryEventOut(
                    event_type="VERIFICATION_SCAN",
                    event_date=s.scanned_at,
                    reference_number=s.session.session_number if s.session else None,
                    actor_name=s.scanner_user.full_name if s.scanner_user else "Auditor",
                    details=f"Audit scan result: {s.scan_result}. Observed condition: {s.observed_condition}",
                    condition=s.observed_condition,
                    location_name=s.scanned_location.room_number if s.scanned_location else None,
                )
            )

        # Sort chronologically descending
        events.sort(key=lambda x: x.event_date, reverse=True)
        return events

    @staticmethod
    def bulk_import_items(
        db: Session,
        file_content: bytes,
        file_name: str,
        office_id: UUID,
        creator: User,
        dry_run: bool = True,
    ) -> Dict[str, Any]:
        """Validates and imports inventory records from CSV format."""
        if not file_name.endswith(".csv"):
            raise ValidationError("Bulk import currently supports UTF-8 CSV files.")

        decoded = file_content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(decoded))

        rows_imported = 0
        errors = []
        preview = []

        categories = {c.code: c.id for c in db.query(Category).all()}
        locations = {l.room_number: l.id for l in db.query(Location).filter(Location.office_id == office_id).all()}
        uoms = {u.code: u.id for u in db.query(UnitOfMeasure).all()}

        for idx, row in enumerate(reader, start=2):
            item_name = row.get("item_name")
            cat_code = row.get("category_code")
            room_no = row.get("room_number")
            uom_code = row.get("uom_code") or "NOS"
            cost_str = row.get("unit_purchase_cost") or "0.00"
            qty_str = row.get("quantity") or "1.00"
            item_type = row.get("item_type") or "DURABLE_ASSET"

            if not item_name or not cat_code or not room_no:
                errors.append(f"Row {idx}: missing required fields (item_name, category_code, room_number)")
                continue

            if cat_code not in categories:
                errors.append(f"Row {idx}: category_code '{cat_code}' not found")
                continue
            if room_no not in locations:
                errors.append(f"Row {idx}: room_number '{room_no}' not found in office")
                continue
            if uom_code not in uoms:
                errors.append(f"Row {idx}: uom_code '{uom_code}' not found")
                continue

            try:
                cost = float(cost_str)
                qty = float(qty_str)
            except ValueError:
                errors.append(f"Row {idx}: invalid numerical cost or quantity")
                continue

            preview_item = {
                "row": idx,
                "item_name": item_name,
                "category_code": cat_code,
                "room_number": room_no,
                "item_type": item_type,
                "quantity": qty,
                "unit_cost": cost,
            }
            preview.append(preview_item)

            if not dry_run:
                payload = ItemCreate(
                    office_id=office_id,
                    category_id=categories[cat_code],
                    location_id=locations[room_no],
                    uom_id=uoms[uom_code],
                    item_name=item_name,
                    item_type=item_type,
                    brand=row.get("brand"),
                    model_number=row.get("model_number"),
                    serial_number=row.get("serial_number"),
                    unit_purchase_cost=cost,
                    condition=row.get("condition") or "GOOD",
                    initial_quantity=qty,
                )
                InventoryService.create_item(db, payload, creator)
                rows_imported += 1

        return {
            "dry_run": dry_run,
            "total_rows_processed": len(preview) + len(errors),
            "valid_rows_count": len(preview),
            "rows_imported": rows_imported,
            "errors": errors,
            "preview": preview[:10],
        }

    @staticmethod
    def export_items_csv(items: List[Item]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Item Code",
            "Barcode",
            "Item Name",
            "Category",
            "Location",
            "Type",
            "Condition",
            "Status",
            "Classification",
            "Custodian",
            "Unit Cost",
            "Total Cost",
            "Serial Number",
        ])
        for it in items:
            writer.writerow([
                it.item_code,
                it.barcode_number or "",
                it.item_name,
                it.category.name if it.category else "",
                it.location.room_number if it.location else "",
                it.item_type,
                it.condition,
                it.operational_status,
                it.current_classification,
                it.current_custodian or "",
                float(it.unit_purchase_cost),
                float(it.total_cost),
                it.serial_number or "",
            ])
        return output.getvalue()

