// All permission codes from docs/role-permissions-matrix.md
export const PERMISSIONS = {
  // Auth & Profile
  AUTH_PROFILE_VIEW: 'auth:profile_view',
  AUTH_PASSWORD_CHANGE: 'auth:password_change',

  // User Management
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_EDIT: 'users:edit',
  USERS_STATUS_MANAGE: 'users:status_manage',
  USERS_ADMIN_RESET: 'users:admin_reset',

  // Roles
  ROLES_VIEW: 'roles:view',
  ROLES_CONFIGURE: 'roles:configure',

  // Offices
  OFFICES_VIEW: 'offices:view',
  OFFICES_CREATE: 'offices:create',
  OFFICES_EDIT: 'offices:edit',

  // Master Data
  MASTER_LOCATIONS_VIEW: 'master:locations_view',
  MASTER_LOCATIONS_MANAGE: 'master:locations_manage',
  MASTER_CATEGORIES_VIEW: 'master:categories_view',
  MASTER_CATEGORIES_MANAGE: 'master:categories_manage',
  MASTER_UOM_MANAGE: 'master:uom_manage',

  // Dashboards
  DASHBOARD_ADMIN_VIEW: 'dashboard:admin_view',
  DASHBOARD_OFFICER_VIEW: 'dashboard:officer_view',
  DASHBOARD_STAFF_VIEW: 'dashboard:staff_view',

  // Inventory
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_EDIT: 'inventory:edit',
  INVENTORY_IMPORT: 'inventory:import',
  INVENTORY_EXPORT: 'inventory:export',

  // Stock Transactions
  STOCK_RECEIPT_VIEW: 'stock:receipt_view',
  STOCK_RECEIPT_CREATE: 'stock:receipt_create',
  STOCK_ISSUE_VIEW: 'stock:issue_view',
  STOCK_ISSUE_CREATE: 'stock:issue_create',
  STOCK_RETURN_VIEW: 'stock:return_view',
  STOCK_RETURN_CREATE: 'stock:return_create',
  STOCK_TRANSFER_VIEW: 'stock:transfer_view',
  STOCK_TRANSFER_REQ: 'stock:transfer_req',
  STOCK_TRANSFER_APP: 'stock:transfer_app',
  STOCK_TRANSFER_COMP: 'stock:transfer_comp',
  STOCK_REVERSAL_CREATE: 'stock:reversal_create',

  // Classification
  CLASSIFY_VIEW: 'classify:view',
  CLASSIFY_RUN: 'classify:run',
  CLASSIFY_OVERRIDE: 'classify:override',

  // Barcodes
  BARCODE_SCAN: 'barcode:scan',
  BARCODE_PRINT: 'barcode:print',

  // Verification
  VERIFY_VIEW: 'verify:view',
  VERIFY_CREATE: 'verify:create',
  VERIFY_SCAN: 'verify:scan',
  VERIFY_RECONCILE: 'verify:reconcile',

  // Suppliers
  SUPPLIER_VIEW: 'supplier:view',
  SUPPLIER_MANAGE: 'supplier:manage',
  SUPPLIER_RMA_VIEW: 'supplier:rma_view',
  SUPPLIER_RMA_MANAGE: 'supplier:rma_manage',

  // Maintenance & Warranty
  MAINTENANCE_VIEW: 'maintenance:view',
  MAINTENANCE_LOG: 'maintenance:log',
  MAINTENANCE_UPDATE: 'maintenance:update',
  WARRANTY_VIEW: 'warranty:view',

  // Alerts
  ALERTS_VIEW: 'alerts:view',
  ALERTS_RESOLVE: 'alerts:resolve',

  // Condemnation & Disposal
  CONDEMN_VIEW: 'condemn:view',
  CONDEMN_SUBMIT: 'condemn:submit',
  CONDEMN_REVIEW: 'condemn:review',
  CONDEMN_APPROVE: 'condemn:approve',
  DISPOSAL_VIEW: 'disposal:view',
  DISPOSAL_EXECUTE: 'disposal:execute',

  // Reports
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',

  // Audit & Governance
  AUDIT_VIEW: 'audit:view',
  DOCUMENTS_UPLOAD: 'documents:upload',
  DOCUMENTS_VIEW: 'documents:view',
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_MANAGE: 'settings:manage',
}

