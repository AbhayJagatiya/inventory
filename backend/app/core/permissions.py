"""Role and Permissions Definitions

Maps standard application roles to approved permissions from docs/role-permissions-matrix.md.
"""

from typing import Dict, List, Set

# System Roles
ROLE_SYSTEM_ADMIN = "SYSTEM_ADMIN"
ROLE_STORE_OFFICER = "STORE_OFFICER"
ROLE_STORE_STAFF = "STORE_STAFF"

ALL_ROLES = [ROLE_SYSTEM_ADMIN, ROLE_STORE_OFFICER, ROLE_STORE_STAFF]

# Master Permissions Dictionary: Code -> (Module, Action, Description)
PERMISSIONS_CATALOGUE = {
    # Auth
    "auth:profile_view": ("Auth", "view", "View own user profile"),
    "auth:password_change": ("Auth", "edit", "Change own account password"),

    # Users
    "users:view": ("Users", "view", "View user list and profiles"),
    "users:create": ("Users", "create", "Create new staff/officer accounts"),
    "users:edit": ("Users", "edit", "Edit user profiles and designations"),
    "users:status_manage": ("Users", "manage", "Activate, deactivate, or lock users"),
    "users:admin_reset": ("Users", "manage", "Reset user password (admin-assisted)"),

    # Roles
    "roles:view": ("Roles", "view", "View roles and assigned permissions"),
    "roles:configure": ("Roles", "manage", "Update role permission mappings"),

    # Offices
    "offices:view": ("Offices", "view", "View registered offices"),
    "offices:create": ("Offices", "create", "Add new Panchayat office"),
    "offices:edit": ("Offices", "edit", "Update office details"),

    # Master Data
    "master:locations_view": ("Master", "view", "View building and store locations"),
    "master:locations_manage": ("Master", "manage", "Create/edit room and shelf locations"),
    "master:categories_view": ("Master", "view", "View category tree"),
    "master:categories_manage": ("Master", "manage", "Create/edit categories & thresholds"),
    "master:uom_manage": ("Master", "manage", "Create/edit units of measure"),

    # Dashboards
    "dashboard:admin_view": ("Dashboard", "view", "View System Admin executive dashboard"),
    "dashboard:officer_view": ("Dashboard", "view", "View Store Officer supervisory dashboard"),
    "dashboard:staff_view": ("Dashboard", "view", "View Store Staff operational dashboard"),

    # Inventory
    "inventory:view": ("Inventory", "view", "View inventory register and items"),
    "inventory:create": ("Inventory", "create", "Register new durable asset or stock"),
    "inventory:edit": ("Inventory", "edit", "Edit non-disposed item details"),
    "inventory:import": ("Inventory", "manage", "Bulk import items via CSV/XLSX"),
    "inventory:export": ("Inventory", "export", "Export inventory register to Excel/CSV"),

    # Stock Transactions & Ledger
    "stock:receipt_view": ("Stock", "view", "View inward receipt vouchers"),
    "stock:receipt_create": ("Stock", "create", "Create & post goods inward receipts"),
    "stock:issue_view": ("Stock", "view", "View outward stock issues"),
    "stock:issue_create": ("Stock", "create", "Issue items to employee/department"),
    "stock:return_view": ("Stock", "view", "View returned stock vouchers"),
    "stock:return_create": ("Stock", "create", "Process item return with inspection"),
    "stock:transfer_view": ("Stock", "view", "View stock transfer orders"),
    "stock:transfer_req": ("Stock", "create", "Request inter-location transfer"),
    "stock:transfer_app": ("Stock", "approve", "Approve stock transfer"),
    "stock:transfer_comp": ("Stock", "manage", "Confirm receipt of transfer"),
    "stock:reversal_create": ("Stock", "create", "Post offsetting reversal/correction voucher"),

    # Classification & Dead Stock
    "classify:view": ("Classify", "view", "View classification & dead stock register"),
    "classify:run": ("Classify", "manage", "Trigger automated classification engine"),
    "classify:override": ("Classify", "manage", "Record or release authorized manual override"),

    # Barcodes
    "barcode:scan": ("Barcode", "view", "Scan barcode/QR for quick lookup"),
    "barcode:print": ("Barcode", "export", "Print barcode / QR label sheets"),

    # Physical Verification
    "verify:view": ("Verify", "view", "View verification sessions & scan logs"),
    "verify:create": ("Verify", "create", "Start verification audit session"),
    "verify:scan": ("Verify", "manage", "Scan and count items during audit session"),
    "verify:reconcile": ("Verify", "approve", "Reconcile discrepancies & complete audit"),

    # Suppliers & RMA
    "supplier:view": ("Supplier", "view", "View suppliers, orders, and history"),
    "supplier:manage": ("Supplier", "manage", "Create/edit suppliers and procurements"),
    "supplier:rma_view": ("Supplier", "view", "View supplier returns and RMA dossier"),
    "supplier:rma_manage": ("Supplier", "manage", "Initiate, dispatch & resolve vendor RMAs"),

    # Maintenance & Warranties
    "maintenance:view": ("Maintenance", "view", "View maintenance records"),
    "maintenance:log": ("Maintenance", "create", "Log issue / maintenance request"),
    "maintenance:update": ("Maintenance", "edit", "Record repair completion and cost"),
    "warranty:view": ("Maintenance", "view", "View warranty tracking and alerts"),

    # Alerts
    "alerts:view": ("Alerts", "view", "View alert center notifications"),
    "alerts:resolve": ("Alerts", "manage", "Acknowledge, resolve, or snooze alerts"),

    # Condemnation & Disposal
    "condemn:view": ("Condemnation", "view", "View condemnation proposals"),
    "condemn:submit": ("Condemnation", "create", "Submit condemnation proposal"),
    "condemn:review": ("Condemnation", "edit", "Review condemnation assessment"),
    "condemn:approve": ("Condemnation", "approve", "Approve condemnation request"),
    "disposal:view": ("Disposal", "view", "View official disposal register"),
    "disposal:execute": ("Disposal", "manage", "Execute auction/scrap & write off"),

    # Reports
    "reports:view": ("Reports", "view", "View official reports & analytics"),
    "reports:export": ("Reports", "export", "Download official PDF/Excel reports"),

    # Governance & Audit
    "audit:view": ("Audit", "view", "View security & operational logs"),
    "documents:upload": ("Documents", "create", "Upload documents and invoices"),
    "documents:view": ("Documents", "view", "View and download documents"),
    "settings:view": ("Settings", "view", "View system settings"),
    "settings:manage": ("Settings", "manage", "Update thresholds & configurations"),
}

# Role to Default Permissions Mapping
DEFAULT_ROLE_PERMISSIONS: Dict[str, List[str]] = {
    ROLE_SYSTEM_ADMIN: [
        "auth:profile_view", "auth:password_change",
        "users:view", "users:create", "users:edit", "users:status_manage", "users:admin_reset",
        "roles:view", "roles:configure",
        "offices:view", "offices:create", "offices:edit",
        "master:locations_view", "master:locations_manage", "master:categories_view", "master:categories_manage", "master:uom_manage",
        "dashboard:admin_view",
        "inventory:view", "inventory:create", "inventory:edit", "inventory:import", "inventory:export",
        "stock:receipt_view", "stock:receipt_create", "stock:issue_view", "stock:return_view",
        "stock:transfer_view", "stock:transfer_req", "stock:transfer_app", "stock:transfer_comp", "stock:reversal_create",
        "classify:view", "classify:run",
        "barcode:scan", "barcode:print",
        "verify:view",
        "supplier:view", "supplier:manage", "supplier:rma_view",
        "maintenance:view", "maintenance:log", "maintenance:update", "warranty:view",
        "alerts:view", "alerts:resolve",
        "condemn:view", "condemn:approve",
        "disposal:view", "disposal:execute",
        "reports:view", "reports:export",
        "audit:view", "documents:upload", "documents:view", "settings:view", "settings:manage",
    ],
    ROLE_STORE_OFFICER: [
        "auth:profile_view", "auth:password_change",
        "offices:view",
        "master:locations_view", "master:locations_manage", "master:categories_view", "master:categories_manage", "master:uom_manage",
        "dashboard:officer_view",
        "inventory:view", "inventory:create", "inventory:edit", "inventory:import", "inventory:export",
        "stock:receipt_view", "stock:receipt_create", "stock:issue_view", "stock:issue_create",
        "stock:return_view", "stock:return_create",
        "stock:transfer_view", "stock:transfer_req", "stock:transfer_app", "stock:transfer_comp", "stock:reversal_create",
        "classify:view", "classify:run", "classify:override",
        "barcode:scan", "barcode:print",
        "verify:view", "verify:create", "verify:scan", "verify:reconcile",
        "supplier:view", "supplier:manage", "supplier:rma_view", "supplier:rma_manage",
        "maintenance:view", "maintenance:log", "maintenance:update", "warranty:view",
        "alerts:view", "alerts:resolve",
        "condemn:view", "condemn:submit", "condemn:review", "condemn:approve",
        "disposal:view", "disposal:execute",
        "reports:view", "reports:export",
        "documents:upload", "documents:view",
    ],
    ROLE_STORE_STAFF: [
        "auth:profile_view", "auth:password_change",
        "offices:view",
        "master:locations_view", "master:categories_view",
        "dashboard:staff_view",
        "inventory:view", "inventory:create", "inventory:export",
        "stock:receipt_view", "stock:receipt_create", "stock:issue_view", "stock:issue_create",
        "stock:return_view", "stock:return_create",
        "stock:transfer_view", "stock:transfer_req", "stock:transfer_comp",
        "classify:view",
        "barcode:scan", "barcode:print",
        "verify:view", "verify:scan",
        "supplier:view", "supplier:rma_view",
        "maintenance:view", "maintenance:log", "warranty:view",
        "alerts:view",
        "condemn:view", "condemn:submit",
        "disposal:view",
        "reports:view", "reports:export",
        "documents:upload", "documents:view",
    ],
}

