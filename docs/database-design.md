# Database Design & Entity Relationship Specification
## PS000214 – Dead Stock Inventory Management System
**Organization:** District Development Office – Gir Somnath, Veraval  
**Target User Group:** Officers and Staff of Store Department, District Panchayat, Gir Somnath  

---

## 1. Schema Design Principles & Integrity Constraints

### 1.1 Relational Architecture & Terminology
- **Inventory Movement Ledger**: The system implements an **Inventory Movement Ledger** (recording physical item inflows, outward issues, linked returns, inter-store transfers, RMA vendor movements, write-offs, and adjustments with traceable voucher numbers). It tracks physical stock quantities, item locations, and custodian assignments across the asset lifecycle.
- **Third Normal Form (3NF)**: Normalized relational structures prevent data duplication while strategic indexing ensures sub-100ms lookups and fast analytical reporting.
- **Strict Immutability & Reversals**: Posted transaction headers and lines are **immutable**. No ordinary update or delete operations are permitted once posted. Adjustments must be performed using explicit `REVERSAL_CORRECTION` vouchers.
- **Referential Integrity**: All transactional, audit, procurement, inventory, and location records enforce `ON DELETE RESTRICT`. Cascading deletion of posted transactions or audit trails is strictly forbidden.

### 1.2 Office-Level Multi-Tenancy & Composite Foreign Keys
To guarantee physical office-level data isolation at the PostgreSQL database engine level (independent of application software logic), parent entities enforce composite unique keys that are referenced by composite foreign keys on child tables:

```sql
-- 1. Locations unique per office
ALTER TABLE locations ADD CONSTRAINT uq_locations_id_office UNIQUE (id, office_id);

-- 2. Items must reference a location belonging to the EXACT same office
ALTER TABLE items ADD CONSTRAINT uq_items_id_office UNIQUE (id, office_id);
ALTER TABLE items ADD CONSTRAINT fk_items_location_office 
    FOREIGN KEY (location_id, office_id) REFERENCES locations(id, office_id) ON DELETE RESTRICT;

-- 3. Stock balances must reference item and location in the same office
ALTER TABLE stock_balances ADD CONSTRAINT uq_stock_balances_office_item_loc UNIQUE (office_id, item_id, location_id);
ALTER TABLE stock_balances ADD CONSTRAINT fk_stock_balances_item_office 
    FOREIGN KEY (item_id, office_id) REFERENCES items(id, office_id) ON DELETE RESTRICT;
ALTER TABLE stock_balances ADD CONSTRAINT fk_stock_balances_location_office 
    FOREIGN KEY (location_id, office_id) REFERENCES locations(id, office_id) ON DELETE RESTRICT;

-- 4. Verification sessions unique per office
ALTER TABLE verification_sessions ADD CONSTRAINT uq_verif_sessions_id_office UNIQUE (id, office_id);

-- 5. Verification items & scan events must belong to the session's office
ALTER TABLE verification_items ADD CONSTRAINT fk_verif_items_session_office 
    FOREIGN KEY (session_id, office_id) REFERENCES verification_sessions(id, office_id) ON DELETE RESTRICT;
ALTER TABLE verification_items ADD CONSTRAINT fk_verif_items_item_office 
    FOREIGN KEY (item_id, office_id) REFERENCES items(id, office_id) ON DELETE RESTRICT;

ALTER TABLE verification_scan_events ADD CONSTRAINT fk_verif_scans_session_office 
    FOREIGN KEY (session_id, office_id) REFERENCES verification_sessions(id, office_id) ON DELETE RESTRICT;
ALTER TABLE verification_scan_events ADD CONSTRAINT fk_verif_scans_location_office 
    FOREIGN KEY (scanned_location_id, office_id) REFERENCES locations(id, office_id) ON DELETE RESTRICT;

-- 6. Condemnation requests unique per office
ALTER TABLE condemnation_requests ADD CONSTRAINT uq_condemn_requests_id_office UNIQUE (id, office_id);
ALTER TABLE condemnation_request_items ADD CONSTRAINT fk_condemn_items_request_office 
    FOREIGN KEY (request_id, office_id) REFERENCES condemnation_requests(id, office_id) ON DELETE RESTRICT;
ALTER TABLE condemnation_request_items ADD CONSTRAINT fk_condemn_items_item_office 
    FOREIGN KEY (item_id, office_id) REFERENCES items(id, office_id) ON DELETE RESTRICT;

-- 7. Supplier returns must link to item in the same office
ALTER TABLE supplier_returns ADD CONSTRAINT fk_supplier_returns_item_office 
    FOREIGN KEY (item_id, office_id) REFERENCES items(id, office_id) ON DELETE RESTRICT;
```

### 1.3 Posted Transaction Immutability Triggers
To guarantee that posted transaction records cannot be modified or deleted by any user or application bug, the database enforces the following triggers:

```sql
-- Trigger Function for stock_transactions Header
CREATE OR REPLACE FUNCTION trg_prevent_posted_transaction_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.status = 'POSTED' THEN
        RAISE EXCEPTION 'Illegal Operation: Transaction % is POSTED and immutable. Posted transaction records cannot be deleted.', OLD.transaction_number;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status = 'POSTED' THEN
        -- Allow NO updates to posted transaction headers
        RAISE EXCEPTION 'Illegal Operation: Transaction % is POSTED and immutable. Modifications to posted vouchers are prohibited.', OLD.transaction_number;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_transactions_immutable
BEFORE UPDATE OR DELETE ON stock_transactions
FOR EACH ROW EXECUTE FUNCTION trg_prevent_posted_transaction_mutation();

-- Trigger Function for stock_transaction_lines
CREATE OR REPLACE FUNCTION trg_prevent_posted_lines_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_status VARCHAR(30);
    v_txn_no VARCHAR(50);
BEGIN
    SELECT status, transaction_number INTO v_status, v_txn_no 
    FROM stock_transactions 
    WHERE id = COALESCE(OLD.transaction_id, NEW.transaction_id);

    IF v_status = 'POSTED' THEN
        RAISE EXCEPTION 'Illegal Operation: Transaction % is POSTED. Inserting, updating, or deleting lines on posted transactions is strictly prohibited.', v_txn_no;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_transaction_lines_immutable
BEFORE INSERT OR UPDATE OR DELETE ON stock_transaction_lines
FOR EACH ROW EXECUTE FUNCTION trg_prevent_posted_lines_mutation();
```

### 1.4 System Settings Uniqueness & Fallback Hierarchy
System settings are stored in `system_settings` with partial unique indexes to guarantee that there is at most one global default and at most one override per office for any key:

```sql
CREATE UNIQUE INDEX uq_system_settings_global ON system_settings(setting_key) WHERE office_id IS NULL;
CREATE UNIQUE INDEX uq_system_settings_office ON system_settings(office_id, setting_key) WHERE office_id IS NOT NULL;
```

**Resolution Precedence SQL**:
```sql
SELECT setting_value 
FROM system_settings 
WHERE (office_id = :office_id OR office_id IS NULL) 
  AND setting_key = :setting_key 
ORDER BY office_id NULLS LAST 
LIMIT 1;
```

### 1.5 RMA Ledger Movement Types & Balance Effects
Vendor RMA transactions are handled via dedicated movement ledger types that update `stock_balances`:

| Transaction Type | Triggering Event | Durable Asset Status | Consumable `stock_balances` Effect |
| :--- | :--- | :--- | :--- |
| `SUPPLIER_RMA_OUT` | Dispatched to vendor for inspection/repair | `operational_status = 'DISPATCHED_TO_VENDOR'`, `custodian = vendor` | `available_qty -= qty`, `in_vendor_rma_qty += qty` |
| `SUPPLIER_RMA_IN` | Vendor delivers brand-new replacement item | New item registered (`AVAILABLE_IN_STORE`), old item marked `DISPOSED` | `available_qty += qty`, `in_vendor_rma_qty -= qty` |
| `SUPPLIER_RMA_RESTORE`| Vendor returns repaired original asset | `operational_status = 'AVAILABLE_IN_STORE'`, condition updated | `available_qty += qty`, `in_vendor_rma_qty -= qty` |
| `SUPPLIER_RMA_WRITEOFF`| Vendor accepts credit note or financial refund | `operational_status = 'DISPOSED'` | `in_vendor_rma_qty -= qty`, `disposed_qty += qty` |
| `SUPPLIER_RMA_REJECT` | Vendor rejects RMA; item returned defective | `operational_status = 'DAMAGED'`, routed to condemnation | `in_vendor_rma_qty -= qty`, `available_qty += qty` (flagged damaged) |

---

## 2. Complete Entity Catalog

### 2.1 Multi-Office & Location Foundation

#### `offices`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Office primary key |
| `code` | VARCHAR(20) | NOT NULL, UNIQUE, INDEX | Official office code (e.g. `OFF-GS-VRV-001`) |
| `name` | VARCHAR(150) | NOT NULL | Office name (e.g. `District Panchayat Office, Gir Somnath`) |
| `office_type` | VARCHAR(50) | NOT NULL | `DISTRICT_PANCHAYAT`, `TALUKA_PANCHAYAT`, `GRAM_PANCHAYAT` |
| `district` | VARCHAR(100) | NOT NULL, DEFAULT 'Gir Somnath' | District name |
| `taluka` | VARCHAR(100) | NOT NULL, DEFAULT 'Veraval' | Taluka/Block name |
| `address` | TEXT | NOT NULL | Physical postal address |
| `contact_email` | VARCHAR(100) | NULLABLE | Official contact email |
| `contact_phone` | VARCHAR(20) | NULLABLE | Official contact phone |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Soft active/inactive status |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Last update timestamp |

#### `locations`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Location primary key |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Owning office scope |
| `building_name`| VARCHAR(100) | NOT NULL | Building name or block |
| `floor` | VARCHAR(50) | NOT NULL | Floor designation (Ground, 1st, 2nd) |
| `room_number` | VARCHAR(50) | NOT NULL | Room/Cabin/Store identifier |
| `location_type`| VARCHAR(50) | NOT NULL | `STORE_ROOM`, `OFFICE_ROOM`, `RECORD_ROOM`, `OPEN_YARD` |
| `description` | TEXT | NULLABLE | Specific location notes |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Active status |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Last update timestamp |
*Composite Constraints:*
- `UNIQUE (id, office_id)`
- `UNIQUE (office_id, building_name, floor, room_number)`

---

### 2.2 Users, Roles & Permissions (RBAC)

#### `roles`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Role primary key |
| `name` | VARCHAR(50) | NOT NULL, UNIQUE, INDEX | Code name (`SYSTEM_ADMIN`, `STORE_OFFICER`, `STORE_STAFF`) |
| `display_name` | VARCHAR(100) | NOT NULL | Human-readable role title |
| `description` | TEXT | NULLABLE | Role scope description |
| `is_system_role`| BOOLEAN | NOT NULL, DEFAULT TRUE | System-defined protected role flag |

#### `permissions`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Permission primary key |
| `code` | VARCHAR(80) | NOT NULL, UNIQUE, INDEX | Permission key (e.g. `inventory:create`, `stock:issue_create`) |
| `module` | VARCHAR(50) | NOT NULL, INDEX | Functional module |
| `action` | VARCHAR(30) | NOT NULL | Action verb (`view`, `create`, `edit`, `approve`, etc.) |
| `description` | TEXT | NULLABLE | Human-readable permission explanation |

#### `role_permissions`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `role_id` | UUID | NOT NULL, FK -> roles(id) ON DELETE CASCADE | Role reference |
| `permission_id`| UUID | NOT NULL, FK -> permissions(id) ON DELETE CASCADE | Permission reference |
*Primary Key: (`role_id`, `permission_id`)*

#### `users`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | User primary key |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Assigned office boundary |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE, INDEX | Login identifier |
| `email` | VARCHAR(120) | NOT NULL, UNIQUE, INDEX | Official email address |
| `hashed_password`| VARCHAR(255) | NOT NULL | Argon2 / bcrypt password hash |
| `full_name` | VARCHAR(120) | NOT NULL | Full name of officer/staff |
| `designation` | VARCHAR(100) | NOT NULL | Official designation |
| `phone_number` | VARCHAR(20) | NULLABLE | Contact telephone |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'ACTIVE', INDEX | `ACTIVE`, `INACTIVE`, `LOCKED`, `PASSWORD_RESET_REQUIRED` |
| `failed_login_attempts`| INTEGER | NOT NULL, DEFAULT 0 | Failed login attempt counter |
| `last_login_at`| TIMESTAMPTZ | NULLABLE | Most recent login timestamp |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Account creation time |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Account update time |

#### `user_roles`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE | User reference |
| `role_id` | UUID | NOT NULL, FK -> roles(id) ON DELETE RESTRICT | Role reference |
*Primary Key: (`user_id`, `role_id`)*

---

### 2.3 Master Categories & Units

#### `categories`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Category primary key |
| `code` | VARCHAR(30) | NOT NULL, UNIQUE, INDEX | e.g. `IT_EQUIPMENT`, `FURNITURE`, `STATIONERY` |
| `name` | VARCHAR(100) | NOT NULL | Display name |
| `parent_id` | UUID | NULLABLE, FK -> categories(id) ON DELETE RESTRICT | Self-referencing parent category |
| `slow_moving_threshold_days`| INTEGER | NOT NULL, DEFAULT 90 | Days of inactivity before flagging as SLOW_MOVING |
| `inactivity_threshold_days` | INTEGER | NOT NULL, DEFAULT 180 | Days of inactivity before flagging as NON_MOVING |
| `obsolescence_years` | INTEGER | NOT NULL, DEFAULT 5 | Useful lifespan in years before considering OBSOLETE |
| `depreciation_rate_pct` | NUMERIC(5, 2) | NOT NULL, DEFAULT 15.00 | Annual straight-line depreciation rate |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Active status |

#### `units_of_measure`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unit primary key |
| `code` | VARCHAR(20) | NOT NULL, UNIQUE | `NOS`, `BOX`, `PACKET`, `SET`, `KG`, `MTR` |
| `name` | VARCHAR(50) | NOT NULL | Human-readable unit name |

---

### 2.4 Core Inventory (Dual-Tracking Model)

#### `items`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Item primary key |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Owning office |
| `category_id` | UUID | NOT NULL, FK -> categories(id) ON DELETE RESTRICT, INDEX | Item category |
| `location_id` | UUID | NOT NULL, INDEX | Assigned location/room |
| `supplier_id` | UUID | NULLABLE, FK -> suppliers(id) ON DELETE RESTRICT, INDEX | Associated vendor (nullable for legacy) |
| `procurement_item_id` | UUID | NULLABLE, INDEX | Link to originating procurement line |
| `uom_id` | UUID | NOT NULL, FK -> units_of_measure(id) ON DELETE RESTRICT | Unit of measure |
| `item_code` | VARCHAR(50) | NOT NULL, UNIQUE, INDEX | System asset code (`AST-GS-VRV-YYYY-XXXXX`) |
| `item_name` | VARCHAR(200) | NOT NULL, INDEX | Item description / name |
| `item_type` | VARCHAR(30) | NOT NULL, INDEX | `DURABLE_ASSET` or `CONSUMABLE_STOCK` |
| `barcode_number`| VARCHAR(100) | NULLABLE, INDEX | Unique barcode / QR string |
| `brand` | VARCHAR(100) | NULLABLE | Manufacturer/Brand |
| `model_number` | VARCHAR(100) | NULLABLE | Model designation |
| `serial_number`| VARCHAR(100) | NULLABLE, INDEX | OEM Manufacturer serial number |
| `purchase_date`| DATE | NULLABLE, INDEX | Date of purchase/procurement |
| `invoice_number`| VARCHAR(100) | NULLABLE | Inward invoice/bill number |
| `unit_purchase_cost` | NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (unit_purchase_cost >= 0) | Per-unit purchase cost |
| `total_cost` | NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (total_cost >= 0) | Total purchase cost |
| `condition` | VARCHAR(30) | NOT NULL, DEFAULT 'GOOD' | `NEW`, `GOOD`, `FAIR`, `POOR`, `DAMAGED`, `SCRAP` |
| `operational_status` | VARCHAR(30) | NOT NULL, DEFAULT 'AVAILABLE_IN_STORE', INDEX | `AVAILABLE_IN_STORE`, `IN_USE`, `UNDER_MAINTENANCE`, `DISPATCHED_TO_VENDOR`, `DAMAGED`, `NON_FUNCTIONAL`, `PENDING_CONDEMNATION`, `PENDING_DISPOSAL`, `DISPOSED` |
| `current_classification` | VARCHAR(30) | NOT NULL, DEFAULT 'ACTIVE', INDEX | `ACTIVE`, `SLOW_MOVING`, `NON_MOVING`, `OBSOLETE` |
| `current_custodian` | VARCHAR(150) | NULLABLE | Custodian employee or section name |
| `current_department`| VARCHAR(100) | NULLABLE | Department/Branch using asset |
| `last_movement_date` | DATE | NULLABLE, INDEX | Date of most recent issue/return/transfer |
| `min_stock_level` | NUMERIC(12, 2) | NOT NULL, DEFAULT 0.00 | Reorder point for consumable stock |
| `is_legacy` | BOOLEAN | NOT NULL, DEFAULT FALSE | Flag for legacy items with missing historic docs |
| `legacy_reference_number` | VARCHAR(100) | NULLABLE | Physical ledger page/volume reference |
| `created_by` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT | Creator user |
| `updated_by` | UUID | NULLABLE, FK -> users(id) ON DELETE RESTRICT | Last modifying user |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Update timestamp |
*Composite Constraints:*
- `UNIQUE (id, office_id)`
- `FOREIGN KEY (location_id, office_id) REFERENCES locations(id, office_id) ON DELETE RESTRICT`
- `FOREIGN KEY (procurement_item_id) REFERENCES procurement_items(id) ON DELETE RESTRICT`
- Unique Partial Index: `items(office_id, barcode_number)` WHERE `barcode_number IS NOT NULL`

#### `stock_balances`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Balance record PK |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office scope |
| `item_id` | UUID | NOT NULL, INDEX | Item reference |
| `location_id` | UUID | NOT NULL, INDEX | Specific room/store |
| `available_qty`| NUMERIC(12, 2) | NOT NULL, DEFAULT 0.00, CHECK (available_qty >= 0) | Available for issue (strictly non-negative) |
| `allocated_qty`| NUMERIC(12, 2) | NOT NULL, DEFAULT 0.00, CHECK (allocated_qty >= 0) | Issued / currently in use |
| `in_vendor_rma_qty`| NUMERIC(12, 2)| NOT NULL, DEFAULT 0.00, CHECK (in_vendor_rma_qty >= 0) | Dispatched to vendor for RMA |
| `disposed_qty` | NUMERIC(12, 2) | NOT NULL, DEFAULT 0.00, CHECK (disposed_qty >= 0) | Officially condemned and written off |
| `last_reconciled_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Last ledger synchronization time |
*Composite Constraints:*
- `UNIQUE (office_id, item_id, location_id)`
- `FOREIGN KEY (item_id, office_id) REFERENCES items(id, office_id) ON DELETE RESTRICT`
- `FOREIGN KEY (location_id, office_id) REFERENCES locations(id, office_id) ON DELETE RESTRICT`

---

### 2.5 Inventory Movement Ledger & Transactions

#### `stock_transactions`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Transaction primary key |
| `transaction_number` | VARCHAR(50) | NOT NULL, UNIQUE, INDEX | e.g. `TXN-2026-00042` |
| `idempotency_key` | VARCHAR(100) | NULLABLE, UNIQUE, INDEX | Client-supplied key to prevent duplicate posting |
| `transaction_type` | VARCHAR(30) | NOT NULL, INDEX | `RECEIPT`, `ISSUE`, `RETURN`, `TRANSFER`, `DISPOSAL_WRITEOFF`, `SUPPLIER_RMA_OUT`, `SUPPLIER_RMA_IN`, `SUPPLIER_RMA_RESTORE`, `SUPPLIER_RMA_WRITEOFF`, `REVERSAL_CORRECTION` |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Controlling office |
| `source_office_id` | UUID | NULLABLE, FK -> offices(id) ON DELETE RESTRICT, INDEX | Source office (for inter-office transfers) |
| `destination_office_id` | UUID | NULLABLE, FK -> offices(id) ON DELETE RESTRICT, INDEX | Destination office (for inter-office transfers) |
| `source_location_id` | UUID | NULLABLE, INDEX | Source room/store |
| `destination_location_id` | UUID | NULLABLE, INDEX | Destination room/store |
| `original_transaction_id` | UUID | NULLABLE, FK -> stock_transactions(id) ON DELETE RESTRICT, INDEX | Links Return, Reversal, or Correction to original transaction |
| `recipient_name` | VARCHAR(150) | NULLABLE | Employee/Official receiving issue |
| `recipient_department` | VARCHAR(100) | NULLABLE | Section receiving issue |
| `reference_document` | VARCHAR(100) | NULLABLE | PO, Inward Challan, Requisition, or Order No |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'DRAFT', INDEX | `DRAFT`, `SUBMITTED`, `POSTED`, `CANCELLED` |
| `actor_id` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT, INDEX | User posting the transaction |
| `remarks` | TEXT | NULLABLE | Operational remarks |
| `reversal_reason` | TEXT | NULLABLE | Mandatory justification if `REVERSAL_CORRECTION` |
| `posted_at` | TIMESTAMPTZ | NULLABLE, INDEX | Timestamp when transaction was posted (locking it) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |

#### `stock_transaction_lines`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Transaction line PK |
| `transaction_id`| UUID | NOT NULL, FK -> stock_transactions(id) ON DELETE RESTRICT, INDEX | Owning transaction (**RESTRICT: no deletion**) |
| `original_line_id` | UUID | NULLABLE, FK -> stock_transaction_lines(id) ON DELETE RESTRICT, INDEX | For partial returns: links to original issue line |
| `procurement_item_id`| UUID | NULLABLE, FK -> procurement_items(id) ON DELETE RESTRICT, INDEX | For inward receipts: links to purchase order line |
| `item_id` | UUID | NOT NULL, FK -> items(id) ON DELETE RESTRICT, INDEX | Item being moved |
| `quantity` | NUMERIC(12, 2) | NOT NULL, CHECK (quantity > 0) | Transaction quantity |
| `cumulative_returned_qty`| NUMERIC(12, 2)| NOT NULL, DEFAULT 0.00, CHECK (cumulative_returned_qty >= 0) | Tracked on original issue lines for partial return bounds |
| `unit_cost` | NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (unit_cost >= 0) | Unit valuation |
| `total_cost` | NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (total_cost >= 0) | Line total amount |
| `condition_observed` | VARCHAR(30) | NULLABLE | Condition (`GOOD`, `DAMAGED`, `SCRAP`) |
| `remarks` | TEXT | NULLABLE | Line specific notes |

---

### 2.6 Procurement & Suppliers

#### `suppliers`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Supplier primary key |
| `supplier_code` | VARCHAR(30) | NOT NULL, UNIQUE, INDEX | e.g. `SUP-VRV-001` |
| `name` | VARCHAR(150) | NOT NULL, INDEX | Vendor/Company business name |
| `contact_person` | VARCHAR(100) | NULLABLE | Representative name |
| `phone` | VARCHAR(20) | NOT NULL | Phone contact |
| `email` | VARCHAR(100) | NULLABLE | Email address |
| `address` | TEXT | NOT NULL | Postal business address |
| `gstin` | VARCHAR(20) | NULLABLE, INDEX | GST Identification Number |
| `pan` | VARCHAR(20) | NULLABLE | Income Tax PAN number |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Active status |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Update timestamp |

#### `procurements`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Procurement header PK |
| `procurement_number` | VARCHAR(50) | NOT NULL, UNIQUE, INDEX | Purchase order / ref number (`PRC-2026-00001`) |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Procuring office |
| `supplier_id` | UUID | NOT NULL, FK -> suppliers(id) ON DELETE RESTRICT, INDEX | Vendor reference |
| `order_date` | DATE | NOT NULL | Purchase order date |
| `invoice_number` | VARCHAR(100) | NULLABLE | Vendor invoice number |
| `total_amount` | NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (total_amount >= 0) | Order total amount |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'PENDING' | `PENDING`, `PARTIALLY_RECEIVED`, `FULLY_RECEIVED`, `CANCELLED` |
| `created_by` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT | Creating user |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |

#### `procurement_items`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Procurement item PK |
| `procurement_id`| UUID | NOT NULL, FK -> procurements(id) ON DELETE RESTRICT, INDEX | Header procurement reference |
| `category_id` | UUID | NOT NULL, FK -> categories(id) ON DELETE RESTRICT, INDEX | Item category |
| `item_description` | TEXT | NOT NULL | Item name and detailed specifications |
| `item_type` | VARCHAR(30) | NOT NULL | `DURABLE_ASSET` or `CONSUMABLE_STOCK` |
| `quantity_ordered` | NUMERIC(12, 2) | NOT NULL, CHECK (quantity_ordered > 0) | Ordered quantity |
| `quantity_received`| NUMERIC(12, 2) | NOT NULL, DEFAULT 0.00, CHECK (quantity_received >= 0) | Received quantity counter |
| `unit_price` | NUMERIC(14, 2) | NOT NULL, CHECK (unit_price >= 0) | Unit price |
| `tax_rate_pct` | NUMERIC(5, 2) | NOT NULL, DEFAULT 0.00 | Applicable GST rate |
| `total_price` | NUMERIC(14, 2) | NOT NULL, CHECK (total_price >= 0) | Line total amount |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |
*Database Constraint:* `CHECK (quantity_received <= quantity_ordered)`

#### `supplier_returns` (Supplier RMA / Vendor Returns)
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Supplier return PK |
| `return_number` | VARCHAR(50) | NOT NULL, UNIQUE, INDEX | e.g. `SRM-2026-00001` |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office scope |
| `supplier_id` | UUID | NOT NULL, FK -> suppliers(id) ON DELETE RESTRICT, INDEX | Supplier receiving return |
| `item_id` | UUID | NOT NULL, INDEX | Item being returned to vendor |
| `procurement_id`| UUID | NULLABLE, FK -> procurements(id) ON DELETE RESTRICT, INDEX | Linked original procurement |
| `warranty_id` | UUID | NULLABLE, FK -> warranties(id) ON DELETE RESTRICT, INDEX | Linked warranty if claim |
| `return_date` | DATE | NOT NULL | Date return initiated |
| `dispatch_date` | DATE | NULLABLE | Date physical item dispatched to vendor |
| `return_tracking_number`| VARCHAR(100)| NULLABLE | Carrier docket / tracking reference |
| `carrier_name` | VARCHAR(100) | NULLABLE | Courier / Logistics agency name |
| `quantity` | NUMERIC(12, 2) | NOT NULL, CHECK (quantity > 0) | Return quantity |
| `reason` | VARCHAR(50) | NOT NULL | `DEFECTIVE_ON_ARRIVAL`, `WARRANTY_REPAIR`, `INCORRECT_SPECIFICATION`, `DAMAGED_IN_TRANSIT` |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'INITIATED', INDEX | Standardized states: `INITIATED`, `DISPATCHED_TO_VENDOR`, `UNDER_VENDOR_ASSESSMENT`, `REJECTED_BY_VENDOR`, `ACCEPTED_REPLACEMENT`, `ACCEPTED_REPAIR`, `ACCEPTED_CREDIT_NOTE`, `ACCEPTED_REFUND`, `COMPLETED_CLOSED`, `CANCELLED` |
| `rma_reference_number` | VARCHAR(100) | NULLABLE | Vendor-issued RMA reference |
| `vendor_acknowledgement_date`| DATE | NULLABLE | Date vendor received item |
| `vendor_rejection_reason`| TEXT | NULLABLE | Reason if vendor rejected claim |
| `resolution_type` | VARCHAR(30) | NULLABLE | `REPLACEMENT`, `CREDIT_NOTE`, `REFUND`, `REPAIRED_RETURN` |
| `resolution_date` | DATE | NULLABLE | Resolution completion date |
| `replacement_item_id` | UUID | NULLABLE, FK -> items(id) ON DELETE RESTRICT | New replacement asset if provided |
| `credit_note_number` | VARCHAR(100) | NULLABLE | Credit note reference |
| `credit_amount` | NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (credit_amount >= 0) | Credited amount |
| `refund_reference_number`| VARCHAR(100)| NULLABLE | Bank refund / payment voucher reference |
| `refund_amount` | NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (refund_amount >= 0) | Refunded amount |
| `resolution_remarks` | TEXT | NULLABLE | Detailed resolution notes |
| `created_by` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT | Creating user |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Update timestamp |
*Composite Constraint:* `FOREIGN KEY (item_id, office_id) REFERENCES items(id, office_id) ON DELETE RESTRICT`

---

### 2.7 Warranties & Maintenance

#### `warranties`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Warranty PK |
| `item_id` | UUID | NOT NULL, UNIQUE, FK -> items(id) ON DELETE RESTRICT, INDEX | Linked asset |
| `supplier_id` | UUID | NULLABLE, FK -> suppliers(id) ON DELETE RESTRICT, INDEX | Warranty provider vendor |
| `provider_name` | VARCHAR(150) | NOT NULL | Provider/Manufacturer name |
| `start_date` | DATE | NOT NULL | Warranty commencement date |
| `end_date` | DATE | NOT NULL, INDEX | Expiration date |
| `coverage_details`| TEXT | NULLABLE | Terms of coverage |
| `support_contact` | VARCHAR(100) | NULLABLE | Helpdesk telephone/email |
| `document_id` | UUID | NULLABLE, FK -> asset_documents(id) ON DELETE RESTRICT | Attached warranty card file |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |

#### `maintenance_records`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Maintenance PK |
| `item_id` | UUID | NOT NULL, INDEX | Serviced asset |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office scope |
| `issue_description` | TEXT | NOT NULL | Defect or problem report |
| `service_provider` | VARCHAR(150) | NOT NULL | Service vendor or technician |
| `reported_date` | DATE | NOT NULL | Date problem was logged |
| `completion_date`| DATE | NULLABLE | Date repair was finished |
| `estimated_cost` | NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (estimated_cost >= 0) | Estimated repair bill |
| `actual_cost` | NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (actual_cost >= 0) | Actual incurred cost |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'REPORTED', INDEX | `REPORTED`, `UNDER_REVIEW`, `APPROVED`, `IN_REPAIR`, `COMPLETED`, `CANCELLED` |
| `work_performed` | TEXT | NULLABLE | Summary of repairs carried out |
| `invoice_reference`| VARCHAR(100) | NULLABLE | Service invoice / bill number |
| `reported_by` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT | Logging user |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Update timestamp |
*Composite Constraint:* `FOREIGN KEY (item_id, office_id) REFERENCES items(id, office_id) ON DELETE RESTRICT`

---

### 2.8 Classification & Dead Stock

#### `classifications`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Classification PK |
| `item_id` | UUID | NOT NULL, INDEX | Evaluated asset |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office scope |
| `calculated_classification` | VARCHAR(30) | NOT NULL | Engine algorithm output (`ACTIVE`, `SLOW_MOVING`, `NON_MOVING`, `OBSOLETE`) |
| `effective_classification` | VARCHAR(30) | NOT NULL, INDEX | Active classification (respects manual override) |
| `rule_version` | VARCHAR(20) | NOT NULL, DEFAULT 'v1.0' | Rule engine version |
| `days_inactive` | INTEGER | NOT NULL | Days elapsed since last issue |
| `item_age_days` | INTEGER | NOT NULL | Days since procurement |
| `contributing_factors` | JSONB | NOT NULL | Breakdown of calculation factors |
| `is_overridden` | BOOLEAN | NOT NULL, DEFAULT FALSE | Manual override protection flag |
| `override_reason`| TEXT | NULLABLE | Mandatory justification for manual override |
| `overridden_by` | UUID | NULLABLE, FK -> users(id) ON DELETE RESTRICT | Officer performing override |
| `overridden_at` | TIMESTAMPTZ | NULLABLE | Timestamp of override |
| `calculated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp(), INDEX | Calculation timestamp |
*Composite Constraint:* `FOREIGN KEY (item_id, office_id) REFERENCES items(id, office_id) ON DELETE RESTRICT`
*Override Protection Rule:* Automated scheduled classification jobs update `calculated_classification` and `contributing_factors`, but MUST NOT overwrite `effective_classification` while `is_overridden = TRUE`.

---

### 2.9 Barcode & Physical Verification

#### `verification_sessions`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Session PK |
| `session_number` | VARCHAR(50) | NOT NULL, UNIQUE, INDEX | e.g. `PVS-2026-00001` |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Audited office |
| `scope_type` | VARCHAR(30) | NOT NULL | `FULL_OFFICE`, `LOCATION`, `CATEGORY` |
| `location_id` | UUID | NULLABLE, INDEX | Scoped location if location-based |
| `category_id` | UUID | NULLABLE, FK -> categories(id) ON DELETE RESTRICT, INDEX | Scoped category if category-based |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'PLANNED', INDEX | `PLANNED`, `IN_PROGRESS`, `UNDER_REVIEW`, `COMPLETED`, `CANCELLED` |
| `notes` | TEXT | NULLABLE | Session instructions and scope notes |
| `lead_verifier_id` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT | Supervising store officer |
| `started_at` | TIMESTAMPTZ | NULLABLE | Session start time |
| `completed_at` | TIMESTAMPTZ | NULLABLE | Official close time |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |
*Composite Constraints:*
- `UNIQUE (id, office_id)`
- Composite FK when `location_id` is set: `FOREIGN KEY (location_id, office_id) REFERENCES locations(id, office_id) ON DELETE RESTRICT`

#### `verification_items` (Expected Baseline Snapshot & Reconciliation Status)
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Verification item PK |
| `session_id` | UUID | NOT NULL, INDEX | Session reference |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office context |
| `item_id` | UUID | NOT NULL, INDEX | Item being verified |
| `expected_location_id` | UUID | NOT NULL, FK -> locations(id) ON DELETE RESTRICT | Baseline snapshot location |
| `observed_location_id` | UUID | NULLABLE, FK -> locations(id) ON DELETE RESTRICT | Found location during audit |
| `expected_condition` | VARCHAR(30) | NOT NULL | Baseline snapshot condition |
| `observed_condition` | VARCHAR(30) | NULLABLE | Physical condition observed |
| `expected_qty` | NUMERIC(12, 2) | NOT NULL | Baseline snapshot quantity |
| `counted_qty` | NUMERIC(12, 2) | NOT NULL, DEFAULT 0.00 | Actual scanned/counted quantity |
| `discrepancy_type` | VARCHAR(40) | NOT NULL, DEFAULT 'NONE', INDEX | `NONE`, `NOT_FOUND`, `UNEXPECTED_ITEM`, `LOCATION_MISMATCH`, `QUANTITY_MISMATCH`, `CONDITION_MISMATCH`, `DUPLICATE_SUSPECTED` |
| `resolution_status` | VARCHAR(30) | NOT NULL, DEFAULT 'PENDING' | `PENDING`, `RESOLVED`, `IGNORED` |
| `resolution_remarks` | TEXT | NULLABLE | Auditor resolution justification |
| `verified_by` | UUID | NULLABLE, FK -> users(id) ON DELETE RESTRICT | Verifier who scanned item |
| `verified_at` | TIMESTAMPTZ | NULLABLE | Time scan was logged |
*Composite Constraints:*
- `FOREIGN KEY (session_id, office_id) REFERENCES verification_sessions(id, office_id) ON DELETE RESTRICT`
- `FOREIGN KEY (item_id, office_id) REFERENCES items(id, office_id) ON DELETE RESTRICT`

#### `verification_scan_events` (Full Scan History & Duplicate Logging)
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Scan event PK |
| `session_id` | UUID | NOT NULL, INDEX | Active verification session |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office context |
| `scanned_barcode` | VARCHAR(100) | NOT NULL, INDEX | Raw barcode or QR string scanned |
| `item_id` | UUID | NULLABLE, FK -> items(id) ON DELETE RESTRICT, INDEX | Resolved item ID (NULL if unknown code) |
| `scanned_location_id`| UUID | NOT NULL, INDEX | Room/Store where scanner was located |
| `observed_condition` | VARCHAR(30) | NOT NULL | Inspected condition entered by verifier |
| `counted_quantity` | NUMERIC(12, 2) | NOT NULL, DEFAULT 1.00 | Count increment recorded |
| `scan_result` | VARCHAR(40) | NOT NULL | `MATCHED_VERIFIED`, `LOCATION_MISMATCH`, `CONDITION_MISMATCH`, `UNEXPECTED_ITEM`, `DUPLICATE_SCAN_REPEATED`, `UNKNOWN_BARCODE` |
| `is_duplicate_scan` | BOOLEAN | NOT NULL, DEFAULT FALSE | Flagged if item already scanned in current session |
| `scanned_by` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT, INDEX | User operating scanner |
| `scanned_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp(), INDEX | Exact scan timestamp |
| `device_info` | VARCHAR(255) | NULLABLE | Browser agent or handheld scanner model |
| `remarks` | TEXT | NULLABLE | Auditor notes during scan |
*Composite Constraints:*
- `FOREIGN KEY (session_id, office_id) REFERENCES verification_sessions(id, office_id) ON DELETE RESTRICT`
- `FOREIGN KEY (scanned_location_id, office_id) REFERENCES locations(id, office_id) ON DELETE RESTRICT`

---

### 2.10 Condemnation, Approval & Disposal

#### `condemnation_requests`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Condemnation PK |
| `request_number` | VARCHAR(50) | NOT NULL, UNIQUE, INDEX | e.g. `CND-2026-00001` |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office initiating proposal |
| `reason_code` | VARCHAR(50) | NOT NULL | `OBSOLETE`, `BEYOND_ECONOMIC_REPAIR`, `DAMAGED_BEYOND_RECOVERY`, `DESTROYED` |
| `condition_summary` | TEXT | NOT NULL | Detailed inspection summary |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'DRAFT', INDEX | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `MORE_INFO_REQUIRED`, `APPROVED`, `REJECTED`, `CANCELLED`, `DISPOSED` |
| `submitted_by` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT | Submitting officer/staff |
| `submitted_at` | TIMESTAMPTZ | NULLABLE | Submission timestamp |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Update timestamp |
*Composite Constraint:* `UNIQUE (id, office_id)`

#### `condemnation_request_items`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Item line PK |
| `request_id` | UUID | NOT NULL, FK -> condemnation_requests(id) ON DELETE RESTRICT, INDEX | Condemnation proposal |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office context |
| `item_id` | UUID | NOT NULL, INDEX | Asset proposed for condemnation |
| `item_condition` | VARCHAR(30) | NOT NULL | Inspected condition |
| `assessed_scrap_value` | NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (assessed_scrap_value >= 0) | Estimated scrap valuation |
| `inspector_remarks` | TEXT | NULLABLE | Technical assessment comments |
*Composite Constraints:*
- `FOREIGN KEY (request_id, office_id) REFERENCES condemnation_requests(id, office_id) ON DELETE RESTRICT`
- `FOREIGN KEY (item_id, office_id) REFERENCES items(id, office_id) ON DELETE RESTRICT`

#### `approval_actions`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Action PK |
| `request_id` | UUID | NOT NULL, FK -> condemnation_requests(id) ON DELETE RESTRICT, INDEX | Proposal being reviewed |
| `action_by` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT | Reviewer or Approver |
| `role_snapshot` | VARCHAR(50) | NOT NULL | Role of actor at decision time |
| `action` | VARCHAR(30) | NOT NULL | `SUBMIT`, `REVIEW`, `REQUEST_INFO`, `APPROVE`, `REJECT` |
| `order_number` | VARCHAR(100) | NULLABLE | Official government sanction order number |
| `remarks` | TEXT | NOT NULL | Written evaluation or rejection rationale |
| `action_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Decision timestamp |

#### `disposals`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Disposal PK |
| `disposal_number` | VARCHAR(50) | NOT NULL, UNIQUE, INDEX | e.g. `DSP-2026-00001` |
| `request_id` | UUID | NOT NULL, UNIQUE, FK -> condemnation_requests(id) ON DELETE RESTRICT, INDEX | Approved proposal |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office scope |
| `disposal_method` | VARCHAR(50) | NOT NULL | `PUBLIC_AUCTION`, `E_WASTE_RECYCLING`, `SCRAP_SALE`, `BUYBACK`, `DESTRUCTION_BURIAL`, `DONATION_TRANSFER` |
| `disposal_date` | DATE | NOT NULL, INDEX | Execution date |
| `total_sale_proceeds` | NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (total_sale_proceeds >= 0) | Revenue realized from scrap/auction |
| `recipient_agency`| VARCHAR(150) | NOT NULL | Buyer / Auction House / Recycling Agency |
| `reference_order_number`| VARCHAR(100)| NOT NULL | Official disposal executive order number |
| `certificate_document_id`| UUID | NULLABLE, FK -> asset_documents(id) ON DELETE RESTRICT | Disposal certificate document |
| `executed_by` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT | Executing officer |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Record timestamp |

#### `disposal_items`
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Disposal line PK |
| `disposal_id` | UUID | NOT NULL, FK -> disposals(id) ON DELETE RESTRICT, INDEX | Header disposal |
| `item_id` | UUID | NOT NULL, FK -> items(id) ON DELETE RESTRICT, INDEX | Disposed asset |
| `disposed_qty` | NUMERIC(12, 2) | NOT NULL, CHECK (disposed_qty > 0) | Disposed quantity |
| `realized_amount`| NUMERIC(14, 2) | NOT NULL, DEFAULT 0.00, CHECK (realized_amount >= 0) | Item scrap recovery value |

---

### 2.11 Alerts, Notifications, System Settings, Documents & Audit Trail

#### `alerts` (Condition-Triggered System Alerts)
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Alert PK |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office scope |
| `item_id` | UUID | NULLABLE, FK -> items(id) ON DELETE RESTRICT, INDEX | Related asset (if item-specific) |
| `alert_type` | VARCHAR(50) | NOT NULL, INDEX | `NON_MOVING_INACTIVITY`, `WARRANTY_EXPIRING`, `MAINTENANCE_DUE`, `LOW_STOCK` |
| `priority` | VARCHAR(20) | NOT NULL, DEFAULT 'MEDIUM' | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `title` | VARCHAR(200) | NOT NULL | Short alert title |
| `message` | TEXT | NOT NULL | Detailed alert message |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'ACTIVE', INDEX | `ACTIVE`, `ACKNOWLEDGED`, `SNOOZED`, `RESOLVED` |
| `snoozed_until` | TIMESTAMPTZ | NULLABLE | Snooze expiration |
| `resolved_by` | UUID | NULLABLE, FK -> users(id) ON DELETE RESTRICT | User resolving alert |
| `resolved_at` | TIMESTAMPTZ | NULLABLE | Resolution timestamp |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp(), INDEX | Alert creation time |

#### `notifications` (User-Facing In-App Delivery)
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Notification PK |
| `recipient_user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT, INDEX | Targeted recipient user |
| `recipient_role_id` | UUID | NULLABLE, FK -> roles(id) ON DELETE RESTRICT, INDEX | Role broadcast (if multi-user alert) |
| `office_id` | UUID | NOT NULL, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office scope |
| `alert_id` | UUID | NULLABLE, FK -> alerts(id) ON DELETE RESTRICT, INDEX | Source alert reference |
| `notification_type` | VARCHAR(50) | NOT NULL, INDEX | `SYSTEM_ALERT`, `APPROVAL_PENDING`, `TRANSFER_REQUEST`, `VERIFICATION_ASSIGNED`, `MAINTENANCE_UPDATE`, `STOCK_LOW` |
| `title` | VARCHAR(200) | NOT NULL | Notification header |
| `message` | TEXT | NOT NULL | Detailed text |
| `priority` | VARCHAR(20) | NOT NULL, DEFAULT 'MEDIUM' | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `related_entity_type` | VARCHAR(50) | NULLABLE, INDEX | `ITEM`, `TRANSACTION`, `CONDEMNATION`, `VERIFICATION`, `MAINTENANCE` |
| `related_entity_id` | UUID | NULLABLE, INDEX | Primary key of referenced entity |
| `action_url` | VARCHAR(255) | NULLABLE | Frontend route to open |
| `is_read` | BOOLEAN | NOT NULL, DEFAULT FALSE, INDEX | Read status flag |
| `read_at` | TIMESTAMPTZ | NULLABLE | Timestamp when read |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp(), INDEX | Delivery timestamp |

#### `system_settings` (Configurable Engine Parameters & Approvals)
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Setting PK |
| `office_id` | UUID | NULLABLE, FK -> offices(id) ON DELETE RESTRICT, INDEX | NULL for global defaults; populated for office-level override |
| `setting_category` | VARCHAR(50) | NOT NULL, INDEX | `CLASSIFICATION`, `NOTIFICATIONS`, `APPROVAL_WORKFLOW`, `OFFICE_CONFIG`, `SYSTEM_PREFERENCES` |
| `setting_key` | VARCHAR(100) | NOT NULL, INDEX | e.g. `classification.inactivity_threshold_days` |
| `setting_value` | JSONB | NOT NULL | Serialized JSON value |
| `data_type` | VARCHAR(20) | NOT NULL | `STRING`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `JSON` |
| `description` | TEXT | NOT NULL | Explanation of parameter behavior |
| `is_public` | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether exposed to client app shell |
| `is_editable` | BOOLEAN | NOT NULL, DEFAULT TRUE | System protection flag |
| `updated_by` | UUID | NULLABLE, FK -> users(id) ON DELETE RESTRICT | Admin who last updated setting |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Update timestamp |
*Partial Unique Indexes (PostgreSQL Compatible):*
- `CREATE UNIQUE INDEX uq_system_settings_global ON system_settings(setting_key) WHERE office_id IS NULL;`
- `CREATE UNIQUE INDEX uq_system_settings_office ON system_settings(office_id, setting_key) WHERE office_id IS NOT NULL;`

#### `asset_documents` (Secure File Attachment Registry)
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Document PK |
| `item_id` | UUID | NULLABLE, FK -> items(id) ON DELETE RESTRICT, INDEX | Linked asset if item-specific |
| `related_entity_type`| VARCHAR(50) | NOT NULL, INDEX | `ITEM`, `RECEIPT`, `MAINTENANCE`, `CONDEMNATION`, `DISPOSAL`, `SUPPLIER_RETURN` |
| `related_entity_id` | UUID | NOT NULL, INDEX | Owning record primary key |
| `file_name` | VARCHAR(255) | NOT NULL | Original uploaded filename |
| `file_path` | VARCHAR(500) | NOT NULL | Sanitized unique storage path on server |
| `file_size` | BIGINT | NOT NULL | File size in bytes |
| `mime_type` | VARCHAR(100) | NOT NULL | Validated MIME type (`application/pdf`, `image/jpeg`, etc.) |
| `document_category` | VARCHAR(50) | NOT NULL | `INVOICE`, `WARRANTY_CARD`, `INSPECTION_PHOTO`, `DISPOSAL_CERTIFICATE`, `CHALLAN` |
| `uploaded_by` | UUID | NOT NULL, FK -> users(id) ON DELETE RESTRICT | Uploading user |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp() | Upload timestamp |

#### `audit_logs` (Append-Only Governance Trail)
| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | Monotonically increasing audit log PK |
| `user_id` | UUID | NULLABLE, FK -> users(id) ON DELETE RESTRICT, INDEX | Actor user (NULL for scheduled system jobs) |
| `username` | VARCHAR(50) | NOT NULL | Actor username snapshot |
| `role_name` | VARCHAR(50) | NOT NULL | Role name at execution time |
| `office_id` | UUID | NULLABLE, FK -> offices(id) ON DELETE RESTRICT, INDEX | Office context |
| `action` | VARCHAR(50) | NOT NULL, INDEX | `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `POST`, `APPROVE`, `REJECT`, `DISPOSE`, `OVERRIDE`, `EXPORT` |
| `module` | VARCHAR(50) | NOT NULL, INDEX | Functional module |
| `record_id` | VARCHAR(100) | NOT NULL, INDEX | Affected record identifier |
| `ip_address` | VARCHAR(45) | NOT NULL | Client IPv4/IPv6 address |
| `user_agent` | VARCHAR(255) | NULLABLE | Client browser/device agent |
| `old_values` | JSONB | NULLABLE | State before modification |
| `new_values` | JSONB | NULLABLE | State after modification |
| `outcome` | VARCHAR(20) | NOT NULL | `SUCCESS` or `FAILURE` |
| `timestamp` | TIMESTAMPTZ | NOT NULL, DEFAULT clock_timestamp(), INDEX | Immutable event timestamp |
