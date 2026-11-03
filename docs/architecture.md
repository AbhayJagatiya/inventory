# System Architecture Specification
## PS000214 – Dead Stock Inventory Management System
**Organization:** District Development Office – Gir Somnath, Veraval  
**Target User Group:** Officers and Staff of Store Department, District Panchayat, Gir Somnath  

---

## 1. High-Level Architectural Model

The Dead Stock Inventory Management System is structured as a decoupled, role-governed three-tier enterprise web application:

```text
┌─────────────────────────────────────────────────────────────┐
│                       Client Tier                           │
│  React 18 + Vite + TypeScript + Tailwind CSS (SPA)          │
│  - Role-based Layouts & Guards (Admin, Officer, Staff)      │
│  - Real-Time Barcode/QR Camera Scanner (HTML5-QRCode)       │
│  - Dashboard Analytics & Alert Feeds (Recharts)             │
│  - Form Validation & Dynamic Ledger Tables                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON REST APIs
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application / API Tier                   │
│  FastAPI (Python 3.11+) Asynchronous Service Architecture   │
│  - Dependency Injection (Auth, Permissions, Office Scope)   │
│  - Independent Backend Office-Scope Authorization           │
│  - Inventory Movement Ledger Service (Voucher Lifecycle)    │
│  - Automated Classification Engine (Precedence Evaluator)   │
│  - Barcode Generation & Verification Engine                 │
│  - Supplier RMA / Return Processing Service                 │
│  - Background Alert & Notification Worker                   │
│  - Dynamic System Settings & Configurable Approvals         │
│  - Safe Document Upload & Streaming Service                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ SQLAlchemy 2.0 / asyncpg
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        Data Tier                            │
│  PostgreSQL 15+ Normalized Relational Database              │
│  - Office-Scoped Multi-Tenant Schema (OFF-GS-VRV-001)       │
│  - Composite Foreign Key Constraints for Office Integrity   │
│  - Row-Level Locking (`SELECT ... FOR UPDATE`)              │
│  - Append-Only Movement Ledger & Audit Logs (Triggers)      │
│  - Strict Referential Integrity (`ON DELETE RESTRICT`)       │
│  - Partial Unique Indexes for System Settings               │
│  - Version-Controlled Alembic Migrations                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Key Architecture Principles & Guardrails

### 2.1 Multi-Office Isolation & Defense-in-Depth
Office data isolation is enforced through a two-tiered defense-in-depth model:

1. **Database-Level Composite Integrity**:
   - Master entities (`locations`, `items`, `verification_sessions`, `condemnation_requests`) enforce composite unique keys `(id, office_id)`.
   - Child entities enforce composite foreign keys:
     - `items(location_id, office_id) REFERENCES locations(id, office_id)`
     - `stock_balances(item_id, office_id) REFERENCES items(id, office_id)`
     - `stock_balances(location_id, office_id) REFERENCES locations(id, office_id)`
     - `verification_items(item_id, office_id) REFERENCES items(id, office_id)`
     - `verification_scan_events(session_id, office_id) REFERENCES verification_sessions(id, office_id)`
     - `condemnation_request_items(item_id, office_id) REFERENCES items(id, office_id)`
     - `supplier_returns(item_id, office_id) REFERENCES items(id, office_id)`
   - These constraints make it physically impossible for an item to reference a store room belonging to another office, even if an API bug were introduced.

2. **Application-Level Office-Scope Authorization**:
   - Independent of database constraints, FastAPI security dependencies (`get_current_user`, `require_office_scope`) inspect the authenticated user's assigned `office_id`.
   - All query filters automatically inject `WHERE office_id = current_user.office_id`.
   - All mutation requests assert that the payload `office_id` matches the user's assigned scope.
   - Only users with the explicit `System Admin` role and cross-office permissions can query across offices.

### 2.2 Inventory Movement Ledger & Immutability Architecture
- **Movement Ledger Model:** The system strictly implements an **Inventory Movement Ledger** (recording physical item inflows, outward issues, linked returns, inter-store transfers, RMA movements, and regulated write-offs with traceable transaction vouchers). It tracks physical stock quantities and custody states rather than financial accounting ledger accounts.
- **Ledger Immutability via Database Triggers:**
  - A database trigger (`trg_stock_transactions_immutable`) executes on `BEFORE UPDATE OR DELETE ON stock_transactions`. Once `status = 'POSTED'`, any modification or deletion raises an immediate PostgreSQL exception.
  - A companion trigger (`trg_stock_transaction_lines_immutable`) executes on `BEFORE INSERT OR UPDATE OR DELETE ON stock_transaction_lines`, preventing line mutations on posted vouchers.
  - Transaction lines enforce `ON DELETE RESTRICT`. Cascading deletion is prohibited.
  - Corrections must be performed via explicit `REVERSAL_CORRECTION` vouchers referencing the original transaction ID.
- **Idempotency & Concurrency:**
  - Post requests accept an optional `idempotency_key` to prevent duplicate submissions from network retries.
  - All balance updates execute within an atomic PostgreSQL transaction using `SELECT ... FOR UPDATE` row locks.
  - Database constraint `CHECK (available_qty >= 0)` guarantees negative stock is rejected at the engine level.

### 2.3 System Settings Hierarchy & Fallback Precedence
Settings are stored in the `system_settings` table with partial unique indexes:
- `CREATE UNIQUE INDEX uq_system_settings_global ON system_settings(setting_key) WHERE office_id IS NULL;`
- `CREATE UNIQUE INDEX uq_system_settings_office ON system_settings(office_id, setting_key) WHERE office_id IS NOT NULL;`

When resolving a setting for an office:
```sql
SELECT setting_value 
FROM system_settings 
WHERE (office_id = :office_id OR office_id IS NULL) 
  AND setting_key = :setting_key 
ORDER BY office_id NULLS LAST 
LIMIT 1;
```
This cleanly applies office-level overrides when present, falling back gracefully to system global defaults.

### 2.4 Classification Engine Precedence Rules
Automated classification evaluates items according to a strict precedence order:
1. **Physical Condition:** Items marked `DAMAGED` or `SCRAP` beyond economic repair are classified as **`OBSOLETE`**.
2. **Age & Useful Life:** Items whose age exceeds category `obsolescence_years` AND days inactive exceed `slow_moving_threshold_days` are classified as **`OBSOLETE`**.
3. **Inactivity:** Items inactive for longer than `inactivity_threshold_days` (default: 180 days) are classified as **`NON_MOVING`**.
4. **Sluggish Movement:** Items inactive for longer than `slow_moving_threshold_days` (default: 90 days) are classified as **`SLOW_MOVING`**.
5. **Default:** All other items are classified as **`ACTIVE`**.

*Override Protection:* If an authorized Store Officer records a manual override (`is_overridden = TRUE`), scheduled background runs calculate and record `calculated_classification`, but MUST NOT alter `effective_classification` unless the override is released via an authorized API call.

### 2.5 Supplier Return / RMA Architecture
Vendor returns are managed independently from internal employee returns:
- Inward receipt links to `procurement_items`, validating `quantity_received <= quantity_ordered`.
- Supplier returns create a dedicated `supplier_returns` record.
- When dispatched, durable asset custody updates to the vendor; consumable stock moves from `available_qty` to `in_vendor_rma_qty` in `stock_balances`.
- When resolved (replacement, repair, credit note, refund), appropriate ledger vouchers synchronize physical balances and financial adjustments.

---

## 3. Technology Stack Breakdown

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React + Vite | React 18.3, Vite 5.x | High-performance Single Page Application (SPA) |
| **Language** | TypeScript | 5.x | Strict type safety aligned with OpenAPI schemas |
| **Styling** | Tailwind CSS | 3.4+ | Government enterprise visual theme (Blue, Slate, White) |
| **Routing** | React Router | 6.x | Role-guarded authenticated client navigation |
| **Charts** | Recharts | 2.x | Operational and dead stock distribution dashboards |
| **Barcode Scanning** | html5-qrcode | 2.3+ | Device camera and hardware barcode/QR scanner integration |
| **Backend Framework** | FastAPI | 0.115+ | High-performance asynchronous REST API framework |
| **Data Validation** | Pydantic v2 | 2.8+ | Strict request/response validation and serialization |
| **ORM & Migrations** | SQLAlchemy + Alembic | 2.0+ / 1.13+ | Clean relational mapping and versioned migrations |
| **Database** | PostgreSQL | 15+ | Enterprise ACID-compliant relational persistence |
| **Authentication** | PyJWT + Passlib (Argon2) | Latest | Secure token lifecycle and salted password hashing |
| **Reports Engine** | ReportLab / WeasyPrint | Latest | High-fidelity government PDF generation |
