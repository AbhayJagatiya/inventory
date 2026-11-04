/**
 * DSIMS Transactions API Service
 * PS000214 – District Panchayat Gir Somnath
 * 100% Real FastAPI Backend & PostgreSQL Persistence – Zero Mock Data
 */

import apiClient from './client'

// ─── Receipts ────────────────────────────────────────────────────────────────
export const getReceipts = async (params = {}) => {
  const response = await apiClient.get('/transactions', {
    params: { ...params, transaction_type: 'RECEIPT' },
  })
  return response.data
}

export const getReceipt = async (id) => {
  const response = await apiClient.get(`/transactions/${id}`)
  return response.data
}

export const createReceipt = async (data) => {
  const response = await apiClient.post('/receipts', data)
  return response.data
}

export const postReceipt = async (id) => {
  const response = await apiClient.post(`/receipts/${id}/post`)
  return response.data
}

// ─── Issues ──────────────────────────────────────────────────────────────────
export const getIssues = async (params = {}) => {
  const response = await apiClient.get('/transactions', {
    params: { ...params, transaction_type: 'ISSUE' },
  })
  return response.data
}

export const getIssue = async (id) => {
  const response = await apiClient.get(`/transactions/${id}`)
  return response.data
}

export const createIssue = async (data) => {
  const response = await apiClient.post('/issues', data)
  return response.data
}

export const postIssue = async (id) => {
  const response = await apiClient.post(`/issues/${id}/post`)
  return response.data
}

// ─── Returns ─────────────────────────────────────────────────────────────────
export const getReturns = async (params = {}) => {
  const response = await apiClient.get('/transactions', {
    params: { ...params, transaction_type: 'RETURN' },
  })
  return response.data
}

export const getReturn = async (id) => {
  const response = await apiClient.get(`/transactions/${id}`)
  return response.data
}

export const createReturn = async (data) => {
  const response = await apiClient.post('/returns', data)
  return response.data
}

export const postReturn = async (id) => {
  const response = await apiClient.post(`/returns/${id}/post`)
  return response.data
}

// ─── Transfers ───────────────────────────────────────────────────────────────
export const getTransfers = async (params = {}) => {
  const response = await apiClient.get('/transactions', {
    params: { ...params, transaction_type: 'TRANSFER' },
  })
  return response.data
}

export const getTransfer = async (id) => {
  const response = await apiClient.get(`/transactions/${id}`)
  return response.data
}

export const createTransfer = async (data) => {
  const response = await apiClient.post('/transfers', data)
  return response.data
}

export const approveTransfer = async (id, data) => {
  const response = await apiClient.post(`/transfers/${id}/approve`, data)
  return response.data
}

export const dispatchTransfer = async (id, data) => {
  const response = await apiClient.post(`/transfers/${id}/dispatch`, data)
  return response.data
}

export const completeTransfer = async (id, data) => {
  const response = await apiClient.post(`/transfers/${id}/complete`, data)
  return response.data
}

// ─── Unified Transaction Ledger ──────────────────────────────────────────────
export const getUnifiedTransactions = async (params = {}) => {
  const response = await apiClient.get('/transactions', { params })
  return response.data
}

export const getUnifiedTransactionDetail = async (id) => {
  const response = await apiClient.get(`/transactions/${id}`)
  return response.data
}

export const reverseTransaction = async (id, data) => {
  const response = await apiClient.post(`/transactions/${id}/reverse`, data)
  return response.data
}

// Alias exports for backward compatibility across transaction pages
export const getTransactions = getUnifiedTransactions
export const getTransaction = getUnifiedTransactionDetail
