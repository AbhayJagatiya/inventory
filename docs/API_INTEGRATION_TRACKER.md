# Frontend–Backend API Integration Tracker
## PS000214 – Dead Stock Inventory Management System
**Organization:** District Development Office – Gir Somnath, Veraval, Gujarat  
**Frontend Stack:** React 18 + Vite + Tailwind CSS + TanStack Query + React Hook Form + Zod  
**Backend Contract Base URL:** `http://localhost:8000/api/v1` (via `VITE_API_BASE_URL`)  
**Status Legend:**
- 🔴 `Not Started` – Contract defined, awaiting backend implementation
- 🟡 `Requested from Backend Developer` – Frontend mock ready, requested backend endpoint
- 🟢 `Available` – Backend endpoint reported live
- 🔵 `Integrated` – Frontend API client connected to backend
- 🟣 `Tested` – End-to-end verified with status codes & validation
- ⛔ `Blocked` – Defect, CORS, or schema mismatch blocking workflow

---

## 1. Authentication & Profile (`/auth`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Notes / Blockers |
|:---|:---|:---|:---|:---|:---|
| `POST` | `/auth/login` | Public | Auth / Login | 🟡 Requested from Backend Developer | Frontend form with Zod validation ready |
| `POST` | `/auth/logout` | Authenticated | Shell / Navbar | 🟡 Requested from Backend Developer | Clears local JWT tokens on client regardless |
| `POST` | `/auth/refresh` | Public | Axios Interceptor | 🟡 Requested from Backend Developer | Auto-retry on 401 response |
| `GET` | `/auth/me` | `auth:profile_view` | AuthContext | 🟡 Requested from Backend Developer | Loads user permissions & office scope |
| `POST` | `/auth/change-password` | `auth:password_change` | My Profile Page | 🟡 Requested from Backend Developer | Validates current password and min. 8 chars |
| `POST` | `/auth/admin-reset-password/{user_id}` | `users:admin_reset` | User Administration | 🟡 Requested from Backend Developer | Admin-assisted reset only |

---

## 2. Role-Based Dashboards (`/dashboard`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Notes / Blockers |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/dashboard/admin` | `dashboard:admin_view` | Admin Dashboard | 🟡 Requested from Backend Developer | Executive cross-office KPIs & chart breakdown |
| `GET` | `/dashboard/officer` | `dashboard:officer_view` | Store Officer Dashboard | 🟡 Requested from Backend Developer | Scoped to assigned office; status breakdown |
| `GET` | `/dashboard/staff` | `dashboard:staff_view` | Store Staff Dashboard | 🟡 Requested from Backend Developer | Operational counts & user's daily activity |
| `GET` | `/dashboard/alerts-summary` | `alerts:view` | Navbar & Dashboards | 🟡 Requested from Backend Developer | Polled every 60s for unread badge |

---

## 3. Inventory Master & Master Data (`/items`, `/categories`, `/locations`, `/units-of-measure`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Notes / Blockers |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/items` | `inventory:view` | Asset Register | 🔵 Integrated | Paginated list with multi-column filters & fallback mock |
| `POST` | `/items` | `inventory:create` | Add Asset Form | 🔵 Integrated | Generates `item_code` and barcode string |
| `GET` | `/items/{id}` | `inventory:view` | Asset 360° Profile | 🔵 Integrated | Comprehensive specs, location, custodian, timeline |
| `PATCH` | `/items/{id}` | `inventory:edit` | Edit Asset Form | 🔵 Integrated | Blocked if status is `DISPOSED` |
| `GET` | `/items/{id}/history` | `inventory:view` | Timeline Tab | 🔵 Integrated | Chronological movement ledger |
| `POST` | `/items/bulk-import` | `inventory:import` | Import Modal | 🟡 Requested from Backend Developer | Multipart CSV/XLSX validation preview |
| `GET` | `/items/export` | `inventory:export` | Export Action | 🟡 Requested from Backend Developer | Streaming file download |
| `GET` | `/categories` | `master:categories_view` | Categories | 🔵 Integrated | Tree list with threshold parameters & edit modal |
| `POST` | `/categories` | `master:categories_manage` | Category Modal | 🔵 Integrated | Thresholds & depreciation rate |
| `GET` | `/locations` | `master:locations_view` | Locations | 🔵 Integrated | Store rooms scoped by office & edit modal |
| `GET` | `/units-of-measure` | `inventory:view` | Item Forms | 🔵 Integrated | UOM dropdown options |

---

## 4. Stock Movement Transactions (`/transactions`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Notes / Blockers |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/transactions/receipts` | `stock:receipt_view` | Receipts Register | 🔵 Integrated | Filter by status (`DRAFT`, `POSTED`), search, pagination |
| `POST` | `/transactions/receipts` | `stock:receipt_create` | New Receipt Form | 🔵 Integrated | Supports multi-line goods inward with accepted/rejected split |
| `GET` | `/transactions/receipts/{id}` | `stock:receipt_view` | Receipt Details | 🔵 Integrated | Item breakdown, serial numbers, print GRN |
| `POST` | `/transactions/receipts/{id}/post` | `stock:receipt_create` | Receipt Action | 🔵 Integrated | Atomically updates stock; prevents duplicate posting |
| `GET` | `/transactions/issues` | `stock:issue_view` | Issue Register | 🔵 Integrated | Departmental issue vouchers list with search |
| `POST` | `/transactions/issues` | `stock:issue_create` | New Issue Form | 🔵 Integrated | Validates against available stock balance; updates custodian |
| `GET` | `/transactions/issues/{id}` | `stock:issue_view` | Issue Details | 🔵 Integrated | Custodian sign-off slip & gate pass print |
| `GET` | `/transactions/returns` | `stock:return_view` | Return Register | 🔵 Integrated | Inspection condition breakdown & maintenance flags |
| `POST` | `/transactions/returns` | `stock:return_create` | New Return Form | 🔵 Integrated | Linked to issue; prevents returning more than unreturned qty |
| `GET` | `/transactions/returns/{id}` | `stock:return_view` | Return Details | 🔵 Integrated | Linked issue back-reference & condition inspection record |
| `GET` | `/transactions/transfers` | `stock:transfer_view` | Transfer Register | 🔵 Integrated | Inter-office transfer tracking with status filter |
| `POST` | `/transactions/transfers` | `stock:transfer_req` | New Transfer Form | 🔵 Integrated | Permanent vs Temporary loan with expected return date |
| `GET` | `/transactions/transfers/{id}` | `stock:transfer_view` | Transfer Lifecycle | 🔵 Integrated | 4-stage stepper: Submitted ➔ Approved ➔ In Transit ➔ Completed |
| `POST` | `/transactions/transfers/{id}/approve` | `stock:transfer_app` | Transfer Review | 🔵 Integrated | Approves or rejects transfer request |
| `POST` | `/transactions/transfers/{id}/dispatch`| `stock:transfer_req` | Dispatch Action | 🔵 Integrated | Sets `IN_TRANSIT` with carrier, waybill, and vehicle number |
| `POST` | `/transactions/transfers/{id}/complete`| `stock:transfer_comp` | Transfer Receipt | 🔵 Integrated | Destination arrival confirmation; updates asset location |
| `GET` | `/transactions` | `stock:receipt_view` | Unified Ledger | 🔵 Integrated | Chronological history of receipts, issues, returns, transfers |

---

## 5. Dead Stock & Condemnation Workflow (`/classifications`, `/condemnations`, `/disposals`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Notes / Blockers |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/classifications/summary` | `classify:view` | Classification Hub | 🔴 Not Started (Phase 5) | Active/Slow/Non-moving/Obsolete counts |
| `GET` | `/classifications/dead-stock` | `classify:view` | Dead Stock Register | 🔴 Not Started (Phase 5) | Official register of dead inventory |
| `POST` | `/classifications/run` | `classify:run` | Engine Action | 🔴 Not Started (Phase 5) | On-demand background evaluation |
| `POST` | `/classifications/{id}/override` | `classify:override` | Override Modal | 🔴 Not Started (Phase 5) | Authorized manual classification override |
| `GET` | `/condemnations` | `condemn:view` | Condemnations | 🔴 Not Started (Phase 5) | Survey committee proposals |
| `POST` | `/condemnations` | `condemn:submit` | New Proposal | 🔴 Not Started (Phase 5) | Sets status to `PENDING_CONDEMNATION` |
| `POST` | `/condemnations/{id}/decision` | `condemn:approve` | Sanction Modal | 🔴 Not Started (Phase 5) | Configurable approver authority |
| `GET` | `/disposals` | `disposal:view` | Disposal Register | 🔴 Not Started (Phase 5) | Regulated disposal history |
| `POST` | `/disposals` | `disposal:execute` | Execution Modal | 🔴 Not Started (Phase 5) | Writes off asset, sets `DISPOSED` |

---

## 6. Identification & Physical Verification (`/barcodes`, `/verifications`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Notes / Blockers |
|:---|:---|:---|:---|:---|:---|
| `POST` | `/barcodes/lookup` | `barcode:scan` | Scanner Screen | 🔴 Not Started (Phase 6) | Optical and laser barcode resolver |
| `GET` | `/barcodes/{id}/label` | `barcode:print` | Print Preview | 🔴 Not Started (Phase 6) | SVG/PDF Code 128 & QR label format |
| `GET` | `/verifications/sessions` | `verify:view` | Audit Sessions | 🔴 Not Started (Phase 6) | Physical stocktaking sessions |
| `POST` | `/verifications/sessions/{id}/scan` | `verify:scan` | Live Audit Scanner | 🔴 Not Started (Phase 6) | Detects duplicates & unexpected items |
| `POST` | `/verifications/sessions/{id}/reconcile`| `verify:reconcile`| Reconciliation | 🔴 Not Started (Phase 6) | Store Officer records resolution |

---

## 7. Supporting Modules (`/suppliers`, `/procurements`, `/supplier-returns`, `/warranties`, `/maintenance`, `/alerts`, `/notifications`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Notes / Blockers |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/suppliers` | `supplier:view` | Supplier Directory | 🔴 Not Started (Phase 6) | GSTIN duplicate checks |
| `GET` | `/procurements` | `supplier:view` | Purchase Orders | 🔴 Not Started (Phase 6) | Links PO lines to stock receipts |
| `GET` | `/supplier-returns` | `supplier:rma_view` | Vendor RMA Returns | 🔴 Not Started (Phase 6) | Independent from internal returns |
| `GET` | `/warranties` | `warranty:view` | Warranty Watch | 🔴 Not Started (Phase 6) | 30/60/90 day expiry tracking |
| `GET` | `/maintenance` | `maintenance:view` | Repair Tickets | 🔴 Not Started (Phase 6) | Cumulative repair cost tracking |
| `GET` | `/alerts` | `alerts:view` | Alerts Center | 🔴 Not Started (Phase 6) | Acknowledge, resolve, snooze |
| `GET` | `/notifications` | Authenticated | Notification Feed | 🔴 Not Started (Phase 6) | User's in-app feed |

---

## 8. Governance & Reports (`/reports`, `/users`, `/roles`, `/offices`, `/settings`, `/audit`)

| Method | Endpoint | Required Permission | Frontend Module | Integration Status | Notes / Blockers |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/reports/*` | `reports:view` | Reports Catalogue | 🔴 Not Started (Phase 7) | 12 statutory registers |
| `POST` | `/reports/generate-export` | `reports:export` | Export Modal | 🔴 Not Started (Phase 7) | Streaming CSV/XLSX/PDF |
| `GET` | `/users` | `users:view` | User Management | 🔴 Not Started (Phase 7) | Personnel administration |
| `GET` | `/roles` | `roles:view` | RBAC Matrix | 🔴 Not Started (Phase 7) | Granular permission governance |
| `GET` | `/offices` | `offices:view` | Office Management | 🔴 Not Started (Phase 7) | Initial Veraval seed |
| `GET` | `/settings` | `settings:view` | System Settings | 🔴 Not Started (Phase 7) | Thresholds & workflow mappings |
| `GET` | `/audit/logs` | `audit:view` | Audit Trail | 🔴 Not Started (Phase 7) | Append-only security logs with JSON diffs |

