# PS000214: Dead Stock Inventory Management System
## Transactions & Stock Ledger Lifecycle Guide
**Target Organization:** District Development Office – Gir Somnath, Veraval, Gujarat  
**System Scope:** Stock Receipts, Stock Issues, Stock Returns, Inter-Office Transfers, Reversals & Balance Accounting  
**Document Location:** `d:\seva\inventory\docs\TRANSACTIONS_LIFECYCLE_GUIDE.md`

---

## 1. Overview: How the Transactions Section Works

All inventory movements in DSIMS are recorded in an **immutable PostgreSQL double-entry ledger** (`stock_transactions` + `stock_transaction_lines`) that automatically updates `stock_balances` and item operational states.

| Module | Voucher Prefix | What It Does | Effect on Stock Balance (`available_qty`) & Asset Status |
|:---|:---|:---|:---|
| **Stock Receipts (GRN)** | `REC-YYYY-XXXXX` | Records new purchases or inward stock from suppliers | **Increases** `available_qty`; registers new items if not yet in catalog |
| **Stock Issues** | `ISS-YYYY-XXXXX` | Allocates items from Central Store to a department / employee | **Decreases** `available_qty`; Durable Assets move `AVAILABLE_IN_STORE` → `IN_USE` |
| **Stock Returns** | `RET-YYYY-XXXXX` | Returns previously issued items back to Store | **Increases** `available_qty`; Durable Assets move `IN_USE` → `AVAILABLE_IN_STORE` |
| **Stock Transfers** | `TRF-YYYY-XXXXX` | Relocates items from one office/store to another | **Subtracts** from Source Office `available_qty` and **Adds** to Destination Office `available_qty` on completion |
| **Reversal Voucher** | `REV-YYYY-XXXXX` | Negates an erroneous `POSTED` transaction | Automatically reverses the stock balance delta while preserving the audit trail |

---

## 2. Detailed Workflow & "What Means What"

### 2.1 Stock Receipts (`POST /api/v1/receipts`)
Used when goods arrive from a supplier (via Purchase Order / Invoice).
- **Statuses:**
  - **`DRAFT`**: Saved for review; **does NOT** increase `stock_balances` yet. Can be posted later via `POST /api/v1/receipts/{id}/post`.
  - **`POSTED`**: Finalized & locked. Increases `stock_balances.available_qty` and sets `last_movement_date`.
- **Key Fields:**
  - `supplier_name` / `supplier_contact`: Vendor supplying the goods.
  - `po_number` / `invoice_number` / `invoice_date`: Procurement and billing reference.
  - `quantity_ordered` / `quantity_received` / `quantity_accepted` / `quantity_rejected`: Quality-check counts; only `quantity_accepted` is added to store stock.
  - **Auto-Registration:** If a receipt line specifies a new `item_name` without an existing `item_id`, the backend automatically creates the `Item` record and initializes its `StockBalance`.

---

### 2.2 Stock Issues (`POST /api/v1/issues`)
Used when store stock or equipment is issued to an office section or employee.
- **Eligibility Rule (Which items appear in the dropdown):**
  - `DURABLE_ASSET`: Only items with `operational_status = AVAILABLE_IN_STORE`.
  - `CONSUMABLE_STOCK`: Only items with `available_qty > 0` (and not `DISPOSED`).
- **Key Fields:**
  - `department` / `receiving_employee` / `receiving_designation`: Who is taking custody.
  - `sanction_order_number` / `purpose`: Administrative approval reference.
- **Database Effect on `POSTED`:**
  - Verifies `available_qty >= quantity_issued` (otherwise raises `InsufficientStockError`).
  - Deducts `available_qty`.
  - For `DURABLE_ASSET`: updates `operational_status = IN_USE`, sets `current_custodian` and `current_department`, and updates `last_movement_date`.

---

### 2.3 Stock Returns (`POST /api/v1/returns`)
Used when an employee or department returns issued items back to the store.
- **How Returnable Quantities Work:**
  - Only `POSTED` issue vouchers that still have `remaining_unreturned > 0` appear in the **Original Issue Voucher** selector.
  - The backend dynamically computes `cumulative_returned_qty` across all `POSTED` returns for that issue (without mutating immutable `POSTED` issue lines).
- **Key Fields:**
  - `condition_observed` (`GOOD`, `FAIR`, `DAMAGED`, `SCRAP`): Updates the returned item's physical condition.
  - `return_reason` / `inspection_notes`: Why the item was returned and its physical check result.
- **Database Effect on `POSTED`:**
  - Adds returned quantity back to `available_qty`.
  - For `DURABLE_ASSET`: updates `operational_status = AVAILABLE_IN_STORE`, clears `current_custodian` back to `Store` (or `None`), and updates `condition`.

---

### 2.4 Inter-Office Stock Transfers (`POST /api/v1/transfers`)
Used to relocate durable assets or consumable stock between Panchayat offices/stores.

#### 4-Stage Transfer Lifecycle
| Stage | Status | Trigger / Action | What Happens |
|:---|:---|:---|:---|
| **1. Request** | **`SUBMITTED`** | **Submit Transfer Request** (`POST /api/v1/transfers`) | Creates transfer voucher; stock is not moved yet |
| **2. Sanction** | **`APPROVED`** or **`REJECTED`** | **Approve** / **Reject** (`POST /api/v1/transfers/{id}/approve`) | Store Officer / Admin sanctions or rejects the request |
| **3. Dispatch** | **`IN_TRANSIT`** | **Dispatch Items** (`POST /api/v1/transfers/{id}/dispatch`) | Records `carrier_name`, `waybill_number`, `vehicle_number`, and `expected_delivery_date` |
| **4. Receipt** | **`COMPLETED`** | **Acknowledge Receipt & Complete** (`POST /api/v1/transfers/{id}/complete`) | Deducts from source `StockBalance`, adds to destination `StockBalance`, updates item `office_id` & `location_id` |

#### Key Transfer Fields ("What Means What")
- **`transfer_type`**:
  - `PERMANENT`: Permanent reallocation of asset ownership/location to the destination office.
  - `TEMPORARY`: Temporary returnable loan (requires `expected_return_date`).
- **`order_reference`**: Official administrative sanction / memo number (e.g., `DDO/GS/TRF/2026/108`).
- **`waybill_number` / `carrier_name` / `vehicle_number`**: Dispatch challan and transport tracking recorded when goods leave the source store.
- **`received_by`**: Name of the destination officer acknowledging physical arrival.

---

### 2.5 Reversals & Immutability (`POST /api/v1/transactions/{id}/reverse`)
- Posted ledger lines are **protected by a PostgreSQL database trigger** (`trg_prevent_posted_lines_mutation`) and cannot be edited or deleted directly.
- To correct a mistake on a `POSTED` voucher, use **Reverse Transaction** with a mandatory `reversal_reason` (minimum 5 characters). This creates a `REVERSAL_CORRECTION` voucher that offsets the balance and maintains a complete audit trail.

---

## 3. Key Files & API Endpoints Reference

| Layer | File / Endpoint | Purpose |
|:---|:---|:---|
| **Receipts UI** | `ReceiptListPage.jsx`, `ReceiptCreatePage.jsx`, `ReceiptDetailPage.jsx` | List, create (`DRAFT`/`POSTED`), and post GRN vouchers |
| **Issues UI** | `IssueListPage.jsx`, `IssueCreatePage.jsx`, `IssueDetailPage.jsx` | Issue available store stock to departments/custodians |
| **Returns UI** | `ReturnListPage.jsx`, `ReturnCreatePage.jsx`, `ReturnDetailPage.jsx` | Return unreturned items from posted issue vouchers |
| **Transfers UI** | `TransferListPage.jsx`, `TransferCreatePage.jsx`, `TransferDetailPage.jsx` | Full 4-stage transfer request, approval, dispatch, and completion |
| **Unified Ledger UI** | `TransactionHistoryPage.jsx` | Search and filter all ledger transactions across types |
| **Backend Routes** | `stock_receipts.py`, `stock_issues.py`, `stock_returns.py`, `stock_transfers.py`, `ledger.py` | REST endpoints under `/api/v1/receipts`, `/issues`, `/returns`, `/transfers`, `/transactions` |
| **Backend Service** | `backend/app/features/ledger/services.py` | `LedgerService` transaction validation, balance locking (`with_for_update`), and audit logging |

