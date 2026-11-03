import apiClient from './client'

// ─── Classifications ──────────────────────────────────────────────────────────
export const getClassificationSummary = async (params = {}) => {
  const response = await apiClient.get('/classifications/summary', { params })
  return response.data
}

export const getDeadStockRegister = async (params = {}) => {
  const response = await apiClient.get('/classifications/dead-stock', { params })
  return response.data
}

export const runClassificationEngine = async (data) => {
  const response = await apiClient.post('/classifications/run', data)
  return response.data
}

export const overrideClassification = async (itemId, data) => {
  const response = await apiClient.post(`/classifications/${itemId}/override`, data)
  return response.data
}

export const releaseClassificationOverride = async (itemId, data) => {
  const response = await apiClient.post(`/classifications/${itemId}/release-override`, data)
  return response.data
}

// ─── Condemnations ────────────────────────────────────────────────────────────
export const getCondemnations = async (params = {}) => {
  const response = await apiClient.get('/condemnations', { params })
  return response.data
}

export const createCondemnation = async (data) => {
  const response = await apiClient.post('/condemnations', data)
  return response.data
}

export const getCondemnation = async (id) => {
  const response = await apiClient.get(`/condemnations/${id}`)
  return response.data
}

export const reviewCondemnation = async (id, data) => {
  const response = await apiClient.post(`/condemnations/${id}/review`, data)
  return response.data
}

export const decideCondemnation = async (id, data) => {
  const response = await apiClient.post(`/condemnations/${id}/decision`, data)
  return response.data
}

// ─── Disposals ────────────────────────────────────────────────────────────────
export const getDisposals = async (params = {}) => {
  const response = await apiClient.get('/disposals', { params })
  return response.data
}

export const createDisposal = async (data) => {
  const response = await apiClient.post('/disposals', data)
  return response.data
}

export const getDisposal = async (id) => {
  const response = await apiClient.get(`/disposals/${id}`)
  return response.data
}

