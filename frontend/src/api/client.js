import axios from 'axios'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

// ─── Axios Instance ──────────────────────────────────────────────────────────
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Token Helpers ───────────────────────────────────────────────────────────
const TOKEN_KEY = 'dsims_access_token'
const REFRESH_KEY = 'dsims_refresh_token'

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (access, refresh) => {
    localStorage.setItem(TOKEN_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clearTokens: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// ─── Request Interceptor ─────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ─── Response Interceptor ────────────────────────────────────────────────────
let isRefreshing = false
let refreshSubscribers = []

const onRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Never redirect on authentication or credential check calls
    if (
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/logout')
    ) {
      return Promise.reject(error)
    }

    // Never redirect if in demo / offline simulation mode
    const isDemo = localStorage.getItem('dsims_demo_mode') === 'true'
    if (isDemo) {
      return Promise.reject(error)
    }

    // Handle 401 – attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = tokenStorage.getRefreshToken()

      if (!refreshToken || refreshToken === 'undefined') {
        const hadAccessToken = tokenStorage.getAccessToken()
        if (hadAccessToken && hadAccessToken !== 'undefined') {
          tokenStorage.clearTokens()
          window.location.href = '/login?expired=1'
        }
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        const resData = response.data?.data || response.data
        const access_token = resData?.access_token || response.data?.access_token
        if (!access_token) {
          throw new Error('Missing access token in refresh response')
        }
        tokenStorage.setTokens(access_token, refreshToken)
        onRefreshed(access_token)
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return apiClient(originalRequest)
      } catch (refreshErr) {
        tokenStorage.clearTokens()
        window.location.href = '/login?expired=1'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    // Handle 403 – forbidden (show toast, don't redirect)
    if (error.response?.status === 403) {
      const message = error.response?.data?.error?.message || 'You do not have permission to perform this action.'
      toast.error(message, { id: 'forbidden' })
    }

    // Handle 500 – server error
    if (error.response?.status === 500) {
      toast.error('A server error occurred. Please try again or contact support.', { id: 'server-error' })
    }

    return Promise.reject(error)
  },
)

// ─── Helper: Extract Error Message ───────────────────────────────────────────
export const extractApiError = (error) => {
  const data = error?.response?.data
  if (data?.error?.message) return data.error.message
  if (data?.error?.details?.length) {
    return data.error.details.map((d) => d.issue || d.message).join('; ')
  }
  if (typeof data === 'string') return data
  return error?.message || 'An unexpected error occurred'
}

// ─── Helper: Extract Field-Level Validation Errors ───────────────────────────
export const extractFieldErrors = (error) => {
  const details = error?.response?.data?.error?.details
  if (!Array.isArray(details)) return {}
  return details.reduce((acc, d) => {
    if (d.field) acc[d.field] = d.issue || d.message
    return acc
  }, {})
}

export default apiClient

