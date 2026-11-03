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
  [CLASSIFICATIONS.ACTIVE]:      'bg-green-100 text-green-700',
  [CLASSIFICATIONS.SLOW_MOVING]: 'bg-amber-100 text-amber-700',
  [CLASSIFICATIONS.NON_MOVING]:  'bg-blue-100 text-blue-700',
  [CLASSIFICATIONS.OBSOLETE]:    'bg-red-100 text-red-700',

  // Operational Status
  [OPERATIONAL_STATUSES.AVAILABLE_IN_STORE]:    'bg-green-100 text-green-700',
  [OPERATIONAL_STATUSES.IN_USE]:                'bg-blue-100 text-blue-700',
  [OPERATIONAL_STATUSES.UNDER_MAINTENANCE]:     'bg-amber-100 text-amber-700',
  [OPERATIONAL_STATUSES.DISPATCHED_TO_VENDOR]:  'bg-purple-100 text-purple-700',
  [OPERATIONAL_STATUSES.PENDING_CONDEMNATION]:  'bg-orange-100 text-orange-700',
  [OPERATIONAL_STATUSES.PENDING_DISPOSAL]:      'bg-red-100 text-red-700',
  [OPERATIONAL_STATUSES.DISPOSED]:              'bg-slate-100 text-slate-500',

  // Transaction Status
  [TRANSACTION_STATUSES.DRAFT]:  'bg-slate-100 text-slate-600',
  [TRANSACTION_STATUSES.POSTED]: 'bg-green-100 text-green-700',

  // Transfer Status
  [TRANSFER_STATUSES.SUBMITTED]: 'bg-blue-100 text-blue-700',
  [TRANSFER_STATUSES.APPROVED]:  'bg-teal-100 text-teal-700',
  [TRANSFER_STATUSES.IN_TRANSIT]:'bg-purple-100 text-purple-700',
  [TRANSFER_STATUSES.COMPLETED]: 'bg-green-100 text-green-700',
  [TRANSFER_STATUSES.REJECTED]:  'bg-red-100 text-red-700',

  // Condemnation Status
  [CONDEMNATION_STATUSES.SUBMITTED]:         'bg-blue-100 text-blue-700',
  [CONDEMNATION_STATUSES.UNDER_REVIEW]:      'bg-amber-100 text-amber-700',
  [CONDEMNATION_STATUSES.MORE_INFO_REQUIRED]:'bg-orange-100 text-orange-700',
  [CONDEMNATION_STATUSES.APPROVED]:          'bg-green-100 text-green-700',
  [CONDEMNATION_STATUSES.REJECTED]:          'bg-red-100 text-red-700',

  // Item Condition
  [ITEM_CONDITIONS.GOOD]:    'bg-green-100 text-green-700',
  [ITEM_CONDITIONS.FAIR]:    'bg-amber-100 text-amber-700',
  [ITEM_CONDITIONS.DAMAGED]: 'bg-red-100 text-red-700',
  [ITEM_CONDITIONS.SCRAP]:   'bg-slate-100 text-slate-500',

  // Alert Priority
  [ALERT_PRIORITIES.CRITICAL]: 'bg-red-100 text-red-700',
  [ALERT_PRIORITIES.HIGH]:     'bg-orange-100 text-orange-700',
  [ALERT_PRIORITIES.MEDIUM]:   'bg-amber-100 text-amber-700',
  [ALERT_PRIORITIES.LOW]:      'bg-slate-100 text-slate-600',

  // Alert Status
  [ALERT_STATUSES.ACTIVE]:       'bg-red-100 text-red-700',
  [ALERT_STATUSES.ACKNOWLEDGED]: 'bg-blue-100 text-blue-700',
  [ALERT_STATUSES.SNOOZED]:      'bg-slate-100 text-slate-600',
  [ALERT_STATUSES.RESOLVED]:     'bg-green-100 text-green-700',

  // Maintenance Status
  [MAINTENANCE_STATUSES.OPEN]:        'bg-red-100 text-red-700',
  [MAINTENANCE_STATUSES.IN_PROGRESS]: 'bg-amber-100 text-amber-700',
  [MAINTENANCE_STATUSES.COMPLETED]:   'bg-green-100 text-green-700',
  [MAINTENANCE_STATUSES.CANCELLED]:   'bg-slate-100 text-slate-500',

  // User Status
  [USER_STATUSES.ACTIVE]:                  'bg-green-100 text-green-700',
  [USER_STATUSES.INACTIVE]:                'bg-slate-100 text-slate-500',
  [USER_STATUSES.LOCKED]:                  'bg-red-100 text-red-700',
  [USER_STATUSES.PASSWORD_RESET_REQUIRED]: 'bg-amber-100 text-amber-700',

  // Supplier Return
  [SUPPLIER_RETURN_STATUSES.INITIATED]:            'bg-blue-100 text-blue-700',
  [SUPPLIER_RETURN_STATUSES.DISPATCHED_TO_VENDOR]: 'bg-purple-100 text-purple-700',
  [SUPPLIER_RETURN_STATUSES.VENDOR_ASSESSING]:     'bg-amber-100 text-amber-700',
  [SUPPLIER_RETURN_STATUSES.REJECTED_BY_VENDOR]:   'bg-red-100 text-red-700',
  [SUPPLIER_RETURN_STATUSES.COMPLETED_CLOSED]:     'bg-green-100 text-green-700',
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
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'
  const text = label || formatLabel(status)
  const sizeClass = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'

  return (
    <span className={cn('inline-flex items-center font-medium rounded-full', style, sizeClass, className)}>
      {text}
    </span>
  )
}

export default StatusBadge

