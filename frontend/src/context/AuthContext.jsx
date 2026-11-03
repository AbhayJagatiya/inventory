import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin, logout as apiLogout, getMe } from '../api/auth.api'
import { tokenStorage } from '../api/client'
import { ROUTES } from '../constants/routes'
import { ROLES } from '../constants/enums'
import { MOCK_USERS } from '../services/mockData'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true) // True until initial check done
  const navigate = useNavigate()

  // ─── Bootstrap: check for existing session ────────────────────────────────
  useEffect(() => {
    const bootstrap = async () => {
      const isDemo = localStorage.getItem('dsims_demo_mode') === 'true'
      const demoRole = localStorage.getItem('dsims_demo_role')

      if (isDemo && demoRole && MOCK_USERS[demoRole]) {
        setUser({ ...MOCK_USERS[demoRole], isDemoMode: true })
        setIsDemoMode(true)
        setIsLoading(false)
        return
      }

      const token = tokenStorage.getAccessToken()
      if (!token) {
        setIsLoading(false)
        return
      }
      try {
        const response = await getMe()
        const userData = response.data || response
        setUser(userData)
        setIsDemoMode(false)
      } catch {
        tokenStorage.clearTokens()
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    bootstrap()
  }, [])

  // ─── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (credentials) => {
    try {
      const response = await apiLogin(credentials)
      const { access_token, refresh_token, user: userData } = response.data || response

      tokenStorage.setTokens(access_token, refresh_token)
      localStorage.removeItem('dsims_demo_mode')
      localStorage.removeItem('dsims_demo_role')
      setUser(userData)
      setIsDemoMode(false)

      navigate(ROUTES.DASHBOARD)
      return userData
    } catch (err) {
      // Check if user is using demo credentials when backend is unreachable
      const lower = credentials.username.toLowerCase().trim()
      const roleKey = lower.includes('admin')
        ? 'admin'
        : lower.includes('officer')
        ? 'officer'
        : lower.includes('staff')
        ? 'staff'
        : lower

      if (MOCK_USERS[roleKey] || MOCK_USERS[lower]) {
        const matched = MOCK_USERS[roleKey] || MOCK_USERS[lower]
        const demoUser = { ...matched, isDemoMode: true }
        localStorage.setItem('dsims_demo_mode', 'true')
        localStorage.setItem('dsims_demo_role', roleKey)
        setUser(demoUser)
        setIsDemoMode(true)
        toast('Logged in using Offline Demo Mode (Backend Unreachable)', {
          icon: '⚠️',
          duration: 5000,
        })
        navigate(ROUTES.DASHBOARD)
        return demoUser
      }
      throw err
    }
  }, [navigate])

  // ─── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken()
    try {
      if (refreshToken) await apiLogout(refreshToken)
    } catch {
      // Best effort — clear tokens regardless
    } finally {
      tokenStorage.clearTokens()
      localStorage.removeItem('dsims_demo_mode')
      localStorage.removeItem('dsims_demo_role')
      setUser(null)
      setIsDemoMode(false)
      navigate(ROUTES.LOGIN)
    }
  }, [navigate])

  // ─── Permission check ─────────────────────────────────────────────────────
  const hasPermission = useCallback((permissionCode) => {
    if (!user) return false
    const permissions = user.permissions || []
    return permissions.includes(permissionCode)
  }, [user])

  const hasAnyPermission = useCallback((...codes) => {
    return codes.some((code) => hasPermission(code))
  }, [hasPermission])

  const hasAllPermissions = useCallback((...codes) => {
    return codes.every((code) => hasPermission(code))
  }, [hasPermission])

  // ─── Role check ───────────────────────────────────────────────────────────
  const userRole = user?.role?.name || user?.role || null

  const isAdmin   = userRole === ROLES.SYSTEM_ADMIN
  const isOfficer = userRole === ROLES.STORE_OFFICER
  const isStaff   = userRole === ROLES.STORE_STAFF

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isDemoMode,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    userRole,
    isAdmin,
    isOfficer,
    isStaff,
    officeId: user?.office?.id || user?.office_id || null,
    officeName: user?.office?.name || null,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext

