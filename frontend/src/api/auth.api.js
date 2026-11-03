import apiClient, { tokenStorage } from './client'

// POST /auth/login
export const login = async ({ username, password }) => {
  const response = await apiClient.post('/auth/login', { username, password })
  return response.data
}

// POST /auth/logout
export const logout = async (refreshToken) => {
  const response = await apiClient.post('/auth/logout', { refresh_token: refreshToken })
  return response.data
}

// POST /auth/refresh
export const refreshToken = async (refresh) => {
  const response = await apiClient.post('/auth/refresh', { refresh_token: refresh })
  return response.data
}

// GET /auth/me
export const getMe = async () => {
  const response = await apiClient.get('/auth/me')
  return response.data
}

// POST /auth/change-password
export const changePassword = async ({ current_password, new_password, confirm_password }) => {
  const response = await apiClient.post('/auth/change-password', {
    current_password,
    new_password,
    confirm_password,
  })
  return response.data
}

// POST /auth/admin-reset-password/{user_id}
export const adminResetPassword = async (userId, { temporary_password }) => {
  const response = await apiClient.post(`/auth/admin-reset-password/${userId}`, {
    temporary_password,
  })
  return response.data
}

