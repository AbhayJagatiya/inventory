import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Menu, Bell, ChevronDown, LogOut, User, Settings,
  PanelLeftClose, PanelLeft, AlertTriangle
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '../../utils/cn'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { getUnreadNotificationCount } from '../../api/alerts.api'
import { ROLE_LABELS } from '../../constants/enums'

function Navbar({ onToggleSidebar, sidebarCollapsed }) {
  const { user, logout, userRole, isDemoMode } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  // Unread notifications badge
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 60000, // poll every 60s
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
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-40">
      {/* Left: Toggle + Breadcrumb placeholder */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Center: Demo Mode Notice */}
      {isDemoMode && (
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
          <AlertTriangle size={13} className="text-amber-600" />
          <span>Demo Environment (Backend Offline)</span>
        </div>
      )}

      {/* Right: Notifications + Profile */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <Link
          to={ROUTES.NOTIFICATIONS}
          className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Profile Dropdown */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
              menuOpen ? 'bg-slate-100' : 'hover:bg-slate-50',
            )}
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-slate-800 leading-tight">
                {user?.full_name || 'User'}
              </div>
              <div className="text-xs text-slate-500 leading-tight">
                {ROLE_LABELS[userRole] || userRole || ''}
              </div>
            </div>
            <ChevronDown size={14} className={cn('text-slate-400 transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <div className="text-sm font-semibold text-slate-800">{user?.full_name}</div>
                <div className="text-xs text-slate-500">{user?.username}</div>
              </div>
              <Link
                to={ROUTES.PROFILE}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <User size={15} />
                My Profile
              </Link>
              <Link
                to={ROUTES.SETTINGS}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Settings size={15} />
                Settings
              </Link>
              <div className="border-t border-slate-100 mt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
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

