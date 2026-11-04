import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell, ChevronDown, LogOut, User, Settings,
  PanelLeftClose, PanelLeft, AlertTriangle, Menu, Shield
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '../../utils/cn'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { getUnreadNotificationCount } from '../../api/alerts.api'
import { ROLE_LABELS } from '../../constants/enums'
import Breadcrumbs from './Breadcrumbs'

function Navbar({ onToggleSidebar, onOpenMobile, sidebarCollapsed }) {
  const { user, logout, userRole, isDemoMode } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  // Unread notifications badge
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 60000,
    select: (res) => res?.data?.unread_count ?? 0,
  })
  const unreadCount = unreadData || 0

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
  }

  return (
    <header className="h-16 bg-white/95 dark:bg-[#0B1513]/95 backdrop-blur-md border-b border-slate-200 dark:border-emerald-500/15 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20 transition-colors duration-200">
      {/* Left: Mobile hamburger + Desktop toggle + Breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger */}
        <button
          onClick={onOpenMobile}
          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl md:hidden transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        {/* Desktop Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          className="hidden md:flex p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft size={19} /> : <PanelLeftClose size={19} />}
        </button>

        {/* Dynamic Breadcrumbs */}
        <div className="hidden lg:block ml-2">
          <Breadcrumbs />
        </div>
      </div>

      {/* Center: Demo Mode Notice */}
      {isDemoMode && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold">
          <AlertTriangle size={13} className="text-amber-500 shrink-0" />
          <span>Evaluation Demo Environment (Local Simulation)</span>
        </div>
      )}

      {/* Right: Notifications + User Profile */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <Link
          to={ROUTES.NOTIFICATIONS}
          className="relative p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"
          aria-label="View notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#0B1513] leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* User Profile Menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              'flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl text-sm transition-all border border-transparent',
              menuOpen
                ? 'bg-slate-100 dark:bg-white/10'
                : 'hover:bg-slate-100 dark:hover:bg-white/5'
            )}
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                {user?.full_name || 'Government User'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                {ROLE_LABELS[userRole] || userRole || 'Panchayat Staff'}
              </div>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                'text-slate-400 dark:text-slate-400 transition-transform duration-200',
                menuOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown panel */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#12221E] border border-slate-200 dark:border-emerald-500/20 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-emerald-500/15">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {user?.full_name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {user?.username}
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                  <Shield size={10} />
                  {ROLE_LABELS[userRole] || userRole}
                </div>
              </div>

              <div className="py-1">
                <Link
                  to={ROUTES.PROFILE}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <User size={15} />
                  My Profile
                </Link>
                <Link
                  to={ROUTES.SETTINGS}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <Settings size={15} />
                  Preferences & Settings
                </Link>
              </div>

              <div className="border-t border-slate-100 dark:border-emerald-500/15 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
