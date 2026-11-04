# Phase 5 – Dead Stock Identification, Physical Verification, Condemnation and Disposal
## Frontend Handoff & Full-Stack Integration Document

**Project:** PS000214 – Web-Based Dead Stock Inventory Management System  
**Organization:** District Panchayat, Gir Somnath, Veraval, Gujarat  
**Frontend Path:** `d:\seva\inventory\frontend`  
**Backend Path:** `d:\seva\inventory\backend`  

---

## 1. Phase 5 Overview & Scope

Phase 5 implements the core statutory mandate of PS000214: identifying, auditing, condemning, and derecognizing dead stock, unserviceable assets, and obsolete equipment across Panchayat stores.

All modules in this phase are implemented according to **Full-Stack Production Standards**:
* **100% Real Backend Integration:** Connected directly to FastAPI REST endpoints and PostgreSQL tables (`classifications`, `verification_sessions`, `verification_items`, `verification_scan_events`, `condemnation_requests`, `condemnation_request_items`, `disposals`, `disposal_items`).
* **Zero Mock Data in Application Functionality:** When PostgreSQL is connected, all records are stored and queried live. Proper Empty and Error states are rendered when no records exist or backend is unreachable.
* **Preserved UI/UX Identity:** Strict adherence to Deep Forest Teal, Dark Emerald, and Mint glassmorphism tokens with full Light and Dark mode toggling.

---

## 2. Delivered Modules & Page Routes

| Module | Route | Page Component | Backend Endpoint | Status |
|:---|:---|:---|:---|:---:|
| **Dead Stock Classification Engine** | `/dead-stock` | `ClassificationOverviewPage.jsx` | `GET /api/v1/classifications/summary`<br/>`POST /api/v1/classifications/run` | **Completed** |
| **Official Dead Stock Register** | `/dead-stock/register` | `DeadStockRegisterPage.jsx` | `GET /api/v1/classifications/dead-stock`<br/>`POST /api/v1/classifications/{id}/override`<br/>`POST /api/v1/classifications/{id}/release-override` | **Completed** |
| **Asset Barcode Scanner & Lookup** | `/verification/lookup` | `BarcodeLookupPage.jsx` | `POST /api/v1/barcodes/lookup` | **Completed** |
| **Physical Stock Verification Sessions** | `/verification/sessions` | `VerificationSessionListPage.jsx` | `GET /api/v1/verifications/sessions`<br/>`POST /api/v1/verifications/sessions` | **Completed** |
| **Discrepancy Workspace & Audit Finalization** | `/verification/sessions/:id` | `VerificationSessionDetailPage.jsx` | `GET /api/v1/verifications/sessions/{id}`<br/>`GET /api/v1/verifications/sessions/{id}/items`<br/>`GET /api/v1/verifications/sessions/{id}/scans`<br/>`POST /api/v1/verifications/sessions/{id}/scan`<br/>`POST /api/v1/verifications/sessions/{id}/reconcile`<br/>`POST /api/v1/verifications/sessions/{id}/complete` | **Completed** |
| **Condemnation Proposals Register** | `/dead-stock/condemnations` | `CondemnationListPage.jsx` | `GET /api/v1/condemnations`<br/>`POST /api/v1/condemnations` | **Completed** |
| **Condemnation Sanction Dossier** | `/dead-stock/condemnations/:id` | `CondemnationDetailPage.jsx` | `GET /api/v1/condemnations/{id}`<br/>`POST /api/v1/condemnations/{id}/review`<br/>`POST /api/v1/condemnations/{id}/decision` | **Completed** |
| **Regulated Disposal & Scrap Ledger** | `/dead-stock/disposals` | `DisposalRegisterPage.jsx` | `GET /api/v1/disposals`<br/>`POST /api/v1/disposals` | **Completed** |

---

## 3. Statutory Business Rules Enforced

1. **Rule Precedence Evaluation:**
   * Precedence 1: Physical condition (`DAMAGED`, `SCRAP` ➔ `OBSOLETE`).
   * Precedence 2: Obsolescence lifespan (`age >= obsolescence_years` AND inactive &gt;= slow-moving threshold ➔ `OBSOLETE`).
   * Precedence 3: Non-moving threshold (`days_inactive >= inactivity_threshold_days` ➔ `NON_MOVING`).
   * Precedence 4: Sluggish movement (`days_inactive >= slow_moving_threshold_days` ➔ `SLOW_MOVING`).
   * Precedence 5: Active stock (`ACTIVE`).
2. **Authorized Officer Overrides:**
   * Automated classifications are advisory statutory indicators.
   * Store Officers can override classifications with mandatory justification (recorded in `override_reason` with user timestamp).
   * Overrides can be formally released to revert back to algorithmic calculation.
3. **Physical Verification Integrity:**
   * Session initialization freezes expected stock snapshot into `verification_items`.
   * Real-time scan events detect repeated/duplicate barcode scans (`is_duplicate_scan = True`) to prevent double-counting.
   * Discrepancies (`LOCATION_MISMATCH`, `CONDITION_MISMATCH`, `NOT_FOUND`, `UNEXPECTED_ITEM`) require formal officer resolution before session sealing.
4. **Separation of Duties in Condemnation:**
   * Store staff/officers submit condemnation proposals.
   * Sanction authorities (DDO / Competent Authority) review technical inspection and issue formal administrative sanction order numbers.
   * On approval, item status in PostgreSQL updates to `PENDING_DISPOSAL`.
5. **Regulated Disposal Execution & Write-Off:**
   * Disposals require an approved condemnation order.
   * Executing disposal commits a `DISPOSAL_WRITEOFF` transaction, records buyer/challan details, sets item status to `DISPOSED`, and permanently locks the asset from future store movements.

---

## 4. Build & Regression Verification

* **Frontend Build (`npm run build`):** Transformed all 2,749 modules with **0 errors**.
* **Theme Audit:** Verified across all 8 pages in both Light mode and Dark mode.

