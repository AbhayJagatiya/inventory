# Known Limitations & Department-Specific Ambiguities
## PS000214 – Dead Stock Inventory Management System
**Organization:** District Development Office – Gir Somnath, Veraval  
**Target User Group:** Officers and Staff of Store Department, District Panchayat, Gir Somnath  

This document logs architectural assumptions, design boundaries, and items requiring administrative confirmation from the District Development Office or Store Department.

---

## 1. Ambiguities & Department Clarification Register

### 1.1 Legal Approval Hierarchy for Condemnation & Disposal
- **Ambiguity:** The Problem Statement (PS000214) identifies the user group as Officers and Staff of the Store Department. However, in Gujarat Panchayat financial operations, condemning government property and sanctioning scrap disposal often requires a statutory Condemnation Board, Survey Committee, or formal sanction by the District Development Officer (DDO) or Taluka Development Officer (TDO) based on value thresholds.
- **Architectural Solution Implemented:** **No unconfirmed designation or approval hierarchy is hard-coded.** The approval hierarchy is dynamically controlled via the `system_settings` table:
  - `approval.condemnation_reviewer_role`: defaults to `STORE_OFFICER`.
  - `approval.condemnation_approver_role`: dynamically configurable (e.g. `SURVEY_COMMITTEE`, `DDO_AUTHORITY`, or `SYSTEM_ADMIN`).
  - `approval.disposal_high_value_threshold`: configurable monetary ceiling (default: ₹100,000.00).
- **Action Required from Department:** Confirm the designation of the final signing authority for write-offs and whether dual approvals (Officer + DDO) are mandatory above specific financial thresholds.

### 1.2 Office Hierarchy & Initial Operational Scope
- **Ambiguity:** The problem description mentions "Panchayat offices across Gir Somnath District" (which spans Patan-Veraval, Talala, Sutrapada, Kodinar, Una, and Gir Gadhada), while the industry client is the District Development Office at Veraval.
- **Architectural Solution Implemented:** The schema enforces multi-tenancy with `office_id` foreign keys, composite constraints (`UNIQUE (id, office_id)`), and row-level authorization scopes across all tables. In strict compliance with project instructions, **operational data is seeded only for Veraval (`OFF-GS-VRV-001`)**. Secondary test office fixtures exist exclusively in test suites to verify isolation.
- **Action Required from Department:** Confirm whether sub-offices (Taluka and Gram Panchayats) should be onboarded in Phase 2 or post-acceptance.

### 1.3 Barcode Label Format & Symbology
- **Ambiguity:** The Problem Statement mandates "Barcode integration" to reduce manual errors, and mentions QR codes as an optional format.
- **Architectural Solution Implemented:** Dual symbology: The system generates standard **Code 128 barcodes** (suitable for handheld 1D optical laser/CCD scanner guns) and **2D QR Codes** (suitable for smartphone/tablet camera scanning via `html5-qrcode`).
- **Action Required from Department:** Confirm whether store rooms will be equipped with physical laser barcode scanners, mobile Android tablets, or both.

### 1.4 Asset Code Prefixes & Physical Ledger References
- **Ambiguity:** Physical dead stock registers in Gujarat Panchayat offices often carry handwritten register page numbers (e.g., "Dead Stock Register Vol-II, Page 45, Item 3").
- **Architectural Solution Implemented:** Standardized system code `AST-GS-VRV-[YEAR]-[SEQ]` is auto-generated for unique digital identity, while a dedicated `legacy_reference_number` field stores historic physical register references.
- **Action Required from Department:** Confirm preferred prefix structure if departmental standards exist.

### 1.5 Asset Valuation & Depreciation Rules
- **Ambiguity:** Government financial reporting requires an Asset Valuation Report, but government accounts typically record assets at historical acquisition cost until condemned, whereas commercial accounting uses Straight-Line or WDV depreciation.
- **Architectural Solution Implemented:** The report presents both historic acquisition cost and straight-line estimated depreciated value (derived from category useful life), with the valuation basis explicitly stated in report headers.
- **Action Required from Department:** Confirm whether straight-line depreciation is acceptable for internal management reporting.

### 1.6 Supplier Return / RMA Handling & Vendor Settlement
- **Ambiguity:** Supplier returns may result in an immediate replacement item, a credit note, a repair, or a cash refund.
- **Architectural Solution Implemented:** A dedicated `supplier_returns` entity tracks the complete RMA lifecycle independently from internal store returns. When dispatched, durable asset custody updates to vendor, and consumable stock moves to `in_vendor_rma_qty`. Upon resolution, appropriate replacement registration, balance restoration, or write-off ledger vouchers are posted.
- **Action Required from Department:** Confirm vendor settlement turnaround policies and standard RMA dispatch documents used by the Panchayat.

---

## 2. Technical Limitations & Operational Boundaries

1. **Local Document Storage Boundary:**
   - In the initial development setup, file attachments (invoices, disposal certificates, damage photos) are stored securely on local disk (`storage/uploads/`) with SHA-256 hash-based paths and MIME validation. The storage abstraction layer can be configured for cloud object storage (S3/MinIO) via environment variables.
2. **Notification Gateways:**
   - In-app notification center is fully operational. External SMS / WhatsApp / SMTP delivery channels are isolated in background workers and configured via `system_settings` (`notifications.channels_enabled`) to avoid blocking operations in offline or intranet networks.
3. **Database Concurrency & Balance Locking:**
   - Stock balance deductions use `SELECT ... FOR UPDATE` row-level locks on `stock_balances` inside PostgreSQL transactions. This eliminates concurrent double-issuance and guarantees `available_qty >= 0`.
4. **Inventory Movement Ledger Immutability:**
   - Posted transaction lines have `ON DELETE RESTRICT` constraints and cannot be deleted or modified. Adjustments must be made via explicit reversal or correction vouchers (`REVERSAL_CORRECTION`).
5. **System Settings Fallback Precedence:**
   - Managed via partial unique indexes. Office-level overrides take precedence over global settings (`office_id IS NULL`).
