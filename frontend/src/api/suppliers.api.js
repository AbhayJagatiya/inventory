import apiClient from './client'

// ─── Suppliers ────────────────────────────────────────────────────────────────
export const getSuppliers = async (params = {}) => {
  const response = await apiClient.get('/suppliers', { params })
  return response.data
}

export const createSupplier = async (data) => {
  const response = await apiClient.post('/suppliers', data)
  return response.data
}

export const getSupplier = async (id) => {
  const response = await apiClient.get(`/suppliers/${id}`)
  return response.data
}

export const updateSupplier = async (id, data) => {
  const response = await apiClient.patch(`/suppliers/${id}`, data)
  return response.data
}

export const getSupplierHistory = async (id) => {
  const response = await apiClient.get(`/suppliers/${id}/history`)
  return response.data
}

// ─── Procurements ─────────────────────────────────────────────────────────────
export const getProcurements = async (params = {}) => {
  const response = await apiClient.get('/procurements', { params })
  return response.data
}

export const createProcurement = async (data) => {
  const response = await apiClient.post('/procurements', data)
  return response.data
}

export const getProcurement = async (id) => {
  const response = await apiClient.get(`/procurements/${id}`)
  return response.data
}

export const updateProcurement = async (id, data) => {
  const response = await apiClient.patch(`/procurements/${id}`, data)
  return response.data
}

// ─── Supplier Returns / RMA ───────────────────────────────────────────────────
export const getSupplierReturns = async (params = {}) => {
  const response = await apiClient.get('/supplier-returns', { params })
  return response.data
}

export const createSupplierReturn = async (data) => {
  const response = await apiClient.post('/supplier-returns', data)
  return response.data
}

export const getSupplierReturn = async (id) => {
  const response = await apiClient.get(`/supplier-returns/${id}`)
  return response.data
}

export const updateSupplierReturn = async (id, data) => {
  const response = await apiClient.patch(`/supplier-returns/${id}`, data)
  return response.data
}

export const dispatchSupplierReturn = async (id, data) => {
  const response = await apiClient.post(`/supplier-returns/${id}/dispatch`, data)
  return response.data
}

export const vendorResponseSupplierReturn = async (id, data) => {
  const response = await apiClient.post(`/supplier-returns/${id}/vendor-response`, data)
  return response.data
}

export const resolveSupplierReturn = async (id, data) => {
  const response = await apiClient.post(`/supplier-returns/${id}/resolve`, data)
  return response.data
}

