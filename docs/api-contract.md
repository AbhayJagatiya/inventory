# REST API Contract Specification
## PS000214 – Dead Stock Inventory Management System
**Organization:** District Development Office – Gir Somnath, Veraval  
**Target User Group:** Officers and Staff of Store Department, District Panchayat, Gir Somnath  

All backend APIs are prefixed with `/api/v1` and follow standard HTTP conventions, RESTful patterns, and standardized JSON envelopes.

---

## 1. Global Standards & Error Envelopes

### 1.1 Success Response Structure (HTTP 200 / 201)
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "meta": {
    "timestamp": "2026-11-02T14:00:00Z",
    "request_id": "req-9842a1bc-7128",
    "page": 1,
    "limit": 20,
    "total": 142,
    "total_pages": 8
  }
}
```

### 1.2 Error Response Structure (HTTP 400 / 401 / 403 / 404 / 409 / 422 / 500)
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Requested issue quantity (10) exceeds available store balance (6)",
    "details": [
      {
        "field": "quantity",
        "issue": "Cannot issue more than available balance (6.00 available in location)"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-11-02T14:00:00Z",
    "request_id": "req-9842a1bc-7128"
  }
}
```

---

## 2. API Endpoint Catalogue

### 2.1 Authentication & Profile (`/api/v1/auth`)

| Method | Path | Required Permission | Request Body | Response Data | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Public | `{ username, password }` | `{ access_token, refresh_token, token_type, user: { id, username, full_name, role, office } }` | `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `ACCOUNT_INACTIVE` |
| `POST` | `/auth/logout` | Authenticated | `{ refresh_token }` | `{ message: "Logged out successfully" }` | `INVALID_TOKEN` |
| `POST` | `/auth/refresh` | Public | `{ refresh_token }` | `{ access_token, token_type }` | `TOKEN_EXPIRED`, `INVALID_TOKEN` |
| `GET` | `/auth/me` | `auth:profile_view` | None | Full profile of authenticated user, assigned office, role, and granular permission list | `UNAUTHORIZED` |
| `POST` | `/auth/change-password` | `auth:password_change` | `{ current_password, new_password, confirm_password }` | `{ message: "Password updated successfully" }` | `INVALID_CURRENT_PASSWORD`, `WEAK_PASSWORD` |
| `POST` | `/auth/admin-reset-password/{user_id}` | `users:admin_reset` | `{ temporary_password }` | `{ message: "Password reset initiated; user must change on first login" }` | `USER_NOT_FOUND`, `FORBIDDEN` |

---

### 2.2 Users & Role Governance (`/api/v1/users`, `/api/v1/roles`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/users` | `users:view` | Query: `office_id`, `role`, `status`, `search`, `page`, `limit` | Paginated list of user accounts with office and role metadata |
| `POST` | `/users` | `users:create` | `{ username, email, full_name, designation, phone_number, office_id, role_id, password }` | Newly created user account object |
| `GET` | `/users/{id}` | `users:view` | None | Detailed profile of specified user |
| `PATCH` | `/users/{id}` | `users:edit` | `{ full_name, designation, phone_number, office_id, role_id }` | Updated user account object |
| `PATCH` | `/users/{id}/status` | `users:status_manage` | `{ status: "ACTIVE" \| "INACTIVE" \| "LOCKED" \| "PASSWORD_RESET_REQUIRED", reason }` | Status change confirmation |
| `GET` | `/roles` | `roles:view` | None | List of all system roles with assigned permissions |
| `GET` | `/roles/{id}` | `roles:view` | None | Single role details with full permission matrix |
| `PATCH` | `/roles/{id}/permissions` | `roles:configure` | `{ permission_ids: [UUID, ...] }` | Updated role-permission configuration |

---

### 2.3 Offices, Locations & UOMs (`/api/v1/offices`, `/api/v1/locations`, `/api/v1/units-of-measure`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/offices` | `offices:view` | Query: `office_type`, `district`, `is_active`, `page`, `limit` | List of offices (filtered to assigned office unless cross-office permitted) |
| `POST` | `/offices` | `offices:create` | `{ code, name, office_type, district, taluka, address, contact_email, contact_phone }` | Registered office record |
| `GET` | `/offices/{id}` | `offices:view` | None | Office details |
| `PATCH` | `/offices/{id}` | `offices:edit` | `{ name, address, contact_email, contact_phone, is_active }` | Updated office record |
| `GET` | `/offices/{id}/summary` | `offices:view` | None | Inventory valuation, total assets, dead-stock count, pending requests |
| `GET` | `/locations` | `master:locations_view` | Query: `office_id`, `location_type`, `search`, `is_active` | List of rooms, stores, and yards in office |
| `POST` | `/locations` | `master:locations_manage` | `{ office_id, building_name, floor, room_number, location_type, description }` | Created location record |
| `GET` | `/locations/{id}` | `master:locations_view` | None | Location details with asset occupancy count |
| `PATCH` | `/locations/{id}` | `master:locations_manage` | `{ building_name, floor, room_number, location_type, description, is_active }` | Updated location record |
| `DELETE` | `/locations/{id}` | `master:locations_manage` | None | Soft deactivates location (fails if active assets assigned) |
| `GET` | `/units-of-measure` | `inventory:view` | None | List of units of measure (`NOS`, `BOX`, `KG`, `MTR`, etc.) |
| `POST` | `/units-of-measure` | `master:uom_manage` | `{ code, name }` | Created unit of measure |

---

### 2.4 Categories & Classification Rules (`/api/v1/categories`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/categories` | `master:categories_view` | Query: `parent_id`, `is_active`, `search` | Hierarchical tree or flat list of Category objects: `[{ id, code, name, parent_id, slow_moving_threshold_days, inactivity_threshold_days, obsolescence_years, depreciation_rate_pct, is_active }, ...]` |
| `POST` | `/categories` | `master:categories_manage` | `{ code, name, parent_id, slow_moving_threshold_days, inactivity_threshold_days, obsolescence_years, depreciation_rate_pct }` | Created Category object with classification thresholds (`slow_moving_threshold_days`, `inactivity_threshold_days`, `obsolescence_years`, `depreciation_rate_pct`) |
| `GET` | `/categories/{id}` | `master:categories_view` | None | Category object with all classification parameters (`slow_moving_threshold_days`, `inactivity_threshold_days`, `obsolescence_years`, `depreciation_rate_pct`) and assigned item count |
| `PATCH` | `/categories/{id}` | `master:categories_manage` | `{ name, slow_moving_threshold_days, inactivity_threshold_days, obsolescence_years, depreciation_rate_pct, is_active }` | Updated Category object reflecting new classification parameters |
| `DELETE` | `/categories/{id}` | `master:categories_manage` | None | Soft deactivates category (fails if active items exist) |

---

### 2.5 Role-Based Dashboards (`/api/v1/dashboard`)

| Method | Path | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/dashboard/admin` | `dashboard:admin_view` | Executive cross-office KPIs: total registered items, active value, dead stock count & value, pending approvals, recent audit events, office distribution |
| `GET` | `/dashboard/officer` | `dashboard:officer_view`| Store Officer supervisory KPIs: office inventory status, pending condemnation reviews, physical verification discrepancies, maintenance due, warranty alerts |
| `GET` | `/dashboard/staff` | `dashboard:staff_view` | Store Staff operational KPIs: available stock, recent receipts/issues created by user, pending returns, assigned verification tasks |
| `GET` | `/dashboard/alerts-summary` | `alerts:view` | Unresolved alerts count grouped by type (`INACTIVITY`, `WARRANTY`, `MAINTENANCE`, `STOCK`) and severity |

---

### 2.6 Core Inventory Master (`/api/v1/items`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/items` | `inventory:view` | Query: `office_id`, `category_id`, `location_id`, `item_type`, `condition`, `operational_status`, `classification`, `search`, `page`, `limit`, `sort_by`, `sort_order` | Paginated asset/item register |
| `POST` | `/items` | `inventory:create` | `{ office_id, category_id, location_id, supplier_id, procurement_item_id?, uom_id, item_name, item_type, brand, model_number, serial_number, purchase_date, invoice_number, unit_purchase_cost, condition, current_custodian, current_department, min_stock_level, is_legacy, legacy_reference_number }` | Registered asset object with auto-generated `item_code` and `barcode_number` |
| `GET` | `/items/{id}` | `inventory:view` | None | Complete 360° asset details (custodian, specs, location, warranty, docs) |
| `PATCH` | `/items/{id}` | `inventory:edit` | `{ item_name, condition, current_custodian, current_department, location_id, min_stock_level }` (Blocked if `DISPOSED`) | Updated asset details |
| `GET` | `/items/{id}/history` | `inventory:view` | Query: `event_type`, `start_date`, `end_date` | Chronological timeline of receipts, issues, returns, transfers, repairs, audits |
| `POST` | `/items/bulk-import` | `inventory:import` | Multipart form: `file` (CSV/XLSX), `dry_run: boolean` | Import validation summary, error list, row-level preview or commit result |
| `GET` | `/items/export` | `inventory:export` | Query: Same filters as `GET /items`, `format: "csv" \| "xlsx"` | Streaming file download |

---

### 2.7 Stock Transactions & Inventory Movement Ledger (`/api/v1/transactions`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/transactions/receipts` | `stock:receipt_view` | Query: `office_id`, `supplier_id`, `status`, `start_date`, `end_date`, `page`, `limit` | List of inward receipt vouchers |
| `POST` | `/transactions/receipts` | `stock:receipt_create` | `{ office_id, supplier_id, reference_document, remarks, idempotency_key?, lines: [{ procurement_item_id?, item_id, quantity, unit_cost, condition_observed, remarks }, ...] }` | Created Receipt in `DRAFT` state |
| `POST` | `/transactions/receipts/{id}/post` | `stock:receipt_create` | None | Atomically posts receipt, writes to movement ledger, increments `stock_balances`, updates `procurement_items.quantity_received`, marks `POSTED` |
| `GET` | `/transactions/issues` | `stock:issue_view` | Query: `office_id`, `recipient_name`, `status`, `start_date`, `end_date`, `page`, `limit` | List of stock issue vouchers |
| `POST` | `/transactions/issues` | `stock:issue_create` | `{ office_id, source_location_id, recipient_name, recipient_department, reference_document, remarks, idempotency_key?, lines: [{ item_id, quantity, remarks }, ...] }` | Created Issue in `DRAFT` state |
| `POST` | `/transactions/issues/{id}/post` | `stock:issue_create` | None | Locks balance with `FOR UPDATE`, validates available stock, decrements balance, updates asset custodian/status, marks `POSTED` |
| `GET` | `/transactions/returns` | `stock:return_view` | Query: `office_id`, `original_transaction_id`, `page`, `limit` | List of return vouchers |
| `POST` | `/transactions/returns` | `stock:return_create` | `{ office_id, destination_location_id, original_transaction_id, recipient_name, remarks, idempotency_key?, lines: [{ original_line_id, item_id, quantity, condition_observed, remarks }, ...] }` | Created Return in `DRAFT` state |
| `POST` | `/transactions/returns/{id}/post` | `stock:return_create` | None | Locks original line `FOR UPDATE`, validates `cumulative_returned + qty <= issued`, increments store balance, updates condition, routes damaged items, marks `POSTED` |
| `GET` | `/transactions/transfers` | `stock:transfer_view` | Query: `source_office_id`, `destination_office_id`, `status`, `page`, `limit` | List of inter-store/office transfer orders |
| `POST` | `/transactions/transfers` | `stock:transfer_req` | `{ source_office_id, destination_office_id, source_location_id, destination_location_id, reason, idempotency_key?, lines: [{ item_id, quantity }, ...] }` | Transfer order created (`SUBMITTED`) |
| `POST` | `/transactions/transfers/{id}/approve` | `stock:transfer_app` | `{ remarks }` | Approves transfer (`APPROVED` / `IN_TRANSIT`) |
| `POST` | `/transactions/transfers/{id}/complete` | `stock:transfer_comp` | `{ remarks, destination_location_id }` | Confirms receipt at destination; atomically records arrival in destination ledger |
| `POST` | `/transactions/{id}/reversal` | `stock:reversal_create`| `{ reversal_reason: string }` | Posts an offsetting `REVERSAL_CORRECTION` voucher linking to original ID |
| `GET` | `/transactions/{id}` | `stock:receipt_view` | None | Detailed transaction voucher with line items, actor, and linked audit records |

---

### 2.8 Classification & Dead Stock (`/api/v1/classifications`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/classifications/summary` | `classify:view` | Query: `office_id` | Count of items in `ACTIVE`, `SLOW_MOVING`, `NON_MOVING`, `OBSOLETE` |
| `GET` | `/classifications/dead-stock` | `classify:view` | Query: `office_id`, `category_id`, `classification: "NON_MOVING" \| "OBSOLETE"`, `condition`, `min_age_days`, `page`, `limit` | Official Dead Stock Register candidates |
| `POST` | `/classifications/run` | `classify:run` | `{ office_id: UUID, category_id?: UUID }` | Triggers background engine; returns count of evaluated and updated items |
| `POST` | `/classifications/{item_id}/override` | `classify:override` | `{ new_classification: "ACTIVE" \| "SLOW_MOVING" \| "NON_MOVING" \| "OBSOLETE", override_reason: string }` | Records authorized manual override with audit justification |
| `POST` | `/classifications/{item_id}/release-override` | `classify:override` | `{ release_reason: string }` | Releases manual override; restores system-calculated classification |

---

### 2.9 Barcodes & Physical Verification (`/api/v1/barcodes`, `/api/v1/verifications`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/barcodes/lookup` | `barcode:scan` | `{ barcode: string }` | Resolves item by barcode; returns asset summary, condition, status, location, custodian |
| `GET` | `/barcodes/{item_id}/label` | `barcode:print` | Query: `format: "svg" \| "png" \| "pdf"` | Printable barcode (Code 128) and QR label sheet layout |
| `GET` | `/verifications/sessions` | `verify:view` | Query: `office_id`, `status`, `page`, `limit` | List of audit sessions with completion % |
| `POST` | `/verifications/sessions` | `verify:create` | `{ office_id, scope_type: "FULL_OFFICE" \| "LOCATION" \| "CATEGORY", location_id?, category_id?, notes? }` | Initializes session; freezes expected snapshot into `verification_items` |
| `GET` | `/verifications/sessions/{id}` | `verify:view` | Query: `discrepancy_type`, `resolution_status`, `page`, `limit` | Audit workspace with expected vs found counts |
| `GET` | `/verifications/sessions/{id}/scans` | `verify:view` | Query: `scan_result`, `is_duplicate`, `page`, `limit` | Complete chronological history of scan events in session |
| `POST` | `/verifications/sessions/{id}/scan` | `verify:scan` | `{ scanned_barcode, scanned_location_id, observed_condition, counted_quantity, device_info?, remarks? }` | Logs scan event in `verification_scan_events`; updates `verification_items` |
| `POST` | `/verifications/sessions/{id}/reconcile` | `verify:reconcile` | `{ resolutions: [{ verification_item_id, resolution_status: "RESOLVED" \| "IGNORED", remarks }] }` | Store Officer records resolution remarks and supporting evidence |
| `POST` | `/verifications/sessions/{id}/complete` | `verify:reconcile` | `{ summary_remarks }` | Finalizes audit session; archives reconciliation report |

---

### 2.10 Suppliers, Procurement & RMA Returns (`/api/v1/suppliers`, `/api/v1/procurements`, `/api/v1/supplier-returns`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/suppliers` | `supplier:view` | Query: `search`, `is_active`, `page`, `limit` | Supplier directory list |
| `POST` | `/suppliers` | `supplier:manage` | `{ supplier_code, name, contact_person, phone, email, address, gstin, pan }` | Created supplier record (checks GSTIN/name duplication) |
| `GET` | `/suppliers/{id}` | `supplier:view` | None | Supplier profile |
| `PATCH` | `/suppliers/{id}` | `supplier:manage` | `{ name, contact_person, phone, email, address, gstin, pan, is_active }` | Updated supplier record |
| `GET` | `/suppliers/{id}/history` | `supplier:view` | None | Procurement history and delivered items list |
| `GET` | `/procurements` | `supplier:view` | Query: `office_id`, `supplier_id`, `status`, `page`, `limit` | List of purchase records |
| `POST` | `/procurements` | `supplier:manage` | `{ office_id, supplier_id, order_date, invoice_number, items: [{ item_description, category_id, item_type, quantity_ordered, unit_price, tax_rate_pct }] }` | Purchase order record with line items in `procurement_items` |
| `GET` | `/procurements/{id}` | `supplier:view` | None | Detailed procurement order with item lines and inward receipt links |
| `PATCH` | `/procurements/{id}` | `supplier:manage` | `{ invoice_number, status }` | Updated procurement header |
| `GET` | `/supplier-returns` | `supplier:rma_view` | Query: `supplier_id`, `status`, `page`, `limit` | List of RMA / vendor return requests |
| `POST` | `/supplier-returns` | `supplier:rma_manage` | `{ office_id, supplier_id, item_id, procurement_id?, warranty_id?, return_date, quantity, reason, rma_reference_number }` | Initiates vendor return / RMA (`INITIATED`) |
| `GET` | `/supplier-returns/{id}` | `supplier:rma_view` | None | Return dossier with tracking status |
| `PATCH` | `/supplier-returns/{id}` | `supplier:rma_manage` | `{ status, rma_reference_number }` | Updates return status |
| `POST` | `/supplier-returns/{id}/dispatch` | `supplier:rma_manage` | `{ dispatch_date, return_tracking_number, carrier_name }` | Dispatches item to vendor (`DISPATCHED_TO_VENDOR`); moves consumable balance to `in_vendor_rma_qty` |
| `POST` | `/supplier-returns/{id}/vendor-response` | `supplier:rma_manage` | `{ response: "ACCEPT" \| "REJECT", rejection_reason?: string, vendor_acknowledgement_date: date }` | Records vendor assessment |
| `POST` | `/supplier-returns/{id}/resolve` | `supplier:rma_manage` | `{ resolution_type: "REPLACEMENT" \| "CREDIT_NOTE" \| "REFUND" \| "REPAIRED_RETURN", resolution_remarks, replacement_item_id?, credit_note_number?, credit_amount?, refund_reference_number?, refund_amount? }` | Finalizes vendor return resolution (`COMPLETED_CLOSED`) |

---

### 2.11 Warranties & Maintenance (`/api/v1/warranties`, `/api/v1/maintenance`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/warranties` | `warranty:view` | Query: `item_id`, `supplier_id`, `is_expired`, `page`, `limit` | List of asset warranties |
| `POST` | `/warranties` | `inventory:edit` | `{ item_id, supplier_id, provider_name, start_date, end_date, coverage_details, support_contact }` | Registered warranty record |
| `GET` | `/warranties/{id}` | `warranty:view` | None | Detailed warranty terms and attached document |
| `PATCH` | `/warranties/{id}` | `inventory:edit` | `{ provider_name, end_date, coverage_details, support_contact }` | Updated warranty details |
| `GET` | `/warranties/expiring` | `warranty:view` | Query: `lead_days: 30 \| 60 \| 90` | Filtered list of assets with warranty expiring within lead window |
| `GET` | `/maintenance` | `maintenance:view` | Query: `office_id`, `item_id`, `status`, `page`, `limit` | Maintenance and repair log |
| `POST` | `/maintenance` | `maintenance:log` | `{ item_id, office_id, issue_description, service_provider, reported_date, estimated_cost }` | Creates ticket; updates asset status to `UNDER_MAINTENANCE` |
| `GET` | `/maintenance/{id}` | `maintenance:view` | None | Maintenance ticket with work details and invoices |
| `PATCH` | `/maintenance/{id}` | `maintenance:update` | `{ service_provider, estimated_cost, actual_cost, status, work_performed, invoice_reference }` | Updates repair progress |
| `POST` | `/maintenance/{id}/complete` | `maintenance:update` | `{ completion_date, actual_cost, work_performed, invoice_reference, resulting_condition: "GOOD" \| "FAIR" \| "SCRAP" }` | Closes repair; updates cumulative repair cost; restores asset status based on condition |

---

### 2.12 Alerts & Notifications (`/api/v1/alerts`, `/api/v1/notifications`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/alerts` | `alerts:view` | Query: `office_id`, `alert_type`, `priority`, `status`, `page`, `limit` | List of system condition alerts |
| `GET` | `/alerts/{id}` | `alerts:view` | None | Single alert detail with linked asset |
| `POST` | `/alerts/run-check` | `settings:manage` | None | Manually triggers background evaluation of inactivity, warranty, and maintenance alerts |
| `POST` | `/alerts/{id}/acknowledge` | `alerts:resolve` | None | Marks alert as acknowledged |
| `POST` | `/alerts/{id}/resolve` | `alerts:resolve` | `{ resolution_remarks: string }` | Resolves alert |
| `POST` | `/alerts/{id}/snooze` | `alerts:resolve` | `{ snooze_days: integer }` | Snoozes alert; suppresses re-triggering until snooze expiry |
| `GET` | `/notifications` | Authenticated | Query: `is_read`, `page`, `limit` | Logged-in user's in-app notification feed |
| `GET` | `/notifications/unread-count`| Authenticated | None | `{ unread_count: integer }` |
| `PATCH` | `/notifications/{id}/read` | Authenticated | None | Marks individual notification as read |
| `POST` | `/notifications/mark-all-read`| Authenticated| None | Marks all notifications for user as read |

---

### 2.13 Condemnation & Disposal Workflow (`/api/v1/condemnations`, `/api/v1/disposals`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/condemnations` | `condemn:view` | Query: `office_id`, `status`, `reason_code`, `page`, `limit` | List of condemnation proposals by tab |
| `POST` | `/condemnations` | `condemn:submit` | `{ office_id, reason_code, condition_summary, items: [{ item_id, item_condition, assessed_scrap_value, inspector_remarks }, ...] }` | Creates proposal (`SUBMITTED`); updates items to `PENDING_CONDEMNATION` |
| `GET` | `/condemnations/{id}` | `condemn:view` | None | Condemnation dossier with item list, photos, and review timeline |
| `POST` | `/condemnations/{id}/review` | `condemn:review` | `{ action: "REVIEW", remarks }` | Store Officer records review notes (`UNDER_REVIEW`) |
| `POST` | `/condemnations/{id}/decision` | `condemn:approve` | `{ action: "APPROVE" \| "REJECT" \| "REQUEST_INFO", order_number?, remarks }` | Approves or rejects condemnation; on approval updates items to `PENDING_DISPOSAL` |
| `GET` | `/disposals` | `disposal:view` | Query: `office_id`, `disposal_method`, `start_date`, `end_date`, `page`, `limit` | Official Disposal Register |
| `POST` | `/disposals` | `disposal:execute` | `{ request_id, office_id, disposal_method, disposal_date, total_sale_proceeds, recipient_agency, reference_order_number, items: [{ item_id, disposed_qty, realized_amount }] }` | Executes disposal: writes `DISPOSAL_WRITEOFF` to ledger, updates items to `DISPOSED`, archives disposal |
| `GET` | `/disposals/{id}` | `disposal:view` | None | Disposal certificate voucher with realized proceeds |

---

### 2.14 Reports & Exports (`/api/v1/reports`)

| Method | Path | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/reports/stock-register` | `reports:view` | Current Stock Register (Item, Category, Store Location, Available Balance, Condition, Status) |
| `GET` | `/reports/asset-register` | `reports:view` | Capital Asset Register (Asset Code, Purchase Date, Cost, Supplier, Warranty, Location, Custodian) |
| `GET` | `/reports/stock-quantity` | `reports:view` | Stock Quantity Report by Item, Category, Office, and Location |
| `GET` | `/reports/asset-valuation` | `reports:view` | Financial Valuation Report (Purchase Cost, Age, Straight-Line Estimated Depreciation) |
| `GET` | `/reports/movements` | `reports:view` | Inventory Movement Register (Receipts, Issues, Returns, Transfers with Actor and Date) |
| `GET` | `/reports/dead-stock` | `reports:view` | Official Dead Stock Register (Classification, Inactivity Days, Condition, Purchase Cost) |
| `GET` | `/reports/condemnations` | `reports:view` | Condemnation Proposal Register (Request No, Reason, Items, Approval Status, Order No) |
| `GET` | `/reports/disposals` | `reports:view` | Official Disposal Register (Method, Date, Realized Value, Buyer Agency, Sanction Order) |
| `GET` | `/reports/suppliers-procurement`| `reports:view` | Supplier & Procurement History Report |
| `GET` | `/reports/warranties` | `reports:view` | Warranty Coverage and Expiry Status Report |
| `GET` | `/reports/maintenance` | `reports:view` | Maintenance & Repair Cost History Report |
| `GET` | `/reports/physical-verification`| `reports:view` | Physical Verification Audit and Discrepancy Reconciliation Report |
| `POST` | `/reports/generate-export` | `reports:export` | Generates streaming file export (`format: "csv" \| "xlsx" \| "pdf"`) with report parameters and headers |

---

### 2.15 System Settings, Documents & Audit Trail (`/api/v1/settings`, `/api/v1/documents`, `/api/v1/audit`)

| Method | Path | Required Permission | Request Body / Query Params | Response Data |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/settings` | `settings:view` | Query: `office_id?`, `category?` | Returns key-value dictionary of system settings with office override resolution |
| `GET` | `/settings/{category}` | `settings:view` | None | Returns settings for category (`CLASSIFICATION`, `NOTIFICATIONS`, `APPROVAL_WORKFLOW`, etc.) |
| `PATCH` | `/settings` | `settings:manage` | `{ office_id?, settings: [{ setting_key, setting_value }, ...] }` | Updates multiple configuration parameters with audit logging |
| `PATCH` | `/settings/{category}/{key}`| `settings:manage` | `{ office_id?, setting_value }` | Updates single parameter value |
| `POST` | `/settings/reset-defaults` | `settings:manage` | `{ category? }` | Restores default parameters |
| `POST` | `/documents/upload` | `documents:upload` | Multipart form: `file`, `related_entity_type`, `related_entity_id`, `document_category` | Validates file type, size, prevents traversal; returns stored document object |
| `GET` | `/documents/{id}/download` | `documents:view` | None | Authenticated streaming binary file download |
| `GET` | `/audit/logs` | `audit:view` | Query: `user_id`, `office_id`, `module`, `action`, `start_date`, `end_date`, `page`, `limit` | Filterable append-only audit trail with old/new JSON diffs |
