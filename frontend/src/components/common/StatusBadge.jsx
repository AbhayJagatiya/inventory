import { cn } from '../../utils/cn'
import {
  CLASSIFICATIONS,
  OPERATIONAL_STATUSES,
  TRANSACTION_STATUSES,
  CONDEMNATION_STATUSES,
  ALERT_PRIORITIES,
  ALERT_STATUSES,
  ITEM_CONDITIONS,
  MAINTENANCE_STATUSES,
  USER_STATUSES,
  TRANSFER_STATUSES,
  SUPPLIER_RETURN_STATUSES,
} from '../../constants/enums'

const STATUS_STYLES = {
  // Classification
  [CLASSIFICATIONS.ACTIVE]:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  [CLASSIFICATIONS.SLOW_MOVING]:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  [CLASSIFICATIONS.NON_MOVING]:
    'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
  [CLASSIFICATIONS.OBSOLETE]:
    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',

  // Operational Status
  [OPERATIONAL_STATUSES.AVAILABLE_IN_STORE]:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  [OPERATIONAL_STATUSES.IN_USE]:
    'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30',
  [OPERATIONAL_STATUSES.UNDER_MAINTENANCE]:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  [OPERATIONAL_STATUSES.DISPATCHED_TO_VENDOR]:
    'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30',
  [OPERATIONAL_STATUSES.PENDING_CONDEMNATION]:
    'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30',
  [OPERATIONAL_STATUSES.PENDING_DISPOSAL]:
    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
  [OPERATIONAL_STATUSES.DISPOSED]:
    'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20',

  // Transaction Status
  [TRANSACTION_STATUSES.DRAFT]:
    'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20',
  [TRANSACTION_STATUSES.POSTED]:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',

  // Transfer Status
  [TRANSFER_STATUSES.SUBMITTED]:
    'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30',
  [TRANSFER_STATUSES.APPROVED]:
    'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30',
  [TRANSFER_STATUSES.IN_TRANSIT]:
    'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30',
  [TRANSFER_STATUSES.COMPLETED]:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  [TRANSFER_STATUSES.REJECTED]:
    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',

  // Condemnation Status
  [CONDEMNATION_STATUSES.SUBMITTED]:
    'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30',
  [CONDEMNATION_STATUSES.UNDER_REVIEW]:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  [CONDEMNATION_STATUSES.MORE_INFO_REQUIRED]:
    'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30',
  [CONDEMNATION_STATUSES.APPROVED]:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  [CONDEMNATION_STATUSES.REJECTED]:
    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',

  // Item Condition
  [ITEM_CONDITIONS.GOOD]:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  [ITEM_CONDITIONS.FAIR]:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  [ITEM_CONDITIONS.DAMAGED]:
    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
  [ITEM_CONDITIONS.SCRAP]:
    'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20',

  // Alert Priority
  [ALERT_PRIORITIES.CRITICAL]:
    'bg-rose-500/20 text-rose-900 dark:text-rose-200 border-rose-500/40 font-semibold',
  [ALERT_PRIORITIES.HIGH]:
    'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30',
  [ALERT_PRIORITIES.MEDIUM]:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  [ALERT_PRIORITIES.LOW]:
    'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20',

  // Alert Status
  [ALERT_STATUSES.ACTIVE]:
    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
  [ALERT_STATUSES.ACKNOWLEDGED]:
    'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
  [ALERT_STATUSES.SNOOZED]:
    'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20',
  [ALERT_STATUSES.RESOLVED]:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',

  // Maintenance Status
  [MAINTENANCE_STATUSES.OPEN]:
    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
  [MAINTENANCE_STATUSES.IN_PROGRESS]:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  [MAINTENANCE_STATUSES.COMPLETED]:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  [MAINTENANCE_STATUSES.CANCELLED]:
    'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20',

  // User Status
  [USER_STATUSES.ACTIVE]:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  [USER_STATUSES.INACTIVE]:
    'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20',
  [USER_STATUSES.LOCKED]:
    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
  [USER_STATUSES.PASSWORD_RESET_REQUIRED]:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',

  // Supplier Return
  [SUPPLIER_RETURN_STATUSES.INITIATED]:
    'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30',
  [SUPPLIER_RETURN_STATUSES.DISPATCHED_TO_VENDOR]:
    'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30',
  [SUPPLIER_RETURN_STATUSES.VENDOR_ASSESSING]:
    'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  [SUPPLIER_RETURN_STATUSES.REJECTED_BY_VENDOR]:
    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
  [SUPPLIER_RETURN_STATUSES.COMPLETED_CLOSED]:
    'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
}

const LABEL_OVERRIDES = {
  AVAILABLE_IN_STORE: 'Available',
  SLOW_MOVING: 'Slow Moving',
  NON_MOVING: 'Non-Moving',
  MORE_INFO_REQUIRED: 'More Info Needed',
  PASSWORD_RESET_REQUIRED: 'Reset Required',
  DISPATCHED_TO_VENDOR: 'At Vendor',
  PENDING_CONDEMNATION: 'Pending Cond.',
  PENDING_DISPOSAL: 'Pending Disposal',
  COMPLETED_CLOSED: 'Closed',
  IN_TRANSIT: 'In Transit',
  IN_PROGRESS: 'In Progress',
}

function formatLabel(status) {
  if (!status) return ''
  return (
    LABEL_OVERRIDES[status] ||
    status
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  )
}

function StatusBadge({ status, label, className, size = 'sm' }) {
  const style = STATUS_STYLES[status] || 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20'
  const text = label || formatLabel(status)
  const sizeClass = size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-0.5'

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border shadow-2xs transition-colors',
        style,
        sizeClass,
        className
      )}
    >
      {text}
    </span>
  )
}

export default StatusBadge
