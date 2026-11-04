import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

// Map route segments to human-readable labels
const SEGMENT_LABELS = {
  inventory: 'Inventory',
  new: 'New',
  edit: 'Edit',
  transactions: 'Transactions',
  receipts: 'Stock Receipts',
  issues: 'Stock Issues',
  returns: 'Stock Returns',
  transfers: 'Transfers',
  'dead-stock': 'Dead Stock',
  register: 'Register',
  condemnations: 'Condemnations',
  disposals: 'Disposals',
  verification: 'Verification',
  lookup: 'Barcode Lookup',
  sessions: 'Audit Sessions',
  suppliers: 'Suppliers',
  procurement: 'Procurement',
  maintenance: 'Maintenance',
  warranties: 'Warranties',
  alerts: 'Alerts',
  notifications: 'Notifications',
  reports: 'Reports',
  administration: 'Administration',
  users: 'Users',
  roles: 'Roles & Permissions',
  offices: 'Offices',
  'master-data': 'Master Data',
  settings: 'Settings',
  audit: 'Audit Trail',
  profile: 'My Profile',
  categories: 'Categories',
  locations: 'Locations',
  dashboard: 'Dashboard',
}

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

function Breadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments.reduce((acc, seg, i) => {
    const path = '/' + segments.slice(0, i + 1).join('/')
    const label = isUUID(seg) ? 'Detail' : (SEGMENT_LABELS[seg] || seg)
    acc.push({ label, path })
    return acc
  }, [])

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-forest-600 dark:text-forest-400">
      <Link
        to="/dashboard"
        className="hover:text-forest-800 dark:hover:text-forest-200 p-1 rounded-md hover:bg-forest-500/10 transition-colors"
        title="Dashboard"
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
