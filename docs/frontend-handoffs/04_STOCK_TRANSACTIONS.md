# Frontend Handoff: Module 04 – Stock Movement Transactions & Custody Ledger
## PS000214 – Dead Stock Inventory Management System

**Target Recipient:** Backend Engineering Teammate (FastAPI / PostgreSQL)  
**Prepared By:** Frontend Architect  
**Organization:** District Development Office – Gir Somnath, Veraval, Gujarat  
**Version:** 1.0.0  
**Phase:** Phase 4 – Stock Transactions  

---

### 1. Module Overview
Module 04 governs all physical movements of inventory into, within, and out of the store department. It strictly enforces atomic updates, double-entry audit records, and custody preservation across four interrelated operational lifecycles:

1. **Goods Inward Receipts (GRN):** Procurement deliveries, delivery challan verification, accepted vs. rejected quality inspection, duplicate confirmation prevention, and automatic inventory increment.
2. **Stock Issues:** Departmental outward issues to employees/branches, pre-issue available stock validation, custody assignment for durable assets, and balance reduction for consumables.
3. **Linked Stock Returns:** Inward returns linked directly to previous issue vouchers, enforcement of maximum returnable quantities, condition assessment (`GOOD`, `FAIR`, `DAMAGED`, `SCRAP`), and automatic routing of damaged goods to maintenance.
4. **Inter-Office Transfers:** Relocations between Gir Somnath District Central Store and Taluka Panchayat stores (Talala, Kodinar, Una, etc.) through a 4-stage lifecycle (`SUBMITTED` ➔ `APPROVED` ➔ `IN_TRANSIT` ➔ `COMPLETED`). Asset locations only update upon destination arrival acknowledgment.
5. **Unified Movement Ledger:** A single chronological audit trail spanning all transaction types with export capabilities.

---

### 2. Frontend Pages and Components Implemented

| Route | Page Component | Purpose | Key Permissions Required |
|:---|:---|:---|:---|
| `/transactions` | `TransactionHistoryPage` | Master chronological ledger of all stock movements | `stock:receipt_view` |
| `/transactions/receipts` | `ReceiptListPage` | Goods Inward register with filter, search, and pagination | `stock:receipt_view` |
| `/transactions/receipts/new` | `ReceiptCreatePage` | Multi-line receipt creator with accepted/rejected split | `stock:receipt_create` |
| `/transactions/receipts/:id` | `ReceiptDetailPage` | GRN voucher view, duplicate-protected posting, and printable note | `stock:receipt_view` |
| `/transactions/issues` | `IssueListPage` | Departmental issue register | `stock:issue_view` |
| `/transactions/issues/new` | `IssueCreatePage` | Outward issue creator with live stock balance checks | `stock:issue_create` |
| `/transactions/issues/:id` | `IssueDetailPage` | Gate pass voucher, custodian acknowledgment slip | `stock:issue_view` |
| `/transactions/returns` | `ReturnListPage` | Return register with condition grading and maintenance flags | `stock:return_view` |
| `/transactions/returns/new` | `ReturnCreatePage` | Linked return selector, inspection grading, unreturned balance cap | `stock:return_create` |
| `/transactions/returns/:id` | `ReturnDetailPage` | Inward credit slip, backlink to issue voucher | `stock:return_view` |
| `/transactions/transfers` | `TransferListPage` | Inter-office transfer tracking register | `stock:transfer_view` |
| `/transactions/transfers/new` | `TransferCreatePage` | Transfer request builder (Permanent vs Temporary loan) | `stock:transfer_req` |
| `/transactions/transfers/:id` | `TransferDetailPage` | 4-stage lifecycle stepper, approval modal, waybill dispatch, receipt | `stock:transfer_view` |

---

### 3. API Contract & Expected REST Endpoints

All endpoints are relative to `VITE_API_BASE_URL` (`http://localhost:8000/api/v1`).

#### A. Goods Inward Receipts
- **`GET /transactions/receipts`**
  - **Query Parameters:** `page`, `limit`, `search`, `status` (`ALL`, `DRAFT`, `POSTED`).
  - **Response:** `{ "data": [ ReceiptObject ], "total": 12, "page": 1 }`
- **`POST /transactions/receipts`**
  - **Request Body:**
    ```json
    {
      "receipt_date": "2026-10-24",
      "supplier_name": "Gujarat Infotech Solutions Pvt Ltd",
      "supplier_contact": "+91 98250 11223",
      "po_number": "GEM-2026-PO-8812",
      "invoice_number": "INV-GIS-2026-441",
      "invoice_date": "2026-10-22",
      "receiving_office": "District Panchayat Central Store, Veraval",
      "receiving_location": "Room 102",
      "receiving_officer": "R. K. Parmar",
      "status": "DRAFT",
      "remarks": "Delivery verified against GeM invoice.",
      "attachment_name": "Challan_8812.pdf",
      "items": [
        {
          "item_name": "HP LaserJet Pro MFP 4104dw Printer",
          "item_type": "DURABLE_ASSET",
          "category_name": "Computers & Peripherals",
          "uom": "NOS",
          "quantity_ordered": 2,
          "quantity_received": 2,
          "quantity_accepted": 2,
          "quantity_rejected": 0,
          "rejection_reason": "",
          "unit_cost": 38500,
          "serial_numbers": ["VNB3K94021", "VNB3K94022"]
        }
      ],
      "total_accepted_value": 77000
    }
    ```
- **`POST /transactions/receipts/{id}/post`**
  - **Behavior:**
    - Checks that receipt status is `DRAFT`. If already `POSTED`, returns `409 Conflict`.
    - Atomically increments consumable inventory balances or creates/activates durable asset records.
    - Sets receipt status to `POSTED`, records `posted_at` and `posted_by`.

#### B. Stock Issues
- **`GET /transactions/issues`**
  - **Query Parameters:** `page`, `limit`, `search`, `department`.
- **`POST /transactions/issues`**
  - **Request Body:**
    ```json
    {
      "issue_date": "2026-10-28",
      "department": "Accounts & Audit Branch",
      "receiving_employee": "Ramesh Dave",
      "receiving_designation": "Head Accountant",
      "sanction_order_number": "DDO/GS/ACC/2026/102",
      "purpose": "Quarterly audit operations",
      "remarks": "Handed over in working order",
      "items": [
        {
          "item_id": "itm-001",
          "item_code": "AST-GS-VRV-2024-00012",
          "item_name": "HP LaserJet Pro MFP 4104dw Printer",
          "item_type": "DURABLE_ASSET",
          "serial_number": "VNB3K94021",
          "uom": "NOS",
          "quantity_issued": 1,
          "remarks": ""
        }
      ]
    }
    ```
  - **Critical Backend Validation:**
    - Must lock row (`SELECT ... FOR UPDATE`) and verify `quantity_available >= quantity_issued`. If balance insufficient, reject with `400 Bad Request`.
    - For durable assets: update `operational_status = 'IN_USE'`, `current_custodian = receiving_employee`, `current_department = department`.

#### C. Stock Returns
- **`GET /transactions/returns`**
  - **Query Parameters:** `page`, `limit`, `search`.
- **`POST /transactions/returns`**
  - **Request Body:**
    ```json
    {
      "return_date": "2026-11-03",
      "original_issue_id": "iss-001",
      "original_issue_voucher": "ISS-GS-VRV-2026-00014",
      "returning_department": "Accounts & Audit Branch",
      "returning_employee": "Ramesh Dave",
      "receiving_officer": "R. K. Parmar",
      "return_reason": "Surplus unopened reams returned",
      "items": [
        {
          "item_id": "itm-003",
          "item_code": "ITM-GS-VRV-2024-00088",
          "item_name": "JK Copier A4 Paper Reams",
          "item_type": "CONSUMABLE_STOCK",
          "uom": "REAM",
          "quantity_returned": 5,
          "condition": "GOOD",
          "inspection_notes": "Carton intact. Re-admitted to store balance.",
          "flagged_for_maintenance": false
        }
      ]
    }
    ```
  - **Critical Backend Validation:**
    - Must verify `quantity_returned <= (original_issue.quantity_issued - original_issue.quantity_returned)`.
    - If `condition` is `DAMAGED` or `SCRAP`, set durable asset `operational_status = 'UNDER_MAINTENANCE'`.
    - If `condition` is `GOOD` or `FAIR`, restore `operational_status = 'AVAILABLE_IN_STORE'` and clear custodian.

#### D. Inter-Office Transfers
- **`GET /transactions/transfers`**
- **`POST /transactions/transfers`** (Creates with `status = 'SUBMITTED'`)
- **`POST /transactions/transfers/{id}/approve`**
  - Payload: `{ "action": "APPROVE" | "REJECT", "reason": "..." }`
  - Sets `status = 'APPROVED'` or `'REJECTED'`.
- **`POST /transactions/transfers/{id}/dispatch`**
  - Payload: `{ "carrier_name": "...", "waybill_number": "...", "vehicle_number": "...", "expected_delivery_date": "..." }`
  - Sets `status = 'IN_TRANSIT'`.
- **`POST /transactions/transfers/{id}/complete`**
  - Payload: `{ "received_by": "...", "remarks": "...", "discrepancy_reported": false }`
  - Sets `status = 'COMPLETED'`.
  - **Crucial Rule:** Asset location and department are **ONLY** modified at this stage to match `destination_office`.

#### E. Unified Ledger
- **`GET /transactions`**
  - Returns unified chronological union of receipts, issues, returns, and transfers.
  - Supports filters by `type` (`RECEIPT`, `ISSUE`, `RETURN`, `TRANSFER`), `search`, and `status`.

---

### 4. Data Integrity & Business Rules Enforced

1. **Non-Negative Balances:** An issue voucher cannot be created if available balance < requested quantity.
2. **Duplicate Posting Shield:** A receipt or issue voucher in `POSTED` status cannot be re-posted.
3. **Return Cap:** Users cannot return more items than the unreturned quantity remaining on the original issue voucher.
4. **Maintenance Quarantine:** Returned items graded as `DAMAGED` or `SCRAP` are automatically transitioned to `UNDER_MAINTENANCE` and removed from departmental issue eligibility.
5. **Transfer Isolation:** Physical asset records remain registered at the originating store until destination arrival acknowledgement (`COMPLETED`).
6. **Immutable Audit Footprint:** Every stock movement requires and preserves the authenticated user's identity, timestamp, voucher number, and sanction memo reference.

