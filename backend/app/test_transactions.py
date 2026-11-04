"""Comprehensive Verification Suite for All Transaction Modules:
Stock Receipts, Stock Issues, Stock Returns, and Stock Transfers.
100% Real FastAPI Backend & PostgreSQL Persistence.
"""

import json
import urllib.request
import urllib.error
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"

def test_transactions():
    print("=" * 60)
    print("DSIMS TRANSACTIONS COMPREHENSIVE VERIFICATION")
    print("=" * 60)

    # 1. Login
    login_data = json.dumps({"username": "admin", "password": "Admin@12345"}).encode()
    req = urllib.request.Request(f"{BASE_URL}/auth/login", data=login_data, headers={"Content-Type": "application/json"})
    res = urllib.request.urlopen(req)
    token = json.loads(res.read().decode())["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print("[PASS] 1. Authentication successful (JWT token acquired)")

    # 2. Test Stock Inward Receipt (Draft mode with auto-item registration)
    unique_num = int(datetime.now().timestamp() * 10) % 100000
    receipt_payload = {
        "receipt_date": "2026-11-05",
        "supplier_name": f"Somnath Supplies Corp #{unique_num}",
        "supplier_contact": "9876543210",
        "po_number": f"PO-GS-{unique_num}",
        "invoice_number": f"INV-GS-{unique_num}",
        "receiving_office": "District Panchayat Central Store, Veraval",
        "receiving_location": "Main Store Room",
        "status": "DRAFT",
        "remarks": "Inward inspection passed",
        "items": [
            {
                "item_name": f"Heavy Duty Office Desk #{unique_num}",
                "item_type": "DURABLE_ASSET",
                "category_name": "Furniture & Fixtures",
                "uom": "NOS",
                "quantity_ordered": 2,
                "quantity_received": 2,
                "quantity_accepted": 2,
                "quantity_rejected": 0,
                "unit_cost": 8500.0,
                "serial_numbers": [f"SN-DESK-{unique_num}-1", f"SN-DESK-{unique_num}-2"]
            }
        ]
    }
    req = urllib.request.Request(f"{BASE_URL}/receipts", data=json.dumps(receipt_payload).encode(), headers=headers)
    try:
        res = urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        print("HTTP Error response body:", e.read().decode())
        raise
    receipt_data = json.loads(res.read().decode())["data"]
    receipt_id = receipt_data["id"]
    print(f"[PASS] 2. Stock Receipt (DRAFT) created: {receipt_data['transaction_number']} (ID: {receipt_id})")
    assert receipt_data["voucher_number"] == receipt_data["transaction_number"]
    assert len(receipt_data["items"]) == 1
    assert receipt_data["items"][0]["item_name"] == f"Heavy Duty Office Desk #{unique_num}"
    created_item_id = receipt_data["items"][0]["item_id"]
    print(f"       -> Auto-registered new inventory Item ID: {created_item_id} (Code: {receipt_data['items'][0]['item_code']})")

    # 3. Post Receipt to Store Inventory
    req = urllib.request.Request(f"{BASE_URL}/receipts/{receipt_id}/post", data=b"{}", headers=headers)
    res = urllib.request.urlopen(req)
    posted_receipt = json.loads(res.read().decode())["data"]
    assert posted_receipt["status"] == "POSTED"
    print(f"[PASS] 3. Stock Receipt posted: {posted_receipt['voucher_number']} status is now {posted_receipt['status']}")

    # 4. Stock Receipt Posted Directly (Instant Goods Inward)
    receipt_payload_instant = {
        "receipt_date": "2026-11-05",
        "supplier_name": f"Gujarat Stationery Depot #{unique_num}",
        "po_number": f"PO-PAP-{unique_num}",
        "invoice_number": f"INV-PAP-{unique_num}",
        "status": "POSTED",
        "items": [
            {
                "item_name": f"A4 Copy Paper Reams #{unique_num}",
                "item_type": "CONSUMABLE_STOCK",
                "category_name": "Office Stationery & Paper",
                "uom": "NOS",
                "quantity_accepted": 20,
                "unit_cost": 320.0
            }
        ]
    }
    req = urllib.request.Request(f"{BASE_URL}/receipts", data=json.dumps(receipt_payload_instant).encode(), headers=headers)
    res = urllib.request.urlopen(req)
    instant_receipt = json.loads(res.read().decode())["data"]
    assert instant_receipt["status"] == "POSTED"
    consumable_item_id = instant_receipt["items"][0]["item_id"]
    print(f"[PASS] 4. Direct Posted Receipt: {instant_receipt['voucher_number']} created & posted immediately")

    # 5. List Receipts via Transactions API
    req = urllib.request.Request(f"{BASE_URL}/transactions?transaction_type=RECEIPT", headers=headers)
    res = urllib.request.urlopen(req)
    receipts_list = json.loads(res.read().decode())["data"]
    assert len(receipts_list) >= 2
    print(f"[PASS] 5. List Receipts: Found {len(receipts_list)} receipts in ledger")

    # 6. Create & Post Stock Issue Voucher
    issue_payload = {
        "issue_date": "2026-11-05",
        "department": "Engineering & Irrigation Wing",
        "receiving_employee": "Vikram Rathod",
        "receiving_designation": "Executive Engineer",
        "sanction_order_number": f"SANCT-IRR-{unique_num}",
        "purpose": "Field site office equipment deployment",
        "status": "POSTED",
        "items": [
            {
                "item_id": created_item_id,
                "quantity_issued": 1,
                "remarks": "Handed over with key"
            },
            {
                "item_id": consumable_item_id,
                "quantity_issued": 5,
                "remarks": "Stationery supplies"
            }
        ]
    }
    req = urllib.request.Request(f"{BASE_URL}/issues", data=json.dumps(issue_payload).encode(), headers=headers)
    res = urllib.request.urlopen(req)
    issue_data = json.loads(res.read().decode())["data"]
    issue_id = issue_data["id"]
    assert issue_data["status"] == "POSTED"
    print(f"[PASS] 6. Stock Issue created & posted: {issue_data['voucher_number']} (ID: {issue_id})")
    assert issue_data["department"] == "Engineering & Irrigation Wing"
    assert issue_data["receiving_employee"] == "Vikram Rathod"
    assert len(issue_data["items"]) == 2

    # 7. List Issues via Transactions API
    req = urllib.request.Request(f"{BASE_URL}/transactions?transaction_type=ISSUE", headers=headers)
    res = urllib.request.urlopen(req)
    issues_list = json.loads(res.read().decode())["data"]
    assert len(issues_list) >= 1
    print(f"[PASS] 7. List Issues: Found {len(issues_list)} issues in ledger")

    # 8. Create & Post Stock Return Voucher
    return_payload = {
        "return_date": "2026-11-05",
        "original_issue_id": issue_id,
        "returning_department": "Engineering & Irrigation Wing",
        "returning_employee": "Vikram Rathod",
        "return_reason": "Project completed, returning asset to store",
        "status": "POSTED",
        "items": [
            {
                "item_id": created_item_id,
                "quantity_returned": 1,
                "condition": "GOOD",
                "remarks": "Inspected, clean and functional"
            }
        ]
    }
    req = urllib.request.Request(f"{BASE_URL}/returns", data=json.dumps(return_payload).encode(), headers=headers)
    try:
        res = urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        print("Return HTTP Error response body:", e.read().decode())
        raise
    return_data = json.loads(res.read().decode())["data"]
    assert return_data["status"] == "POSTED"
    print(f"[PASS] 8. Stock Return created & posted: {return_data['voucher_number']} against {return_data['reference_document']}")

    # 9. List Returns via Transactions API
    req = urllib.request.Request(f"{BASE_URL}/transactions?transaction_type=RETURN", headers=headers)
    res = urllib.request.urlopen(req)
    returns_list = json.loads(res.read().decode())["data"]
    assert len(returns_list) >= 1
    print(f"[PASS] 9. List Returns: Found {len(returns_list)} returns in ledger")

    # 10. Create Stock Transfer Voucher
    transfer_payload = {
        "transfer_type": "PERMANENT",
        "destination_office": "Taluka Development Office, Talala",
        "order_reference": f"TRF-MEMO-{unique_num}",
        "reason": "Redistribution of surplus consumables to Talala office",
        "items": [
            {
                "item_id": consumable_item_id,
                "quantity": 5
            }
        ]
    }
    req = urllib.request.Request(f"{BASE_URL}/transfers", data=json.dumps(transfer_payload).encode(), headers=headers)
    res = urllib.request.urlopen(req)
    transfer_data = json.loads(res.read().decode())["data"]
    transfer_id = transfer_data["id"]
    print(f"[PASS] 10. Stock Transfer created: {transfer_data['transfer_number']} (Status: {transfer_data['status']})")

    # 11. Approve Stock Transfer
    req = urllib.request.Request(
        f"{BASE_URL}/transfers/{transfer_id}/approve",
        data=json.dumps({"remarks": "Approved by District Store Officer"}).encode(),
        headers=headers
    )
    res = urllib.request.urlopen(req)
    approved_transfer = json.loads(res.read().decode())["data"]
    assert approved_transfer["status"] == "APPROVED"
    print(f"[PASS] 11. Stock Transfer approved: Status is now {approved_transfer['status']}")

    # 12. Complete Stock Transfer
    req = urllib.request.Request(
        f"{BASE_URL}/transfers/{transfer_id}/complete",
        data=json.dumps({"remarks": "Acknowledged and received in Talala store room"}).encode(),
        headers=headers
    )
    res = urllib.request.urlopen(req)
    completed_transfer = json.loads(res.read().decode())["data"]
    assert completed_transfer["status"] == "POSTED"
    print(f"[PASS] 12. Stock Transfer completed: Status is now {completed_transfer['status']}")

    print("=" * 60)
    print("ALL 12 TRANSACTION OPERATIONS VERIFIED SUCCESSFULLY: 100% OPERATIONAL")
    print("=" * 60)

if __name__ == "__main__":
    test_transactions()
