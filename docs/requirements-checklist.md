# Requirements Checklist & Scope Specification
## PS000214 – Dead Stock Inventory Management System
**Organization:** District Development Office – Gir Somnath, Veraval  
**Target User Group:** Officers and Staff of Store Department, District Panchayat, Gir Somnath  

Status Legend:
- ⏳ `PLANNED` (In architecture blueprint, awaiting phase execution)
- 🟡 `IN_PROGRESS` (Active implementation)
- ✅ `VERIFIED` (Implemented with passing automated tests – strictly none until code is built and tested)

---

### Module 01: Application Foundation & Multi-Office Structure
- [ ] **REQ-01.1**: Multi-office database schema support. Initial operational data scoped to Veraval (`OFF-GS-VRV-001`). `PLANNED`
- [ ] **REQ-01.2**: Office Master CRUD (code, name, type, district, taluka, address, status). `PLANNED`
- [ ] **REQ-01.3**: Two-tier office data isolation: database composite foreign keys and independent application-level scope authorization. `PLANNED`
- [ ] **REQ-01.4**: System configuration for default timezone (`Asia/Kolkata`), date format (`DD/MM/YYYY`), currency (`INR / ₹`). `PLANNED`
- [ ] **REQ-01.5**: Centralized API response envelope, pagination, sorting, and health check endpoint (`/api/v1/health`). `PLANNED`

### Module 02: Authentication & Role-Based Access Control (RBAC)
- [ ] **REQ-02.1**: User account management with full name, username, official email, assigned office, status. `PLANNED`
- [ ] **REQ-02.2**: Secure login with JWT access and refresh tokens; rate limiting and lockout on failed attempts. `PLANNED`
- [ ] **REQ-02.3**: Modern password hashing with Argon2/bcrypt; admin-assisted password reset flow. `PLANNED`
- [ ] **REQ-02.4**: Role-based access control with 3 proposed functional roles: System Admin, Store Officer, Store Staff. `PLANNED`
- [ ] **REQ-02.5**: Granular backend permission enforcement on every single API endpoint. `PLANNED`

### Module 03: Executive & Role-Based Dashboards
- [ ] **REQ-03.1**: System Admin Dashboard (`GET /dashboard/admin`) with cross-office KPIs, dead stock chart, pending approvals, recent audit feed. `PLANNED`
- [ ] **REQ-03.2**: Store Officer Dashboard (`GET /dashboard/officer`) with office stock KPIs, discrepancy alerts, pending reviews. `PLANNED`
- [ ] **REQ-03.3**: Store Staff Dashboard (`GET /dashboard/staff`) with operational counts, quick receipt/issue actions, recent transactions. `PLANNED`
- [ ] **REQ-03.4**: Centralized KPI calculation rules excluding disposed items and avoiding double-counting. `PLANNED`
- [ ] **REQ-03.5**: Alerts summary card (`GET /dashboard/alerts-summary`) grouped by type and priority. `PLANNED`

### Module 04: Inventory Database Management & Asset Lifecycle
- [ ] **REQ-04.1**: Dual inventory model: Individually tracked durable assets vs quantity-tracked consumables. `PLANNED`
- [ ] **REQ-04.2**: Unique asset code generation (`AST-GS-VRV-YYYY-XXXXX`) and barcode linkage. `PLANNED`
- [ ] **REQ-04.3**: Comprehensive asset metadata (procurement date, cost, invoice, supplier, condition, location, custodian). `PLANNED`
- [ ] **REQ-04.4**: Support for legacy inventory records with explicit "Not Available" historic supplier/invoice data and physical ledger references. `PLANNED`
- [ ] **REQ-04.5**: Operational statuses: Available, In Use, Under Maintenance, Dispatched to Vendor, Damaged, Non-Functional, Pending Condemnation, Pending Disposal, Disposed. `PLANNED`
- [ ] **REQ-04.6**: Multi-parameter search, filtering, server-side pagination, CSV/XLSX bulk import and export. `PLANNED`

### Module 05: Inventory Movement Ledger: Receipts, Issues, Returns & Transfers
- [ ] **REQ-05.1**: Inventory movement ledger recording physical item movements with traceable voucher numbers. `PLANNED`
- [ ] **REQ-05.2**: Stock Receipt / Inward: PO reference, supplier, line items, cost, balance increment, invoice upload, links to `procurement_items`. `PLANNED`
- [ ] **REQ-05.3**: Stock Issue / Outward: Recipient employee/section, atomic balance check, prevents negative stock via `FOR UPDATE` lock. `PLANNED`
- [ ] **REQ-05.4**: Stock Return linked to original issue transaction and line (`original_transaction_id`, `original_line_id`). `PLANNED`
- [ ] **REQ-05.5**: Safe partial returns and multiple returns validation (`SUM(accepted_returned_quantity) <= issued_quantity`). `PLANNED`
- [ ] **REQ-05.6**: Stock Transfer: Inter-location and inter-office movements with approval and completion stages. `PLANNED`
- [ ] **REQ-05.7**: Offsetting reversal & correction vouchers (`REVERSAL_CORRECTION`). Posted transaction headers and lines are strictly immutable via database trigger. No cascading deletion. `PLANNED`

### Module 06: Item Classification & Dead-Stock Identification
- [ ] **REQ-06.1**: Classification engine evaluating Active, Slow-moving, Non-moving, and Obsolete inventory against category rules. `PLANNED`
- [ ] **REQ-06.2**: Strict precedence rules: Condition (Damaged/Scrap) > Useful Life Lifespan > Inactivity Threshold > Sluggish Movement > Active. `PLANNED`
- [ ] **REQ-06.3**: Category-specific thresholds (`slow_moving_threshold_days` e.g. 90, `inactivity_threshold_days` e.g. 180, `obsolescence_years` e.g. 5). `PLANNED`
- [ ] **REQ-06.4**: Classification review panel with visible factors and authorized manual override with audit remarks. `PLANNED`
- [ ] **REQ-06.5**: Override protection: automated background runs update `calculated_classification` but never overwrite `effective_classification` while `is_overridden = TRUE`. `PLANNED`
- [ ] **REQ-06.6**: Dedicated Dead Stock Register for non-moving and obsolete candidates with review status. `PLANNED`
- [ ] **REQ-06.7**: Strict policy: Automated classification never triggers automatic condemnation or legal disposal. `PLANNED`

### Module 07: Barcode Integration & Physical Verification
- [ ] **REQ-07.1**: Barcode identity generation (Code 128 / QR format) linked to asset record. `PLANNED`
- [ ] **REQ-07.2**: Print-ready barcode/QR label generation layout. `PLANNED`
- [ ] **REQ-07.3**: Barcode lookup/scan API (`POST /api/v1/barcodes/lookup`) with camera scanner support and sub-100ms response time. `PLANNED`
- [ ] **REQ-07.4**: Physical verification session setup (`POST /api/v1/verifications/sessions`) with baseline expected asset snapshot. `PLANNED`
- [ ] **REQ-07.5**: Full scan event logging in `verification_scan_events`, detecting repeated/duplicate scans and unexpected barcodes. `PLANNED`
- [ ] **REQ-07.6**: Standardized verification session routes (`/api/v1/verifications/sessions/{id}/...`). `PLANNED`
- [ ] **REQ-07.7**: Discrepancy reconciliation workflow and formal report archive. `PLANNED`

### Module 08: Supplier, Procurement, Warranties & Supplier Returns (RMA)
- [ ] **REQ-08.1**: Supplier master directory with contact info, GSTIN/PAN, duplicate prevention (`GET/POST /api/v1/suppliers`). `PLANNED`
- [ ] **REQ-08.2**: Procurement orders with line items in `procurement_items` enforcing `quantity_received <= quantity_ordered`. `PLANNED`
- [ ] **REQ-08.3**: Warranty tracking with provider details, start/end dates, and coverage documents (`GET/POST /api/v1/warranties`). `PLANNED`
- [ ] **REQ-08.4**: Supplier Return / RMA tracking (`GET/POST /api/v1/supplier-returns`) with standardized status states. `PLANNED`
- [ ] **REQ-08.5**: Supplier RMA dispatch, carrier tracking, vendor assessment, and resolution recording (replacement, credit note, refund, repair). `PLANNED`

### Module 09: Maintenance, Alerts & Notifications
- [ ] **REQ-09.1**: Maintenance ticket logging with issue description, service provider, estimated/actual cost (`GET/POST /api/v1/maintenance`). `PLANNED`
- [ ] **REQ-09.2**: Asset operational status transition to Under Maintenance and restored post-repair. `PLANNED`
- [ ] **REQ-09.3**: Automated alert generation for non-moving items, warranty expiry (30/60/90 days), maintenance due (`GET/POST /api/v1/alerts`). `PLANNED`
- [ ] **REQ-09.4**: User-targeted in-app notification center (`GET/PATCH /api/v1/notifications`) with read status and unread counter. `PLANNED`

### Module 10: Condemnation, Approval & Disposal Workflow
- [ ] **REQ-10.1**: Condemnation proposal submission with condition assessment, photo evidence, and validation. `PLANNED`
- [ ] **REQ-10.2**: Configurable review and committee approval workflow with separation-of-duties enforcement. `PLANNED`
- [ ] **REQ-10.3**: Disposal execution recording (Auction, Scrap, E-Waste, Buyback, Destruction) with sale proceeds. `PLANNED`
- [ ] **REQ-10.4**: Asset derecognition marking items as Disposed, locking them from active transactions. `PLANNED`
- [ ] **REQ-10.5**: Official Disposal Register with reference orders, proceeds, and certificate uploads. `PLANNED`

### Module 11: Reports, Analytics & Data Export
- [ ] **REQ-11.1**: Current Stock Register (item, category, quantity, location, condition, status). `PLANNED`
- [ ] **REQ-11.2**: Capital Asset Register (asset code, purchase date, cost, supplier, warranty, location, custodian). `PLANNED`
- [ ] **REQ-11.3**: Stock Quantity Report (by item, category, office, location). `PLANNED`
- [ ] **REQ-11.4**: Asset Valuation Report (purchase cost, estimated depreciation, valuation basis). `PLANNED`
- [ ] **REQ-11.5**: Inventory Movement Report (receipts, issues, returns, transfers). `PLANNED`
- [ ] **REQ-11.6**: Dead-Stock Report (classification, age, last movement, condition, recorded value). `PLANNED`
- [ ] **REQ-11.7**: Condemnation Request Report and Disposal Register. `PLANNED`
- [ ] **REQ-11.8**: Supplier/Procurement, Warranty, Maintenance, and Physical Verification Reports. `PLANNED`
- [ ] **REQ-11.9**: Downloadable CSV, XLSX, and printable PDF export with government headers and timestamps. `PLANNED`

### Module 12: Audit Trail, Document Security & System Settings
- [ ] **REQ-12.1**: Append-only immutable audit trail capturing actor, role, action, module, record ID, and old/new JSON diffs. `PLANNED`
- [ ] **REQ-12.2**: Document upload service with MIME validation, anti-path traversal, and permission-checked downloads. `PLANNED`
- [ ] **REQ-12.3**: Reference master data management (categories, units, locations, condition values, disposal methods). `PLANNED`
- [ ] **REQ-12.4**: Configurable system settings schema in `system_settings` with partial unique indexes and global fallback / office override precedence. `PLANNED`
