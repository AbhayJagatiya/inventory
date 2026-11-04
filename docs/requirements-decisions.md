# Requirements Decisions & Reconciliation Register
## PS000214 – Dead Stock Inventory Management System
**Organization:** District Development Office – Gir Somnath, Veraval  
**Target User Group:** Officers and Staff of Store Department, District Panchayat, Gir Somnath  

This document logs all reconciliations, architectural alignments, and material decisions made across the authoritative specifications:
- `PS000214_Complete_Backend_Features_Specification.pdf`
- `docs/requirements-checklist.md`
- `docs/architecture.md`
- `docs/database-design.md`
- `docs/api-contract.md`
- `docs/role-permissions-matrix.md`
- `docs/workflows.md`
- `docs/feature-traceability-matrix.md`
- `docs/known-limitations.md`

---

## 1. Summary of Requirements Reconciliation

| Topic | Source Documents Comparison | Approved Reconciliation Decision | Rationale |
| :--- | :--- | :--- | :--- |
| **API Route Naming for Stock Transactions** | `PS000214 PDF` (p. 17) suggests `/receipts`, `/issues`, `/returns`, `/transfers`. `docs/api-contract.md` (p. 6-7) groups them under `/transactions/receipts`, `/transactions/issues`, `/transactions/returns`, `/transactions/transfers`. | Implement primary routes under `/api/v1/transactions/...` and configure route aliases for `/api/v1/receipts`, `/api/v1/issues`, `/api/v1/returns`, `/api/v1/transfers`. | Ensures 100% compliance with both the detailed API contract and any client expecting the short resource paths. |
| **Condemnation Endpoint Path** | `PS000214 PDF` uses `/condemnation-requests`. `docs/api-contract.md` specifies `/condemnations`. | Primary routes at `/api/v1/condemnations`, with route aliases at `/api/v1/condemnation-requests`. | Avoids breaking client integrations regardless of which documentation document they reference. |
| **Verification Session Route Path** | `PS000214 PDF` uses `/verification-sessions`. `docs/api-contract.md` specifies `/verifications/sessions`. | Primary routes at `/api/v1/verifications/sessions`, with route aliases for `/api/v1/verification-sessions`. | Consistent nesting under module namespaces while supporting the PDF catalogue format. |
| **Supplier Returns / RMA Route Path** | `PS000214 PDF` describes RMA under Supplier & Procurement. `docs/api-contract.md` uses `/api/v1/supplier-returns`. | Route `/api/v1/supplier-returns` with full RMA state lifecycle (`INITIATED` -> `DISPATCHED_TO_VENDOR` -> `UNDER_VENDOR_ASSESSMENT` -> resolution). | Adheres to `api-contract.md` and preserves clear separation between internal store returns and vendor RMA. |
| **Authentication & Password Reset Endpoints** | `PS000214 PDF` includes `/auth/forgot-password`, `/auth/reset-password`. `docs/api-contract.md` includes `/auth/change-password`, `/auth/admin-reset-password/{user_id}`. | Implement `/auth/change-password`, `/auth/admin-reset-password/{user_id}`, as well as `/auth/forgot-password` and `/auth/reset-password`. | Fully covers both self-service password changes and admin-assisted password reset flows. |
| **Nature of the Stock Ledger** | `PS000214 PDF` and `docs/architecture.md` emphasize physical stock movements. | The ledger is strictly an **Inventory Movement Ledger** tracking physical quantities, custodians, and locations with immutable vouchers, NOT a double-entry debit/credit financial accounting ledger. | Government store management requires traceable stock vouchers, physical location balances, and custody attribution. Financial valuation is calculated as a derived report. |
| **Condemnation Approval Authority** | Neither PS nor government rules confirm that `SYSTEM_ADMIN` is the legal write-off authority. | Approval authority is dynamic and resolved from `system_settings` (`approval.condemnation_approver_role`), with default to `STORE_OFFICER` for review and configurable approval role. | Never hardcode legal authority; allows Panchayat to assign approval to a Survey Committee, DDO, or designated officer without code refactoring. |
| **Classification Engine Precedence** | 5-tier precedence defined across `docs/architecture.md`, `docs/database-design.md`, and `docs/workflows.md`. | Strictly enforce the 5 tiers: 1. Condition (DAMAGED/SCRAP -> OBSOLETE); 2. Useful Life + Inactivity -> OBSOLETE; 3. Inactivity >= 180 days -> NON_MOVING; 4. Inactivity >= 90 days -> SLOW_MOVING; 5. Default -> ACTIVE. | Prevents arbitrary or hard-coded rules and ensures consistent classification calculation across reports. |
| **Manual Override vs Scheduled Classification** | When a Store Officer records an override (`is_overridden = TRUE`). | Scheduled background job updates `calculated_classification` and `contributing_factors`, but MUST NOT alter `effective_classification`. | Preserves administrative human review while maintaining algorithmic calculation history. |
| **Office Scoping & Tenant Isolation** | `PS000214` specifies District Panchayat, Gir Somnath, Veraval. | Multi-office ready schema with composite foreign keys `(id, office_id)`. Initial seed strictly limited to Veraval (`OFF-GS-VRV-001`). Application authorization enforces office boundaries. | Prevents cross-office data leakage and avoids creating fake production offices. |

---

## 2. Technical Stack & Driver Selection

- **Python Version**: Python 3.11.9
- **Web Framework**: FastAPI 0.115+
- **Data Validation & Serialization**: Pydantic v2
- **ORM & Migrations**: SQLAlchemy 2.0+ & Alembic 1.20+
- **Database Engine**: PostgreSQL 18 (Running on localhost:5432)
- **Database Connector**: `psycopg2-binary` (Synchronous sessions with connection pooling, compatible with Alembic and FastAPI dependencies) and `asyncpg` support
- **Password Hashing**: `argon2-cffi`
- **Token Security**: `PyJWT` (RS256/HS256 with expiration, refresh token lifecycle, and revocation tracking)
- **Reporting & Export**: `openpyxl` (XLSX), Python CSV (CSV), `reportlab` (PDF)
- **Barcode & QR Generation**: Python-based SVG/PNG barcode rendering (Code 128) and QR code generation compatible with `html5-qrcode`

---

## 3. Database Integrity & Immutability Rules

1. **Immutable Posted Transactions**:
   - `stock_transactions` and `stock_transaction_lines` cannot be modified or deleted once `status = 'POSTED'`.
   - Database triggers enforce this at the PostgreSQL engine level.
   - Adjustments must be performed using explicit `REVERSAL_CORRECTION` vouchers referencing `original_transaction_id`.
2. **Atomic Row-Level Locking**:
   - Outward stock issues, returns, and RMA balance adjustments execute within database transactions using `SELECT ... FOR UPDATE` on `stock_balances`.
   - Check constraint `CHECK (available_qty >= 0)` prevents negative stock at the engine level.
3. **Composite Foreign Keys**:
   - `items(location_id, office_id) REFERENCES locations(id, office_id)`
   - `stock_balances(item_id, office_id) REFERENCES items(id, office_id)`
   - `stock_balances(location_id, office_id) REFERENCES locations(id, office_id)`
   - `verification_items(item_id, office_id) REFERENCES items(id, office_id)`
   - `verification_scan_events(session_id, office_id) REFERENCES verification_sessions(id, office_id)`
   - `condemnation_request_items(item_id, office_id) REFERENCES items(id, office_id)`
   - `supplier_returns(item_id, office_id) REFERENCES items(id, office_id)`
4. **Partial Unique Indexes for System Settings**:
   - `uq_system_settings_global` on `(setting_key) WHERE office_id IS NULL`
   - `uq_system_settings_office` on `(office_id, setting_key) WHERE office_id IS NOT NULL`
   - Resolution order: `ORDER BY office_id NULLS LAST LIMIT 1` (office override falls back to global default).

