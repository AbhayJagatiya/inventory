# PS000214: Dead Stock Inventory Management System
## Asset Registration, Classification & State Lifecycle Guide
**Target Organization:** District Development Office – Gir Somnath, Veraval, Gujarat  
**System Scope:** Inventory Registration, Automated 5-Tier Classification Engine, and Operational State Transitions  
**Document Location:** `d:\seva\inventory\docs\ASSET_LIFECYCLE_GUIDE.md`

---

## 1. Asset Registration & Dual-Tracking Model

DSIMS supports two distinct inventory tracking modes selected during registration in **Inventory → Add New Item** (`AddEditAssetPage.jsx`) or **Import Excel** (`ExcelImportModal.jsx`):

| Tracking Mode (`item_type`) | Use Case | Auto-Generated Code | Barcode Prefix | Quantity Rule |
|:---|:---|:---|:---|:---|
| **`DURABLE_ASSET`** | Computers, printers, furniture, machinery | `AST-GS-VRV-YYYY-XXXXX` | `BC-AST-XXXXXX` | Locked to `1` per record |
| **`CONSUMABLE_STOCK`** | Stationery, copier paper, toners, supplies | `ITM-GS-VRV-XXXXX` | `BC-ITM-XXXXXX` | Quantity / batch tracked (`available_qty`) |

### What Happens When You Register a New Asset (`POST /api/v1/items`)
When a new item is submitted via `InventoryService.create_item`:
1. **Office & Master Data Resolution:** Scopes the record to the user's `office_id`, validates that `location_id` belongs to the same office, and resolves `category_id` and `uom_id`.
2. **Initial Defaults Applied Automatically:**
   - `operational_status` = **`AVAILABLE_IN_STORE`**
   - `current_classification` = **`ACTIVE`**
   - `last_movement_date` = `purchase_date` (or current UTC date if omitted)
   - `total_cost` = `unit_purchase_cost × initial_quantity`
3. **Stock Balance Initialization:** Creates a `stock_balances` record with `available_qty = initial_quantity`.
4. **Audit Trail:** Records a `CREATE` entry in `audit_logs`.

---

## 2. Editing, Bulk Importing & Deleting Assets

### 2.1 Updating an Asset (`PATCH /api/v1/items/{item_id}`)
- Accessed via the **Edit** (`Edit3`) icon in the Asset Register (`AssetRegisterPage.jsx`).
- Editable fields include: `item_name`, `category_id`, `location_id`, `uom` / `uom_id`, `brand`, `model_number`, `serial_number`, `unit_purchase_cost` (automatically recalculates `total_cost`), `purchase_date`, `invoice_number`, `current_custodian`, `current_department`, `min_stock_level`, and `condition`.
- Items with `operational_status = DISPOSED` are archived and immutable.

### 2.2 Bulk Import from Excel / CSV (`POST /api/v1/items/bulk-import`)
- Supports both **`.xlsx`** (via `openpyxl`) and **`.csv`** files.
- **Step 1 (`dry_run=true`):** Validates every row against PostgreSQL (`category_code`, `room_number` / `room_code`, `uom` / `uom_code`, `item_type`, numeric cost/quantity) and returns a row-by-row preview with isolated error messages.
- **Step 2 (`dry_run=false`):** Imports all valid rows into PostgreSQL and creates corresponding `stock_balances` and audit entries.

### 2.3 Deleting / Disposing an Asset (`DELETE /api/v1/items/{item_id}`)
- Accessed via the **Delete** (`Trash2`) icon in both Table and Card views of the Asset Register.
- Performs a **soft-delete** (archives the item by setting `operational_status = DISPOSED`) after confirmation, preserving full movement and audit history.

---

## 3. Classification Lifecycle (`ACTIVE` → `OBSOLETE`)

Classification is **not** chosen manually on the Add Asset form—every new item starts as **`ACTIVE`**. Classification changes through the **Dead Stock Classification Engine** or **Manual Officer Override**.

### 3.1 Automated 5-Tier Classification Engine
- **Where to run:** **Dead Stock → Classification Engine** (`ClassificationOverviewPage.jsx`) → click **Run Classification** (`POST /api/v1/classifications/run`).
- **Evaluation Rules (`ClassificationService.evaluate_item`):** Evaluates every non-disposed item in strict 5-tier precedence using category thresholds configured in **Inventory → Categories** (`CategoryListPage.jsx`):

| Precedence | Condition | Resulting Classification |
|:---|:---|:---|
| **Tier 1** | Physical `condition` is `DAMAGED` or `SCRAP` | **`OBSOLETE`** |
| **Tier 2** | `item_age_years >= obsolescence_years` **AND** `days_inactive >= slow_moving_threshold_days` | **`OBSOLETE`** |
| **Tier 3** | `days_inactive >= inactivity_threshold_days` | **`NON_MOVING`** |
| **Tier 4** | `days_inactive >= slow_moving_threshold_days` | **`SLOW_MOVING`** |
| **Tier 5** | Default (regularly active stock) | **`ACTIVE`** |

> **Note:** Registering an older/legacy item with a past `purchase_date` (exceeding `obsolescence_years`) or setting its condition to `DAMAGED`/`SCRAP` and then clicking **Run Classification** will automatically move it to `NON_MOVING` or `OBSOLETE`.

### 3.2 Manual Classification Override
- **Where to change:** **Dead Stock → Dead Stock Register** (`DeadStockRegisterPage.jsx`).
- **How it works:**
  - **Apply Override (`POST /api/v1/classifications/{item_id}/override`):** Authorized officers can manually override an item's classification with a mandatory justification reason (minimum 5 characters). Overridden items are preserved during subsequent automated engine runs.
  - **Release Override (`POST /api/v1/classifications/{item_id}/release-override`):** Releases the manual lock and restores the engine-calculated classification.

---

## 4. Operational State vs. Physical Condition

DSIMS separates **Physical Condition** from **Operational State** so asset custody and movement remain strictly auditable:

### 4.1 Physical Condition (`condition`)
- Values: `NEW`, `GOOD`, `FAIR`, `POOR`, `DAMAGED`, `SCRAP`.
- **Where changed:** Directly on **Edit Asset** (`AddEditAssetPage.jsx`), during **Stock Returns**, or during **Physical Verification** scans.

### 4.2 Operational State (`operational_status`)
Operational status is driven by inventory workflow transactions (accessible directly from `AssetDetailPage.jsx` or the Transactions / Dead Stock menus):

| Workflow Action | Status Transition |
|:---|:---|
| **Asset Registration / Goods Receipt** | → `AVAILABLE_IN_STORE` |
| **Stock Issue** | `AVAILABLE_IN_STORE` → `IN_USE` |
| **Stock Return** | `IN_USE` → `AVAILABLE_IN_STORE` |
| **Maintenance / Repair** | → `UNDER_MAINTENANCE` (or `DISPATCHED_TO_VENDOR`) |
| **Condemnation Proposal** | → `PENDING_CONDEMNATION` → `PENDING_DISPOSAL` |
| **Disposal Execution / Delete** | → `DISPOSED` (archived & immutable) |

---

## 5. Key Files & API Endpoints Reference

| Layer | File / Endpoint | Purpose |
|:---|:---|:---|
| **Frontend Register** | `frontend/src/pages/inventory/AssetRegisterPage.jsx` | List, filter, sort, export, and delete/dispose items |
| **Frontend Add/Edit** | `frontend/src/pages/inventory/AddEditAssetPage.jsx` | Register new item or edit existing item & condition |
| **Frontend Import** | `frontend/src/components/inventory/ExcelImportModal.jsx` | `.xlsx` / `.csv` dry-run validation & bulk import |
| **Frontend Classification** | `frontend/src/pages/dead-stock/ClassificationOverviewPage.jsx` | Run automated 5-tier classification engine |
| **Frontend Dead Stock** | `frontend/src/pages/dead-stock/DeadStockRegisterPage.jsx` | View `NON_MOVING`/`OBSOLETE` items & apply overrides |
| **Backend Inventory** | `backend/app/routes/inventory.py` | `GET/POST /items`, `PATCH/DELETE /items/{id}`, `POST /items/bulk-import` |
| **Backend Classification** | `backend/app/routes/classification.py` | `/classifications/summary`, `/run`, `/dead-stock`, `/{id}/override` |

