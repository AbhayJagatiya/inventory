import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin, logout as apiLogout, getMe } from '../api/auth.api'
import { tokenStorage } from '../api/client'
import { ROUTES } from '../constants/routes'
import { ROLES } from '../constants/enums'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

// Helper to reliably normalize backend user / profile schema with frontend expected attributes
const normalizeAuthUser = (rawUser, profileData = null) => {
  if (!rawUser) return null
  const source = profileData || rawUser
  const rolesList = source.roles || rawUser.roles || []
  const roleNames = Array.isArray(rolesList)
    ? rolesList.map((r) => (typeof r === 'string' ? r : r.name))
    : []

  const primaryRole =
    (typeof rawUser.role === 'string' ? rawUser.role : rawUser.role?.name) ||
    roleNames[0] ||
    'STORE_STAFF'

  let permissions = []
  if (Array.isArray(source.permissions)) {
    permissions = source.permissions.map((p) => (typeof p === 'string' ? p : p.code))
  } else if (Array.isArray(rawUser.permissions)) {
    permissions = rawUser.permissions.map((p) => (typeof p === 'string' ? p : p.code))
  } else if (Array.isArray(rolesList)) {
    permissions = rolesList.flatMap((r) => r.permissions?.map((p) => (typeof p === 'string' ? p : p.code)) || [])
  }

  return {
    ...rawUser,
    role: primaryRole,
    roles: roleNames,
    permissions: Array.from(new Set(permissions)),
    office: source.office || rawUser.office,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  // ─── Bootstrap: check for existing session ────────────────────────────────
  useEffect(() => {
    const bootstrap = async () => {
      localStorage.removeItem('dsims_demo_mode')
      localStorage.removeItem('dsims_demo_role')

      const token = tokenStorage.getAccessToken()
      if (!token) {
        setIsLoading(false)
        return
      }
      try {
        const response = await getMe()
        const profile = response.data || response
        const normalized = normalizeAuthUser(profile.user || profile, profile)
        setUser(normalized)
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
      const dataPayload = response?.data?.data || response?.data || response
      const access_token = dataPayload?.access_token
      const refresh_token = dataPayload?.refresh_token
      const userData = dataPayload?.user

      if (!access_token) {
        throw new Error('Authentication response did not contain an access token')
      }

      tokenStorage.setTokens(access_token, refresh_token)
      localStorage.removeItem('dsims_demo_mode')
      localStorage.removeItem('dsims_demo_role')

      let normalized = normalizeAuthUser(userData)
      try {
        const profileRes = await getMe()
        const pData = profileRes?.data?.data || profileRes?.data || profileRes
        if (pData) {
          normalized = normalizeAuthUser(pData.user || userData, pData)
        }
      } catch {
        // use basic normalized user
      }

      setUser(normalized)
      setIsDemoMode(false)

      navigate(ROUTES.DASHBOARD)
      return normalized
    } catch (err) {
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
  const userRole =
    (typeof user?.role === 'string' ? user.role : user?.role?.name) ||
    (Array.isArray(user?.roles)
      ? typeof user.roles[0] === 'string'
        ? user.roles[0]
        : user.roles[0]?.name
      : null) ||
    'STORE_STAFF'

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
