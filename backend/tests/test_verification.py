"""Automated tests for Barcode/QR Lookup, RBAC, Office Isolation, and Verification (Option B)."""

from datetime import date
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy import BigInteger, Integer, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import require_permission
from app.core.exceptions import NotFoundError, OfficeAccessDeniedError, PermissionDeniedError, ValidationError
from app.core.permissions import ROLE_STORE_OFFICER, ROLE_STORE_STAFF
from app.core.security import hash_password
from app.features.audit.models import AuditLog
from app.features.barcodes.schemas import BarcodeLookupRequest
from app.features.categories.models import Category, UnitOfMeasure
from app.features.inventory.models import Item, StockBalance
from app.features.locations.models import Location
from app.features.offices.models import Office
from app.features.roles.models import Role
from app.features.roles.services import RoleService
from app.features.users.models import User
from app.features.verification.schemas import (
    VerificationCompleteRequest,
    VerificationDiscrepancyResolution,
    VerificationReconcileRequest,
    VerificationScanRequest,
    VerificationSessionCreate,
)
from app.models import Base
from app.routes import barcodes as barcode_routes
from app.routes import inventory as inventory_routes
from app.routes import verification as verification_routes


@pytest.fixture()
def test_env():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    AuditLog.__table__.c.id.type = BigInteger().with_variant(Integer, "sqlite")
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    RoleService.seed_default_roles_and_permissions(db)

    office_a = Office(
        code="OFF-GS-VRV-001",
        name="Veraval Store Office",
        office_type="DISTRICT_OFFICE",
        district="Gir Somnath",
        taluka="Veraval",
        address="Veraval",
        is_active=True,
    )
    office_b = Office(
        code="OFF-GS-TLL-002",
        name="Talala Store Office",
        office_type="TALUKA_OFFICE",
        district="Gir Somnath",
        taluka="Talala",
        address="Talala",
        is_active=True,
    )
    db.add_all([office_a, office_b])
    db.flush()

    officer_role = db.query(Role).filter(Role.name == ROLE_STORE_OFFICER).first()
    staff_role = db.query(Role).filter(Role.name == ROLE_STORE_STAFF).first()

    officer = User(
        office_id=office_a.id,
        username="officer_vrv",
        email="officer_vrv@gujarat.gov.in",
        hashed_password=hash_password("Officer@12345"),
        full_name="Rajesh Officer",
        designation="Store Officer",
        status="ACTIVE",
        roles=[officer_role],
    )
    staff = User(
        office_id=office_a.id,
        username="staff_vrv",
        email="staff_vrv@gujarat.gov.in",
        hashed_password=hash_password("Staff@12345"),
        full_name="Kiran Staff",
        designation="Store Staff",
        status="ACTIVE",
        roles=[staff_role],
    )
    other_officer = User(
        office_id=office_b.id,
        username="officer_tll",
        email="officer_tll@gujarat.gov.in",
        hashed_password=hash_password("Officer@12345"),
        full_name="Talala Officer",
        designation="Store Officer",
        status="ACTIVE",
        roles=[officer_role],
    )
    db.add_all([officer, staff, other_officer])
    db.flush()

    loc_a1 = Location(
        office_id=office_a.id,
        building_name="Main Block",
        floor="Ground",
        room_number="ROOM-101",
        location_type="STORE_ROOM",
        description="Main Store",
        is_active=True,
    )
    loc_a2 = Location(
        office_id=office_a.id,
        building_name="Main Block",
        floor="First",
        room_number="ROOM-202",
        location_type="OFFICE_ROOM",
        description="Accounts Room",
        is_active=True,
    )
    loc_b1 = Location(
        office_id=office_b.id,
        building_name="Talala Annex",
        floor="Ground",
        room_number="TLL-101",
        location_type="STORE_ROOM",
        description="Talala Store",
        is_active=True,
    )
    db.add_all([loc_a1, loc_a2, loc_b1])
    db.flush()

    cat = Category(
        code="IT_EQUIPMENT",
        name="IT Equipment",
        slow_moving_threshold_days=90,
        inactivity_threshold_days=180,
        obsolescence_years=5,
        depreciation_rate_pct=Decimal("20.00"),
    )
    uom = UnitOfMeasure(code="NOS", name="Numbers")
    db.add_all([cat, uom])
    db.flush()

    item1 = Item(
        office_id=office_a.id,
        category_id=cat.id,
        location_id=loc_a1.id,
        uom_id=uom.id,
        item_code="AST-GS-VRV-2026-00001",
        item_name="Dell OptiPlex Desktop",
        item_type="DURABLE_ASSET",
        barcode_number="BC-AST-000001",
        brand="Dell",
        model_number="7090",
        serial_number="SN-DELL-001",
        purchase_date=date(2025, 1, 10),
        unit_purchase_cost=Decimal("65000.00"),
        total_cost=Decimal("65000.00"),
        condition="GOOD",
        operational_status="AVAILABLE_IN_STORE",
        current_classification="ACTIVE",
        current_custodian="Store Keeper",
        current_department="IT Cell",
        created_by=officer.id,
    )
    item2 = Item(
        office_id=office_a.id,
        category_id=cat.id,
        location_id=loc_a1.id,
        uom_id=uom.id,
        item_code="AST-GS-VRV-2026-00002",
        item_name="HP LaserJet Printer",
        item_type="DURABLE_ASSET",
        barcode_number="BC-AST-000002",
        brand="HP",
        model_number="M404dn",
        serial_number="SN-HP-002",
        unit_purchase_cost=Decimal("25000.00"),
        total_cost=Decimal("25000.00"),
        condition="GOOD",
        operational_status="AVAILABLE_IN_STORE",
        current_classification="ACTIVE",
        created_by=officer.id,
    )
    item3_disposed = Item(
        office_id=office_a.id,
        category_id=cat.id,
        location_id=loc_a1.id,
        uom_id=uom.id,
        item_code="AST-GS-VRV-2020-00099",
        item_name="Old CRT Monitor",
        item_type="DURABLE_ASSET",
        barcode_number="BC-AST-000099",
        unit_purchase_cost=Decimal("5000.00"),
        total_cost=Decimal("5000.00"),
        condition="SCRAP",
        operational_status="DISPOSED",
        current_classification="OBSOLETE",
        created_by=officer.id,
    )
    item_other_office = Item(
        office_id=office_b.id,
        category_id=cat.id,
        location_id=loc_b1.id,
        uom_id=uom.id,
        item_code="AST-GS-TLL-2026-00001",
        item_name="Talala Scanner",
        item_type="DURABLE_ASSET",
        barcode_number="BC-TLL-000001",
        unit_purchase_cost=Decimal("12000.00"),
        total_cost=Decimal("12000.00"),
        condition="GOOD",
        operational_status="AVAILABLE_IN_STORE",
        current_classification="ACTIVE",
        created_by=other_officer.id,
    )
    db.add_all([item1, item2, item3_disposed, item_other_office])
    db.flush()

    db.add_all([
        StockBalance(office_id=office_a.id, item_id=item1.id, location_id=loc_a1.id, available_qty=Decimal("1.00")),
        StockBalance(office_id=office_a.id, item_id=item2.id, location_id=loc_a1.id, available_qty=Decimal("1.00")),
        StockBalance(office_id=office_b.id, item_id=item_other_office.id, location_id=loc_b1.id, available_qty=Decimal("1.00")),
    ])
    db.commit()

    yield {
        "db": db,
        "office_a": office_a,
        "office_b": office_b,
        "officer": officer,
        "staff": staff,
        "other_officer": other_officer,
        "loc_a1": loc_a1,
        "loc_a2": loc_a2,
        "item1": item1,
        "item2": item2,
        "item3_disposed": item3_disposed,
        "item_other_office": item_other_office,
    }

    db.close()
    Base.metadata.drop_all(bind=engine)


def test_barcode_lookup_and_label_generation(test_env):
    db = test_env["db"]
    staff = test_env["staff"]
    item1 = test_env["item1"]

    # Case-insensitive lookup by asset code
    res = barcode_routes.lookup_barcode(
        payload=BarcodeLookupRequest(barcode="ast-gs-vrv-2026-00001"),
        db=db,
        current_user=staff,
    )
    assert res.success is True
    assert res.data.item_code == item1.item_code
    assert res.data.brand == "Dell"
    assert res.data.serial_number == "SN-DELL-001"
    assert res.data.location_id == item1.location_id
    assert res.data.available_qty == 1.0

    # Lookup by serial number
    res_serial = barcode_routes.lookup_barcode(
        payload=BarcodeLookupRequest(barcode="SN-DELL-001"),
        db=db,
        current_user=staff,
    )
    assert res_serial.data.item_id == item1.id

    # Cross-office lookup blocked
    with pytest.raises(NotFoundError):
        barcode_routes.lookup_barcode(
            payload=BarcodeLookupRequest(barcode="BC-TLL-000001"),
            db=db,
            current_user=staff,
        )

    # Disposed item rejected
    with pytest.raises(ValidationError):
        barcode_routes.lookup_barcode(
            payload=BarcodeLookupRequest(barcode="BC-AST-000099"),
            db=db,
            current_user=staff,
        )

    # Printable PNG & SVG QR labels
    png_res = barcode_routes.generate_barcode_label(
        item_id=item1.id,
        output_format="png",
        db=db,
        current_user=staff,
    )
    assert png_res.media_type == "image/png"
    assert len(png_res.body) > 100

    svg_res = barcode_routes.generate_barcode_label(
        item_id=item1.id,
        output_format="svg",
        db=db,
        current_user=staff,
    )
    assert svg_res.media_type == "image/svg+xml"
    assert b"<svg" in svg_res.body


def test_verification_audit_option_b_rbac_and_isolation(test_env):
    db = test_env["db"]
    office_a = test_env["office_a"]
    officer = test_env["officer"]
    staff = test_env["staff"]
    other_officer = test_env["other_officer"]
    loc_a1 = test_env["loc_a1"]
    loc_a2 = test_env["loc_a2"]
    item1 = test_env["item1"]
    item2 = test_env["item2"]

    # RBAC: Staff cannot pass verify:create or verify:reconcile dependencies
    with pytest.raises(PermissionDeniedError):
        require_permission("verify:create")(current_user=staff)
    with pytest.raises(PermissionDeniedError):
        require_permission("verify:reconcile")(current_user=staff)

    # Officer creates session
    assert require_permission("verify:create")(current_user=officer).id == officer.id
    create_res = verification_routes.create_session(
        payload=VerificationSessionCreate(
            office_id=office_a.id,
            scope_type="LOCATION",
            location_id=loc_a1.id,
            notes="[Monthly Routine Audit] Room 101 check",
        ),
        db=db,
        current_user=officer,
    )
    session = create_res.data
    assert session.total_expected_items == 2
    assert session.location_name == "Main Block - ROOM-101"

    # Cross-office officer cannot view session
    with pytest.raises(HTTPException) as exc_info:
        verification_routes.get_session(
            session_id=session.id,
            db=db,
            current_user=other_officer,
        )
    assert exc_info.value.status_code == 403

    # Cross-office officer cannot create session for office_a
    with pytest.raises(OfficeAccessDeniedError):
        verification_routes.create_session(
            payload=VerificationSessionCreate(
                office_id=office_a.id,
                scope_type="FULL_OFFICE",
            ),
            db=db,
            current_user=other_officer,
        )

    # Staff scans item1 in a different room (ROOM-202) and updated condition (DAMAGED) -> Option B immediate update
    assert require_permission("verify:scan")(current_user=staff).id == staff.id
    scan_res = verification_routes.process_scan(
        session_id=session.id,
        payload=VerificationScanRequest(
            scanned_barcode="BC-AST-000001",
            scanned_location_id=loc_a2.id,
            observed_condition="DAMAGED",
            counted_quantity=1,
            remarks="Moved to Accounts Room with damaged display",
        ),
        db=db,
        current_user=staff,
    )
    scan_data = scan_res.data
    assert scan_data.scan_result == "LOCATION_MISMATCH"
    assert scan_data.item_updated is True
    assert set(scan_data.updated_fields) == {"condition", "location_id"}

    # Verify Option B updated live Item, StockBalance, and wrote AuditLog
    db.refresh(item1)
    assert item1.condition == "DAMAGED"
    assert item1.location_id == loc_a2.id

    bal = db.query(StockBalance).filter(StockBalance.item_id == item1.id).first()
    assert bal.location_id == loc_a2.id

    audit = (
        db.query(AuditLog)
        .filter(AuditLog.record_id == str(item1.id), AuditLog.action == "VERIFY_UPDATE")
        .first()
    )
    assert audit is not None

    # Duplicate scan using item_code (different string, same resolved item) is detected
    dup_res = verification_routes.process_scan(
        session_id=session.id,
        payload=VerificationScanRequest(
            scanned_barcode=item1.item_code,
            scanned_location_id=loc_a2.id,
            observed_condition="DAMAGED",
            counted_quantity=1,
        ),
        db=db,
        current_user=staff,
    )
    assert dup_res.data.is_duplicate_scan is True
    assert dup_res.data.scan_result == "DUPLICATE_SCAN_REPEATED"

    # Enriched snapshot items show readable names
    items_res = verification_routes.list_session_items(
        session_id=session.id,
        discrepancy_only=False,
        discrepancy_type=None,
        resolution_status=None,
        db=db,
        current_user=officer,
    )
    item1_row = next(r for r in items_res.data if r.item_id == item1.id)
    assert item1_row.item_code == item1.item_code
    assert item1_row.expected_location_name == "Main Block - ROOM-101"
    assert item1_row.observed_location_name == "Main Block - ROOM-202"

    # Officer reconciles item1 mismatch
    rec_res = verification_routes.reconcile_session(
        session_id=session.id,
        payload=VerificationReconcileRequest(
            resolutions=[
                VerificationDiscrepancyResolution(
                    verification_item_id=item1_row.id,
                    resolution_status="RESOLVED",
                    remarks="Relocation approved",
                )
            ]
        ),
        db=db,
        current_user=officer,
    )
    assert rec_res.data.status == "UNDER_REVIEW"

    # Complete session -> unscanned item2 flagged NOT_FOUND
    comp_res = verification_routes.complete_session(
        session_id=session.id,
        payload=VerificationCompleteRequest(summary_remarks="Monthly audit concluded and signed off."),
        db=db,
        current_user=officer,
    )
    assert comp_res.data.status == "COMPLETED"

    items_after = verification_routes.list_session_items(
        session_id=session.id,
        discrepancy_only=False,
        discrepancy_type=None,
        resolution_status=None,
        db=db,
        current_user=officer,
    )
    item2_row = next(r for r in items_after.data if r.item_id == item2.id)
    assert item2_row.discrepancy_type == "NOT_FOUND"

    # Download CSV reconciliation report
    from app.features.verification.services import VerificationService

    csv_text, filename = VerificationService.export_session_report_csv(db, session.id)
    assert filename.endswith(".csv")
    assert item1.item_code in csv_text
    assert item2.item_code in csv_text

    # Asset history timeline includes scan, live audit update, and audit session outcome
    hist_res = inventory_routes.get_item_history(
        item_id=item1.id,
        page=1,
        limit=20,
        db=db,
        current_user=officer,
    )
    event_types = {e.event_type for e in hist_res.data}
    assert {"VERIFICATION_SCAN", "VERIFY_UPDATE", "VERIFICATION_AUDIT"}.issubset(event_types)

    # Unscanned item2 also records NOT_FOUND audit outcome in its asset history
    hist_item2 = inventory_routes.get_item_history(
        item_id=item2.id,
        page=1,
        limit=20,
        db=db,
        current_user=officer,
    )
    assert any(e.event_type == "VERIFICATION_AUDIT" and "NOT_FOUND" in e.details for e in hist_item2.data)
