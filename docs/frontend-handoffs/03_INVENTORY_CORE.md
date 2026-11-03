# Frontend Handoff: Module 03 – Core Inventory Database & Asset Lifecycle
## PS000214 – Dead Stock Inventory Management System

**Target Recipient:** Backend Engineering Teammate  
**Prepared By:** Frontend Architect (Ninu Handoff)  
**Organization:** District Development Office – Gir Somnath, Veraval, Gujarat  
**Version:** 1.0.0  
**Phase:** Phase 3 – Inventory Core

---

### 1. Module Overview
Module 03 implements the central inventory register for Panchayat assets and store supplies. It handles both:
1. **Durable Assets:** Individually serialized equipment (computers, machinery, furniture) with system-generated unique Asset IDs (`AST-GS-VRV-YYYY-XXXXX`) and printable Code 128 / QR barcodes.
2. **Consumable Stock:** Quantity-tracked office supplies and stationery (`ITM-GS-VRV-XXXXX`) maintaining store balances without forcing individual QR stickers on every single unit.

It provides a searchable, filterable, sortable, and paginated data table, a multi-section registration form supporting legacy records, a 360° asset profile with an append-only movement timeline, and category/location managers.

---

### 2. Pages and Components

#### Pages:
1. `AssetRegisterPage` (`/inventory`): Searchable, filterable, paginated data table of all items.
2. `AddEditAssetPage` (`/inventory/new`, `/inventory/:id/edit`): Multi-section item entry form.
3. `AssetDetailPage` (`/inventory/:id`): 360° item profile, barcode preview, financial valuation, and movement timeline.
4. `CategoryListPage` (`/inventory/categories`): Lifespan rules, thresholds, and depreciation rates.
5. `LocationListPage` (`/inventory/locations`): Room and yard taxonomy scoped to assigned office.

#### Shared Components:
- `DataTable`: Generic sortable table with page size selector and pagination controls.
- `FilterBar`: Keyword search input, clear button, and multi-select filter dropdowns.
- `StatusBadge`: Visual indicator for operational status, classification, and condition.

---

### 3. All Input Fields & 4. Field Data Types

| Field Name | Type | UI Component | Required? | Validation Rules |
|:---|:---|:---|:---:|:---|
| `item_type` | Enum (`DURABLE_ASSET`, `CONSUMABLE_STOCK`) | Dropdown | **Yes** | Cannot be altered after creation |
| `item_name` | String | Text Input | **Yes** | Min 2 characters, trimmed |
| `category_id` | UUID | Dropdown | **Yes** | Must match existing active category |
| `location_id` | UUID | Dropdown | **Yes** | Must match room belonging to user's office |
| `uom` | String | Dropdown | **Yes** | Standard UOM code (`NOS`, `BOX`, `REAM`, etc.) |
| `quantity` | Number | Number Input | **Yes** | Fixed to 1 for Durable Assets; >= 1 for Consumables |
| `unit_purchase_cost` | Decimal (2 dec) | Currency Input | **Yes** | Non-negative numeric value |
| `purchase_date` | ISO Date (`YYYY-MM-DD`) | Date Picker | **Yes** | Cannot be in future |
| `condition` | Enum (`GOOD`, `FAIR`, `DAMAGED`, `SCRAP`) | Dropdown | **Yes** | Default: `GOOD` |
| `brand` | String | Text Input | Optional | Max 100 characters |
| `model_number` | String | Text Input | Optional | Max 100 characters |
| `serial_number` | String | Text Input (Mono) | Optional | Validated for uniqueness per brand if provided |
| `invoice_number` | String | Text Input | Optional | Required if `is_legacy = false` |
| `current_custodian` | String | Text Input | Optional | Designated employee name |
| `is_legacy` | Boolean | Checkbox | Optional | If true, permits missing invoice / supplier info |

---

### 5. Required and Optional Fields
- Core required: `item_type`, `item_name`, `category_id`, `location_id`, `uom`, `quantity`, `unit_purchase_cost`, `purchase_date`, `condition`.
- Optional: `brand`, `model_number`, `serial_number`, `invoice_number`, `supplier_name`, `current_custodian`, `is_legacy`.

---

### 6. Validation Requirements
- Client schema validated via **Zod** (`assetSchema`) inside React Hook Form.
- Total recorded cost is computed automatically as `quantity * unit_purchase_cost`.
- Form inputs preserve state when validation fails.
- Double-submission disabled while `isSubmitting = true`.

---

### 7. Button Actions
- **Add New Item (`AssetRegisterPage`):** Navigates to `/inventory/new`.
- **Export Action (`AssetRegisterPage`):** Calls `GET /api/v1/items/export`.
- **Row Click / View Icon:** Navigates to `/inventory/:id`.
- **Edit Icon:** Navigates to `/inventory/:id/edit` (Blocked if status is `DISPOSED`).
- **Print Record (`AssetDetailPage`):** Opens browser print dialog with print-optimized CSS.
- **Save Category / Location:** Opens modal, submits payload, refreshes table.

---

### 8. Search and Filter Requirements
- Text search: Matches `item_name`, `item_code`, `serial_number`, or `barcode_number`.
- Filter parameters:
  - `category_id` (UUID)
  - `item_type` (`DURABLE_ASSET` / `CONSUMABLE_STOCK`)
  - `operational_status` (`AVAILABLE_IN_STORE`, `IN_USE`, `UNDER_MAINTENANCE`, `PENDING_CONDEMNATION`, `PENDING_DISPOSAL`, `DISPOSED`)
  - `classification` (`ACTIVE`, `SLOW_MOVING`, `NON_MOVING`, `OBSOLETE`)
  - `condition` (`GOOD`, `FAIR`, `DAMAGED`, `SCRAP`)

---

### 9. API Endpoint Requirements & 10. HTTP Methods

| Operation | Method | Endpoint | Required Permission |
|:---|:---:|:---|:---|
| List Items | `GET` | `/api/v1/items` | `inventory:view` |
| Create Item | `POST` | `/api/v1/items` | `inventory:create` |
| Get Item Details | `GET` | `/api/v1/items/{id}` | `inventory:view` |
| Update Item | `PATCH` | `/api/v1/items/{id}` | `inventory:edit` |
| Item History | `GET` | `/api/v1/items/{id}/history` | `inventory:view` |
| List Categories | `GET` | `/api/v1/categories` | `master:categories_view` |
| Create Category | `POST` | `/api/v1/categories` | `master:categories_manage` |
| List Locations | `GET` | `/api/v1/locations` | `master:locations_view` |
| Create Location | `POST` | `/api/v1/locations` | `master:locations_manage` |

---

### 11. Request JSON Examples

#### `POST /api/v1/items`:
```json
{
  "office_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "item_type": "DURABLE_ASSET",
  "category_id": "cat-001",
  "location_id": "loc-001",
  "item_name": "HP LaserJet Pro MFP 4104dw Printer",
  "brand": "HP",
  "model_number": "MFP 4104dw",
  "serial_number": "VNB3K94021",
  "quantity": 1,
  "uom": "NOS",
  "unit_purchase_cost": 38500.00,
  "purchase_date": "2024-03-15",
  "invoice_number": "INV-HP-2024-89",
  "condition": "GOOD",
  "current_custodian": "Store Department",
  "is_legacy": false
}
```

---

### 12. Expected Response JSON Examples

#### `POST /api/v1/items` (HTTP 201 Created):
```json
{
  "success": true,
  "data": {
    "id": "itm-001",
    "item_code": "AST-GS-VRV-2024-00012",
    "barcode_number": "BC-AST-00012",
    "item_name": "HP LaserJet Pro MFP 4104dw Printer",
    "item_type": "DURABLE_ASSET",
    "operational_status": "AVAILABLE_IN_STORE",
    "classification": "ACTIVE",
    "quantity": 1,
    "unit_purchase_cost": 38500.00,
    "total_purchase_cost": 38500.00
  },
  "message": "Item registered successfully"
}
```

---

### 13. Required Master Data
- Categories list with lifespan parameters.
- Storage locations scoped to user's assigned Panchayat office.
- Units of Measure (UOM) dictionary.

---

### 14. Status and Enum Values
- **Operational Statuses:** `AVAILABLE_IN_STORE`, `IN_USE`, `UNDER_MAINTENANCE`, `PENDING_CONDEMNATION`, `PENDING_DISPOSAL`, `DISPOSED`.
- **Classification Statuses:** `ACTIVE`, `SLOW_MOVING`, `NON_MOVING`, `OBSOLETE`.
- **Conditions:** `GOOD`, `FAIR`, `DAMAGED`, `SCRAP`.

---

### 15. Error Handling
- **HTTP 409 Conflict:**
  - Duplicate serial number or barcode returns error banner: *"An asset with serial number X already exists in this office."*
- **HTTP 422 Unprocessable Entity:**
  - Field-level validation issues rendered inline below each respective input.
- **Disposed Item Mutation Block:**
  - Modifying a `DISPOSED` item returns HTTP 403 / 422 preventing status revival.

---

### 16. Backend Dependencies
- Automatic sequential asset code generator (`AST-GS-VRV-YYYY-XXXXX` or `ITM-GS-VRV-XXXXX`).
- Automatic Code 128 string generation.
- Initial row inserted into `stock_balances` inside the same database transaction.

---

### 17. Testing Checklist
- [x] Search filters items by name, asset code, and serial number in real time.
- [x] Switching between Durable Asset and Consumable Stock adjusts form constraints (quantity fixed to 1 for durable).
- [x] Total valuation auto-computes as quantity * unit cost.
- [x] Legacy record toggle allows saving historic records without invoice numbers.
- [x] Detail view displays 360° specs, visual barcode preview, and chronological history timeline.
- [x] Category and Location managers allow adding and updating thresholds.

