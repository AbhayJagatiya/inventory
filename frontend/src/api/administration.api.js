import apiClient from './client'

// ─── Users ────────────────────────────────────────────────────────────────────
export const getUsers = async (params = {}) => {
  const response = await apiClient.get('/users', { params })
  return response.data
}

export const createUser = async (data) => {
  const response = await apiClient.post('/users', data)
  return response.data
}

export const getUser = async (id) => {
  const response = await apiClient.get(`/users/${id}`)
  return response.data
}

export const updateUser = async (id, data) => {
  const response = await apiClient.patch(`/users/${id}`, data)
  return response.data
}

export const updateUserStatus = async (id, data) => {
  const response = await apiClient.patch(`/users/${id}/status`, data)
  return response.data
}

// ─── Roles ────────────────────────────────────────────────────────────────────
export const getRoles = async () => {
  const response = await apiClient.get('/roles')
  return response.data
}

export const getRole = async (id) => {
  const response = await apiClient.get(`/roles/${id}`)
  return response.data
}

export const updateRolePermissions = async (id, data) => {
  const response = await apiClient.patch(`/roles/${id}/permissions`, data)
  return response.data
}

// ─── Offices ──────────────────────────────────────────────────────────────────
export const getOffices = async (params = {}) => {
  const response = await apiClient.get('/offices', { params })
  return response.data
}

export const createOffice = async (data) => {
  const response = await apiClient.post('/offices', data)
  return response.data
}

export const getOffice = async (id) => {
  const response = await apiClient.get(`/offices/${id}`)
  return response.data
}

export const updateOffice = async (id, data) => {
  const response = await apiClient.patch(`/offices/${id}`, data)
  return response.data
}

export const getOfficeSummary = async (id) => {
  const response = await apiClient.get(`/offices/${id}/summary`)
  return response.data
}

// ─── System Settings ──────────────────────────────────────────────────────────
export const getSettings = async (params = {}) => {
  const response = await apiClient.get('/settings', { params })
  return response.data
}

export const getSettingsByCategory = async (category) => {
  const response = await apiClient.get(`/settings/${category}`)
  return response.data
}

export const updateSettings = async (data) => {
  const response = await apiClient.patch('/settings', data)
  return response.data
}

export const updateSetting = async (category, key, data) => {
  const response = await apiClient.patch(`/settings/${category}/${key}`, data)
  return response.data
}

export const resetSettingsToDefaults = async (data = {}) => {
  const response = await apiClient.post('/settings/reset-defaults', data)
  return response.data
}

// ─── Documents ────────────────────────────────────────────────────────────────
export const uploadDocument = async (formData) => {
  const response = await apiClient.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export const downloadDocument = async (id) => {
  const response = await apiClient.get(`/documents/${id}/download`, {
    responseType: 'blob',
  })
  return response
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const getAuditLogs = async (params = {}) => {
  const response = await apiClient.get('/audit/logs', { params })
  return response.data
}

