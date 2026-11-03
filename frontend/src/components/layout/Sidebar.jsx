import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, ArrowLeftRight, Archive, QrCode,
  Truck, Wrench, Bell, FileText, Settings, Users, ClipboardList,
  User, ChevronDown, ChevronRight, Building2
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../utils/cn'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'

const APP_NAME = import.meta.env.VITE_APP_SHORT_NAME || 'DSIMS'

// Navigation configuration
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: ROUTES.DASHBOARD,
    permission: null, // All authenticated users
  },
  {
    label: 'Inventory',
    icon: Package,
    permission: PERMISSIONS.INVENTORY_VIEW,
    children: [
      { label: 'Asset Register', to: ROUTES.INVENTORY },
      { label: 'Add New Item', to: ROUTES.INVENTORY_NEW, permission: PERMISSIONS.INVENTORY_CREATE },
      { label: 'Categories', to: ROUTES.INVENTORY_CATEGORIES },
      { label: 'Locations', to: ROUTES.INVENTORY_LOCATIONS },
    ],
  },
  {
    label: 'Transactions',
    icon: ArrowLeftRight,
    permission: PERMISSIONS.STOCK_RECEIPT_VIEW,
    children: [
      { label: 'Stock Receipts', to: ROUTES.RECEIPTS },
      { label: 'Stock Issues', to: ROUTES.ISSUES },
      { label: 'Stock Returns', to: ROUTES.RETURNS },
      { label: 'Transfers', to: ROUTES.TRANSFERS },
      { label: 'Transaction Ledger', to: ROUTES.TRANSACTIONS },
    ],
  },
  {
    label: 'Dead Stock',
    icon: Archive,
    permission: PERMISSIONS.CLASSIFY_VIEW,
    children: [
      { label: 'Classification', to: ROUTES.DEAD_STOCK },
      { label: 'Dead Stock Register', to: ROUTES.DEAD_STOCK_REGISTER },
      { label: 'Condemnations', to: ROUTES.CONDEMNATIONS },
      { label: 'Disposal Register', to: ROUTES.DISPOSALS },
    ],
  },
  {
    label: 'Verification',
    icon: QrCode,
    permission: PERMISSIONS.BARCODE_SCAN,
    children: [
      { label: 'Barcode Lookup', to: ROUTES.BARCODE_LOOKUP },
      { label: 'Audit Sessions', to: ROUTES.VERIFICATION_SESSIONS },
    ],
  },
  {
    label: 'Suppliers',
    icon: Truck,
    permission: PERMISSIONS.SUPPLIER_VIEW,
    children: [
      { label: 'Supplier Directory', to: ROUTES.SUPPLIERS },
      { label: 'Procurement', to: ROUTES.PROCUREMENT },
      { label: 'Vendor Returns', to: ROUTES.SUPPLIER_RETURNS },
    ],
  },
  {
    label: 'Maintenance',
    icon: Wrench,
    permission: PERMISSIONS.MAINTENANCE_VIEW,
    children: [
      { label: 'Repair Tickets', to: ROUTES.MAINTENANCE },
      { label: 'Warranties', to: ROUTES.WARRANTIES },
    ],
  },
  {
    label: 'Alerts',
    icon: Bell,
    permission: PERMISSIONS.ALERTS_VIEW,
    to: ROUTES.ALERTS,
  },
  {
    label: 'Reports',
    icon: FileText,
    permission: PERMISSIONS.REPORTS_VIEW,
    to: ROUTES.REPORTS,
  },
  {
    label: 'Administration',
    icon: Settings,
    permission: PERMISSIONS.USERS_VIEW,
    children: [
      { label: 'Users', to: ROUTES.USERS, permission: PERMISSIONS.USERS_VIEW },
      { label: 'Roles & Permissions', to: ROUTES.ROLES, permission: PERMISSIONS.ROLES_VIEW },
      { label: 'Offices', to: ROUTES.OFFICES, permission: PERMISSIONS.OFFICES_VIEW },
      { label: 'Master Data', to: ROUTES.MASTER_DATA },
      { label: 'System Settings', to: ROUTES.SETTINGS, permission: PERMISSIONS.SETTINGS_VIEW },
    ],
  },
  {
    label: 'Audit Trail',
    icon: ClipboardList,
    permission: PERMISSIONS.AUDIT_VIEW,
    to: ROUTES.AUDIT,
  },
]

function NavItem({ item, collapsed }) {
  const { hasPermission, hasAnyPermission } = useAuth()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(() => {
    if (!item.children) return false
    return item.children.some((c) => location.pathname.startsWith(c.to || ''))
  })

  // Permission check
  if (item.permission && !hasPermission(item.permission)) return null

  const Icon = item.icon

  // Simple link (no children)
  if (!item.children) {
    return (
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
            isActive
              ? 'bg-blue-700 text-white'
              : 'text-slate-200 hover:bg-slate-700 hover:text-white',
          )
        }
        title={collapsed ? item.label : undefined}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    )
  }

  // Has children – expandable group
  const hasVisibleChild = item.children.some(
    (c) => !c.permission || hasPermission(c.permission),
  )
  if (!hasVisibleChild) return null

  const isChildActive = item.children.some((c) => c.to && location.pathname.startsWith(c.to))

  return (
    <div>
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
          isChildActive
            ? 'bg-slate-700 text-white'
            : 'text-slate-200 hover:bg-slate-700 hover:text-white',
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.label}</span>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </>
        )}
      </button>

      {!collapsed && isOpen && (
        <div className="mt-0.5 ml-9 space-y-0.5">
          {item.children.map((child) => {
            if (child.permission && !hasPermission(child.permission)) return null
            return (
              <NavLink
                key={child.to}
                to={child.to}
                className={({ isActive }) =>
                  cn(
                    'block px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'text-white font-medium bg-blue-700/80'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700',
                  )
                }
              >
                {child.label}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Sidebar({ collapsed, onToggle }) {
  const { user, officeName } = useAuth()

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-slate-800 text-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-slate-700 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-white">DS</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{APP_NAME}</div>
            <div className="text-xs text-slate-400 truncate">Gir Somnath</div>
          </div>
        )}
      </div>

      {/* Office Badge */}
      {!collapsed && officeName && (
        <div className="mx-3 mt-3 mb-1 px-3 py-2 bg-slate-700/60 rounded-md">
          <div className="flex items-center gap-2">
            <Building2 size={12} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-300 truncate">{officeName}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.label} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Profile quick-link */}
      <div className="border-t border-slate-700 p-3 shrink-0">
        <NavLink
          to={ROUTES.PROFILE}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
              isActive ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white',
            )
          }
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold shrink-0">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{user?.full_name || 'User'}</div>
              <div className="text-xs text-slate-400 truncate">{user?.designation || user?.role?.name || ''}</div>
            </div>
          )}
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar

