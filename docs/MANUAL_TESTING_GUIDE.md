# PS000214: Dead Stock Inventory Management System
## Complete Manual Testing Guide & Acceptance Verification Protocol
**Target Organization:** District Development Office – Gir Somnath, Veraval, Gujarat  
**Hackathon:** Seva First Innovation Challenge (SFIC) 2026–27  
**System Scope:** Frontend Verification Protocol (Phases 1–3 Implemented; Phases 4–11 Structured Roadmaps)  
**Document Location:** `d:\seva\inventory\docs\MANUAL_TESTING_GUIDE.md`  

---

## 1. Environment Setup & Server Execution

### 1.1 Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ LTS recommended)
- **Package Manager:** `npm` (v9.0.0 or higher)
- **Web Browser:** Google Chrome, Microsoft Edge, or Mozilla Firefox (latest desktop release)
- **Operating System:** Windows 10/11, Linux, or macOS

### 1.2 How to Start the Frontend Development Server
Open PowerShell or your command terminal and execute:

```powershell
# Navigate to the frontend directory
Set-Location "d:\seva\inventory\frontend"

# (Optional - only required if packages are not installed)
# npm install --legacy-peer-deps

# Launch the local Vite development server
npm run dev
```

The terminal will report:
```text
  VITE v5.4.21  ready in ~350 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

Open your browser and navigate to: **`http://localhost:5173/`**

### 1.3 How to Stop the Development Server
In the PowerShell/terminal window running Vite:
- Press `Ctrl + C`
- When prompted `Terminate batch job (Y/N)?`, type `Y` and hit `Enter`.

### 1.4 How to Verify the Production Build
To test the exact production bundle as it will be deployed on government intranet servers:
```powershell
Set-Location "d:\seva\inventory\frontend"

# Compile production bundle
npm run build

# Preview production build locally
npm run preview
```
Open **`http://localhost:4173/`** in your browser.

### 1.5 Backend Connectivity & Offline Demo Mode
- **If the FastAPI backend is running on `http://localhost:8000`:** The frontend communicates with live REST endpoints via JWT Bearer tokens.
- **If the FastAPI backend is NOT running (Port 8000 offline):** The frontend automatically activates **Demo Mode**. All authentication requests, asset queries, category lookups, and location lists will gracefully fall back to local in-memory fixtures. An amber pill `⚠️ DEMO MODE (Backend Offline)` will appear in the top navigation bar.

---

## 2. Demo Credentials & Proposed Role Matrix

The frontend includes 3 pre-configured demo personas representing the operational hierarchy at Gir Somnath District Panchayat:

| Role Identifier | Role Title | Email / Username | Default Password | Primary Scope & Access Rights |
|:---|:---|:---|:---|:---|
| **`SYSTEM_ADMIN`** | System Administrator | `admin@girsomnath.gov.in` | `Admin@12345` | Global governance, office setup, user accounts, audit trails, master taxonomy. |
| **`STORE_OFFICER`** | Store Officer (Supervisory) | `officer@girsomnath.gov.in` | `Officer@12345` | Inventory supervision, discrepancy review, disposal sanctioning, classification reviews. |
| **`STORE_STAFF`** | Store Staff (Operator) | `staff@girsomnath.gov.in` | `Staff@12345` | Item data entry, stock inward receipts, issues, returns, Excel bulk uploads, physical scans. |

> **Pro Tip:** On the Login page (`/login`), click any of the 3 quick-fill pill buttons (`System Admin`, `Store Officer`, `Store Staff`) to auto-populate credentials instantly.

---

## 3. Implementation Status Classification Key

Every test case in this manual is labeled with one of the following implementation statuses:

- 🟢 **`Fully Functional (Client)`** – Complete UI interactivity, client-side validation, React state updates, local modal actions, and dynamic route rendering working in the browser.
- 🟡 **`Mock / Offline Demo`** – Interacting with local in-memory fixture data because the independent FastAPI backend is offline. Changes persist in React Query cache during the session.
- 🔵 **`Backend-Dependent`** – Dispatches real Axios HTTP requests to `VITE_API_BASE_URL` (`http://localhost:8000/api/v1`). Full end-to-end database persistence requires the companion FastAPI server.
- 🟠 **`Phase Placeholder (Structured)`** – Clean, informative placeholder page displaying planned module roadmaps, target API endpoints, and feature specifications (Phases 4–11).
- 🔴 **`Not Implemented`** – Feature not yet scheduled or engineered.

---

## 4. Manual Test Cases

---

### Module 1: Authentication & Session Management

#### TC-AUTH-01: Valid Login via Role Quick-Fill Pills
- **Page/Module:** Authentication (`/login`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo`
- **Navigation:** Open `http://localhost:5173/login`
- **Steps:**
  1. Click the blue pill button labeled **`Store Officer`**.
  2. Observe the Email field auto-populating with `officer@girsomnath.gov.in` and Password with `Officer@12345`.
  3. Click the **`Sign In to Store Department`** button.
- **Expected Result:**
  - Login button shows a loading spinner briefly.
  - Toast notification appears: *"Login successful. Welcome back, Rajesh Kumar!"*
  - User is redirected to `/dashboard` (which renders the Store Officer Dashboard).
  - Top navigation bar displays: User avatar "RK", name "Rajesh Kumar", role badge "Store Officer", and office "District Panchayat Central Store, Veraval".
- **Failure Indicators:** Page stays on `/login`, form shows Zod validation error, or uncaught console error.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-AUTH-02: Form Validation on Invalid Login Inputs
- **Page/Module:** Authentication (`/login`)
- **Status:** 🟢 `Fully Functional (Client)`
- **Navigation:** Open `http://localhost:5173/login`
- **Steps:**
  1. Leave Email and Password fields blank.
  2. Click **`Sign In to Store Department`**.
  3. Enter `invalid-email-format` in Email and `123` in Password.
  4. Click **`Sign In to Store Department`**.
- **Expected Result:**
  - On empty submit: Red error text *"Email address is required"* and *"Password is required"*.
  - On invalid format: Red error text *"Please enter a valid government email address"* and *"Password must be at least 6 characters"*.
  - Submission is halted before dispatching network request.
- **Failure Indicators:** Form submits anyway or page crashes.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-AUTH-03: Offline Demo Banner & Transparency Notice
- **Page/Module:** Authentication (`/login`) & Navbar
- **Status:** 🟢 `Fully Functional (Client)`
- **Navigation:** Open `http://localhost:5173/login`
- **Steps:**
  1. Inspect the bottom of the login card.
  2. Verify the presence of the blue notice box titled *"Demonstration & Evaluation Environment"*.
  3. Log in as any user and inspect the top navigation bar.
- **Expected Result:**
  - Login card clearly states that mock credentials are for frontend evaluation only and that real production security uses FastAPI Argon2 password hashing.
  - When backend is offline, the Navbar displays a persistent amber badge: `⚠️ DEMO MODE (Backend Offline)`.
- **Failure Indicators:** No indication of demo mode; user misled into thinking mock credentials constitute production security.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-AUTH-04: Forgot Password Policy Page
- **Page/Module:** Authentication (`/forgot-password`)
- **Status:** 🟢 `Fully Functional (Client)`
- **Navigation:** From `/login`, click the *"Forgot your password?"* link.
- **Steps:**
  1. Verify the information displayed on the screen.
  2. Click the **`Return to Sign In`** button.
- **Expected Result:**
  - Displays official government security notice: *"Password Reset Policy: Self-service email password reset is restricted under District Panchayat Store Security Guidelines."*
  - Provides official contact details for Veraval System Administrator (`admin@girsomnath.gov.in`).
  - Clicking "Return to Sign In" returns user to `/login`.
- **Failure Indicators:** Displays a generic insecure password reset input box.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-AUTH-05: User Logout & Session Cleardown
- **Page/Module:** Shell Layout / Navbar (`/dashboard`)
- **Status:** 🟢 `Fully Functional (Client)`
- **Navigation:** Log in to `/dashboard`.
- **Steps:**
  1. Look at the top-right corner of the Navbar.
  2. Click the **`Sign Out`** icon button (door icon with arrow).
- **Expected Result:**
  - Toast notification: *"You have been signed out."*
  - Session state and JWT tokens in `localStorage` are purged.
  - Browser redirects immediately to `/login`.
  - Pressing the browser's Back button does not allow re-entry into protected routes.
- **Failure Indicators:** User remains on dashboard or tokens remain valid in storage.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-AUTH-06: Protected Route Guard & Deep Linking
- **Page/Module:** Router (`/inventory`)
- **Status:** 🟢 `Fully Functional (Client)`
- **Navigation:** Ensure you are logged out. In your browser address bar, paste: `http://localhost:5173/inventory`
- **Steps:**
  1. Press `Enter`.
- **Expected Result:**
  - `ProtectedRoute` intercepts the unauthenticated request.
  - Browser is immediately redirected to `/login`.
- **Failure Indicators:** Asset Register loads without an active login session.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

### Module 2: Role-Based Dashboards

#### TC-DASH-01: System Admin Executive Dashboard
- **Page/Module:** Dashboard (`/dashboard`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo`
- **Navigation:** Log in as `admin@girsomnath.gov.in` (`SYSTEM_ADMIN`).
- **Steps:**
  1. Verify the page header displays: *"System Administrator Executive Dashboard"*.
  2. Inspect the 4 top KPI cards.
  3. Inspect the Recharts visual chart: *"Inventory Classification Distribution"*.
  4. Inspect the System Health & Office Overview table.
- **Expected Result:**
  - 4 KPI cards render:
    - *Total Tracked Assets* (e.g., 2,845)
    - *Total Valuation* in Indian Rupees (e.g., ₹1,42,80,000)
    - *Dead Stock & Obsolete* (e.g., 348)
    - *System User Accounts* (e.g., 18 Active)
  - Interactive Recharts bar/pie chart shows proportion of Active, Slow-Moving, Non-Moving, and Obsolete stock.
  - Office overview displays Gir Somnath Panchayat Offices (Veraval, Talala, Kodinar, Una).
- **Failure Indicators:** Dashboard crashes, chart fails to render, or non-admin features are displayed.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-DASH-02: Store Officer Supervisory Dashboard
- **Page/Module:** Dashboard (`/dashboard`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo`
- **Navigation:** Log in as `officer@girsomnath.gov.in` (`STORE_OFFICER`).
- **Steps:**
  1. Verify page header: *"Store Officer Supervisory Dashboard"*.
  2. Inspect the supervisory KPI metrics and Pending Action Items.
  3. Inspect the *"Operational Status Breakdown"* bar chart.
- **Expected Result:**
  - KPIs highlight supervisory concerns:
    - *Items Under Custody*
    - *Pending Condemnation Requests*
    - *Discrepancies Requiring Review*
    - *Slow / Non-Moving Items*
  - Action list displays items requiring Store Officer sanction (e.g., Damaged Desktop Proposal, Transfer Requests).
- **Failure Indicators:** Admin controls (like user account creation) are shown; chart fails to mount.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-DASH-03: Store Staff Operational Dashboard
- **Page/Module:** Dashboard (`/dashboard`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo`
- **Navigation:** Log in as `staff@girsomnath.gov.in` (`STORE_STAFF`).
- **Steps:**
  1. Verify page header: *"Store Staff Operational Workspace"*.
  2. Inspect the 6 Quick Action operational cards.
  3. Inspect the *"Recent Stock Movements"* list.
- **Expected Result:**
  - Staff workspace presents direct operational tiles:
    - *Add New Item / Asset* (links to `/inventory/new`)
    - *Inward Stock Receipt*
    - *Issue to Department*
    - *Return from Department*
    - *Scan Barcode / QR*
    - *Physical Verification*
  - Shows staff member's daily processed vouchers.
- **Failure Indicators:** User or system configuration settings are visible to staff.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

### Module 3: Inventory Master & Asset Register

#### TC-INV-01: Asset Register Search & Multi-Filter Querying
- **Page/Module:** Asset Register (`/inventory`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo`
- **Navigation:** In Sidebar, click **`Inventory Master`** ➔ **`Asset Register`**.
- **Steps:**
  1. In the search input, type `Dell` and wait 400ms (debounce).
  2. Observe the table filtering to display only Dell equipment.
  3. Clear the search input.
  4. In the **`Category`** filter dropdown, select `Computers & IT Equipment`.
  5. In the **`Classification`** filter, select `ACTIVE`.
  6. In the **`Tracking Type`** filter, select `Durable Asset (Individual)`.
  7. Click the **`Reset Filters`** button.
- **Expected Result:**
  - Instant table updates reflecting the exact filter criteria.
  - Active filter badges display the number of applied filters.
  - "Reset Filters" restores the full asset list to page 1.
- **Failure Indicators:** Table does not filter, page reloads completely, or UI freezes.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-INV-02: Table Sorting & Pagination Controls
- **Page/Module:** Asset Register (`/inventory`)
- **Status:** 🟢 `Fully Functional (Client)`
- **Navigation:** Open `/inventory`.
- **Steps:**
  1. Click on the column header **`Purchase Cost`**.
  2. Observe sort arrow switching to ascending, then click again for descending.
  3. Click on the column header **`Item Name`**.
  4. At the bottom right, verify pagination controls (Previous, Next, Page Numbers, Rows Per Page selector).
  5. Change Rows Per Page from `10` to `25`.
- **Expected Result:**
  - Table rows re-order correctly according to numerical cost or alphabetical name.
  - Pagination updates row count indicator (e.g., *"Showing 1 to 10 of 28 assets"*).
- **Failure Indicators:** Sort direction indicator doesn't change; pagination numbers are miscalculated.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-INV-03: COMPLETE WORKFLOW – Adding a Durable Asset
- **Page/Module:** Add Item Form (`/inventory/new`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo` / 🔵 `Backend-Dependent`
- **Navigation:** Open `/inventory` and click the blue **`+ Register New Asset / Item`** button.
- **Input Data Matrix:**
  - **Item Classification / Mode:** Select radio pill **`Durable Asset (Individually Tracked)`**
  - **Item Name:** `HP LaserJet Pro MFP 4104dw`
  - **Category:** `Printers & Scanners`
  - **Brand / OEM:** `HP India`
  - **Model Number:** `MFP-4104DW`
  - **Serial Number:** `HPLJ-2026-VRV-9941`
  - **Purchase Cost (₹):** `42500`
  - **Quantity:** `1` (Disabled/locked to 1 for durable assets)
  - **Procurement Date:** Select any past date (e.g., `2025-08-15`)
  - **PO / GeM Contract Number:** `GEM-2025-B-998811`
  - **Supplier:** `Gujarat State Electronics Development Corp`
  - **Office / Store:** `District Panchayat Central Store, Veraval`
  - **Location / Room:** `Room 102 - Store Record Section`
  - **Custodian Officer:** `M. K. Parmar, Deputy Engineer`
  - **Physical Condition:** `GOOD`
  - **Warranty Expiry:** Select a future date (e.g., `2028-08-14`)
  - **Remarks / Technical Specs:** `Dual-band Wi-Fi, duplex printing, installed in engineering wing`
- **Steps:**
  1. Fill all above fields.
  2. Observe auto-calculated Total Valuation displaying `₹42,500`.
  3. Click **`Save Asset Record`**.
- **Expected Result:**
  - Button enters loading state.
  - In Demo Mode: A new asset is added to in-memory state with generated code (e.g., `AST-GS-VRV-2026-00029`).
  - Toast notification appears: *"Asset registered successfully!"*
  - User is navigated back to `/inventory`, where the newly added HP LaserJet appears at the top of the register.
- **Failure Indicators:** Validation fails on valid fields; quantity is allowed to be > 1 for durable asset.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-INV-04: COMPLETE WORKFLOW – Adding Consumable Stock
- **Page/Module:** Add Item Form (`/inventory/new`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo` / 🔵 `Backend-Dependent`
- **Navigation:** Open `/inventory/new`.
- **Input Data Matrix:**
  - **Item Classification / Mode:** Select radio pill **`Consumable Stock (Bulk / Quantity Tracked)`**
  - **Item Name:** `JK Copier A4 Paper Reams (75 GSM)`
  - **Category:** `Office Stationery & Supplies`
  - **Brand / OEM:** `JK Paper Ltd`
  - **Model Number:** Leave blank or `75GSM-A4`
  - **Serial Number:** **Verify field is hidden or disabled** (Not applicable to consumables)
  - **Unit of Measure (UOM):** `REAMS`
  - **Initial Stock Quantity:** `200`
  - **Unit Cost (₹):** `320`
  - **Minimum Reorder Threshold:** `30`
  - **Office / Store:** `District Panchayat Central Store, Veraval`
  - **Location / Room:** `Room 101 - Stationery & Office Supplies Rack A`
  - **Physical Condition:** **Verify condition is locked to GOOD or hidden**
- **Steps:**
  1. Fill the above values.
  2. Observe Total Valuation automatically calculating: `200 × ₹320 = ₹64,000`.
  3. Verify that individual Serial Number and Custodian Officer are NOT required.
  4. Click **`Save Asset Record`**.
- **Expected Result:**
  - Record is saved with item code formatted as `ITM-GS-VRV-XXXXX`.
  - Toast notification: *"Consumable stock item created successfully!"*
  - Asset Register lists item with UOM `REAMS` and bulk balance `200`.
- **Failure Indicators:** System requires an individual serial number or crashes when serial number is omitted.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-INV-05: COMPLETE WORKFLOW – Editing an Existing Asset
- **Page/Module:** Edit Asset Page (`/inventory/edit/:id`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo` / 🔵 `Backend-Dependent`
- **Navigation:** Open `/inventory`. Find an active asset (e.g., `Dell OptiPlex 7090 Desktop`).
- **Steps:**
  1. Click the edit icon (pencil) in the table Actions column.
  2. Verify the form loads with all current asset attributes pre-filled.
  3. Modify the **`Location / Room`** from `Room 204` to `Room 305 - Taluka Development Wing`.
  4. Update **`Custodian Officer`** to `S. P. Joshi, Senior Clerk`.
  5. Update **`Physical Condition`** from `GOOD` to `FAIR`.
  6. Click **`Update Asset Record`**.
- **Expected Result:**
  - Form validates successfully and submits update payload.
  - Toast notification: *"Asset updated successfully."*
  - Redirected to Asset Detail page showing the updated Location, Custodian, and Condition.
- **Failure Indicators:** Existing fields fail to populate; update wipes out previous data; duplicate code generated.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-INV-06: 360° Asset Profile & Specifications
- **Page/Module:** Asset Details (`/inventory/view/:id`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo`
- **Navigation:** Open `/inventory` and click on any Asset Name link (or eye icon).
- **Steps:**
  1. Inspect the top banner: Verify Asset Code, Operational Status badge, Usage Classification badge, and Condition badge.
  2. Inspect the **`Barcode & Identification`** card in the left column.
  3. Click the copy icon next to the Asset Code.
  4. Inspect the **`Procurement & Financials`** card: Purchase Date, Cost, PO Number, Depreciated Value.
  5. Inspect the **`Current Custody & Location`** card: Assigned Department, Officer, Building, Room.
- **Expected Result:**
  - Copy icon triggers toast: *"Asset ID copied to clipboard!"*
  - Simulated Code 128 barcode displays the barcode string below it.
  - Financial figures are formatted in Indian Rupee format (`₹XX,XXX`).
- **Failure Indicators:** Blank cards, broken badges, or unhandled null fields.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-INV-07: Movement & Audit Timeline History
- **Page/Module:** Asset Details (`/inventory/view/:id`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo`
- **Navigation:** On the Asset Details page, click the tab: **`Movement & Audit Timeline`**.
- **Steps:**
  1. Inspect the chronological vertical timeline.
  2. Check individual timeline event cards:
     - Event Type badge (`INITIAL_RECEIPT`, `DEPARTMENT_ISSUE`, `PHYSICAL_INSPECTION`, `CUSTODY_TRANSFER`)
     - Date and Timestamp
     - Performed By (Officer / Staff name)
     - Voucher / Reference Number
     - Event Notes / Justification
- **Expected Result:**
  - Timeline lists events in reverse chronological order (newest first).
  - Demonstrates that asset movement history is immutable and preserved across edits.
- **Failure Indicators:** Timeline tab is empty or throws a rendering error.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-INV-08: COMPLETE WORKFLOW – Excel / CSV Bulk Import
- **Page/Module:** Asset Register / Import Modal (`/inventory`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo` / 🔵 `Backend-Dependent`
- **Navigation:** Open `/inventory` and click the **`Import Excel / CSV`** button in the header.
- **Steps:**
  1. In the modal, click the **`Download Standard Template (.csv)`** button.
     - *Verify:* A file named `inventory-import-template.csv` downloads with proper headers.
  2. Inspect the **`Column Mapping Guide`** tab to see required vs optional fields.
  3. Switch to the **`Upload & Preview`** tab.
  4. Create a test CSV file `test_inventory.csv` with the following content:
     ```csv
     item_name,category_code,tracking_type,make,model,serial_number,location_code,purchase_cost,procurement_date,supplier_name,po_number,room_number
     Acer Veriton Desktop,CAT-IT,DURABLE_ASSET,Acer,M200,ACR-9981-TEST,LOC-STORE-101,38500,2025-01-10,Gem Supplier,GEM-1122,Room 101
     Canon LBP2900 Printer,CAT-IT,DURABLE_ASSET,Canon,LBP2900,CAN-8877-TEST,LOC-STORE-102,14200,2025-02-15,Gem Supplier,GEM-3344,Room 102
     Faulty Row Missing Category,,DURABLE_ASSET,Generic,ModelX,GEN-0001-TEST,LOC-STORE-101,5000,2025-01-01,Vendor,GEM-0000,Room 101
     Duplicate Serial Item,CAT-IT,DURABLE_ASSET,Acer,M200,ACR-9981-TEST,LOC-STORE-101,38500,2025-01-10,Vendor,GEM-1122,Room 101
     ```
  5. Drag and drop `test_inventory.csv` into the upload dropzone.
  6. Inspect the generated **Import Preview Table**:
     - *Row 1 & 2:* Status `VALID` (green badge).
     - *Row 3:* Status `ERROR` (red badge: *"Category code is required"*).
     - *Row 4:* Status `ERROR` (red badge: *"Duplicate serial number in batch"*).
  7. Click the **`Download Error Report`** button.
     - *Verify:* Downloads `import-errors-[timestamp].csv` detailing the 2 invalid rows.
  8. Click the blue **`Import Valid Rows (2)`** button.
  9. Click the **`Past Batches`** tab in the modal.
- **Expected Result:**
  - Invalid rows are quarantined; valid rows are accepted.
  - Toast notification confirms: *"Import completed: 2 items created, 2 skipped."*
  - Past Batches tab logs the import session with Batch ID, timestamp, and success/failure counts.
  - Newly imported Acer Desktop and Canon Printer appear in the Asset Register.
- **Failure Indicators:** Modal crashes on file drop; error rows cause the entire import to abort; duplicate serials are accepted.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-INV-09: Category Master Management
- **Page/Module:** Categories (`/inventory/categories`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo` / 🔵 `Backend-Dependent`
- **Navigation:** In Sidebar, click **`Inventory Master`** ➔ **`Category Master`**.
- **Steps:**
  1. Inspect the category list: Computers & IT, Office Furniture, Printers & Scanners, Heavy Machinery, Office Supplies.
  2. Verify that each category displays: Lifespan (Years), Inactivity Threshold (Days), Depreciation Rate (%), and Active Item count.
  3. Click **`+ Add Category`** button.
  4. Fill modal:
     - *Category Name:* `Solar & Renewable Energy Equipment`
     - *Category Code:* `CAT-SOLAR`
     - *Lifespan:* `10`
     - *Inactivity Alert Threshold:* `180`
     - *Annual Depreciation:* `10`
  5. Click **`Save Category`**.
- **Expected Result:**
  - New category is added to the list.
  - Toast notification confirms creation.
  - New category becomes available in the Add Item dropdown.
- **Failure Indicators:** Modal fails to open; inputs don't accept numbers; list doesn't update.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-INV-10: Store Location & Room Taxonomy
- **Page/Module:** Locations (`/inventory/locations`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo` / 🔵 `Backend-Dependent`
- **Navigation:** In Sidebar, click **`Inventory Master`** ➔ **`Location Master`**.
- **Steps:**
  1. Inspect the location list: Room 101, Room 102, Room 204, IT Server Room, Engineering Store.
  2. Verify Location Types (`MAIN_STORE`, `DEPARTMENT_ROOM`, `RECORD_ROOM`, `TRANSIT_BAY`).
  3. Click **`+ Add Location`** button.
  4. Fill modal:
     - *Location Name:* `Room 308 - District Planning Cell`
     - *Location Code:* `LOC-DPC-308`
     - *Building / Floor:* `Main Administrative Building, 3rd Floor`
     - *Location Type:* `DEPARTMENT_ROOM`
  5. Click **`Save Location`**.
- **Expected Result:**
  - Location is saved and appears in the table.
  - Toast notification: *"Location added successfully."*
- **Failure Indicators:** Location modal crashes or fails to validate code format.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

### Module 4: Role Permissions & Access Control Verification

#### TC-RBAC-01: Store Staff Access Restrictions
- **Page/Module:** Navigation & Protected Routes
- **Status:** 🟢 `Fully Functional (Client)`
- **Navigation:** Log in as `staff@girsomnath.gov.in` (`STORE_STAFF`).
- **Steps:**
  1. Inspect the Sidebar menu options.
  2. Verify that **`Administration`** (User Accounts, Roles, Office Settings) is NOT visible in the navigation sidebar.
  3. In the browser URL address bar, manually type: `http://localhost:5173/admin/users` and hit `Enter`.
- **Expected Result:**
  - `ProtectedRoute` detects insufficient permission scope.
  - Browser is immediately routed to the **`403 - Access Denied / Unauthorized`** screen.
  - Screen displays: *"You do not have the required role permissions to access this administrative module."*
  - Provides a **`Return to Dashboard`** button.
- **Failure Indicators:** Store Staff is able to view or edit user accounts.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-RBAC-02: Disposed Asset Action Freeze
- **Page/Module:** Asset Details (`/inventory/view/AST-GS-VRV-2022-00004`)
- **Status:** 🟢 `Fully Functional (Client)`
- **Navigation:** Open `/inventory`. Filter by Operational Status: `DISPOSED`. Click on the disposed asset (e.g., *HP ScanJet Pro Scanner*).
- **Steps:**
  1. Inspect the top banner and action buttons.
  2. Observe the prominent red banner: *"RECORD FROZEN: This asset was officially disposed under Sanction Order GS/DISP/2026/04. No further stock movements, issues, or edits are permitted."*
  3. Verify that the **`Edit Asset`** button is either hidden or disabled.
- **Expected Result:**
  - System enforces government audit compliance by prohibiting modifications to condemned/disposed assets.
- **Failure Indicators:** User can edit or issue an asset marked as `DISPOSED`.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

### Module 5: Barcode & Identification Workflow

#### TC-BC-01: Asset Detail Barcode Card & Asset ID Formatting
- **Page/Module:** Asset Details (`/inventory/view/:id`)
- **Status:** 🟢 `Fully Functional (Client)`
- **Navigation:** Open `/inventory` and view any durable asset.
- **Steps:**
  1. Verify the Asset ID follows the standard government pattern: `AST-GS-VRV-YYYY-XXXXX`.
  2. Inspect the Code 128 barcode graphic in the identification card.
  3. Verify the barcode number matches the item code or barcode field.
  4. Click **`Print Record`** in the top action bar.
- **Expected Result:**
  - Browser print dialog opens with a print-optimized stylesheet.
- **Failure Indicators:** Barcode renders broken image icon or Asset ID format is inconsistent.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-BC-02: Manual Asset ID / Serial Number Lookup
- **Page/Module:** Asset Register (`/inventory`)
- **Status:** 🟢 `Fully Functional (Client)`
- **Navigation:** Open `/inventory`.
- **Steps:**
  1. Copy a known serial number (e.g., `DELL-OPT-7090-001`).
  2. Paste it into the search box.
  3. Clear and paste a full Asset ID (e.g., `AST-GS-VRV-2023-00012`).
- **Expected Result:**
  - In both queries, the exact asset is resolved and displayed as the sole result in the table.
  - Confirms manual fallback lookup is active without requiring a camera/scanner.
- **Failure Indicators:** Search only matches item name; fails to resolve serial number or asset ID.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-BC-03: Barcode Scanner Screen (Phase 6 Placeholder)
- **Page/Module:** Barcode Verification (`/verification/barcode-lookup`)
- **Status:** 🟠 `Phase Placeholder (Structured)`
- **Navigation:** In Sidebar, click **`Physical Verification`** ➔ **`Barcode Scanner`**.
- **Steps:**
  1. Inspect the rendered page.
- **Expected Result:**
  - Displays a clean `ModulePlaceholder` card titled *"Barcode Scanner & Fast Asset Lookup"*.
  - Clearly identifies: **Phase 6 Implementation**.
  - Lists target endpoint: `POST /api/v1/barcodes/lookup`.
  - Enumerates upcoming features: Live camera scanning via `html5-qrcode`, USB laser scanner listener, manual autocomplete fallback, and printable label sheet generator.
- **Failure Indicators:** Blank 404 page, broken layout, or uncaught exception.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

### Module 6: Dead Stock & Classification Workflow

#### TC-DS-01: Three-Dimensional Status Separation Check
- **Page/Module:** Asset Register & Add/Edit Asset (`/inventory`)
- **Status:** 🟢 `Fully Functional (Client)`
- **Navigation:** Open `/inventory`.
- **Steps:**
  1. Inspect table headers and status badges.
  2. Verify that there are 3 completely separate status indicators:
     - **Operational Status:** `AVAILABLE_IN_STORE`, `IN_USE`, `UNDER_MAINTENANCE`, `DISPATCHED_TO_VENDOR`, `PENDING_CONDEMNATION`, `DISPOSED`.
     - **Usage Classification:** `ACTIVE`, `SLOW_MOVING`, `NON_MOVING`, `OBSOLETE`.
     - **Physical Condition:** `GOOD`, `FAIR`, `DAMAGED`, `SCRAP`.
  3. Filter table by Classification: `NON_MOVING`.
  4. Observe the operational status of the resulting items.
- **Expected Result:**
  - An item classified as `NON_MOVING` or `OBSOLETE` still maintains an operational status such as `AVAILABLE_IN_STORE` or `IN_USE`.
  - Confirms that non-moving or aged items are **NOT** automatically condemned or marked as disposed.
- **Failure Indicators:** Classifying an item as `OBSOLETE` automatically changes its status to `DISPOSED`.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

#### TC-DS-02: Dead Stock Classification Hub (Phase 5 Placeholder)
- **Page/Module:** Dead Stock Management (`/dead-stock/classification`)
- **Status:** 🟠 `Phase Placeholder (Structured)`
- **Navigation:** In Sidebar, click **`Dead Stock Management`** ➔ **`Classification Hub`**.
- **Steps:**
  1. Inspect the rendered page.
- **Expected Result:**
  - Renders `ModulePlaceholder` titled *"Stock Classification Engine & Overview"*.
  - Clearly identifies: **Phase 5 Implementation**.
  - Lists target endpoint: `GET /api/v1/classifications/summary` and `POST /api/v1/classifications/run`.
  - Explains the precedence rule hierarchy and states: *"Automated suggestion does not authorize legal condemnation or disposal."*
- **Failure Indicators:** Broken page or missing navigation link.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---

### Module 7: Phase 4–11 Structured Placeholders Verification

Verify that all subsequent roadmap modules are properly routed and display informative placeholder specifications rather than breaking the application:

| Test ID | Module Route | Sidebar Navigation Path | Scheduled Phase | Expected Target API Endpoint | Result Checkbox |
|:---|:---|:---|:---:|:---|:---:|
| **TC-PH-01** | `/transactions/receipts` | Stock Transactions ➔ Inward Receipts | Phase 4 | `GET /api/v1/transactions/receipts` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-02** | `/transactions/issues` | Stock Transactions ➔ Department Issues | Phase 4 | `GET /api/v1/transactions/issues` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-03** | `/transactions/returns` | Stock Transactions ➔ Department Returns | Phase 4 | `GET /api/v1/transactions/returns` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-04** | `/transactions/transfers` | Stock Transactions ➔ Inter-Store Transfers | Phase 4 | `GET /api/v1/transactions/transfers` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-05** | `/dead-stock/condemnations` | Dead Stock ➔ Condemnation Proposals | Phase 5 | `GET /api/v1/condemnations` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-06** | `/dead-stock/disposals` | Dead Stock ➔ Disposal Register | Phase 5 | `GET /api/v1/disposals` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-07** | `/verification/sessions` | Physical Verification ➔ Audit Sessions | Phase 6 | `GET /api/v1/verifications/sessions` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-08** | `/suppliers` | Suppliers & Procurement ➔ Supplier Directory | Phase 7 | `GET /api/v1/suppliers` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-09** | `/maintenance` | Maintenance & Warranty ➔ Maintenance Logs | Phase 7 | `GET /api/v1/maintenance` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-10** | `/alerts` | Alert Center ➔ Stock & Warranty Alerts | Phase 8 | `GET /api/v1/alerts` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-11** | `/reports` | Reports & Analytics ➔ Report Center | Phase 9 | `GET /api/v1/reports` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-12** | `/admin/users` | Administration ➔ User Accounts | Phase 10 | `GET /api/v1/users` | `[ ] PASS` `[ ] FAIL` |
| **TC-PH-13** | `/audit` | Audit Trail ➔ Immutable System Logs | Phase 10 | `GET /api/v1/audit-trail` | `[ ] PASS` `[ ] FAIL` |

---

## 5. User Profile & Account Settings Test

#### TC-PROF-01: View Profile & Update Password
- **Page/Module:** My Profile (`/profile`)
- **Status:** 🟢 `Fully Functional (Client)` / 🟡 `Mock Demo`
- **Navigation:** In Navbar, click on user profile pill / avatar. Select **`My Profile`** (or navigate to `/profile`).
- **Steps:**
  1. Inspect profile details: Name, Email, Role, Office Assignment, Account Status (`ACTIVE`).
  2. Scroll down to **`Change Account Password`**.
  3. Enter Current Password: `Officer@12345`.
  4. Enter New Password: `NewSecretPass@2026`.
  5. Enter Confirm Password: `NewSecretPass@2026`.
  6. Click **`Update Password`**.
- **Expected Result:**
  - Form validates matching passwords and minimum character requirements.
  - Toast notification appears: *"Password updated successfully."*
  - Form resets inputs.
- **Failure Indicators:** Form allows mismatched passwords; submits without current password.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] NOT IMPLEMENTED` &nbsp; `[ ] BLOCKED BY BACKEND`
- **Observations:** __________________________________________________

---


---

## 7. Phase 5 – Dead Stock Identification, Physical Verification, Condemnation & Disposal Test Suite

#### TC-P5-01: Statutory Classification Engine Trigger & Summary
- **Page/Module:** Dead Stock Classification Engine (`/dead-stock/classification`)
- **Backend Endpoint:** `GET /api/v1/classifications/summary`, `POST /api/v1/classifications/run`
- **Role Required:** Store Officer or System Admin
- **Steps:**
  1. Navigate to **Dead Stock** → **Classification Engine** in the sidebar.
  2. Inspect the KPI cards: Total Evaluated, Active, Non-Moving, Obsolete, Slow-Moving, Overridden.
  3. Inspect the statutory Gujarat GFR 5-tier precedence rule card.
  4. Click the **Run Engine Now** button in the header.
- **Expected Result:**
  - System executes classification rules on the backend database.
  - Toast notification appears: *"Classification engine executed successfully."*
  - The aggregate counters refresh with updated calculations from PostgreSQL.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] BLOCKED BY BACKEND`

---

#### TC-P5-02: Dead Stock Register, Filters, and Store Officer Override
- **Page/Module:** Dead Stock Register (`/dead-stock/register`)
- **Backend Endpoint:** `GET /api/v1/classifications/dead-stock`, `POST /api/v1/classifications/{id}/override`, `POST /api/v1/classifications/{id}/release-override`
- **Role Required:** Store Officer or System Admin
- **Steps:**
  1. Navigate to **Dead Stock** → **Dead Stock Register**.
  2. Inspect the data table listing assets classified as `NON_MOVING` or `OBSOLETE`.
  3. Filter by category, condition, or classification status.
  4. Click the **Override** action button on any eligible asset row.
  5. In the modal, select New Status (e.g. `ACTIVE` or `OBSOLETE`), enter a mandatory justification (e.g., *"Recommissioned for election duty"*), and click **Submit Override**.
  6. Verify the badge updates to show the overridden state.
  7. Click the **Release** button to restore the engine-calculated classification.
- **Expected Result:**
  - Status updates in the database and audit trail captures the officer's justification.
  - Overridden badge toggles seamlessly with light/dark theme contrast.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] BLOCKED BY BACKEND`

---

#### TC-P5-03: Barcode Lookup & Identity Resolver
- **Page/Module:** Barcode Lookup (`/verification/barcode-lookup`)
- **Backend Endpoint:** `POST /api/v1/barcodes/lookup`
- **Role Required:** Any authenticated role
- **Steps:**
  1. Navigate to **Verification** → **Barcode Lookup**.
  2. In the search input, type or paste an existing Asset Code or Barcode (e.g., `AST-2024-001`).
  3. Press Enter or click **Lookup Asset**.
- **Expected Result:**
  - Backend resolves the asset record and displays a comprehensive asset card.
  - Card displays Item Description, Category, Current Custodian, Physical Condition, Valuation, and Barcode SVG preview.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] BLOCKED BY BACKEND`

---

#### TC-P5-04: Create Physical Verification Audit Session
- **Page/Module:** Verification Sessions (`/verification/sessions`)
- **Backend Endpoint:** `GET /api/v1/verifications/sessions`, `POST /api/v1/verifications/sessions`
- **Role Required:** Store Officer or System Admin
- **Steps:**
  1. Navigate to **Verification** → **Audit Sessions**.
  2. Click **New Verification Session**.
  3. Enter Session Title (e.g., *"Annual Store Physical Audit FY 2026-27"*).
  4. Select Audit Scope: `Full Office Inventory` or specific Location/Category.
  5. Select Verification Officer and Custodian Witness.
  6. Click **Initialize Audit Session**.
- **Expected Result:**
  - Backend creates a new verification session and takes a frozen baseline snapshot of all expected stock items in the database.
  - New session appears in the table with status `IN_PROGRESS`.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] BLOCKED BY BACKEND`

---

#### TC-P5-05: Live Barcode Scanning & Duplicate Detection
- **Page/Module:** Verification Detail / Live Scanner (`/verification/sessions/:id`)
- **Backend Endpoint:** `POST /api/v1/verifications/sessions/{id}/scan`, `GET /api/v1/verifications/sessions/{id}/scans`
- **Role Required:** Store Officer or Inventory Staff
- **Steps:**
  1. Open the created verification session.
  2. In the **Live Scanner** tab, focus the Barcode input field.
  3. Scan or enter a valid item barcode (e.g., `AST-2024-001`) and submit.
  4. Notice the scanned items counter increments.
  5. Scan or enter the exact same barcode a second time.
- **Expected Result:**
  - First scan: Successfully registered and appended to the Scan Log table.
  - Duplicate scan: System alerts *"Duplicate scan detected: Item has already been verified in this session"*, preventing double counting.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] BLOCKED BY BACKEND`

---

#### TC-P5-06: Discrepancy Investigation & Officer Reconciliation
- **Page/Module:** Verification Detail / Discrepancies (`/verification/sessions/:id`)
- **Backend Endpoint:** `GET /api/v1/verifications/sessions/{id}/items`, `POST /api/v1/verifications/sessions/{id}/reconcile`
- **Role Required:** Store Officer
- **Steps:**
  1. Switch to the **Discrepancy Investigation** tab.
  2. Review the list of items flagged as `SURPLUS`, `DEFICIT` (missing), or `MISPLACED`.
  3. Click **Resolve / Reconcile** on an unverified or missing item.
  4. Select Resolution Type: `FOUND_WRONG_LOCATION`, `DAMAGED_NOTED`, or `MISSING_EXPLAINED`.
  5. Enter reconciliation remarks and submit.
- **Expected Result:**
  - Discrepancy status updates to `RECONCILED` with resolution notes recorded in the database.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] BLOCKED BY BACKEND`

---

#### TC-P5-07: Session Finalization & Statutory Certification
- **Page/Module:** Verification Detail / Finalization (`/verification/sessions/:id`)
- **Backend Endpoint:** `POST /api/v1/verifications/sessions/{id}/complete`
- **Role Required:** Store Officer or System Admin
- **Steps:**
  1. Switch to the **Finalization & Report** tab.
  2. Inspect the audit summary (Total Expected, Verified Present, Discrepancies Resolved).
  3. Check the statutory verification certification acknowledgment box.
  4. Click **Certify & Close Audit Session**.
- **Expected Result:**
  - Session status transitions to `COMPLETED`.
  - Verification certificate reference number is generated.
  - Scanner is closed and the session is locked from further modifications.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] BLOCKED BY BACKEND`

---

#### TC-P5-08: Draft Condemnation Proposal with Multi-Item Nomination
- **Page/Module:** Condemnation Proposals (`/dead-stock/condemnations`)
- **Backend Endpoint:** `GET /api/v1/condemnations`, `POST /api/v1/condemnations`
- **Role Required:** Store Officer
- **Steps:**
  1. Navigate to **Dead Stock** → **Condemnation Proposals**.
  2. Click **New Condemnation Proposal**.
  3. Enter Proposal Title (e.g., *"Disposal of Beyond-Economic-Repair IT Equipment"*).
  4. Select Condemnation Reason: `BEYOND_ECONOMIC_REPAIR`, `UNSERVICEABLE`, or `OBSOLETE_SURPLUS`.
  5. Select one or more candidate items from the dead stock inventory.
  6. Enter Assessed Scrap Value and Committee Remarks.
  7. Click **Submit Proposal**.
- **Expected Result:**
  - Proposal is saved in PostgreSQL with status `SUBMITTED`.
  - It appears in the Condemnations table with a clean tracking badge.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] BLOCKED BY BACKEND`

---

#### TC-P5-09: Multi-Stage Review & Official DDO Sanction Order Approval
- **Page/Module:** Condemnation Detail (`/dead-stock/condemnations/:id`)
- **Backend Endpoint:** `GET /api/v1/condemnations/{id}`, `POST /api/v1/condemnations/{id}/review`, `POST /api/v1/condemnations/{id}/decision`
- **Role Required:** System Admin / DDO (District Development Officer)
- **Steps:**
  1. Open the submitted proposal detail view.
  2. Review the nominated items, original acquisition costs, and total scrap valuation.
  3. Click **Mark Under Review** (transitions status to `UNDER_REVIEW`).
  4. Click **Executive Decision**.
  5. Select `APPROVE`, enter the official government **Sanction Order Number** (e.g., `DP-GS/COND/2026/044`), select Sanction Date, and add DDO approval notes.
  6. Click **Confirm Decision**.
- **Expected Result:**
  - System enforces separation of duties: Sanction Order Number is strictly required for approval.
  - Proposal status transitions to `APPROVED`.
  - Status timeline displays the sanction order reference and approval timestamp.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] BLOCKED BY BACKEND`

---

#### TC-P5-10: Regulated Disposal Execution & Scrap Proceeds Tracking
- **Page/Module:** Disposal Register (`/dead-stock/disposals`)
- **Backend Endpoint:** `GET /api/v1/disposals`, `POST /api/v1/disposals`, `GET /api/v1/condemnations?status=APPROVED`
- **Role Required:** Store Officer or System Admin
- **Steps:**
  1. Navigate to **Dead Stock** → **Disposal Register**.
  2. Click **Execute Regulated Disposal**.
  3. In the modal, select the approved condemnation proposal from the dropdown (only proposals with status `APPROVED` appear).
  4. Select Disposal Method: `PUBLIC_AUCTION`, `SCRAP_SALE`, or `E_WASTE_RECYCLING`.
  5. Enter Buyer / Agency Name (e.g., *"Gujarat Scrap Processors Ltd"*).
  6. Enter Sale Proceeds Realized (₹) and Treasury Challan / Receipt Number.
  7. Check the irreversible asset write-off acknowledgment.
  8. Click **Finalize & Record Disposal**.
- **Expected Result:**
  - Disposal record is saved in PostgreSQL with certificate number.
  - Linked inventory items transition permanently to operational status `DISPOSED`.
  - Financial ledger and scrap register record the realized proceeds.
- **Result:** `[ ] PASS` &nbsp; `[ ] FAIL` &nbsp; `[ ] BLOCKED BY BACKEND`

---
## 8. Manual Testing Execution Scorecard

Use this summary scorecard upon completing your manual testing walk-through:

| Module Area | Total Test Cases | Passed (✅) | Failed (❌) | Blocked by Backend (⏳) | Notes & Observations |
|:---|:---:|:---:|:---:|:---:|:---|
| **1. Authentication & Session** | 6 | | | | Full mock demo fallback verified. |
| **2. Role-Based Dashboards** | 3 | | | | Admin, Officer, and Staff role views. |
| **3. Inventory Master & Assets** | 10 | | | | Asset Register, Add Durable/Consumable, Edit, Details, Timeline, Excel Import, Categories, Locations. |
| **4. Role Permissions (RBAC)** | 2 | | | | Staff restricted from admin; Disposed record freeze. |
| **5. Barcode & Identification** | 3 | | | | SVG rendering, Manual search fallback, Optical label preview. |
| **6. Phase 5 Dead Stock & Verification** | 10 | | | | Classification Engine, Dead Stock Register & Override, Barcode Lookup, Audit Sessions, Scanning, Reconciliation, Finalization, Condemnation Workflow & DDO Sanction, Disposal Execution. |
| **7. Structured Phase Placeholders** | 13 | | | | Verifies that all future routes render clean specifications. |
| **8. Profile & Account** | 1 | | | | Profile view and password validation. |
| **TOTAL** | **48** | | | | |

---

### Verification Sign-Off
- **Tested By (Name / Designation):** _____________________________________________
- **Test Date:** ________________________
- **Test Environment:** `Local Vite Dev (Node v_____)` &nbsp;|&nbsp; `Production Preview Build`
- **Backend Status:** `[ ] Offline (Demo Fixtures)` &nbsp;|&nbsp; `[ ] Online (FastAPI http://localhost:8000)`
- **Overall Assessment:** `[ ] PHASE 5 FULLY VERIFIED - READY FOR PHASE 6` &nbsp;|&nbsp; `[ ] DEFECTS TO REMEDIATE FIRST`
`

