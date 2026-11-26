"""Automated tests for Barcode/QR Lookup and Physical Verification (Option B)."""

from datetime import date
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.permissions import ROLE_STORE_OFFICER, ROLE_STORE_STAFF
from app.core.security import create_access_token, hash_password
from app.features.audit.models import AuditLog
from app.features.categories.models import Category, UnitOfMeasure
from app.features.inventory.models import Item, StockBalance
from app.features.locations.models import Location
from app.features.offices.models import Office
from app.features.roles.models import Role
from app.features.roles.services import RoleService
from app.features.users.models import User
from app.main import create_app
from app.models import Base


@pytest.fixture()
def test_env():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
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

    app = create_app()

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    officer_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(officer.id)})}"}
    staff_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(staff.id)})}"}
    other_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(other_officer.id)})}"}

    yield {
        "client": client,
        "db": db,
        "SessionLocal": TestingSessionLocal,
        "office_a": office_a,
        "office_b": office_b,
        "loc_a1": loc_a1,
        "loc_a2": loc_a2,
        "item1": item1,
        "item2": item2,
        "item3_disposed": item3_disposed,
        "item_other_office": item_other_office,
        "officer_headers": officer_headers,
        "staff_headers": staff_headers,
        "other_headers": other_headers,
    }

    db.close()
    Base.metadata.drop_all(bind=engine)


def test_barcode_lookup_and_label_generation(test_env):
    client = test_env["client"]
    staff_headers = test_env["staff_headers"]
    item1 = test_env["item1"]

    # Case-insensitive lookup by asset code
    res = client.post(
        "/api/v1/barcodes/lookup",
        json={"barcode": "ast-gs-vrv-2026-00001"},
        headers=staff_headers,
    )
    assert res.status_code == 200
    body = res.json()["data"]
    assert body["item_code"] == item1.item_code
    assert body["brand"] == "Dell"
    assert body["serial_number"] == "SN-DELL-001"
    assert body["location_id"] == str(item1.location_id)
    assert body["available_qty"] == 1.0

    # Lookup by serial number
    res_serial = client.post(
        "/api/v1/barcodes/lookup",
        json={"barcode": "SN-DELL-001"},
        headers=staff_headers,
    )
    assert res_serial.status_code == 200
    assert res_serial.json()["data"]["item_id"] == str(item1.id)

    # Cross-office lookup blocked
    res_other = client.post(
        "/api/v1/barcodes/lookup",
        json={"barcode": "BC-TLL-000001"},
        headers=staff_headers,
    )
    assert res_other.status_code == 404

    # Disposed item rejected
    res_disp = client.post(
        "/api/v1/barcodes/lookup",
        json={"barcode": "BC-AST-000099"},
        headers=staff_headers,
    )
    assert res_disp.status_code == 422

    # Printable PNG & SVG QR labels
    png_res = client.get(f"/api/v1/barcodes/{item1.id}/label?format=png", headers=staff_headers)
    assert png_res.status_code == 200
    assert png_res.headers["content-type"] == "image/png"

    svg_res = client.get(f"/api/v1/barcodes/{item1.id}/label?format=svg", headers=staff_headers)
    assert svg_res.status_code == 200
    assert "image/svg+xml" in svg_res.headers["content-type"]


def test_verification_audit_option_b_and_rbac(test_env):
    client = test_env["client"]
    officer_headers = test_env["officer_headers"]
    staff_headers = test_env["staff_headers"]
    other_headers = test_env["other_headers"]
    office_a = test_env["office_a"]
    loc_a1 = test_env["loc_a1"]
    loc_a2 = test_env["loc_a2"]
    item1 = test_env["item1"]
    item2 = test_env["item2"]

    # Staff cannot create an audit session (verify:create belongs to Store Officer)
    res_staff_create = client.post(
        "/api/v1/verifications/sessions",
        json={"office_id": str(office_a.id), "scope_type": "LOCATION", "location_id": str(loc_a1.id)},
        headers=staff_headers,
    )
    assert res_staff_create.status_code == 403

    # Officer creates session
    res_create = client.post(
        "/api/v1/verifications/sessions",
        json={
            "office_id": str(office_a.id),
            "scope_type": "LOCATION",
            "location_id": str(loc_a1.id),
            "notes": "[Monthly Routine Audit] Room 101 check",
        },
        headers=officer_headers,
    )
    assert res_create.status_code == 201
    session = res_create.json()["data"]
    session_id = session["id"]
    assert session["total_expected_items"] == 2
    assert session["location_name"] == "Main Block - ROOM-101"

    # Cross-office officer cannot view session
    res_cross = client.get(f"/api/v1/verifications/sessions/{session_id}", headers=other_headers)
    assert res_cross.status_code == 403

    # Staff scans item1 in a different room (ROOM-202) and updated condition (DAMAGED) -> Option B immediate update
    res_scan = client.post(
        f"/api/v1/verifications/sessions/{session_id}/scan",
        json={
            "scanned_barcode": "BC-AST-000001",
            "scanned_location_id": str(loc_a2.id),
            "observed_condition": "DAMAGED",
            "counted_quantity": 1,
            "remarks": "Moved to Accounts Room with damaged display",
        },
        headers=staff_headers,
    )
    assert res_scan.status_code == 200
    scan_data = res_scan.json()["data"]
    assert scan_data["scan_result"] == "LOCATION_MISMATCH"
    assert scan_data["item_updated"] is True
    assert set(scan_data["updated_fields"]) == {"condition", "location_id"}

    # Verify Option B updated live Item, StockBalance, and wrote AuditLog
    verify_db = test_env["SessionLocal"]()
    try:
        refreshed_item1 = verify_db.query(Item).filter(Item.id == item1.id).first()
        assert refreshed_item1.condition == "DAMAGED"
        assert refreshed_item1.location_id == loc_a2.id

        bal = verify_db.query(StockBalance).filter(StockBalance.item_id == item1.id).first()
        assert bal.location_id == loc_a2.id

        audit = (
            verify_db.query(AuditLog)
            .filter(AuditLog.record_id == str(item1.id), AuditLog.action == "VERIFY_UPDATE")
            .first()
        )
        assert audit is not None
    finally:
        verify_db.close()

    # Duplicate scan using item_code (different string, same resolved item) is detected
    res_dup = client.post(
        f"/api/v1/verifications/sessions/{session_id}/scan",
        json={
            "scanned_barcode": item1.item_code,
            "scanned_location_id": str(loc_a2.id),
            "observed_condition": "DAMAGED",
            "counted_quantity": 1,
        },
        headers=staff_headers,
    )
    assert res_dup.status_code == 200
    assert res_dup.json()["data"]["is_duplicate_scan"] is True
    assert res_dup.json()["data"]["scan_result"] == "DUPLICATE_SCAN_REPEATED"

    # Enriched snapshot items show readable names (no raw UUIDs only)
    res_items = client.get(f"/api/v1/verifications/sessions/{session_id}/items", headers=officer_headers)
    assert res_items.status_code == 200
    items = res_items.json()["data"]
    item1_row = next(r for r in items if r["item_id"] == str(item1.id))
    assert item1_row["item_code"] == item1.item_code
    assert item1_row["expected_location_name"] == "Main Block - ROOM-101"
    assert item1_row["observed_location_name"] == "Main Block - ROOM-202"

    # Staff cannot reconcile (verify:reconcile is Officer only)
    res_staff_rec = client.post(
        f"/api/v1/verifications/sessions/{session_id}/reconcile",
        json={"resolutions": [{"verification_item_id": item1_row["id"], "resolution_status": "RESOLVED", "remarks": "Staff try"}]},
        headers=staff_headers,
    )
    assert res_staff_rec.status_code == 403

    # Officer reconciles item1 mismatch
    res_rec = client.post(
        f"/api/v1/verifications/sessions/{session_id}/reconcile",
        json={"resolutions": [{"verification_item_id": item1_row["id"], "resolution_status": "RESOLVED", "remarks": "Relocation approved"}]},
        headers=officer_headers,
    )
    assert res_rec.status_code == 200
    assert res_rec.json()["data"]["status"] == "UNDER_REVIEW"

    # Complete session -> unscanned item2 flagged NOT_FOUND
    res_comp = client.post(
        f"/api/v1/verifications/sessions/{session_id}/complete",
        json={"summary_remarks": "Monthly audit concluded and signed off."},
        headers=officer_headers,
    )
    assert res_comp.status_code == 200
    assert res_comp.json()["data"]["status"] == "COMPLETED"

    res_items_after = client.get(f"/api/v1/verifications/sessions/{session_id}/items", headers=officer_headers)
    item2_row = next(r for r in res_items_after.json()["data"] if r["item_id"] == str(item2.id))
    assert item2_row["discrepancy_type"] == "NOT_FOUND"

    # Download CSV reconciliation report
    res_report = client.get(f"/api/v1/verifications/sessions/{session_id}/report", headers=officer_headers)
    assert res_report.status_code == 200
    assert "text/csv" in res_report.headers["content-type"]
    assert item1.item_code in res_report.text
    assert item2.item_code in res_report.text
