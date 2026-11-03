# Frontend Handoff: Module 02 – Role-Based Dashboards & Operational Summaries
## PS000214 – Dead Stock Inventory Management System

**Target Recipient:** Backend Engineering Teammate  
**Prepared By:** Frontend Architect (Ninu Handoff)  
**Organization:** District Development Office – Gir Somnath, Veraval, Gujarat  
**Version:** 1.0.0  
**Phase:** Phase 2 – Dashboards & Metrics

---

### 1. Module Overview
Module 02 provides distinct role-scoped operational dashboards for each of the three proposed roles:
- **System Admin:** High-level executive KPIs, inventory valuation, classification distribution pie chart, and system audit trail feed.
- **Store Officer:** Assigned office inventory KPIs, operational status bar chart, supervisory action queues (condemnations, transfers, audit discrepancies), and recent transactions.
- **Store Staff:** Daily operational metrics, 6-card quick store action panel (new item, receipt, issue, return, barcode scan, condemnation proposal), user's personal transaction history, and action items.

---

### 2. Pages and Components

#### Pages:
1. `DashboardRouter` (`/dashboard`): Inspects authenticated user role and renders role-appropriate dashboard variant.
2. `AdminDashboard`: Cross-office executive overview and classification trigger.
3. `OfficerDashboard`: Office-scoped supervisory controls and action queues.
4. `StaffDashboard`: Quick operational action launchers and daily stock overview.

#### Shared Widgets & Charts:
- `KPICard`: Reusable metric card with icon container, formatted value, subtitle, and loading skeleton.
- `ResponsiveContainer` + `PieChart`: Recharts visualization of Active vs Slow-Moving vs Non-Moving vs Obsolete assets.
- `ResponsiveContainer` + `BarChart`: Recharts distribution of assets by operational status.
- `ActionQueue`: Operational tasks requiring user action with direct deep links.

---

### 3. Input Fields & 4. Field Data Types
- Dashboards are primary read-only presentation interfaces.
- Filter controls:
  - `office_id` (UUID): Optional query filter for System Admin cross-office monitoring.
  - `start_date` / `end_date` (ISO Date string): Optional temporal filter for recent movement ledger events.

---

### 5. Required and Optional Fields
- All dashboard endpoints receive query filters optionally. When omitted, the backend defaults to the authenticated user's assigned `office_id`.

---

### 6. Validation Requirements
- The frontend strictly displays backend-computed totals and status distributions.
- The UI never invents or calculates stock balances or valuation totals on the client.
- Disposed assets are excluded from active stock counts while retained in historical/dead-stock figures.

---

### 7. Button Actions
- **Refresh Dashboard Button:** Invalidates TanStack Query cache and triggers refetch of metrics.
- **Run Classification Button (`AdminDashboard`):** Triggers `POST /api/v1/classifications/run` and displays success notification.
- **Scan Barcode Button (`Navbar` & Dashboards):** Navigates to `/verification/lookup`.
- **Quick Action Tiles (`StaffDashboard`):** Instant 1-click navigation to:
  - New Item (`/inventory/new`)
  - Inward Receipt (`/transactions/receipts/new`)
  - Stock Issue (`/transactions/issues/new`)
  - Stock Return (`/transactions/returns/new`)
  - Barcode Lookup (`/verification/lookup`)
  - Condemnation Proposal (`/dead-stock/condemnations`)

---

### 8. Search and Filter Requirements
- Dashboard summaries respect office-level data isolation:
  - System Admin: Can toggle offices if cross-office permission is active.
  - Store Officer & Staff: Strictly scoped to assigned office (`office_id = user.office_id`).

---

### 9. API Endpoint Requirements & 10. HTTP Methods

| Operation | HTTP Method | Route | Permission Required |
|:---|:---:|:---|:---|
| Admin Executive KPIs | `GET` | `/api/v1/dashboard/admin` | `dashboard:admin_view` |
| Store Officer Supervisory KPIs | `GET` | `/api/v1/dashboard/officer` | `dashboard:officer_view` |
| Store Staff Operational KPIs | `GET` | `/api/v1/dashboard/staff` | `dashboard:staff_view` |
| Unresolved Alerts Grouping | `GET` | `/api/v1/dashboard/alerts-summary` | `alerts:view` |

---

### 11. Request JSON Examples
None (All dashboard endpoints are `GET` requests with optional query parameters).

Example Request:
`GET /api/v1/dashboard/officer?office_id=off-vrv-001`

---

### 12. Expected Response JSON Examples

#### `GET /api/v1/dashboard/admin`:
```json
{
  "success": true,
  "data": {
    "total_items": 384,
    "active_inventory_value": 4895600.00,
    "dead_stock_count": 42,
    "dead_stock_value": 618400.00,
    "pending_approvals": 7,
    "classification_breakdown": {
      "Active": 285,
      "Slow Moving": 57,
      "Non Moving": 28,
      "Obsolete": 14
    },
    "recent_audit_events": [
      {
        "id": "evt-001",
        "description": "Physical Verification Session discrepancy resolved",
        "actor_name": "R. K. Parmar",
        "created_at": "2026-11-04T08:30:00Z"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-11-04T09:00:00Z"
  }
}
```

#### `GET /api/v1/dashboard/officer`:
```json
{
  "success": true,
  "data": {
    "total_office_items": 384,
    "pending_condemnations": 4,
    "pending_transfers": 3,
    "verification_discrepancies": 2,
    "status_distribution": {
      "AVAILABLE_IN_STORE": 198,
      "IN_USE": 142,
      "UNDER_MAINTENANCE": 12,
      "DISPATCHED_TO_VENDOR": 3,
      "PENDING_CONDEMNATION": 8,
      "PENDING_DISPOSAL": 4,
      "DISPOSED": 17
    },
    "recent_movements": [
      {
        "id": "mov-001",
        "reference_number": "ISS-2026-00054",
        "transaction_type": "ISSUE",
        "item_name": "Desktop Computers (Core i5)",
        "quantity": 4,
        "status": "POSTED",
        "created_by_name": "H. N. Rathod",
        "created_at": "2026-11-04T07:15:00Z"
      }
    ]
  }
}
```

#### `GET /api/v1/dashboard/staff`:
```json
{
  "success": true,
  "data": {
    "available_stock_count": 198,
    "my_receipts_today": 3,
    "my_issues_today": 5,
    "tasks_pending_action": 2,
    "my_recent_transactions": [
      {
        "id": "txn-001",
        "voucher_number": "RCV-2026-00019",
        "type": "Stock Inward Receipt",
        "item_count": 4,
        "status": "POSTED",
        "created_at": "2026-11-04T08:00:00Z"
      }
    ],
    "action_queue": [
      {
        "title": "Complete Return Inspection for RET-2026-00007",
        "description": "Returned Biometric Device requires physical condition classification.",
        "action_url": "/transactions/returns"
      }
    ]
  }
}
```

---

### 13. Required Master Data
- Office record for Veraval (`OFF-GS-VRV-001`).
- Classification categories with active stock mapping.

---

### 14. Status and Enum Values
- **Classification Categories:** `ACTIVE`, `SLOW_MOVING`, `NON_MOVING`, `OBSOLETE`.
- **Operational Statuses:** `AVAILABLE_IN_STORE`, `IN_USE`, `UNDER_MAINTENANCE`, `DISPATCHED_TO_VENDOR`, `PENDING_CONDEMNATION`, `PENDING_DISPOSAL`, `DISPOSED`.

---

### 15. Error Handling
- Network / Server Errors: Render inline `ErrorState` with a "Retry" button.
- Empty lists: Render empty state illustration indicating no pending reviews or movements.
- Loading: Render `CardSkeleton` with pulsing placeholders preventing content layout shifts.

---

### 16. Backend Dependencies
- Summary aggregation queries on PostgreSQL tables: `items`, `stock_balances`, `stock_transactions`, `condemnation_requests`, and `verification_items`.
- Precedence classification engine service.

---

### 17. Testing Checklist
- [x] Correct dashboard renders according to logged-in user's role (`SYSTEM_ADMIN`, `STORE_OFFICER`, `STORE_STAFF`).
- [x] Currency values formatted using Indian numbering system (`₹48,95,600`).
- [x] Responsive layout collapses sidebars and reflows KPI cards on mobile/tablet viewports.
- [x] Refresh button triggers background query re-validation.

