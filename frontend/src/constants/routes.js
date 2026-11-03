// Application route paths — single source of truth
export const ROUTES = {
  // Auth
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',

  // Dashboard (resolved by role)
  DASHBOARD: '/dashboard',

  // Inventory
  INVENTORY: '/inventory',
  INVENTORY_NEW: '/inventory/new',
  INVENTORY_DETAIL: (id = ':id') => `/inventory/${id}`,
  INVENTORY_EDIT: (id = ':id') => `/inventory/${id}/edit`,
  INVENTORY_CATEGORIES: '/inventory/categories',
  INVENTORY_LOCATIONS: '/inventory/locations',

  // Transactions
  TRANSACTIONS: '/transactions',
  RECEIPTS: '/transactions/receipts',
  RECEIPTS_NEW: '/transactions/receipts/new',
  RECEIPT_DETAIL: (id = ':id') => `/transactions/receipts/${id}`,
  ISSUES: '/transactions/issues',
  ISSUES_NEW: '/transactions/issues/new',
  ISSUE_DETAIL: (id = ':id') => `/transactions/issues/${id}`,
  RETURNS: '/transactions/returns',
  RETURNS_NEW: '/transactions/returns/new',
  RETURN_DETAIL: (id = ':id') => `/transactions/returns/${id}`,
  TRANSFERS: '/transactions/transfers',
  TRANSFERS_NEW: '/transactions/transfers/new',
  TRANSFER_DETAIL: (id = ':id') => `/transactions/transfers/${id}`,

  // Dead Stock
  DEAD_STOCK: '/dead-stock',
  DEAD_STOCK_REGISTER: '/dead-stock/register',
  CONDEMNATIONS: '/dead-stock/condemnations',
  CONDEMNATION_DETAIL: (id = ':id') => `/dead-stock/condemnations/${id}`,
  DISPOSALS: '/dead-stock/disposals',

  // Verification & Barcodes
  BARCODE_LOOKUP: '/verification/lookup',
  VERIFICATION_SESSIONS: '/verification/sessions',
  VERIFICATION_SESSION_DETAIL: (id = ':id') => `/verification/sessions/${id}`,

  // Suppliers
  SUPPLIERS: '/suppliers',
  SUPPLIER_DETAIL: (id = ':id') => `/suppliers/${id}`,
  PROCUREMENT: '/suppliers/procurement',
  PROCUREMENT_DETAIL: (id = ':id') => `/suppliers/procurement/${id}`,
  SUPPLIER_RETURNS: '/suppliers/returns',
  SUPPLIER_RETURN_DETAIL: (id = ':id') => `/suppliers/returns/${id}`,

  // Maintenance
  MAINTENANCE: '/maintenance',
  WARRANTIES: '/maintenance/warranties',

  // Alerts
  ALERTS: '/alerts',
  NOTIFICATIONS: '/notifications',

  // Reports
  REPORTS: '/reports',
  REPORT_VIEW: (type = ':reportType') => `/reports/${type}`,

  // Administration
  USERS: '/administration/users',
  USER_DETAIL: (id = ':id') => `/administration/users/${id}`,
  ROLES: '/administration/roles',
  OFFICES: '/administration/offices',
  MASTER_DATA: '/administration/master-data',
  SETTINGS: '/administration/settings',

  // Audit & Profile
  AUDIT: '/audit',
  PROFILE: '/profile',

  // Error pages
  UNAUTHORIZED: '/unauthorized',
  NOT_FOUND: '/not-found',
}

