import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useLanguage } from '../../i18n'

// Map route segments to translation keys
const SEGMENT_KEYS = {
  inventory: 'breadcrumbs.inventory',
  new: 'breadcrumbs.new',
  edit: 'breadcrumbs.edit',
  transactions: 'breadcrumbs.transactions',
  receipts: 'breadcrumbs.receipts',
  issues: 'breadcrumbs.issues',
  returns: 'breadcrumbs.returns',
  transfers: 'breadcrumbs.transfers',
  'dead-stock': 'breadcrumbs.deadStock',
  register: 'breadcrumbs.register',
  condemnations: 'breadcrumbs.condemnations',
  disposals: 'breadcrumbs.disposals',
  verification: 'breadcrumbs.verification',
  lookup: 'breadcrumbs.lookup',
  sessions: 'breadcrumbs.sessions',
  suppliers: 'breadcrumbs.suppliers',
  procurement: 'breadcrumbs.procurement',
  maintenance: 'breadcrumbs.maintenance',
  warranties: 'breadcrumbs.warranties',
  alerts: 'breadcrumbs.alerts',
  notifications: 'breadcrumbs.notifications',
  reports: 'breadcrumbs.reports',
  administration: 'breadcrumbs.administration',
  users: 'breadcrumbs.users',
  roles: 'breadcrumbs.roles',
  offices: 'breadcrumbs.offices',
  'master-data': 'breadcrumbs.masterData',
  settings: 'breadcrumbs.settings',
  audit: 'breadcrumbs.audit',
  profile: 'breadcrumbs.profile',
  categories: 'breadcrumbs.categories',
  locations: 'breadcrumbs.locations',
  dashboard: 'breadcrumbs.dashboard',
}

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

function Breadcrumbs() {
  const { pathname } = useLocation()
  const { t } = useLanguage()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments.reduce((acc, seg, i) => {
    const path = '/' + segments.slice(0, i + 1).join('/')
    const key = SEGMENT_KEYS[seg]
    const label = isUUID(seg) ? t('breadcrumbs.detail') : (key ? t(key) : seg)
    acc.push({ label, path })
    return acc
  }, [])

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-forest-600 dark:text-forest-400">
      <Link
        to="/dashboard"
        className="hover:text-forest-800 dark:hover:text-forest-200 p-1 rounded-md hover:bg-forest-500/10 transition-colors"
        title={t('breadcrumbs.dashboard')}
      >
        <Home size={13} />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1.5">
          <ChevronRight size={12} className="text-forest-400/50 dark:text-forest-600/60" />
          {i === crumbs.length - 1 ? (
            <span className="font-semibold text-forest-900 dark:text-forest-100">{crumb.label}</span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:text-forest-800 dark:hover:text-forest-200 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

export default Breadcrumbs
