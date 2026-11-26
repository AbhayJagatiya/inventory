"""Automated tests for Alerts, Notifications, and Reports."""

from datetime import date, timedelta
from decimal import Decimal
import pytest
from sqlalchemy import BigInteger, Integer, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.exceptions import OfficeAccessDeniedError
from app.core.permissions import ROLE_STORE_OFFICER
from app.core.security import hash_password
from app.features.alerts.schemas import AlertResolveRequest, AlertSnoozeRequest
from app.features.alerts.services import AlertService
from app.features.audit.models import AuditLog
from app.features.categories.models import Category, UnitOfMeasure
from app.features.inventory.models import Item, StockBalance
from app.features.locations.models import Location
from app.features.offices.models import Office
from app.features.reports.services import ReportsService
from app.features.roles.models import Role
from app.features.roles.services import RoleService
from app.features.users.models import User
from app.features.warranties.models import Warranty
from app.models import Base
from app.routes import alerts as alert_routes


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
    db.add_all([officer, other_officer])
    db.flush()

    loc_a = Location(
        office_id=office_a.id,
        building_name="Main Block",
        floor="Ground",
        room_number="ROOM-101",
        location_type="STORE_ROOM",
        description="Main Store",
        is_active=True,
    )
    cat = Category(
        code="STATIONERY",
        name="Stationery",
        slow_moving_threshold_days=90,
        inactivity_threshold_days=180,
        obsolescence_years=5,
        depreciation_rate_pct=Decimal("10.00"),
    )
    uom = UnitOfMeasure(code="NOS", name="Numbers")
    db.add_all([loc_a, cat, uom])
    db.flush()

    # Non-moving item + expiring warranty
    item1 = Item(
        office_id=office_a.id,
        category_id=cat.id,
        location_id=loc_a.id,
        uom_id=uom.id,
        item_code="DS-ST-0001",
        item_name="Filing Cabinet",
        item_type="DURABLE_ASSET",
        condition="GOOD",
        operational_status="AVAILABLE_IN_STORE",
        current_classification="NON_MOVING",
        unit_purchase_cost=Decimal("12000.00"),
        total_cost=Decimal("12000.00"),
        created_by=officer.id,
    )
    # Low stock consumable item
    item2 = Item(
        office_id=office_a.id,
        category_id=cat.id,
        location_id=loc_a.id,
        uom_id=uom.id,
        item_code="CS-ST-0002",
        item_name="A4 Paper Ream",
        item_type="CONSUMABLE_STOCK",
        condition="GOOD",
        operational_status="AVAILABLE_IN_STORE",
        current_classification="ACTIVE",
        min_stock_level=Decimal("10.00"),
        unit_purchase_cost=Decimal("250.00"),
        total_cost=Decimal("250.00"),
        created_by=officer.id,
    )
    db.add_all([item1, item2])
    db.flush()

    db.add(
        StockBalance(
            office_id=office_a.id,
            item_id=item2.id,
            location_id=loc_a.id,
            available_qty=Decimal("3.00"),
        )
    )
    db.add(
        Warranty(
            item_id=item1.id,
            provider_name="Godrej Care",
            start_date=date.today() - timedelta(days=355),
            end_date=date.today() + timedelta(days=10),
        )
    )
    db.commit()

    yield {
        "db": db,
        "office_a": office_a,
        "officer": officer,
        "other_officer": other_officer,
    }
    db.close()


def test_alert_evaluation_and_lifecycle(test_env):
    db = test_env["db"]
    office_a = test_env["office_a"]
    officer = test_env["officer"]
    other_officer = test_env["other_officer"]

    # First evaluation generates alerts (NON_MOVING_INACTIVITY, WARRANTY_EXPIRING, LOW_STOCK)
    created_count = AlertService.run_alert_evaluation_job(
        db=db, office_id=office_a.id, actor=officer
    )
    assert created_count >= 3

    # Second evaluation must not create duplicate active alerts
    dup_count = AlertService.run_alert_evaluation_job(
        db=db, office_id=office_a.id, actor=officer
    )
    assert dup_count == 0

    alerts, total = AlertService.list_alerts(db=db, office_id=office_a.id)
    assert total >= 3
    first_alert = alerts[0]

    # Office isolation
    with pytest.raises(OfficeAccessDeniedError):
        alert_routes.acknowledge_alert(
            alert_id=first_alert.id,
            db=db,
            current_user=other_officer,
        )

    # Acknowledge -> Snooze -> Resolve
    acked = AlertService.acknowledge_alert(db=db, alert_id=first_alert.id, user=officer)
    assert acked.status == "ACKNOWLEDGED"

    snoozed = AlertService.snooze_alert(
        db=db, alert_id=first_alert.id, snooze_days=7, user=officer
    )
    assert snoozed.status == "SNOOZED"
    assert snoozed.snoozed_until is not None

    resolved = AlertService.resolve_alert(
        db=db,
        alert_id=first_alert.id,
        remarks="Verified and handled",
        user=officer,
    )
    assert resolved.status == "RESOLVED"

    # Notifications check
    unread = AlertService.get_unread_count(db=db, user=officer)
    assert unread >= 1
    notifs, _ = AlertService.list_user_notifications(db=db, user=officer)
    assert len(notifs) >= 1
    AlertService.mark_notification_read(db=db, notification_id=notifs[0].id, user=officer)
    assert AlertService.get_unread_count(db=db, user=officer) == unread - 1
    AlertService.mark_all_notifications_read(db=db, user=officer)
    assert AlertService.get_unread_count(db=db, user=officer) == 0


def test_reports_all_12_and_exports(test_env):
    db = test_env["db"]
    officer = test_env["officer"]

    overview = ReportsService.get_overview(db=db, office_id=officer.office_id, current_user=officer)
    assert overview.total_registered_assets == 2

    report_names = [
        "stock-register",
        "asset-register",
        "stock-quantity",
        "asset-valuation",
        "movements",
        "dead-stock",
        "condemnations",
        "disposals",
        "suppliers-procurement",
        "warranties",
        "maintenance",
        "physical-verification",
    ]
    for name in report_names:
        payload = ReportsService.get_report_payload(
            db=db,
            report_name=name,
            office_id=officer.office_id,
            filters={},
            page=1,
            limit=20,
        )
        assert "headers" in payload and len(payload["headers"]) > 0
        assert "rows" in payload
        assert "summary" in payload

    # Test CSV, XLSX, PDF exports
    asset_payload = ReportsService.get_report_payload(
        db=db,
        report_name="asset-register",
        office_id=officer.office_id,
        filters={},
        page=1,
        limit=20,
    )
    csv_data = ReportsService.export_to_csv(
        asset_payload["headers"], asset_payload.get("all_rows", asset_payload["rows"])
    )
    assert "DS-ST-0001" in csv_data

    xlsx_bytes = ReportsService.export_to_xlsx(
        asset_payload.get("title", "Asset Register"),
        asset_payload["headers"],
        asset_payload.get("all_rows", asset_payload["rows"]),
        summary=asset_payload.get("summary"),
    )
    assert xlsx_bytes[:2] == b"PK"

    pdf_bytes = ReportsService.export_to_pdf(
        asset_payload.get("title", "Asset Register"),
        asset_payload["headers"],
        asset_payload.get("all_rows", asset_payload["rows"]),
        summary=asset_payload.get("summary"),
    )
    assert pdf_bytes[:4] == b"%PDF"
