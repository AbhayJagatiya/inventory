"""Automated tests for Maintenance & Warranty Management."""

from datetime import date, timedelta
from decimal import Decimal
import pytest
from sqlalchemy import BigInteger, Integer, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.exceptions import ConflictError, OfficeAccessDeniedError, ValidationError
from app.core.permissions import ROLE_STORE_OFFICER, ROLE_STORE_STAFF
from app.core.security import hash_password
from app.features.audit.models import AuditLog
from app.features.categories.models import Category, UnitOfMeasure
from app.features.inventory.models import Item
from app.features.locations.models import Location
from app.features.maintenance.schemas import MaintenanceComplete, MaintenanceCreate, MaintenanceUpdate
from app.features.maintenance.services import MaintenanceService
from app.features.offices.models import Office
from app.features.roles.models import Role
from app.features.roles.services import RoleService
from app.features.users.models import User
from app.features.warranties.schemas import WarrantyCreate, WarrantyUpdate
from app.features.warranties.services import WarrantyService
from app.models import Base
from app.routes import maintenance as maintenance_routes
from app.routes import warranties as warranty_routes


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
        code="IT_EQUIPMENT",
        name="IT Equipment",
        slow_moving_threshold_days=90,
        inactivity_threshold_days=180,
        obsolescence_years=5,
        depreciation_rate_pct=Decimal("20.00"),
    )
    uom = UnitOfMeasure(code="NOS", name="Numbers")
    db.add_all([loc_a, cat, uom])
    db.flush()

    item1 = Item(
        office_id=office_a.id,
        category_id=cat.id,
        location_id=loc_a.id,
        uom_id=uom.id,
        item_code="DS-IT-0001",
        item_name="Desktop PC",
        item_type="DURABLE_ASSET",
        condition="GOOD",
        operational_status="AVAILABLE_IN_STORE",
        current_classification="ACTIVE",
        unit_purchase_cost=Decimal("45000.00"),
        total_cost=Decimal("45000.00"),
        created_by=officer.id,
    )
    item2 = Item(
        office_id=office_a.id,
        category_id=cat.id,
        location_id=loc_a.id,
        uom_id=uom.id,
        item_code="DS-IT-0002",
        item_name="Laser Printer",
        item_type="DURABLE_ASSET",
        condition="GOOD",
        operational_status="AVAILABLE_IN_STORE",
        current_classification="ACTIVE",
        unit_purchase_cost=Decimal("18000.00"),
        total_cost=Decimal("18000.00"),
        created_by=officer.id,
    )
    db.add_all([item1, item2])
    db.commit()

    yield {
        "db": db,
        "office_a": office_a,
        "office_b": office_b,
        "officer": officer,
        "staff": staff,
        "other_officer": other_officer,
        "item1": item1,
        "item2": item2,
    }
    db.close()


def test_maintenance_lifecycle_and_office_isolation(test_env):
    db = test_env["db"]
    officer = test_env["officer"]
    other_officer = test_env["other_officer"]
    item1 = test_env["item1"]

    # Create ticket
    created = MaintenanceService.log_maintenance(
        db=db,
        payload=MaintenanceCreate(
            item_id=item1.id,
            issue_description="Power supply failure",
            service_provider="Gir Tech Services",
            reported_date=date.today(),
            estimated_cost=1500.0,
        ),
        reporter=officer,
    )
    assert created.status == "REPORTED"
    assert created.ticket_reference is not None
    db.refresh(item1)
    assert item1.operational_status == "UNDER_MAINTENANCE"

    # Duplicate open ticket rejected
    with pytest.raises(ConflictError):
        MaintenanceService.log_maintenance(
            db=db,
            payload=MaintenanceCreate(
                item_id=item1.id,
                issue_description="Another issue",
                service_provider="Gir Tech Services",
                reported_date=date.today(),
                estimated_cost=500.0,
            ),
            reporter=officer,
        )

    # Invalid lifecycle jump REPORTED -> COMPLETED rejected
    with pytest.raises(ValidationError):
        MaintenanceService.update_maintenance(
            db=db,
            maintenance_id=created.id,
            payload=MaintenanceUpdate(status="COMPLETED"),
            updater=officer,
        )

    # Office isolation enforced at route helper
    with pytest.raises(OfficeAccessDeniedError):
        maintenance_routes.get_maintenance(
            maintenance_id=created.id,
            db=db,
            current_user=other_officer,
        )

    # Valid transitions: REPORTED -> UNDER_REVIEW -> APPROVED -> IN_REPAIR
    MaintenanceService.update_maintenance(
        db=db,
        maintenance_id=created.id,
        payload=MaintenanceUpdate(status="UNDER_REVIEW"),
        updater=officer,
    )
    MaintenanceService.update_maintenance(
        db=db,
        maintenance_id=created.id,
        payload=MaintenanceUpdate(status="APPROVED"),
        updater=officer,
    )
    MaintenanceService.update_maintenance(
        db=db,
        maintenance_id=created.id,
        payload=MaintenanceUpdate(status="IN_REPAIR"),
        updater=officer,
    )

    # Complete maintenance
    completed = MaintenanceService.complete_maintenance(
        db=db,
        maintenance_id=created.id,
        payload=MaintenanceComplete(
            completion_date=date.today(),
            actual_cost=1250.0,
            work_performed="Replaced SMPS unit and tested",
            invoice_reference="INV-2026-01",
            resulting_condition="GOOD",
        ),
        completer=officer,
    )
    assert completed.status == "COMPLETED"
    assert completed.actual_cost == 1250.0
    db.refresh(item1)
    assert item1.operational_status == "AVAILABLE_IN_STORE"
    assert item1.condition == "GOOD"

    # Summary KPIs
    summary = MaintenanceService.get_summary(db=db, current_user=officer)
    assert summary.total_tickets == 1
    assert summary.completed_count == 1
    assert summary.total_actual_cost == 1250.0


def test_warranty_crud_status_and_expiry(test_env):
    db = test_env["db"]
    officer = test_env["officer"]
    other_officer = test_env["other_officer"]
    item1 = test_env["item1"]
    item2 = test_env["item2"]

    today = date.today()

    # Invalid date range rejected
    with pytest.raises(ValidationError):
        WarrantyService.create_warranty(
            db=db,
            payload=WarrantyCreate(
                item_id=item1.id,
                provider_name="Dell India",
                start_date=today,
                end_date=today - timedelta(days=1),
            ),
            creator=officer,
        )

    # Expiring within 15 days -> EXPIRING_SOON
    w1 = WarrantyService.create_warranty(
        db=db,
        payload=WarrantyCreate(
            item_id=item1.id,
            provider_name="Dell ProSupport",
            start_date=today - timedelta(days=350),
            end_date=today + timedelta(days=15),
            coverage_details="Onsite NBD",
            support_contact="1800-425-0088",
        ),
        creator=officer,
    )
    assert w1.status == "EXPIRING_SOON"
    assert w1.remaining_days == 15

    # Duplicate warranty for same item rejected
    with pytest.raises(ConflictError):
        WarrantyService.create_warranty(
            db=db,
            payload=WarrantyCreate(
                item_id=item1.id,
                provider_name="Another",
                start_date=today,
                end_date=today + timedelta(days=365),
            ),
            creator=officer,
        )

    # Expired warranty for item2
    w2 = WarrantyService.create_warranty(
        db=db,
        payload=WarrantyCreate(
            item_id=item2.id,
            provider_name="HP Care",
            start_date=today - timedelta(days=400),
            end_date=today - timedelta(days=5),
        ),
        creator=officer,
    )
    assert w2.status == "EXPIRED"

    # Expiring endpoint query
    expiring_30 = WarrantyService.get_expiring_warranties(
        db=db, lead_days=30, current_user=officer
    )
    assert len(expiring_30) == 1
    assert expiring_30[0].id == w1.id

    # Summary counts
    summary = WarrantyService.get_summary(db=db, current_user=officer)
    assert summary.total_warranties == 2
    assert summary.expiring_30_count == 1
    assert summary.expired_count == 1
    assert summary.items_without_warranty == 0

    # Office isolation
    with pytest.raises(OfficeAccessDeniedError):
        warranty_routes.get_warranty(
            warranty_id=w1.id,
            db=db,
            current_user=other_officer,
        )
