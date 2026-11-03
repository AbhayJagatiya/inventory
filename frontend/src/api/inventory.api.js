import apiClient from './client'

// ─── Items ───────────────────────────────────────────────────────────────────
export const getItems = async (params = {}) => {
  const response = await apiClient.get('/items', { params })
  return response.data
}

export const getItem = async (id) => {
  const response = await apiClient.get(`/items/${id}`)
  return response.data
}

export const createItem = async (data) => {
  const response = await apiClient.post('/items', data)
  return response.data
}

export const updateItem = async (id, data) => {
  const response = await apiClient.patch(`/items/${id}`, data)
  return response.data
}

export const getItemHistory = async (id, params = {}) => {
  const response = await apiClient.get(`/items/${id}/history`, { params })
  return response.data
}

export const bulkImportItems = async (formData) => {
  const response = await apiClient.post('/items/bulk-import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export const exportItems = async (params = {}) => {
  const response = await apiClient.get('/items/export', {
    params,
    responseType: 'blob',
  })
  return response
}

// ─── Categories ──────────────────────────────────────────────────────────────
export const getCategories = async (params = {}) => {
  const response = await apiClient.get('/categories', { params })
  return response.data
}

export const getCategory = async (id) => {
  const response = await apiClient.get(`/categories/${id}`)
  return response.data
}

export const createCategory = async (data) => {
  const response = await apiClient.post('/categories', data)
  return response.data
}

export const updateCategory = async (id, data) => {
  const response = await apiClient.patch(`/categories/${id}`, data)
  return response.data
}

export const deleteCategory = async (id) => {
  const response = await apiClient.delete(`/categories/${id}`)
  return response.data
}

// ─── Locations ───────────────────────────────────────────────────────────────
export const getLocations = async (params = {}) => {
  const response = await apiClient.get('/locations', { params })
  return response.data
}

export const getLocation = async (id) => {
  const response = await apiClient.get(`/locations/${id}`)
  return response.data
}

export const createLocation = async (data) => {
  const response = await apiClient.post('/locations', data)
  return response.data
}

export const updateLocation = async (id, data) => {
  const response = await apiClient.patch(`/locations/${id}`, data)
  return response.data
}

export const deleteLocation = async (id) => {
  const response = await apiClient.delete(`/locations/${id}`)
  return response.data
}

// ─── Units of Measure ────────────────────────────────────────────────────────
export const getUOMs = async () => {
  const response = await apiClient.get('/units-of-measure')
  return response.data
}

export const createUOM = async (data) => {
  const response = await apiClient.post('/units-of-measure', data)
  return response.data
}

