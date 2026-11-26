# Physical Verification & QR Audit Session Guide

**System:** Dead Stock Inventory Management System (PS000214)  
**Organization:** District Development Office – Gir Somnath, Veraval  
**URLs:**
- **Quick QR / Barcode Lookup:** `/verification/lookup` ([BarcodeLookupPage.jsx](file:///d:/seva/inventory/frontend/src/pages/verification/BarcodeLookupPage.jsx))
- **Audit Sessions List:** `/verification/sessions` ([VerificationSessionListPage.jsx](file:///d:/seva/inventory/frontend/src/pages/verification/VerificationSessionListPage.jsx)) *(visiting `/verification` redirects here)*
- **Audit Session Workspace:** `/verification/sessions/:id` ([VerificationSessionDetailPage.jsx](file:///d:/seva/inventory/frontend/src/pages/verification/VerificationSessionDetailPage.jsx))

---

## 1. Roles & Permissions

| Role | Quick Lookup (`/verification/lookup`) | Start Audit Session (`verify:create`) | Scan & Update Asset (`verify:scan`) | Review & Finalize Audit (`verify:reconcile`) | Export Report (`verify:view`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **System Admin** | Yes | No | No | No | Yes |
| **Store Officer** | Yes | Yes | Yes | Yes | Yes |
| **Store Staff** | Yes | No | Yes | No | Yes |

*(Defined in [permissions.py](file:///d:/seva/inventory/backend/app/core/permissions.py) and enforced on every backend route in [verification.py](file:///d:/seva/inventory/backend/app/routes/verification.py) and [barcodes.py](file:///d:/seva/inventory/backend/app/routes/barcodes.py).)*

---

## 2. How Quick Asset Search Works (`/verification/lookup`)

Any Officer or Staff member can inspect an asset's live record in two ways:
1. **Camera QR Scan:** Click **Camera QR Scan** to open your laptop webcam or mobile rear camera (or click **Scan QR Image** to upload a photo/screenshot of a QR label).
2. **Manual Number Entry / USB Scanner:** Type or scan with a handheld barcode gun using any of:
   - `barcode_number` (e.g., `BC-AST-000001`)
   - `item_code` (e.g., `AST-GS-VRV-2024-00001`)
   - `serial_number` (e.g., `DL-7090-VRV-0101`)

The backend (`POST /api/v1/barcodes/lookup`) matches case-insensitively inside the user's office, blocks `DISPOSED` assets from active scanning, and returns the asset's current room, custodian, department, condition, classification, operational status, brand/model/serial, quantity, and purchase cost—plus a **Print QR Label** button and link to the full Asset Profile (`/inventory/:id`).

---

## 3. How Monthly / Quarterly Audit Sessions Work (End-to-End Lifecycle)

```text
1. Create Session (Officer) ──► 2. Baseline Snapshot Frozen (PostgreSQL)
                                        │
                                        ▼
4. Officer Review & Finalize ◄── 3. Scan QR / Manual Entry & Update Condition/Room
   (Resolve Flags & Seal)           (Option B: Live Asset Update + Audit Trail)
                                        │
                                        ▼
                         5. Download Official CSV / Print Report
```

### Phase 1: Initialize an Audit Session (Store Officer)
1. Open **Verification → Audit Sessions** (`/verification/sessions`) and click **New Audit Session**.
2. Choose:
   - **Audit Cycle:** `Monthly Routine Audit`, `Quarterly Physical Verification`, `Annual Statutory Stocktaking`, or `Surprise / Spot Check`.
   - **Audit Scope:**
     - `FULL_OFFICE` — includes every non-disposed asset & consumable in your office.
     - `LOCATION` — includes only items assigned to a specific room/store.
     - `CATEGORY` — includes only items in a specific category (e.g., `IT_EQUIPMENT`).
   - **Notes / Mandate:** optional order reference or audit purpose.
3. Click **Start Session & Freeze Snapshot** (`POST /api/v1/verifications/sessions`):
   - The backend creates a `VerificationSession` (`PVS-YYYY-XXXXX`) in status `IN_PROGRESS`.
   - It takes a **baseline snapshot** of every matching non-disposed item and writes one row per item into `verification_items` storing `expected_location_id`, `expected_condition`, and `expected_qty`.
   - You are automatically redirected to `/verification/sessions/:id`.

---

### Phase 2: Scan Assets & Update Condition / Details (Staff or Officer)
Inside **Tab 1: QR / Manual Audit Scanner**, the auditor has **two input methods** and **two workflow modes**:

- **Input Method 1 — Manual Number / USB Scanner:** Type or scan `barcode_number`, `item_code`, or `serial_number`.
- **Input Method 2 — Camera QR Scan:** Opens the desktop webcam or mobile camera immediately via `QrCameraScanner` (`html5-qrcode`). Click **Stop Camera** anytime to release the camera stream and turn off the webcam light.

#### Guided 2-Step Mode (Default)
1. **Step 1 — Identify Asset:** Scan the QR code or enter the asset number and click **Find Asset**.
   - The UI calls `POST /api/v1/barcodes/lookup` and checks the session snapshot.
   - An **Asset Preview Card** shows the recorded room, custodian, category, condition, operational status, and whether the asset is *Expected in Audit Scope*, *Already Scanned*, or *Outside Session Scope*.
2. **Step 2 — Verify & Update Physical Details:**
   - **Observed Storage Room:** Keep the expected room or select the actual room where the asset was physically found.
   - **Observed Physical Condition:** Select `NEW`, `GOOD`, `FAIR`, `POOR`, `DAMAGED`, or `SCRAP`.
   - **Counted Quantity:** Confirm `1` for durable assets or the physical count for consumables.
   - **Audit Observation / Remarks:** Add field notes (e.g., *"Screen cracked"*, *"Moved to Accounts Room"*).
3. Click **Submit Verification & Update Record** (`POST /api/v1/verifications/sessions/:id/scan`).

*(Optional: Check **Rapid Auto-Submit Mode** if you are scanning many identical items continuously with a handheld barcode gun and want each scan to submit immediately without pausing on the preview card.)*

---

### Phase 3: What the Backend Does on Every Scan (Option B)
When `POST /api/v1/verifications/sessions/:id/scan` executes in [services.py](file:///d:/seva/inventory/backend/app/features/verification/services.py):

1. **Duplicate Detection:** Checks if the resolved `item_id` or scanned barcode was already scanned in this session. If yes, logs `is_duplicate_scan = TRUE` (`DUPLICATE_SCAN_REPEATED`) and prevents double-counting or overwriting.
2. **Snapshot Comparison:**
   - If the code doesn't exist in your office: logs `UNKNOWN_BARCODE` (`UNEXPECTED_ITEM`).
   - If the item exists in your office but wasn't in the session's scope (e.g., belongs to another room in a `LOCATION` audit): adds an `UNEXPECTED_ITEM` row to `verification_items`.
   - If the item is in the snapshot: compares observed room and observed condition against the frozen baseline:
     - Room changed → flags `LOCATION_MISMATCH`.
     - Condition changed → flags `CONDITION_MISMATCH`.
     - Exact match → marks `MATCHED_VERIFIED` (`discrepancy_type = NONE`, `resolution_status = RESOLVED`).
3. **Option B Live Asset Update:**
   - If `observed_condition` differs from `items.condition`, **`items.condition` is updated immediately**.
   - If `scanned_location_id` differs from `items.location_id`, **`items.location_id` is updated immediately** (and `stock_balances.location_id` is synced/merged for durable assets).
   - Every live change writes a `VERIFY_UPDATE` entry to `audit_logs` with `old_values`, `new_values`, actor, and `session_number`.
4. **Immutable Scan Log:** Every scan (matched, mismatch, duplicate, or unknown) is appended to `verification_scan_events` and shown in the **Recorded Audit Scan Log** table.

---

### Phase 4: Asset Checklist & Officer Review (Tab 2)
Open **Tab 2: Asset Checklist & Discrepancies** to see every item in the session snapshot:
- Search by item code, name, barcode, or room, and filter by flag (`All`, `Discrepancies Only`, `Not Found`, `Location Mismatch`, `Condition Mismatch`, `Unexpected Item`, `Verified Sound`).
- **Verify Now shortcut:** For any unscanned item (`counted_qty = 0`), Staff/Officers can click **Verify Now** to jump directly to Tab 1 with that item loaded for physical confirmation.
- **Officer Review (`Resolve` button — `verify:reconcile`):**
  - Store Officers review any flagged item (`LOCATION_MISMATCH`, `CONDITION_MISMATCH`, `UNEXPECTED_ITEM`) and choose:
    - `RESOLVED`: Accepts and confirms the audit observation with official remarks.
    - `IGNORED`: Closes the flag with remarks without further changes.
  - Submitting moves the session status from `IN_PROGRESS` to `UNDER_REVIEW` and logs `RECONCILE` in `audit_logs`.

---

### Phase 5: Finalize & Export Report (Tab 3)
1. Click **Finalize Audit** (header button or **Tab 3: Finalize & Reconciliation Report**).
2. Enter concluding audit summary remarks and click **Sign & Finalize Verification Audit** (`POST /api/v1/verifications/sessions/:id/complete`).
3. The backend:
   - Automatically marks any remaining unscanned snapshot items (`counted_qty == 0`) as **`NOT_FOUND`**.
   - Sets session status to **`COMPLETED`**, records `completed_at`, and locks further scans.
   - Logs `COMPLETE` in `audit_logs`.
4. Click **Export CSV** / **Download CSV Report** (`GET /api/v1/verifications/sessions/:id/report`) or **Print Summary** to archive the official verification & reconciliation sheet.
5. **View Audit History on Each Asset:** Open any asset in **Inventory → Asset Register → Asset Detail → Movement & Audit Timeline** (`GET /api/v1/items/{id}/history`) to view all `VERIFICATION_SCAN`, `VERIFY_UPDATE`, and `VERIFICATION_AUDIT` (including `NOT_FOUND` / `RESOLVED` / `IGNORED`) events chronologically.

---

## 4. Quick Demo / Test Walkthrough
1. Open an item under **Inventory → Asset Register** (`/inventory`) and click **Print QR Label** (or download PNG) to get a real scannable QR tag.
2. Go to **Verification → Barcode Lookup** (`/verification/lookup`) → scan that QR code with your camera (or paste the `AST-...` / `BC-AST-...` code) → confirm all asset details appear.
3. Go to **Verification → Audit Sessions** (`/verification/sessions`) → log in as **Store Officer** → click **New Audit Session** → pick **Monthly Routine Audit** and **Location** (e.g., Main Store) → **Start Session**.
4. In Tab 1, scan or enter an item from that room, change its condition (e.g., `GOOD` → `FAIR`) or room, and submit.
5. Check **Inventory → Asset Register** or Lookup again to confirm the live item condition/room updated immediately, while Tab 2 still flags the change for Officer review.
6. In Tab 2, click **Resolve** as Store Officer → go to Tab 3 → enter concluding remarks → **Sign & Finalize** → click **Download CSV Report**.
