import io
import json
import sys
import urllib.request
import urllib.error
import openpyxl

BASE_URL = "http://127.0.0.1:8000/api/v1"


def request(method, path, data=None, token=None, headers=None):
    url = f"{BASE_URL}{path}"
    hdrs = headers or {}
    if token:
        hdrs["Authorization"] = f"Bearer {token}"
    body = None
    if data is not None and not isinstance(data, (bytes, bytearray)):
        body = json.dumps(data).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    elif isinstance(data, (bytes, bytearray)):
        body = data
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


def encode_multipart(filename, file_bytes, content_type, fields=None):
    boundary = "----DSIMSTestBoundary7MA4YWxkTrZu0gW"
    parts = []
    for k, v in (fields or {}).items():
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode("utf-8")
        )
    parts.append(
        (
            f"--{boundary}\r\n"
            f"Content-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode("utf-8")
        + file_bytes
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(parts)
    return body, f"multipart/form-data; boundary={boundary}"


def main():
    # 1. Login
    code, res = request("POST", "/auth/login", {"username": "admin", "password": "Admin@12345"})
    assert code == 200, f"Login failed: {code} {res}"
    token = res["data"]["access_token"]
    print("[PASS] 1. Admin login")

    # 2. Fetch categories & locations
    code, cats_res = request("GET", "/categories", token=token)
    assert code == 200 and len(cats_res["data"]) > 0, f"Categories failed: {code} {cats_res}"
    cat = cats_res["data"][0]
    cat2 = cats_res["data"][1] if len(cats_res["data"]) > 1 else cat
    print(f"[PASS] 2. Categories loaded: {len(cats_res['data'])} found (sample: {cat['code']})")

    code, locs_res = request("GET", "/locations", token=token)
    assert code == 200 and len(locs_res["data"]) > 0, f"Locations failed: {code} {locs_res}"
    loc = locs_res["data"][0]
    print(f"[PASS] 3. Locations loaded: {len(locs_res['data'])} found (sample: {loc['room_number']})")

    # 3. Check items list returns category, location, classification, uom, quantity
    code, items_res = request("GET", "/items?limit=5", token=token)
    assert code == 200, f"List items failed: {code} {items_res}"
    if items_res["data"]:
        first = items_res["data"][0]
        assert "category" in first and first["category"] is not None, f"Missing category in ItemOut: {first}"
        assert "location" in first and first["location"] is not None, f"Missing location in ItemOut: {first}"
        assert "classification" in first and first["classification"], f"Missing classification in ItemOut: {first}"
        assert "uom" in first and first["uom"], f"Missing uom in ItemOut: {first}"
        assert "quantity" in first, f"Missing quantity in ItemOut: {first}"
        print(
            f"[PASS] 4. ItemOut includes category={first['category']['name']}, "
            f"location={first['location']['room_number']}, "
            f"classification={first['classification']}, uom={first['uom']}, qty={first['quantity']}"
        )

    # 4. Create a test item
    create_payload = {
        "item_type": "DURABLE_ASSET",
        "item_name": "Test Asset For Patch & Delete",
        "category_id": cat["id"],
        "location_id": loc["id"],
        "uom": "NOS",
        "brand": "HP",
        "model_number": "ProBook",
        "serial_number": "TEST-SN-99999",
        "quantity": 1,
        "unit_purchase_cost": 45000,
        "purchase_date": "2026-10-01",
        "condition": "GOOD",
    }
    code, create_res = request("POST", "/items", create_payload, token=token)
    assert code in (200, 201), f"Create item failed: {code} {create_res}"
    item_id = create_res["data"]["id"]
    print(f"[PASS] 5. Created test item {item_id}")

    # 5. Update the test item (PATCH) with full form payload including convenience fields
    update_payload = {
        "item_type": "DURABLE_ASSET",
        "item_name": "Updated Test Asset Name",
        "category_id": cat2["id"],
        "location_id": loc["id"],
        "uom": "NOS",
        "brand": "Dell",
        "model_number": "Latitude 5440",
        "serial_number": "TEST-SN-99999-UPD",
        "quantity": 1,
        "initial_quantity": 1,
        "unit_purchase_cost": 52000,
        "purchase_date": "2026-10-02",
        "condition": "FAIR",
        "current_custodian": "Accounts Section",
        "supplier_name": None,
        "office_id": create_res["data"]["office_id"],
    }
    code, update_res = request("PATCH", f"/items/{item_id}", update_payload, token=token)
    assert code == 200, f"Update item failed: {code} {update_res}"
    upd = update_res["data"]
    assert upd["item_name"] == "Updated Test Asset Name"
    assert upd["brand"] == "Dell"
    assert upd["condition"] == "FAIR"
    assert upd["total_cost"] == 52000.0
    assert upd["category"]["id"] == cat2["id"]
    print(f"[PASS] 6. Updated test item via PATCH (name={upd['item_name']}, brand={upd['brand']}, total_cost={upd['total_cost']})")

    # 6. Delete (dispose) the test item
    code, del_res = request("DELETE", f"/items/{item_id}", token=token)
    assert code == 200, f"Delete item failed: {code} {del_res}"
    assert del_res["data"]["operational_status"] == "DISPOSED"
    print(f"[PASS] 7. Soft-deleted test item {item_id}")

    # 7. Test Excel (.xlsx) bulk-import dry_run=true and dry_run=false
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append([
        "item_name", "item_type", "category_code", "room_number",
        "quantity", "uom", "unit_purchase_cost", "purchase_date",
        "condition", "brand", "model_number", "serial_number",
    ])
    ws.append([
        "Excel Imported Monitor", "DURABLE_ASSET", cat["code"], loc["room_number"],
        1, "NOS", 14500, "2026-10-15", "GOOD", "LG", "24MP60G", "XLSX-TEST-001",
    ])
    buf = io.BytesIO()
    wb.save(buf)
    xlsx_bytes = buf.getvalue()

    body, ctype = encode_multipart(
        "test_import.xlsx",
        xlsx_bytes,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fields={"dry_run": "true"},
    )
    code, dry_res = request("POST", "/items/bulk-import", body, token=token, headers={"Content-Type": ctype})
    assert code == 200, f"Excel dry-run failed: {code} {dry_res}"
    assert dry_res["data"]["valid_rows_count"] == 1, f"Expected 1 valid row: {dry_res}"
    print("[PASS] 8. Excel (.xlsx) dry_run=true validation passed")

    body, ctype = encode_multipart(
        "test_import.xlsx",
        xlsx_bytes,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fields={"dry_run": "false"},
    )
    code, imp_res = request("POST", "/items/bulk-import", body, token=token, headers={"Content-Type": ctype})
    assert code == 200, f"Excel import failed: {code} {imp_res}"
    assert imp_res["data"]["rows_imported"] == 1, f"Expected 1 imported row: {imp_res}"
    print("[PASS] 9. Excel (.xlsx) dry_run=false import succeeded")

    # Clean up the Excel-imported test item
    code, search_res = request("GET", "/items?search=XLSX-TEST-001", token=token)
    assert code == 200 and len(search_res["data"]) >= 1
    for it in search_res["data"]:
        if it["operational_status"] != "DISPOSED":
            request("DELETE", f"/items/{it['id']}", token=token)
    print("[PASS] 10. Cleaned up Excel-imported test item")

    print("\nALL 10 ASSET REGISTRATION VERIFICATION CHECKS PASSED!")


if __name__ == "__main__":
    main()
