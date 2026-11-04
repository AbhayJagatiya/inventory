"""Seeding Script for Realistic District Panchayat Inventory & Dead Stock Data.

Populates PostgreSQL database (deadstock_db) with:
1. Approved Vendors & Suppliers
2. Durable Assets & Consumable Inventory Items
3. Location Stock Balances
4. Stock Movement Ledger (Receipts, Issues, Transfers)
5. Dead Stock Classifications (Active, Slow-moving, Non-moving, Obsolete)
6. Physical Verification Audit Session & Reconciliation Discrepancy
7. Condemnation Proposal & Approval Workflow Log
8. Disposal Execution & Scrap Sales Record
"""

import sys
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import (
    Office,
    User,
    Category,
    Location,
    UnitOfMeasure,
    Supplier,
    Item,
    StockBalance,
    StockTransaction,
    StockTransactionLine,
    Classification,
    VerificationSession,
    VerificationItem,
    CondemnationRequest,
    CondemnationRequestItem,
    ApprovalAction,
    Disposal,
    DisposalItem,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_inventory")


def seed_database():
    db: Session = SessionLocal()
    try:
        logger.info("Connecting to PostgreSQL deadstock_db to seed inventory records...")

        # 1. Fetch prerequisite entities
        office = db.query(Office).first()
        if not office:
            raise RuntimeError("No Office found. Please run app.db_init first.")

        admin_user = db.query(User).filter(User.username == "admin").first() or db.query(User).first()
        officer_user = db.query(User).filter(User.username == "officer").first() or admin_user
        staff_user = db.query(User).filter(User.username == "staff").first() or admin_user

        cats = {c.code: c for c in db.query(Category).all()}
        uoms = {u.code: u for u in db.query(UnitOfMeasure).all()}
        locs = {l.building_name: l for l in db.query(Location).all()}

        # Fallback location lookup
        main_store = next((l for l in locs.values() if "Main Store" in l.building_name), list(locs.values())[0])
        stat_store = next((l for l in locs.values() if "Stationery" in l.building_name), main_store)
        admin_cabin = next((l for l in locs.values() if "Administrative" in l.building_name or "Cabin" in l.building_name), main_store)
        record_room = next((l for l in locs.values() if "Record" in l.building_name), main_store)
        open_yard = next((l for l in locs.values() if "Yard" in l.building_name), main_store)

        nos_uom = uoms.get("NOS") or list(uoms.values())[0]
        box_uom = uoms.get("BOX") or nos_uom
        pkt_uom = uoms.get("PACKET") or nos_uom
        set_uom = uoms.get("SET") or nos_uom

        # 2. Seed Suppliers
        logger.info("Seeding Suppliers...")
        suppliers_data = [
            {
                "code": "SUP-INFOTECH",
                "name": "InfoTech Solutions Ahmedabad",
                "person": "Manish Shah",
                "phone": "+91 98250 11223",
                "email": "sales@infotechsolutions.in",
                "address": "402 Silicon Heights, C.G. Road, Ahmedabad - 380009",
                "gstin": "24AABCI1234F1Z8",
                "pan": "AABCI1234F",
            },
            {
                "code": "SUP-GUJ-FURN",
                "name": "Gujarat State Handloom & Handicrafts Dev Corp",
                "person": "Rameshchandra Patel",
                "phone": "+91 94270 33445",
                "email": "garvigujarat@gujarat.gov.in",
                "address": "Panchayat Bhavan Emporium, Rajkot - 360001",
                "gstin": "24AAACG5678B1ZP",
                "pan": "AAACG5678B",
            },
            {
                "code": "SUP-GIR-STAT",
                "name": "Gir Stationery & General Mart",
                "person": "Harishbhai Vala",
                "phone": "+91 98980 55667",
                "email": "girstationery.veraval@gmail.com",
                "address": "Shop 12, Tower Chowk, Veraval, Gir Somnath - 362265",
                "gstin": "24AAGFG9012C1ZU",
                "pan": "AAGFG9012C",
            },
            {
                "code": "SUP-SAU-AUTO",
                "name": "Saurashtra Office Automation",
                "person": "Kishorbhai Bhensdadia",
                "phone": "+91 97260 77889",
                "email": "kishor@saurashtraauto.co.in",
                "address": "Station Road, Junagadh - 362001",
                "gstin": "24AAPFS3456D1ZQ",
                "pan": "AAPFS3456D",
            },
        ]

        sup_map = {}
        for s_data in suppliers_data:
            existing = db.query(Supplier).filter(Supplier.supplier_code == s_data["code"]).first()
            if not existing:
                existing = Supplier(
                    supplier_code=s_data["code"],
                    name=s_data["name"],
                    contact_person=s_data["person"],
                    phone=s_data["phone"],
                    email=s_data["email"],
                    address=s_data["address"],
                    gstin=s_data["gstin"],
                    pan=s_data["pan"],
                    is_active=True,
                )
                db.add(existing)
                db.flush()
            sup_map[s_data["code"]] = existing

        # 3. Seed Items (Assets & Consumables)
        logger.info("Seeding Inventory Items...")
        today = date.today()

        items_spec = [
            # 1. Active IT Equipment
            {
                "code": "AST-GS-VRV-2024-00001",
                "name": "Dell OptiPlex 7090 Desktop Computer",
                "type": "DURABLE_ASSET",
                "cat": "IT_EQUIPMENT",
                "loc": main_store,
                "sup": "SUP-INFOTECH",
                "uom": nos_uom,
                "brand": "Dell",
                "model": "OptiPlex 7090 MT",
                "serial": "DL-7090-VRV-0101",
                "barcode": "8901234000012",
                "purchase_date": today - timedelta(days=120),
                "invoice": "INV-INF-2024-891",
                "cost": Decimal("68500.00"),
                "total": Decimal("68500.00"),
                "condition": "GOOD",
                "status": "AVAILABLE_IN_STORE",
                "classification": "ACTIVE",
                "custodian": "Main Store Keeper",
                "dept": "Store Division",
                "last_movement": today - timedelta(days=20),
                "qty": Decimal("1.00"),
            },
            {
                "code": "AST-GS-VRV-2023-00014",
                "name": "HP LaserJet Pro M404dn High Speed Printer",
                "type": "DURABLE_ASSET",
                "cat": "IT_EQUIPMENT",
                "loc": admin_cabin,
                "sup": "SUP-INFOTECH",
                "uom": nos_uom,
                "brand": "HP",
                "model": "LaserJet M404dn",
                "serial": "VNB3R89412",
                "barcode": "8901234000029",
                "purchase_date": today - timedelta(days=340),
                "invoice": "INV-INF-2023-455",
                "cost": Decimal("28900.00"),
                "total": Decimal("28900.00"),
                "condition": "GOOD",
                "status": "IN_USE",
                "classification": "ACTIVE",
                "custodian": "Rajeshbhai Parmar (Senior Clerk)",
                "dept": "Accounts Branch",
                "last_movement": today - timedelta(days=90),
                "qty": Decimal("1.00"),
            },
            {
                "code": "AST-GS-VRV-2024-00022",
                "name": "Acer TravelMate Business Laptop",
                "type": "DURABLE_ASSET",
                "cat": "IT_EQUIPMENT",
                "loc": main_store,
                "sup": "SUP-INFOTECH",
                "uom": nos_uom,
                "brand": "Acer",
                "model": "TravelMate TMP214",
                "serial": "NXVRV001994",
                "barcode": "8901234000036",
                "purchase_date": today - timedelta(days=80),
                "invoice": "INV-INF-2024-912",
                "cost": Decimal("54200.00"),
                "total": Decimal("54200.00"),
                "condition": "FAIR",
                "status": "UNDER_MAINTENANCE",
                "classification": "ACTIVE",
                "custodian": "Nileshbhai Chudasama",
                "dept": "Panchayat Engineering Cell",
                "last_movement": today - timedelta(days=5),
                "qty": Decimal("1.00"),
            },
            # 2. Furniture
            {
                "code": "AST-GS-VRV-2022-00005",
                "name": "Godrej Storewel Plain Steel Almirah",
                "type": "DURABLE_ASSET",
                "cat": "OFFICE_FURNITURE",
                "loc": record_room,
                "sup": "SUP-GUJ-FURN",
                "uom": nos_uom,
                "brand": "Godrej Interio",
                "model": "Storewel Minor",
                "serial": "GDJ-ALM-2022-77",
                "barcode": "8901234000043",
                "purchase_date": today - timedelta(days=600),
                "invoice": "INV-GF-2022-108",
                "cost": Decimal("24500.00"),
                "total": Decimal("24500.00"),
                "condition": "GOOD",
                "status": "IN_USE",
                "classification": "ACTIVE",
                "custodian": "Smt. Bhavnaben Mori (Record Custodian)",
                "dept": "Central Registry",
                "last_movement": today - timedelta(days=180),
                "qty": Decimal("1.00"),
            },
            {
                "code": "AST-GS-VRV-2023-00088",
                "name": "Executive High-Back Revolving Chairs (Pair)",
                "type": "DURABLE_ASSET",
                "cat": "OFFICE_FURNITURE",
                "loc": admin_cabin,
                "sup": "SUP-GUJ-FURN",
                "uom": set_uom,
                "brand": "Featherlite",
                "model": "Helix High-Back",
                "serial": "FL-CHR-2023-41",
                "barcode": "8901234000050",
                "purchase_date": today - timedelta(days=280),
                "invoice": "INV-GF-2023-304",
                "cost": Decimal("19800.00"),
                "total": Decimal("19800.00"),
                "condition": "GOOD",
                "status": "IN_USE",
                "classification": "ACTIVE",
                "custodian": "District Planning Officer",
                "dept": "Planning Cell",
                "last_movement": today - timedelta(days=45),
                "qty": Decimal("1.00"),
            },
            # 3. Office Machinery
            {
                "code": "AST-GS-VRV-2023-00031",
                "name": "Canon imageRUNNER 2625 Heavy Duty Copier",
                "type": "DURABLE_ASSET",
                "cat": "OFFICE_MACHINERY",
                "loc": admin_cabin,
                "sup": "SUP-SAU-AUTO",
                "uom": nos_uom,
                "brand": "Canon",
                "model": "iR 2625 MFD",
                "serial": "CNN-IR2625-9981",
                "barcode": "8901234000067",
                "purchase_date": today - timedelta(days=410),
                "invoice": "INV-SAU-2023-77",
                "cost": Decimal("145000.00"),
                "total": Decimal("145000.00"),
                "condition": "GOOD",
                "status": "IN_USE",
                "classification": "ACTIVE",
                "custodian": "Central Dispatch Clerk",
                "dept": "General Administration",
                "last_movement": today - timedelta(days=15),
                "qty": Decimal("1.00"),
            },
            {
                "code": "AST-GS-VRV-2024-00045",
                "name": "Voltas 2.0 Ton Inverter Split Air Conditioner",
                "type": "DURABLE_ASSET",
                "cat": "OFFICE_MACHINERY",
                "loc": admin_cabin,
                "sup": "SUP-SAU-AUTO",
                "uom": nos_uom,
                "brand": "Voltas",
                "model": "V-243V-Vectra",
                "serial": "VLT-243-VRV-01",
                "barcode": "8901234000074",
                "purchase_date": today - timedelta(days=100),
                "invoice": "INV-SAU-2024-112",
                "cost": Decimal("52000.00"),
                "total": Decimal("52000.00"),
                "condition": "GOOD",
                "status": "IN_USE",
                "classification": "ACTIVE",
                "custodian": "District Development Officer Chamber",
                "dept": "DDO Secretariat",
                "last_movement": today - timedelta(days=100),
                "qty": Decimal("1.00"),
            },
            # 4. DEAD STOCK: Slow-Moving & Non-Moving Assets (Phase 5 Testing)
            {
                "code": "AST-GS-VRV-2018-00012",
                "name": "HCL Infinity Pro Desktop Computer Set",
                "type": "DURABLE_ASSET",
                "cat": "IT_EQUIPMENT",
                "loc": record_room,
                "sup": "SUP-INFOTECH",
                "uom": nos_uom,
                "brand": "HCL",
                "model": "Infinity Pro 900",
                "serial": "HCL-INF-2018-091",
                "barcode": "8901234000081",
                "purchase_date": today - timedelta(days=2600),
                "invoice": "INV-OLD-2018-40",
                "cost": Decimal("38500.00"),
                "total": Decimal("38500.00"),
                "condition": "DAMAGED",
                "status": "NON_FUNCTIONAL",
                "classification": "OBSOLETE",
                "custodian": "Unassigned",
                "dept": "Statistics Branch (Defunct)",
                "last_movement": today - timedelta(days=680),
                "qty": Decimal("1.00"),
            },
            {
                "code": "AST-GS-VRV-2016-00004",
                "name": "Wipro LQ-540 Dot Matrix 24-Pin Printer",
                "type": "DURABLE_ASSET",
                "cat": "IT_EQUIPMENT",
                "loc": record_room,
                "sup": "SUP-INFOTECH",
                "uom": nos_uom,
                "brand": "Wipro / Epson",
                "model": "LQ-540 DX",
                "serial": "WPR-DMP-16-003",
                "barcode": "8901234000098",
                "purchase_date": today - timedelta(days=3200),
                "invoice": "INV-OLD-2016-11",
                "cost": Decimal("16500.00"),
                "total": Decimal("16500.00"),
                "condition": "SCRAP",
                "status": "AVAILABLE_IN_STORE",
                "classification": "OBSOLETE",
                "custodian": "Unassigned",
                "dept": "Treasury Store",
                "last_movement": today - timedelta(days=920),
                "qty": Decimal("1.00"),
            },
            {
                "code": "AST-GS-VRV-2017-00033",
                "name": "Teak Wood Double Pedestal Staff Clerk Table",
                "type": "DURABLE_ASSET",
                "cat": "OFFICE_FURNITURE",
                "loc": open_yard,
                "sup": "SUP-GUJ-FURN",
                "uom": nos_uom,
                "brand": "Gujarat Handicrafts",
                "model": "Standard Table 5x3",
                "serial": "TAB-WD-2017-104",
                "barcode": "8901234000104",
                "purchase_date": today - timedelta(days=2800),
                "invoice": "INV-OLD-2017-88",
                "cost": Decimal("14200.00"),
                "total": Decimal("14200.00"),
                "condition": "POOR",
                "status": "AVAILABLE_IN_STORE",
                "classification": "NON_MOVING",
                "custodian": "Unassigned",
                "dept": "Estate Branch",
                "last_movement": today - timedelta(days=310),
                "qty": Decimal("1.00"),
            },
            {
                "code": "AST-GS-VRV-2015-00008",
                "name": "Sharp Digital Copier SF-2014 Analog Drum",
                "type": "DURABLE_ASSET",
                "cat": "OFFICE_MACHINERY",
                "loc": open_yard,
                "sup": "SUP-SAU-AUTO",
                "uom": nos_uom,
                "brand": "Sharp",
                "model": "SF-2014 Analog",
                "serial": "SHP-COP-15-77",
                "barcode": "8901234000111",
                "purchase_date": today - timedelta(days=3500),
                "invoice": "INV-OLD-2015-02",
                "cost": Decimal("85000.00"),
                "total": Decimal("85000.00"),
                "condition": "DAMAGED",
                "status": "PENDING_CONDEMNATION",
                "classification": "OBSOLETE",
                "custodian": "Unassigned",
                "dept": "Record Preservation",
                "last_movement": today - timedelta(days=510),
                "qty": Decimal("1.00"),
            },
            {
                "code": "AST-GS-VRV-2017-00089",
                "name": "Bajaj 56-inch Heavy Duty Ceiling Fans Lot (4 Units)",
                "type": "DURABLE_ASSET",
                "cat": "OFFICE_MACHINERY",
                "loc": open_yard,
                "sup": "SUP-SAU-AUTO",
                "uom": set_uom,
                "brand": "Bajaj",
                "model": "MaxAir 56",
                "serial": "BJJ-FAN-LOT-04",
                "barcode": "8901234000128",
                "purchase_date": today - timedelta(days=2700),
                "invoice": "INV-OLD-2017-91",
                "cost": Decimal("12800.00"),
                "total": Decimal("12800.00"),
                "condition": "SCRAP",
                "status": "PENDING_DISPOSAL",
                "classification": "OBSOLETE",
                "custodian": "Unassigned",
                "dept": "Civil Maintenance",
                "last_movement": today - timedelta(days=440),
                "qty": Decimal("1.00"),
            },
            {
                "code": "AST-GS-VRV-2014-00002",
                "name": "TVS MSP-240 Thermal Receipt & Voucher Printer",
                "type": "DURABLE_ASSET",
                "cat": "IT_EQUIPMENT",
                "loc": open_yard,
                "sup": "SUP-INFOTECH",
                "uom": nos_uom,
                "brand": "TVS Electronics",
                "model": "MSP-240 Star",
                "serial": "TVS-240-2014-01",
                "barcode": "8901234000135",
                "purchase_date": today - timedelta(days=3900),
                "invoice": "INV-OLD-2014-19",
                "cost": Decimal("11500.00"),
                "total": Decimal("11500.00"),
                "condition": "SCRAP",
                "status": "DISPOSED",
                "classification": "OBSOLETE",
                "custodian": "Disposed via Auction",
                "dept": "Disposed Assets",
                "last_movement": today - timedelta(days=60),
                "qty": Decimal("0.00"),
            },
            # 5. Consumable Stationery Stocks (Quantity Tracked)
            {
                "code": "ITM-GS-VRV-00101",
                "name": "JK Copier Paper A4 75 GSM (Ream of 500 Sheets)",
                "type": "CONSUMABLE_STOCK",
                "cat": "OFFICE_STATIONERY",
                "loc": stat_store,
                "sup": "SUP-GIR-STAT",
                "uom": pkt_uom,
                "brand": "JK Paper",
                "model": "A4 75GSM",
                "serial": None,
                "barcode": "8901234001019",
                "purchase_date": today - timedelta(days=45),
                "invoice": "INV-GIR-2024-412",
                "cost": Decimal("310.00"),
                "total": Decimal("37200.00"),
                "condition": "NEW",
                "status": "AVAILABLE_IN_STORE",
                "classification": "ACTIVE",
                "custodian": "Stationery Store Incharge",
                "dept": "Store Division",
                "last_movement": today - timedelta(days=10),
                "qty": Decimal("120.00"),
            },
            {
                "code": "ITM-GS-VRV-00102",
                "name": "Cello Gripper Blue Ballpoint Pen (Pack of 20)",
                "type": "CONSUMABLE_STOCK",
                "cat": "OFFICE_STATIONERY",
                "loc": stat_store,
                "sup": "SUP-GIR-STAT",
                "uom": box_uom,
                "brand": "Cello",
                "model": "Gripper 0.7mm",
                "serial": None,
                "barcode": "8901234001026",
                "purchase_date": today - timedelta(days=30),
                "invoice": "INV-GIR-2024-450",
                "cost": Decimal("160.00"),
                "total": Decimal("7200.00"),
                "condition": "NEW",
                "status": "AVAILABLE_IN_STORE",
                "classification": "ACTIVE",
                "custodian": "Stationery Store Incharge",
                "dept": "Store Division",
                "last_movement": today - timedelta(days=8),
                "qty": Decimal("45.00"),
            },
            {
                "code": "ITM-GS-VRV-00103",
                "name": "HP LaserJet 88A Original Black Toner Cartridge",
                "type": "CONSUMABLE_STOCK",
                "cat": "OFFICE_STATIONERY",
                "loc": main_store,
                "sup": "SUP-INFOTECH",
                "uom": nos_uom,
                "brand": "HP",
                "model": "CC388A",
                "serial": "TNR-HP88A-LOT24",
                "barcode": "8901234001033",
                "purchase_date": today - timedelta(days=60),
                "invoice": "INV-INF-2024-780",
                "cost": Decimal("3850.00"),
                "total": Decimal("46200.00"),
                "condition": "NEW",
                "status": "AVAILABLE_IN_STORE",
                "classification": "ACTIVE",
                "custodian": "Main Store Keeper",
                "dept": "Store Division",
                "last_movement": today - timedelta(days=12),
                "qty": Decimal("12.00"),
            },
            {
                "code": "ITM-GS-VRV-00104",
                "name": "Hard Bound Panchayat Ledger Register (300 Pages)",
                "type": "CONSUMABLE_STOCK",
                "cat": "OFFICE_STATIONERY",
                "loc": stat_store,
                "sup": "SUP-GIR-STAT",
                "uom": nos_uom,
                "brand": "Navneet",
                "model": "Ledger 300P",
                "serial": None,
                "barcode": "8901234001040",
                "purchase_date": today - timedelta(days=90),
                "invoice": "INV-GIR-2024-210",
                "cost": Decimal("240.00"),
                "total": Decimal("20400.00"),
                "condition": "NEW",
                "status": "AVAILABLE_IN_STORE",
                "classification": "ACTIVE",
                "custodian": "Stationery Store Incharge",
                "dept": "Store Division",
                "last_movement": today - timedelta(days=25),
                "qty": Decimal("85.00"),
            },
        ]

        item_map = {}
        for spec in items_spec:
            cat_obj = cats.get(spec["cat"])
            if not cat_obj:
                cat_obj = list(cats.values())[0]

            sup_obj = sup_map.get(spec["sup"])

            existing_item = db.query(Item).filter(Item.item_code == spec["code"]).first()
            if not existing_item:
                item_obj = Item(
                    office_id=office.id,
                    category_id=cat_obj.id,
                    location_id=spec["loc"].id,
                    supplier_id=sup_obj.id if sup_obj else None,
                    uom_id=spec["uom"].id,
                    item_code=spec["code"],
                    item_name=spec["name"],
                    item_type=spec["type"],
                    barcode_number=spec["barcode"],
                    brand=spec["brand"],
                    model_number=spec["model"],
                    serial_number=spec["serial"],
                    purchase_date=spec["purchase_date"],
                    invoice_number=spec["invoice"],
                    unit_purchase_cost=spec["cost"],
                    total_cost=spec["total"],
                    condition=spec["condition"],
                    operational_status=spec["status"],
                    current_classification=spec["classification"],
                    current_custodian=spec["custodian"],
                    current_department=spec["dept"],
                    last_movement_date=spec["last_movement"],
                    min_stock_level=Decimal("10.00") if spec["type"] == "CONSUMABLE_STOCK" else Decimal("0.00"),
                    created_by=admin_user.id,
                    updated_by=admin_user.id,
                )
                db.add(item_obj)
                db.flush()
            else:
                item_obj = existing_item

            item_map[spec["code"]] = item_obj

            # Ensure StockBalance exists for item + location
            existing_bal = db.query(StockBalance).filter(
                StockBalance.item_id == item_obj.id,
                StockBalance.location_id == spec["loc"].id,
            ).first()

            if not existing_bal:
                is_allocated = spec["status"] in ["IN_USE", "UNDER_MAINTENANCE"]
                is_disposed = spec["status"] == "DISPOSED"

                bal = StockBalance(
                    office_id=office.id,
                    item_id=item_obj.id,
                    location_id=spec["loc"].id,
                    available_qty=Decimal("0.00") if (is_allocated or is_disposed) else spec["qty"],
                    allocated_qty=spec["qty"] if is_allocated else Decimal("0.00"),
                    disposed_qty=spec["qty"] if is_disposed else Decimal("0.00"),
                )
                db.add(bal)
                db.flush()

        logger.info(f"Seeded {len(items_spec)} items and corresponding stock balances.")

        # 4. Seed Stock Movement Ledger (Receipts, Issues, Transfers)
        logger.info("Seeding Stock Movement Ledger (Transactions)...")
        txns_spec = [
            {
                "num": "RC-2024-00101",
                "type": "RECEIPT",
                "dest_loc": stat_store,
                "src_loc": None,
                "recipient": "Main Store Room",
                "dept": "Store Division",
                "ref": "PO-GIR-2024-089 / Ch-412",
                "status": "POSTED",
                "remarks": "Received stationery consignment against annual district supply order.",
                "days_ago": 45,
                "lines": [
                    {
                        "item_code": "ITM-GS-VRV-00101",
                        "qty": Decimal("150.00"),
                        "unit_cost": Decimal("310.00"),
                        "cond": "NEW",
                    },
                    {
                        "item_code": "ITM-GS-VRV-00102",
                        "qty": Decimal("50.00"),
                        "unit_cost": Decimal("160.00"),
                        "cond": "NEW",
                    },
                ],
            },
            {
                "num": "IS-2024-00045",
                "type": "ISSUE",
                "dest_loc": admin_cabin,
                "src_loc": stat_store,
                "recipient": "Rajeshbhai Parmar (Senior Clerk)",
                "dept": "Accounts Branch",
                "ref": "REQ-ACC-2024-12",
                "status": "POSTED",
                "remarks": "Issued A4 paper and pens for budget preparation session.",
                "days_ago": 10,
                "lines": [
                    {
                        "item_code": "ITM-GS-VRV-00101",
                        "qty": Decimal("30.00"),
                        "unit_cost": Decimal("310.00"),
                        "cond": "GOOD",
                    },
                    {
                        "item_code": "ITM-GS-VRV-00102",
                        "qty": Decimal("5.00"),
                        "unit_cost": Decimal("160.00"),
                        "cond": "GOOD",
                    },
                ],
            },
            {
                "num": "TR-2024-00018",
                "type": "TRANSFER",
                "dest_loc": admin_cabin,
                "src_loc": main_store,
                "recipient": "DDO Secretariat",
                "dept": "Administration",
                "ref": "MEMO-DDO-2024-88",
                "status": "POSTED",
                "remarks": "Internal asset transfer of revolving chairs for DDO conference room.",
                "days_ago": 25,
                "lines": [
                    {
                        "item_code": "AST-GS-VRV-2023-00088",
                        "qty": Decimal("1.00"),
                        "unit_cost": Decimal("19800.00"),
                        "cond": "GOOD",
                    },
                ],
            },
            {
                "num": "RT-2024-00007",
                "type": "RETURN",
                "dest_loc": stat_store,
                "src_loc": admin_cabin,
                "recipient": "Stationery Store Incharge",
                "dept": "Store Division",
                "ref": "RTN-MEMO-2024-01",
                "status": "POSTED",
                "remarks": "Returned unutilized register books back to central stock.",
                "days_ago": 5,
                "lines": [
                    {
                        "item_code": "ITM-GS-VRV-00104",
                        "qty": Decimal("5.00"),
                        "unit_cost": Decimal("240.00"),
                        "cond": "GOOD",
                    },
                ],
            },
        ]

        for t_spec in txns_spec:
            existing_txn = db.query(StockTransaction).filter(StockTransaction.transaction_number == t_spec["num"]).first()
            if not existing_txn:
                txn = StockTransaction(
                    transaction_number=t_spec["num"],
                    transaction_type=t_spec["type"],
                    office_id=office.id,
                    source_office_id=office.id,
                    destination_office_id=office.id,
                    source_location_id=t_spec["src_loc"].id if t_spec["src_loc"] else None,
                    destination_location_id=t_spec["dest_loc"].id if t_spec["dest_loc"] else None,
                    recipient_name=t_spec["recipient"],
                    recipient_department=t_spec["dept"],
                    reference_document=t_spec["ref"],
                    status="DRAFT",  # Create as DRAFT first so trigger allows lines insertion
                    actor_id=officer_user.id,
                    remarks=t_spec["remarks"],
                    posted_at=datetime.now(timezone.utc) - timedelta(days=t_spec["days_ago"]),
                    created_at=datetime.now(timezone.utc) - timedelta(days=t_spec["days_ago"]),
                )
                db.add(txn)
                db.flush()

                for l_spec in t_spec["lines"]:
                    itm = item_map.get(l_spec["item_code"])
                    if itm:
                        line = StockTransactionLine(
                            transaction_id=txn.id,
                            item_id=itm.id,
                            quantity=l_spec["qty"],
                            unit_cost=l_spec["unit_cost"],
                            total_cost=l_spec["qty"] * l_spec["unit_cost"],
                            condition_observed=l_spec["cond"],
                            remarks=f"Movement recorded for {itm.item_name}",
                        )
                        db.add(line)
                db.flush()

                # Update transaction status to POSTED now that lines are present
                txn.status = t_spec["status"]
                db.flush()

        # 5. Seed Dead Stock Classifications (Phase 5 Engine Records)
        logger.info("Seeding Dead Stock Classifications...")
        deadstock_classifications = [
            {
                "code": "AST-GS-VRV-2018-00012",
                "calc": "OBSOLETE",
                "eff": "OBSOLETE",
                "inactive": 680,
                "age": 2600,
                "factors": {
                    "inactivity_days": 680,
                    "inactivity_threshold": 180,
                    "lifespan_years": 7.1,
                    "lifespan_threshold": 5,
                    "breakdown_count": 4,
                    "spare_parts_available": False,
                    "recommendation": "Technical write-off recommended",
                },
            },
            {
                "code": "AST-GS-VRV-2016-00004",
                "calc": "OBSOLETE",
                "eff": "OBSOLETE",
                "inactive": 920,
                "age": 3200,
                "factors": {
                    "inactivity_days": 920,
                    "inactivity_threshold": 180,
                    "lifespan_years": 8.7,
                    "lifespan_threshold": 5,
                    "technology_deprecated": True,
                    "recommendation": "E-waste condemnation and auction",
                },
            },
            {
                "code": "AST-GS-VRV-2017-00033",
                "calc": "NON_MOVING",
                "eff": "NON_MOVING",
                "inactive": 310,
                "age": 2800,
                "factors": {
                    "inactivity_days": 310,
                    "inactivity_threshold": 180,
                    "physical_condition": "Damaged joints and termites",
                    "recommendation": "Survey review by Store Officer",
                },
            },
            {
                "code": "AST-GS-VRV-2015-00008",
                "calc": "OBSOLETE",
                "eff": "OBSOLETE",
                "inactive": 510,
                "age": 3500,
                "factors": {
                    "inactivity_days": 510,
                    "repair_estimate_exceeds_scrap": True,
                    "estimated_repair_cost": 42000,
                    "residual_value": 4500,
                    "recommendation": "Condemnation proposal submitted",
                },
            },
            {
                "code": "AST-GS-VRV-2017-00089",
                "calc": "OBSOLETE",
                "eff": "OBSOLETE",
                "inactive": 440,
                "age": 2700,
                "factors": {
                    "inactivity_days": 440,
                    "burnt_armatures": 4,
                    "beyond_economic_repair": True,
                    "recommendation": "Ready for scrap ledger auction",
                },
            },
        ]

        for d_spec in deadstock_classifications:
            itm = item_map.get(d_spec["code"])
            if itm:
                existing_cls = db.query(Classification).filter(
                    Classification.item_id == itm.id,
                    Classification.office_id == office.id,
                ).first()
                if not existing_cls:
                    cls_obj = Classification(
                        item_id=itm.id,
                        office_id=office.id,
                        calculated_classification=d_spec["calc"],
                        effective_classification=d_spec["eff"],
                        rule_version="v1.0",
                        days_inactive=d_spec["inactive"],
                        item_age_days=d_spec["age"],
                        contributing_factors=d_spec["factors"],
                        calculated_at=datetime.now(timezone.utc) - timedelta(days=15),
                    )
                    db.add(cls_obj)

        # 6. Seed Physical Verification Audit Session & Reconciliation Discrepancy
        logger.info("Seeding Physical Verification Session...")
        verif_session_num = "PV-2024-VRV-001"
        existing_sess = db.query(VerificationSession).filter(VerificationSession.session_number == verif_session_num).first()
        if not existing_sess:
            sess = VerificationSession(
                session_number=verif_session_num,
                office_id=office.id,
                scope_type="FULL_OFFICE",
                status="IN_PROGRESS",
                notes="District Annual Dead Stock & Asset Physical Verification Exercise 2024-25.",
                lead_verifier_id=officer_user.id,
                started_at=datetime.now(timezone.utc) - timedelta(days=2),
                created_at=datetime.now(timezone.utc) - timedelta(days=3),
            )
            db.add(sess)
            db.flush()

            # Add verified items into session
            # Discrepancy item 1: Dell desktop (Expected in Main Store, counted as OK)
            pc_item = item_map.get("AST-GS-VRV-2024-00001")
            if pc_item:
                v_item1 = VerificationItem(
                    session_id=sess.id,
                    office_id=office.id,
                    item_id=pc_item.id,
                    expected_location_id=main_store.id,
                    observed_location_id=main_store.id,
                    expected_condition="GOOD",
                    observed_condition="GOOD",
                    expected_qty=Decimal("1.00"),
                    counted_qty=Decimal("1.00"),
                    discrepancy_type="NONE",
                    resolution_status="RESOLVED",
                    resolution_remarks="Asset verified in proper operational order.",
                    verified_by=officer_user.id,
                    verified_at=datetime.now(timezone.utc) - timedelta(days=1),
                )
                db.add(v_item1)

            # Discrepancy item 2: Teak Wood Table (Expected in Main Store, found in Open Yard with condition mismatch)
            tbl_item = item_map.get("AST-GS-VRV-2017-00033")
            if tbl_item:
                v_item2 = VerificationItem(
                    session_id=sess.id,
                    office_id=office.id,
                    item_id=tbl_item.id,
                    expected_location_id=main_store.id,
                    observed_location_id=open_yard.id,
                    expected_condition="GOOD",
                    observed_condition="POOR",
                    expected_qty=Decimal("1.00"),
                    counted_qty=Decimal("1.00"),
                    discrepancy_type="LOCATION_MISMATCH",
                    resolution_status="PENDING",
                    resolution_remarks="Furniture relocated to open yard due to dampness; needs relocation order.",
                    verified_by=officer_user.id,
                    verified_at=datetime.now(timezone.utc) - timedelta(days=1),
                )
                db.add(v_item2)

            # Discrepancy item 3: Sharp Photocopier (Condition Mismatch & Pending Condemnation)
            shp_item = item_map.get("AST-GS-VRV-2015-00008")
            if shp_item:
                v_item3 = VerificationItem(
                    session_id=sess.id,
                    office_id=office.id,
                    item_id=shp_item.id,
                    expected_location_id=open_yard.id,
                    observed_location_id=open_yard.id,
                    expected_condition="FAIR",
                    observed_condition="DAMAGED",
                    expected_qty=Decimal("1.00"),
                    counted_qty=Decimal("1.00"),
                    discrepancy_type="CONDITION_MISMATCH",
                    resolution_status="PENDING",
                    resolution_remarks="Photocopier drum seized; recommended for condemnation.",
                    verified_by=officer_user.id,
                    verified_at=datetime.now(timezone.utc) - timedelta(days=1),
                )
                db.add(v_item3)

        # 7. Seed Condemnation Proposal & Approval Workflow
        logger.info("Seeding Condemnation Proposal...")
        condemn_num = "CP-GS-VRV-2024-001"
        existing_cp = db.query(CondemnationRequest).filter(CondemnationRequest.request_number == condemn_num).first()
        if not existing_cp:
            cp = CondemnationRequest(
                request_number=condemn_num,
                office_id=office.id,
                reason_code="BEYOND_ECONOMIC_REPAIR",
                condition_summary="Photocopier and legacy IT hardware evaluated by technical committee as unserviceable.",
                status="UNDER_REVIEW",
                submitted_by=officer_user.id,
                submitted_at=datetime.now(timezone.utc) - timedelta(days=7),
                created_at=datetime.now(timezone.utc) - timedelta(days=8),
            )
            db.add(cp)
            db.flush()

            hcl_pc = item_map.get("AST-GS-VRV-2018-00012")
            if hcl_pc:
                cp_item1 = CondemnationRequestItem(
                    request_id=cp.id,
                    office_id=office.id,
                    item_id=hcl_pc.id,
                    item_condition="DAMAGED",
                    assessed_scrap_value=Decimal("1800.00"),
                    inspector_remarks="Motherboard shorted, CRT monitor obsolete.",
                )
                db.add(cp_item1)

            shp_pc = item_map.get("AST-GS-VRV-2015-00008")
            if shp_pc:
                cp_item2 = CondemnationRequestItem(
                    request_id=cp.id,
                    office_id=office.id,
                    item_id=shp_pc.id,
                    item_condition="DAMAGED",
                    assessed_scrap_value=Decimal("4500.00"),
                    inspector_remarks="Optical drum and main gear assembly irrecoverably broken.",
                )
                db.add(cp_item2)

            # Approval action 1: Submitter
            act1 = ApprovalAction(
                request_id=cp.id,
                action_by=officer_user.id,
                role_snapshot="Store Officer",
                action="SUBMIT",
                remarks="Proposal prepared and submitted after technical survey inspection.",
                action_at=datetime.now(timezone.utc) - timedelta(days=7),
            )
            db.add(act1)

            # Approval action 2: DDO Review
            act2 = ApprovalAction(
                request_id=cp.id,
                action_by=admin_user.id,
                role_snapshot="District Development Officer",
                action="REVIEW",
                remarks="Forwarded to District Technical Condemnation Committee for final auction sanction.",
                action_at=datetime.now(timezone.utc) - timedelta(days=3),
            )
            db.add(act2)

        # 8. Seed Disposal Execution & Scrap Ledger
        logger.info("Seeding Disposal Record...")
        disp_num = "DSP-GS-VRV-2024-001"
        existing_dsp = db.query(Disposal).filter(Disposal.disposal_number == disp_num).first()
        if not existing_dsp:
            # Need a dummy sanctioned condemnation request for the disposal foreign key
            condemn_disp_num = "CP-GS-VRV-2023-099"
            cp_disp = db.query(CondemnationRequest).filter(CondemnationRequest.request_number == condemn_disp_num).first()
            if not cp_disp:
                cp_disp = CondemnationRequest(
                    request_number=condemn_disp_num,
                    office_id=office.id,
                    reason_code="OBSOLETE",
                    condition_summary="Sanctioned disposal order for irreparable thermal printer.",
                    status="DISPOSED",
                    submitted_by=officer_user.id,
                    submitted_at=datetime.now(timezone.utc) - timedelta(days=90),
                    created_at=datetime.now(timezone.utc) - timedelta(days=92),
                )
                db.add(cp_disp)
                db.flush()

            tvs_item = item_map.get("AST-GS-VRV-2014-00002")

            dsp = Disposal(
                disposal_number=disp_num,
                request_id=cp_disp.id,
                office_id=office.id,
                disposal_method="PUBLIC_AUCTION",
                disposal_date=today - timedelta(days=60),
                total_sale_proceeds=Decimal("1850.00"),
                recipient_agency="Gir Somnath Registered Scrap Traders Association",
                reference_order_number="ORDER-DDO-DISP-2024-11",
                executed_by=admin_user.id,
                created_at=datetime.now(timezone.utc) - timedelta(days=60),
            )
            db.add(dsp)
            db.flush()

            if tvs_item:
                dsp_line = DisposalItem(
                    disposal_id=dsp.id,
                    item_id=tvs_item.id,
                    disposed_qty=Decimal("1.00"),
                    realized_amount=Decimal("1850.00"),
                )
                db.add(dsp_line)

        # Commit everything to PostgreSQL
        db.commit()
        logger.info("Successfully committed all realistic inventory, dead stock, and audit records to PostgreSQL!")

    except Exception as exc:
        db.rollback()
        logger.error(f"Error during seeding: {exc}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
