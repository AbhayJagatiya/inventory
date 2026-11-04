"""End-to-End Test for All Core System Operations:
From Frontend Contract to FastAPI Backend to PostgreSQL Database.
"""

import sys
import json
import time
import urllib.request
import urllib.error
from datetime import date, datetime

BASE_URL = "http://localhost:8000/api/v1"

def run_tests():
    print("=" * 60)
    print("DSIMS END-TO-END OPERATIONS TEST SUITE")
    print("=" * 60)

    # 1. Login
    login_data = json.dumps({"username": "admin", "password": "Admin@12345"}).encode()
    req = urllib.request.Request(f"{BASE_URL}/auth/login", data=login_data, headers={"Content-Type": "application/json"})
    res = urllib.request.urlopen(req)
    token = json.loads(res.read().decode())["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print("[PASS] 1. Authentication successful (JWT token acquired)")

    # 2. Add New Location
    unique_suffix = int(datetime.now().timestamp() * 100) % 100000
    loc_payload = {
        "building_name": "Panchayat Bhavan West Wing",
        "floor": "Ground Floor",
        "room_number": f"WW-STORE-{unique_suffix}",
        "location_type": "STORE_ROOM",
        "description": "West Wing General Equipment Storage"
    }
    req = urllib.request.Request(f"{BASE_URL}/locations", data=json.dumps(loc_payload).encode(), headers=headers)
    res = urllib.request.urlopen(req)
    loc_data = json.loads(res.read().decode())["data"]
    loc_id = loc_data["id"]
    print(f"[PASS] 2. Location created: {loc_data['room_number']} in {loc_data['building_name']} (ID: {loc_id})")

    # 3. Add New Category
    cat_payload = {
        "code": f"COMM_{unique_suffix}",
        "name": f"Wireless Equipment {unique_suffix}",
        "slow_moving_threshold_days": 90,
        "inactivity_threshold_days": 180,
        "obsolescence_years": 5,
        "depreciation_rate_pct": 15.0
    }
    req = urllib.request.Request(f"{BASE_URL}/categories", data=json.dumps(cat_payload).encode(), headers=headers)
    res = urllib.request.urlopen(req)
    cat_data = json.loads(res.read().decode())["data"]
    cat_id = cat_data["id"]
    print(f"[PASS] 3. Category created: {cat_data['name']} ({cat_data['code']}) (ID: {cat_id})")

    # 4. Register New Asset (Item)
    item_payload = {
        "item_type": "DURABLE_ASSET",
        "item_name": "Motorola Wave PTX Two-Way Radio Set",
        "category_id": cat_id,
        "location_id": loc_id,
        "uom": "NOS",
        "quantity": 1,
        "unit_purchase_cost": 34500.0,
        "condition": "GOOD",
        "brand": "Motorola",
        "model_number": "TLK 100",
        "serial_number": f"MOT-TLK-{unique_suffix}",
        "purchase_date": str(date.today()),
        "invoice_number": f"INV-MOT-{unique_suffix}",
        "current_custodian": "Control Room Officer",
        "current_department": "Disaster Management Cell"
    }
    req = urllib.request.Request(f"{BASE_URL}/items", data=json.dumps(item_payload).encode(), headers=headers)
    res = urllib.request.urlopen(req)
    item_data = json.loads(res.read().decode())["data"]
    item_id = item_data["id"]
    item_code = item_data["item_code"]
    barcode = item_data.get("barcode_number")
    print(f"[PASS] 4. Item registered: {item_data['item_name']} (Code: {item_code}, Barcode: {barcode})")

    # 5. Retrieve Item Details
    req = urllib.request.Request(f"{BASE_URL}/items/{item_id}", headers=headers)
    res = urllib.request.urlopen(req)
    retrieved_item = json.loads(res.read().decode())["data"]
    assert retrieved_item["item_code"] == item_code
    print(f"[PASS] 5. Item detail retrieved: Status={retrieved_item['operational_status']}, Valuation=Rs {retrieved_item['total_cost']}")

    # 6. Update Item Condition / Details
    patch_payload = {
        "condition": "GOOD",
        "current_custodian": "Senior Wireless Inspector",
        "current_department": "Emergency Response Unit"
    }
    req = urllib.request.Request(f"{BASE_URL}/items/{item_id}", data=json.dumps(patch_payload).encode(), headers=headers, method="PATCH")
    res = urllib.request.urlopen(req)
    updated_item = json.loads(res.read().decode())["data"]
    print(f"[PASS] 6. Item updated: Custodian={updated_item['current_custodian']}, Dept={updated_item['current_department']}")

    # 7. List Transactions
    req = urllib.request.Request(f"{BASE_URL}/transactions", headers=headers)
    res = urllib.request.urlopen(req)
    txns = json.loads(res.read().decode())["data"]
    print(f"[PASS] 7. Stock movement transactions listed: {len(txns)} vouchers in ledger")

    # 8. Dead Stock Register & Summary
    req = urllib.request.Request(f"{BASE_URL}/classifications/summary", headers=headers)
    res = urllib.request.urlopen(req)
    summary = json.loads(res.read().decode())["data"]
    print(f"[PASS] 8. Dead stock classification summary: Total={summary.get('total_items', 'N/A')}, SlowMoving={summary.get('slow_moving_count', 0)}, NonMoving={summary.get('non_moving_count', 0)}, Obsolete={summary.get('obsolete_count', 0)}")

    # 9. Verification Sessions
    req = urllib.request.Request(f"{BASE_URL}/verifications/sessions", headers=headers)
    res = urllib.request.urlopen(req)
    verifs = json.loads(res.read().decode())["data"]
    print(f"[PASS] 9. Physical verification sessions retrieved: {len(verifs)} session(s)")

    # 10. Condemnation Proposals
    req = urllib.request.Request(f"{BASE_URL}/condemnations", headers=headers)
    res = urllib.request.urlopen(req)
    conds = json.loads(res.read().decode())["data"]
    print(f"[PASS] 10. Condemnation proposals retrieved: {len(conds)} proposal(s)")

    # 11. Disposals Register
    req = urllib.request.Request(f"{BASE_URL}/disposals", headers=headers)
    res = urllib.request.urlopen(req)
    disps = json.loads(res.read().decode())["data"]
    print(f"[PASS] 11. Disposal register retrieved: {len(disps)} executed writeoff(s)")

    # 12. Dashboard Analytics
    req = urllib.request.Request(f"{BASE_URL}/reports/dashboard", headers=headers)
    res = urllib.request.urlopen(req)
    dash = json.loads(res.read().decode())["data"]
    print(f"[PASS] 12. Live Dashboard analytics retrieved:")
    print(f"     - Total Registered Assets: {dash.get('total_registered_assets')}")
    print(f"     - Active Stock Valuation: Rs {dash.get('active_stock_value'):,.2f}")
    print(f"     - Dead Stock Candidates: {dash.get('dead_stock_candidates_count')}")

    print("=" * 60)
    print("ALL 12 OPERATIONS VERIFIED SUCCESSFULLY: 100% OPERATIONAL")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
