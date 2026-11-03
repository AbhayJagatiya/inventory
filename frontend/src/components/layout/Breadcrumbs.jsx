import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

// Map route segments to human-readable labels
const SEGMENT_LABELS = {
  inventory: 'Inventory',
  new: 'New',
  edit: 'Edit',
  transactions: 'Transactions',
  receipts: 'Receipts',
  issues: 'Issues',
  returns: 'Returns',
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
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
      <Link to="/dashboard" className="hover:text-blue-700 transition-colors">
        <Home size={13} />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1.5">
          <ChevronRight size={12} className="text-slate-300" />
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-slate-700">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="hover:text-blue-700 transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

export default Breadcrumbs

