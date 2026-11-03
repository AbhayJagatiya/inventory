# Role-Based Access Control (RBAC) Permissions Matrix
## PS000214 – Dead Stock Inventory Management System
**Organization:** District Development Office – Gir Somnath, Veraval  
**Target User Group:** Officers and Staff of Store Department, District Panchayat, Gir Somnath  

The system defines three standard proposed operational roles:
1. **`SYSTEM_ADMIN`**: System Administrator (Technical Governance, Security, Global Settings)
2. **`STORE_OFFICER`**: Store Officer / Custodian Supervisor (Approvals, Audits, Overrides)
3. **`STORE_STAFF`**: Store Staff / Data Entry & Verification Operator (Day-to-day operations)

---

## Detailed Permissions Matrix

| Permission Code | Description | Module | System Admin | Store Officer | Store Staff |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Authentication & Profile** | | | | | |
| `auth:profile_view` | View own user profile | Auth | ✅ | ✅ | ✅ |
| `auth:password_change`| Change own account password | Auth | ✅ | ✅ | ✅ |
| **User Management** | | | | | |
| `users:view` | View user list and profiles | Users | ✅ | ❌ | ❌ |
| `users:create` | Create new staff/officer accounts | Users | ✅ | ❌ | ❌ |
| `users:edit` | Edit user profiles and designations | Users | ✅ | ❌ | ❌ |
| `users:status_manage` | Activate, deactivate, or lock users | Users | ✅ | ❌ | ❌ |
| `users:admin_reset` | Reset user password (admin-assisted) | Users | ✅ | ❌ | ❌ |
| **Roles & Permissions** | | | | | |
| `roles:view` | View roles and assigned permissions | Roles | ✅ | ❌ | ❌ |
| `roles:configure` | Update role permission mappings | Roles | ✅ | ❌ | ❌ |
| **Offices & Hierarchy** | | | | | |
| `offices:view` | View registered offices | Offices | ✅ | View Assigned | View Assigned |
| `offices:create` | Add new Panchayat office | Offices | ✅ | ❌ | ❌ |
| `offices:edit` | Update office details | Offices | ✅ | ❌ | ❌ |
| **Master Data (Locations, Categories, UOMs)** | | | | | |
| `master:locations_view`| View building and store locations | Master | ✅ | ✅ | ✅ |
| `master:locations_manage`| Create/edit room and shelf locations | Master | ✅ | ✅ | ❌ |
| `master:categories_view`| View category tree | Master | ✅ | ✅ | ✅ |
| `master:categories_manage`| Create/edit categories & thresholds | Master | ✅ | ✅ | ❌ |
| `master:uom_manage` | Create/edit units of measure | Master | ✅ | ✅ | ❌ |
| **Dashboards** | | | | | |
| `dashboard:admin_view`| View System Admin executive dashboard| Dashboard | ✅ | ❌ | ❌ |
| `dashboard:officer_view`| View Store Officer supervisory dashboard| Dashboard | ❌ | ✅ | ❌ |
| `dashboard:staff_view`| View Store Staff operational dashboard| Dashboard | ❌ | ❌ | ✅ |
| **Inventory & Asset Register** | | | | | |
| `inventory:view` | View inventory register and items | Inventory | ✅ | ✅ | ✅ |
| `inventory:create` | Register new durable asset or stock | Inventory | ✅ | ✅ | ✅ |
| `inventory:edit` | Edit non-disposed item details | Inventory | ✅ | ✅ | ❌ |
| `inventory:import` | Bulk import items via CSV/XLSX | Inventory | ✅ | ✅ | ❌ |
| `inventory:export` | Export inventory register to Excel/CSV | Inventory | ✅ | ✅ | ✅ |
| **Stock Transactions & Movement Ledger** | | | | | |
| `stock:receipt_view` | View inward receipt vouchers | Stock | ✅ | ✅ | ✅ |
| `stock:receipt_create`| Create & post goods inward receipts | Stock | ✅ | ✅ | ✅ |
| `stock:issue_view` | View outward stock issues | Stock | ✅ | ✅ | ✅ |
| `stock:issue_create` | Issue items to employee/department | Stock | ❌ | ✅ | ✅ |
| `stock:return_view` | View returned stock vouchers | Stock | ✅ | ✅ | ✅ |
| `stock:return_create`| Process item return with inspection| Stock | ❌ | ✅ | ✅ |
| `stock:transfer_view`| View stock transfer orders | Stock | ✅ | ✅ | ✅ |
| `stock:transfer_req` | Request inter-location transfer | Stock | ✅ | ✅ | ✅ |
| `stock:transfer_app` | Approve stock transfer | Stock | ✅ | ✅ | ❌ |
| `stock:transfer_comp`| Confirm receipt of transfer | Stock | ✅ | ✅ | ✅ |
| `stock:reversal_create`| Post offsetting reversal/correction voucher | Stock | ✅ | ✅ | ❌ |
| **Classification & Dead Stock** | | | | | |
| `classify:view` | View classification & dead stock register| Classify | ✅ | ✅ | ✅ |
| `classify:run` | Trigger automated classification engine| Classify | ✅ | ✅ | ❌ |
| `classify:override` | Record or release authorized manual override| Classify | ❌ | ✅ | ❌ |
| **Barcodes & QR Codes** | | | | | |
| `barcode:scan` | Scan barcode/QR for quick lookup | Barcode | ✅ | ✅ | ✅ |
| `barcode:print` | Print barcode / QR label sheets | Barcode | ✅ | ✅ | ✅ |
| **Physical Verification** | | | | | |
| `verify:view` | View verification sessions & scan logs | Verify | ✅ | ✅ | ✅ |
| `verify:create` | Start verification audit session | Verify | ❌ | ✅ | ❌ |
| `verify:scan` | Scan and count items during audit session| Verify | ❌ | ✅ | ✅ |
| `verify:reconcile` | Reconcile discrepancies & complete audit| Verify | ❌ | ✅ | ❌ |
| **Suppliers, Procurement & RMA Returns** | | | | | |
| `supplier:view` | View suppliers, orders, and history | Supplier | ✅ | ✅ | ✅ |
| `supplier:manage` | Create/edit suppliers and procurements| Supplier | ✅ | ✅ | ❌ |
| `supplier:rma_view` | View supplier returns and RMA dossier | Supplier | ✅ | ✅ | ✅ |
| `supplier:rma_manage`| Initiate, dispatch & resolve vendor RMAs| Supplier | ❌ | ✅ | ❌ |
| **Maintenance & Warranties** | | | | | |
| `maintenance:view` | View maintenance records | Maint | ✅ | ✅ | ✅ |
| `maintenance:log` | Log issue / maintenance request | Maint | ✅ | ✅ | ✅ |
| `maintenance:update`| Record repair completion and cost | Maint | ✅ | ✅ | ❌ |
| `warranty:view` | View warranty tracking and alerts | Maint | ✅ | ✅ | ✅ |
| **Alerts & Notifications** | | | | | |
| `alerts:view` | View alert center notifications | Alerts | ✅ | ✅ | ✅ |
| `alerts:resolve` | Acknowledge, resolve, or snooze alerts| Alerts | ✅ | ✅ | ❌ |
| **Condemnation & Disposal Workflow** | | | | | |
| `condemn:view` | View condemnation proposals | Condemn | ✅ | ✅ | ✅ |
| `condemn:submit` | Submit condemnation proposal | Condemn | ❌ | ✅ | ✅ |
| `condemn:review` | Review condemnation assessment | Condemn | ❌ | ✅ | ❌ |
| `condemn:approve` | Approve condemnation request | Condemn | Configurable | Configurable | ❌ |
| `disposal:view` | View official disposal register | Disposal | ✅ | ✅ | ✅ |
| `disposal:execute` | Execute auction/scrap & write off | Disposal | Configurable | Configurable | ❌ |
| **Reports & Analytics** | | | | | |
| `reports:view` | View official reports & analytics | Reports | ✅ | ✅ | ✅ |
| `reports:export` | Download official PDF/Excel reports | Reports | ✅ | ✅ | ✅ |
| **System Governance & Audit** | | | | | |
| `audit:view` | View security & operational logs | Audit | ✅ | ❌ | ❌ |
| `documents:upload` | Upload documents and invoices | Documents | ✅ | ✅ | ✅ |
| `documents:view` | View and download documents | Documents | ✅ | ✅ | ✅ |
| `settings:view` | View system settings | Settings | ✅ | ❌ | ❌ |
| `settings:manage` | Update thresholds & configurations | Settings | ✅ | ❌ | ❌ |
