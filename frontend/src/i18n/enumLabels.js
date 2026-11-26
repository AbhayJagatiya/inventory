// Centralized mapping from backend/database enum values to i18n translation keys.
// Internal DB enum values remain unchanged (e.g. 'DAMAGED', 'AVAILABLE_IN_STORE').

export const ENUM_TRANSLATION_KEYS = {
  // Roles
  SYSTEM_ADMIN: 'roles.systemAdmin',
  STORE_OFFICER: 'roles.storeOfficer',
  STORE_STAFF: 'roles.storeStaff',

  // Item Types
  DURABLE_ASSET: 'itemType.durableAsset',
  CONSUMABLE_STOCK: 'itemType.consumableStock',

  // Conditions
  NEW: 'condition.new',
  GOOD: 'condition.good',
  FAIR: 'condition.fair',
  POOR: 'condition.poor',
  DAMAGED: 'condition.damaged',
  SCRAP: 'condition.scrap',

  // Operational Statuses
  AVAILABLE_IN_STORE: 'operationalStatus.availableInStore',
  IN_USE: 'operationalStatus.inUse',
  UNDER_MAINTENANCE: 'operationalStatus.underMaintenance',
  DISPATCHED_TO_VENDOR: 'operationalStatus.dispatchedToVendor',
  PENDING_CONDEMNATION: 'operationalStatus.pendingCondemnation',
  PENDING_DISPOSAL: 'operationalStatus.pendingDisposal',
  NON_FUNCTIONAL: 'operationalStatus.nonFunctional',
  DISPOSED: 'operationalStatus.disposed',

  // Classifications
  ACTIVE: 'status.active',
  SLOW_MOVING: 'classification.slowMoving',
  NON_MOVING: 'classification.nonMoving',
  OBSOLETE: 'classification.obsolete',

  // Transaction Types
  RECEIPT: 'transactionType.receipt',
  ISSUE: 'transactionType.issue',
  RETURN: 'transactionType.return',
  TRANSFER: 'transactionType.transfer',
  REVERSAL_CORRECTION: 'transactionType.reversalCorrection',
  DISPOSAL_WRITEOFF: 'transactionType.disposalWriteoff',
  SUPPLIER_RMA_OUT: 'transactionType.supplierRmaOut',
  SUPPLIER_RMA_IN: 'transactionType.supplierRmaIn',
  SUPPLIER_RMA_WRITEOFF: 'transactionType.supplierRmaWriteoff',

  // Transaction / Workflow Statuses
  DRAFT: 'status.draft',
  POSTED: 'status.posted',
  SUBMITTED: 'status.submitted',
  APPROVED: 'status.approved',
  IN_TRANSIT: 'status.inTransit',
  COMPLETED: 'status.completed',
  REJECTED: 'status.rejected',
  UNDER_REVIEW: 'status.underReview',
  MORE_INFO_REQUIRED: 'status.moreInfoRequired',
  CANCELLED: 'status.cancelled',

  // Disposal Methods
  PUBLIC_AUCTION: 'disposalMethod.publicAuction',
  SCRAP_SALE: 'disposalMethod.scrapSale',
  E_WASTE_RECYCLING: 'disposalMethod.eWasteRecycling',
  DESTRUCTION: 'disposalMethod.destruction',
  BUYBACK: 'disposalMethod.buyback',
  DESTRUCTION_BURIAL: 'disposalMethod.destructionBurial',
  DONATION_TRANSFER: 'disposalMethod.donationTransfer',

  // Condemnation Reasons
  BEYOND_ECONOMIC_REPAIR: 'condemnationReason.beyondEconomicRepair',
  DAMAGED_BEYOND_RECOVERY: 'condemnationReason.damagedBeyondRecovery',
  DESTROYED: 'condemnationReason.destroyed',

  // Alert Types
  INACTIVITY: 'alertType.inactivity',
  WARRANTY: 'alertType.warranty',
  MAINTENANCE: 'alertType.maintenance',
  STOCK: 'alertType.stock',

  // Alert Priorities
  CRITICAL: 'alertPriority.critical',
  HIGH: 'alertPriority.high',
  MEDIUM: 'alertPriority.medium',
  LOW: 'alertPriority.low',

  // Alert / User / Maintenance / Supplier Return Statuses
  ACKNOWLEDGED: 'status.acknowledged',
  SNOOZED: 'status.snoozed',
  RESOLVED: 'status.resolved',
  INACTIVE: 'status.inactive',
  LOCKED: 'status.locked',
  PASSWORD_RESET_REQUIRED: 'status.passwordResetRequired',
  OPEN: 'status.open',
  IN_PROGRESS: 'status.inProgress',
  INITIATED: 'status.initiated',
  VENDOR_ASSESSING: 'status.vendorAssessing',
  REJECTED_BY_VENDOR: 'status.rejectedByVendor',
  COMPLETED_CLOSED: 'status.closedCompleted',

  // Location Types
  STORE_ROOM: 'locationType.storeRoom',
  OFFICE_ROOM: 'locationType.officeRoom',
  STORE_YARD: 'locationType.storeYard',
  IT_ROOM: 'locationType.itRoom',
  ARCHIVE: 'locationType.archive',

  // Scope Types & Verification Sessions / Results
  FULL_OFFICE: 'scopeType.fullOffice',
  LOCATION: 'scopeType.location',
  CATEGORY: 'scopeType.category',
  PLANNED: 'status.planned',

  // Discrepancy Flags & Verification Results
  NONE: 'verification.enums.none',
  NOT_FOUND: 'verification.enums.notFound',
  UNEXPECTED_ITEM: 'verification.enums.unexpectedItem',
  LOCATION_MISMATCH: 'verification.enums.locationMismatch',
  CONDITION_MISMATCH: 'verification.enums.conditionMismatch',
  DUPLICATE_SUSPECTED: 'verification.enums.duplicateSuspected',
  MATCHED_VERIFIED: 'verification.enums.matchedVerified',
  UNKNOWN_BARCODE: 'verification.enums.unknownBarcode',
  DUPLICATE_SCAN_REPEATED: 'verification.enums.duplicateScanRepeated',
  IGNORED: 'verification.enums.ignored',

  // Extra Location Types & Audit Events
  RECORD_ROOM: 'locationType.recordRoom',
  OPEN_YARD: 'locationType.openYard',
  VERIFICATION_SCAN: 'auditEvents.verificationScan',
  VERIFICATION_AUDIT: 'auditEvents.verificationAudit',
  VERIFY_UPDATE: 'auditEvents.verifyUpdate',
  MAINTENANCE: 'auditEvents.maintenance',
  RECEIPT: 'auditEvents.receipt',
  ISSUE: 'auditEvents.issue',
  RETURN: 'auditEvents.return',
  TRANSFER: 'auditEvents.transfer',
}

/**
 * Translates seeded master records (default categories, UOMs, offices) by code
 * while keeping custom user-entered master names verbatim as fallback.
 */
export function translateMasterName(t, kind, code, fallbackName) {
  if (!code) return fallbackName || ''
  const key = `master.${kind}.${code}`
  const translated = t(key)
  if (translated && translated !== key) {
    return translated
  }
  return fallbackName || code
}

/**
 * Translate a backend enum value using the active t() function.
 * Falls back to formatted title case if no translation key exists.
 */
export function translateEnum(t, value, contextPrefix = null) {
  if (!value) return ''
  if (contextPrefix) {
    const contextKey = `${contextPrefix}.${value.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`
    const translated = t(contextKey)
    if (translated && translated !== contextKey.split('.').pop()) {
      return translated
    }
  }
  const key = ENUM_TRANSLATION_KEYS[value]
  if (key) return t(key)
  return String(value)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}
