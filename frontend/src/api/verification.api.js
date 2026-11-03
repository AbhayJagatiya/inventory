import apiClient from './client'

// ─── Barcodes ─────────────────────────────────────────────────────────────────
export const lookupBarcode = async ({ barcode }) => {
  const response = await apiClient.post('/barcodes/lookup', { barcode })
  return response.data
}

export const getBarcodeLabel = async (itemId, params = {}) => {
  const response = await apiClient.get(`/barcodes/${itemId}/label`, {
    params,
    responseType: 'blob',
  })
  return response
}

// ─── Verification Sessions ────────────────────────────────────────────────────
export const getVerificationSessions = async (params = {}) => {
  const response = await apiClient.get('/verifications/sessions', { params })
  return response.data
}

export const createVerificationSession = async (data) => {
  const response = await apiClient.post('/verifications/sessions', data)
  return response.data
}

export const getVerificationSession = async (id, params = {}) => {
  const response = await apiClient.get(`/verifications/sessions/${id}`, { params })
  return response.data
}

export const getVerificationScans = async (id, params = {}) => {
  const response = await apiClient.get(`/verifications/sessions/${id}/scans`, { params })
  return response.data
}

export const scanItem = async (id, data) => {
  const response = await apiClient.post(`/verifications/sessions/${id}/scan`, data)
  return response.data
}

export const reconcileSession = async (id, data) => {
  const response = await apiClient.post(`/verifications/sessions/${id}/reconcile`, data)
  return response.data
}

export const completeVerificationSession = async (id, data) => {
  const response = await apiClient.post(`/verifications/sessions/${id}/complete`, data)
  return response.data
}

