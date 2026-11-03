import apiClient from './client'

// ─── Warranties ───────────────────────────────────────────────────────────────
export const getWarranties = async (params = {}) => {
  const response = await apiClient.get('/warranties', { params })
  return response.data
}

export const createWarranty = async (data) => {
  const response = await apiClient.post('/warranties', data)
  return response.data
}

export const getWarranty = async (id) => {
  const response = await apiClient.get(`/warranties/${id}`)
  return response.data
}

export const updateWarranty = async (id, data) => {
  const response = await apiClient.patch(`/warranties/${id}`, data)
  return response.data
}

export const getExpiringWarranties = async (params = {}) => {
  const response = await apiClient.get('/warranties/expiring', { params })
  return response.data
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
export const getMaintenanceRecords = async (params = {}) => {
  const response = await apiClient.get('/maintenance', { params })
  return response.data
}

export const createMaintenanceRecord = async (data) => {
  const response = await apiClient.post('/maintenance', data)
  return response.data
}

export const getMaintenanceRecord = async (id) => {
  const response = await apiClient.get(`/maintenance/${id}`)
  return response.data
}

export const updateMaintenanceRecord = async (id, data) => {
  const response = await apiClient.patch(`/maintenance/${id}`, data)
  return response.data
}

export const completeMaintenanceRecord = async (id, data) => {
  const response = await apiClient.post(`/maintenance/${id}/complete`, data)
  return response.data
}

