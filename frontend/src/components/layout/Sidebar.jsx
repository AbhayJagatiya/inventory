import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, ArrowLeftRight, Archive, QrCode,
  Truck, Wrench, Bell, FileText, Settings, Users, ClipboardList,
  ChevronDown, ChevronRight, Building2, Sun, Moon, ChevronLeft,
  X
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../utils/cn'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { PERMISSIONS } from '../../constants/permissions'

const APP_NAME = import.meta.env.VITE_APP_SHORT_NAME || 'DSIMS'

// Navigation hierarchy
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: ROUTES.DASHBOARD,
    permission: null,
  },
  {
    label: 'Inventory',
    icon: Package,
    permission: PERMISSIONS.INVENTORY_VIEW,
    children: [
      { label: 'Asset Register', to: ROUTES.INVENTORY },
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

function NavItem({ item, collapsed, onMobileClose }) {
  const { hasPermission } = useAuth()
  const location = useLocation()

  // Helper: check if a specific child item is active, avoiding false positive prefix collisions
  const isChildActive = (child) => {
    // 1. Exact match
    if (location.pathname === child.to) return true

    // 2. Child marked end: true matches only exact
    if (child.end) return false

    // 3. Sub-route match (e.g. /inventory/AST-2026-0001 matches /inventory)
    if (location.pathname.startsWith(child.to + '/')) {
      // If there is another sibling with a more specific match, this item is NOT active
      const hasMoreSpecificSibling = item.children?.some(
        (sibling) =>
          sibling.to !== child.to &&
          sibling.to.startsWith(child.to) &&
          (location.pathname === sibling.to || location.pathname.startsWith(sibling.to + '/'))
      )
      return !hasMoreSpecificSibling
    }
    return false
  }

  // Determine if any child is currently active
  const hasActiveChild =
    item.children &&
    item.children.some((c) => isChildActive(c))

  const [isOpen, setIsOpen] = useState(() => Boolean(hasActiveChild))

  // Keep group open when navigating inside it
  useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true)
    }
  }, [hasActiveChild])

  if (item.permission && !hasPermission(item.permission)) return null

  const Icon = item.icon

  // Direct single item link (e.g. Dashboard, Alerts, Reports, Audit Trail)
  if (!item.children) {
    const isExactDashboard = item.to === ROUTES.DASHBOARD && location.pathname === ROUTES.DASHBOARD
    const isOtherActive = item.to !== ROUTES.DASHBOARD && (location.pathname === item.to || location.pathname.startsWith(item.to + '/'))
    const isActive = isExactDashboard || isOtherActive

    return (
      <div className="relative group my-0.5 px-2">
        <NavLink
          to={item.to}
          onClick={() => onMobileClose && onMobileClose()}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150',
            isActive
              ? 'bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-400/30 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <Icon
            size={18}
            className={cn(
              'shrink-0 transition-colors',
              isActive
                ? 'text-white dark:text-emerald-300'
                : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
            )}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </NavLink>

        {/* Collapsed Tooltip */}
        {collapsed && (
          <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-black text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 top-1/2 -translate-y-1/2">
            {item.label}
          </div>
        )}
      </div>
    )
  }

  // Parent with expandable sub-items
  const hasVisibleChild = item.children.some(
    (c) => !c.permission || hasPermission(c.permission)
  )
  if (!hasVisibleChild) return null

  return (
    <div className="relative group my-0.5 px-2">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150',
          hasActiveChild && !isOpen
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold'
            : hasActiveChild
              ? 'text-slate-900 dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon
          size={18}
          className={cn(
            'shrink-0 transition-colors',
            hasActiveChild
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
          )}
        />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.label}</span>
            <span className="transition-transform duration-200 text-slate-400">
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </>
        )}
      </button>

      {/* Collapsed Tooltip */}
      {collapsed && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-black text-white text-xs font-semibold whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 top-1/2 -translate-y-1/2">
          {item.label}
        </div>
      )}

      {/* Smooth Animated Submenu Accordion */}
      <AnimatePresence initial={false}>
        {!collapsed && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden mt-1 ml-4 pl-3 border-l-2 border-slate-200 dark:border-emerald-500/20 space-y-0.5 py-0.5"
          >
            {item.children.map((child) => {
              if (child.permission && !hasPermission(child.permission)) return null

              const isActive = isChildActive(child)

              return (
                <NavLink
                  key={child.to}
                  to={child.to}
                  onClick={() => onMobileClose && onMobileClose()}
                  className={cn(
                    'block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500/25 dark:text-emerald-300 font-bold shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                  )}
                >
                  {child.label}
                </NavLink>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { user, officeName } = useAuth()
  const { theme, toggleTheme, isDark } = useTheme()

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileOpen) {
        onMobileClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen, onMobileClose])

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0B1513] text-slate-800 dark:text-slate-100 select-none border-r border-slate-200 dark:border-emerald-500/15 transition-colors duration-200">
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-emerald-500/15 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm text-white font-extrabold text-sm tracking-wider">
            GS
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                {APP_NAME}
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 rounded font-semibold">
                  v2.0
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                District Panchayat Gir Somnath
              </div>
            </div>
          )}
        </div>

        {/* Mobile Close Button */}
        {mobileOpen && (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Office Banner */}
      {!collapsed && officeName && (
        <div className="mx-3 mt-3 px-3 py-2 bg-slate-50 dark:bg-[#12221E] rounded-xl border border-slate-200 dark:border-emerald-500/15 flex items-center gap-2 shrink-0">
          <Building2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs text-slate-700 dark:text-slate-300 truncate font-semibold">
            {officeName}
          </span>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.label}
            item={item}
            collapsed={collapsed}
            onMobileClose={onMobileClose}
          />
        ))}
      </nav>

      {/* Footer Controls: Theme Toggle & User Profile */}
      <div className="p-3 border-t border-slate-200 dark:border-emerald-500/15 shrink-0 space-y-2">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors',
            'bg-slate-100 hover:bg-slate-200/80 dark:bg-[#12221E] dark:hover:bg-[#172D28] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-emerald-500/15',
            collapsed && 'justify-center px-0'
          )}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle color theme"
        >
          {isDark ? (
            <Sun size={16} className="text-amber-400 shrink-0" />
          ) : (
            <Moon size={16} className="text-slate-600 shrink-0" />
          )}
          {!collapsed && (
            <span className="flex-1 text-left">
              {isDark ? 'Light Theme' : 'Dark Theme'}
            </span>
          )}
        </button>

        {/* User Profile Bar */}
        <NavLink
          to={ROUTES.PROFILE}
          onClick={() => onMobileClose && onMobileClose()}
          className={cn(
            'flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-white/5',
            collapsed && 'justify-center'
          )}
        >
          <div className="w-8 h-8 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {user?.full_name || 'Government User'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {user?.designation || user?.role?.name || ''}
              </div>
            </div>
          )}
        </NavLink>

        {/* Desktop Collapse / Expand Toggle */}
        <button
          onClick={onToggle}
          className="hidden md:flex w-full items-center justify-center py-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 text-xs transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            size={16}
            className={cn('transition-transform duration-200', collapsed && 'rotate-180')}
          />
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          'hidden md:block h-screen shrink-0 transition-all duration-200 z-30 shadow-xs',
          collapsed ? 'w-20' : 'w-68 sm:w-72'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Panel */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs"
              aria-hidden="true"
            />

            {/* Off-canvas Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-80 max-w-[85vw] h-full shadow-2xl z-10"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Sidebar
