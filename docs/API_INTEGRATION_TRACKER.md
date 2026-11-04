# Frontend–Backend API Integration Tracker
## PS000214 – Dead Stock Inventory Management System
**Organization:** District Development Office – Gir Somnath, Veraval, Gujarat  
**Frontend Stack:** React 18 + Vite + Tailwind CSS + TanStack Query + React Hook Form + Zod  
**Backend Contract Base URL:** `http://localhost:8000/api/v1` (via `VITE_API_BASE_URL`)  
**Backend Framework:** FastAPI + SQLAlchemy 2.0 + PostgreSQL 16 + Pydantic v2  
**Database Single Source of Truth:** PostgreSQL (Strict Zero Mock Data Policy)  
**Status Legend:**
- 🟢 `Backend Available` – Implemented in FastAPI and mapped to PostgreSQL tables
- 🔵 `Integrated & Live` – Frontend connected directly to FastAPI & PostgreSQL with real CRUD & zero mock data
- 🟣 `Verified & Tested` – Production build verified; live DB persistence verified

---

## 1. Authentication & Profile (`/auth`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Database Source |
|:---|:---|:---|:---|:---|:---|
| `POST` | `/auth/login` | Public | Auth / Login | 🟣 Verified & Live | `users` table via Argon2 password verification |
| `POST` | `/auth/logout` | Authenticated | Shell / Navbar | 🔵 Integrated & Live | Revokes JWT tokens |
| `POST` | `/auth/refresh` | Public | Axios Interceptor | 🔵 Integrated & Live | Exchanges refresh token for new access token |
| `GET` | `/auth/me` | `auth:profile_view` | AuthContext | 🟣 Verified & Live | Loads user permissions, roles & office scope from DB |
| `POST` | `/auth/change-password` | `auth:password_change` | My Profile Page | 🔵 Integrated & Live | Updates Argon2 hash in `users` table |
| `POST` | `/auth/admin-reset-password/{user_id}` | `users:admin_reset` | User Administration | 🔵 Integrated & Live | Admin-assisted password reset in DB |

---

## 2. Role-Based Dashboards (`/reports/dashboard` & `/dashboard`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Database Source |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/reports/dashboard` | `reports:view` | Executive Dashboards | 🟣 Verified & Live | Aggregates from `items`, `condemnation_requests`, `disposals` |
| `GET` | `/dashboard/admin` | `dashboard:admin_view` | Admin Dashboard | 🔵 Integrated & Live | Live PostgreSQL metrics across all stores |
| `GET` | `/dashboard/officer` | `dashboard:officer_view` | Store Officer Dashboard | 🔵 Integrated & Live | Live department/office scoped metrics from DB |
| `GET` | `/dashboard/staff` | `dashboard:staff_view` | Store Staff Dashboard | 🔵 Integrated & Live | Real-time counts of pending items and vouchers |
| `GET` | `/reports/alerts-summary` | `reports:view` | Navbar & Dashboards | 🔵 Integrated & Live | Real-time alert counts from `alerts` table |

---

## 3. Inventory Master & Master Data (`/items`, `/categories`, `/locations`, `/units-of-measure`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Database Source |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/items` | `inventory:view` | Asset Register | 🟣 Verified & Live | Paginated, filtered queries directly from `items` table |
| `POST` | `/items` | `inventory:create` | Add Asset Form | 🟣 Verified & Live | Inserts item into `items` table with auto AST & barcode |
| `GET` | `/items/{id}` | `inventory:view` | Asset 360° Profile | 🟣 Verified & Live | Retrieves item specifications from `items` table |
| `PATCH` | `/items/{id}` | `inventory:edit` | Edit Asset Form | 🟣 Verified & Live | Updates records; prevents edit if `operational_status == 'DISPOSED'` |
| `GET` | `/items/{id}/history` | `inventory:view` | Timeline Tab | 🔵 Integrated & Live | Queries `stock_transactions` and `audit_logs` |
| `POST` | `/items/bulk-import` | `inventory:import` | Import Modal | 🔵 Integrated & Live | CSV/Excel bulk upload directly to `items` table |
| `GET` | `/items/export` | `inventory:export` | Export Action | 🔵 Integrated & Live | CSV export with date & category filters |
| `GET` | `/categories` | `master:categories_view` | Categories | 🟣 Verified & Live | Real rows from `categories` table |
| `POST` | `/categories` | `master:categories_manage` | Category Modal | 🔵 Integrated & Live | Persists lifespan & depreciation rules to DB |
| `GET` | `/locations` | `master:locations_view` | Locations | 🟣 Verified & Live | Real rows from `locations` table |
| `POST` | `/locations` | `master:locations_manage` | Location Modal | 🔵 Integrated & Live | Storage room registry with capacity tracking in DB |
| `GET` | `/units-of-measure` | `inventory:view` | Item Forms | 🔵 Integrated & Live | Standard UOM options from `units_of_measure` table |

---

## 4. Stock Movement Transactions (`/receipts`, `/issues`, `/returns`, `/transfers`, `/transactions`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Database Source |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/transactions` | `stock:receipt_view` | Transactions Ledger | 🟣 Verified & Live | Paginated ledger from `stock_transactions` table |
| `POST` | `/receipts` | `stock:receipt_create` | New Receipt Form | 🟣 Verified & Live | Creates receipt transaction with auto-item registration |
| `POST` | `/receipts/{id}/post` | `stock:receipt_create` | Receipt Action | 🟣 Verified & Live | Increments stock balance & updates `items` table |
| `POST` | `/issues` | `stock:issue_create` | New Issue Form | 🟣 Verified & Live | Creates issue voucher with custodian assignment in DB |
| `POST` | `/issues/{id}/post` | `stock:issue_create` | Issue Action | 🟣 Verified & Live | Decrements stock balance & updates asset status |
| `POST` | `/returns` | `stock:return_create` | New Return Form | 🟣 Verified & Live | Validates and accepts returned items into DB |
| `POST` | `/returns/{id}/post` | `stock:return_create` | Return Action | 🟣 Verified & Live | Restores stock balance & records condition in DB |
| `POST` | `/transfers` | `stock:transfer_req` | New Transfer Form | 🟣 Verified & Live | Creates transfer request between offices in DB |
| `POST` | `/transfers/{id}/approve` | `stock:transfer_app` | Transfer Review | 🟣 Verified & Live | Competent authority sanction stored in DB |
| `POST` | `/transfers/{id}/complete`| `stock:transfer_comp` | Transfer Receipt | 🟣 Verified & Live | Completes transfer and updates asset location in DB |
| `POST` | `/transactions/{id}/reverse`| `stock:receipt_create`| Reversal Action | 🟣 Verified & Live | Creates negative reversal voucher in ledger |

---

## 5. Phase 5 Dead Stock & Verification (`/classifications`, `/barcodes`, `/verifications`, `/condemnations`, `/disposals`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Database Source |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/classifications/summary` | `classify:view` | Classification Hub | 🟣 Verified & Live | Calculated aggregates from `classifications` table |
| `GET` | `/classifications/dead-stock`| `classify:view` | Dead Stock Register | 🟣 Verified & Live | Non-moving & obsolete assets from DB |
| `POST` | `/classifications/run` | `classify:run` | Engine Action | 🟣 Verified & Live | Executes statutory GFR 5-tier classification engine |
| `POST` | `/classifications/{id}/override` | `classify:override` | Override Modal | 🟣 Verified & Live | Persists Store Officer justification to DB |
| `POST` | `/classifications/{id}/release-override`| `classify:override`| Override Modal | 🟣 Verified & Live | Restores engine calculation in DB |
| `POST` | `/barcodes/lookup` | `barcode:scan` | Barcode Lookup | 🟣 Verified & Live | Resolves asset card from `items` table |
| `GET` | `/verifications/sessions` | `verify:view` | Audit Sessions | 🟣 Verified & Live | Lists sessions from `verification_sessions` table |
| `POST` | `/verifications/sessions` | `verify:create` | New Audit Session | 🟣 Verified & Live | Freezes baseline stock snapshot in `verification_items` |
| `POST` | `/verifications/sessions/{id}/scan` | `verify:scan` | Live Scanner | 🟣 Verified & Live | Records scan events in `verification_scans` table |
| `POST` | `/verifications/sessions/{id}/reconcile` | `verify:reconcile`| Discrepancy Tab | 🟣 Verified & Live | Saves discrepancy resolution notes in DB |
| `POST` | `/verifications/sessions/{id}/complete` | `verify:complete` | Finalize & Certify | 🟣 Verified & Live | Locks session and writes certificate to DB |
| `GET` | `/condemnations` | `condemn:view` | Condemnations | 🟣 Verified & Live | Lists proposals from `condemnation_requests` table |
| `POST` | `/condemnations` | `condemn:submit` | New Proposal | 🟣 Verified & Live | Saves multi-item proposal and scrap valuation to DB |
| `POST` | `/condemnations/{id}/decision` | `condemn:approve` | DDO Sanction | 🟣 Verified & Live | Requires Sanction Order Number, updates status in DB |
| `GET` | `/disposals` | `disposal:view` | Disposal Register | 🟣 Verified & Live | Lists records from `disposals` table |
| `POST` | `/disposals` | `disposal:execute` | Execution Modal | 🟣 Verified & Live | Derecognizes assets (`DISPOSED`) and logs proceeds |
