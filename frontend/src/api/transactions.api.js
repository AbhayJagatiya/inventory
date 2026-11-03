import apiClient from './client'
import {
  getMockReceipts,
  saveMockReceipt,
  postMockReceipt,
  getMockIssues,
  saveMockIssue,
  getMockReturns,
  saveMockReturn,
  getMockTransfers,
  saveMockTransfer,
  approveMockTransfer,
  dispatchMockTransfer,
  completeMockTransfer,
  getUnifiedTransactionLedger,
} from '../services/transactionsMockData'

// ─── Receipts ────────────────────────────────────────────────────────────────
export const getReceipts = async (params = {}) => {
  try {
    const response = await apiClient.get('/transactions/receipts', { params })
    return response.data
  } catch (err) {
    let list = getMockReceipts()
    if (params.search) {
      const q = params.search.toLowerCase()
      list = list.filter(
        (r) =>
          r.voucher_number.toLowerCase().includes(q) ||
          r.supplier_name.toLowerCase().includes(q) ||
          (r.po_number && r.po_number.toLowerCase().includes(q))
      )
    }
    if (params.status && params.status !== 'ALL') {
      list = list.filter((r) => r.status === params.status)
    }
    return { data: list, total: list.length }
  }
}

export const getReceipt = async (id) => {
  try {
    const response = await apiClient.get(`/transactions/receipts/${id}`)
    return response.data
  } catch (err) {
    const list = getMockReceipts()
    const found = list.find((r) => r.id === id || r.voucher_number === id)
    if (found) return { data: found }
    throw err
  }
}

export const createReceipt = async (data) => {
  try {
    const response = await apiClient.post('/transactions/receipts', data)
    return response.data
  } catch (err) {
    const saved = saveMockReceipt(data)
    return { data: saved, message: 'Receipt saved (Offline Demo Mode)' }
  }
}

export const postReceipt = async (id, currentUser) => {
  try {
    const response = await apiClient.post(`/transactions/receipts/${id}/post`)
    return response.data
  } catch (err) {
    const posted = postMockReceipt(id, currentUser)
    return { data: posted, message: 'Receipt posted successfully (Offline Demo Mode)' }
  }
}

// ─── Issues ──────────────────────────────────────────────────────────────────
export const getIssues = async (params = {}) => {
  try {
    const response = await apiClient.get('/transactions/issues', { params })
    return response.data
  } catch (err) {
    let list = getMockIssues()
    if (params.search) {
      const q = params.search.toLowerCase()
      list = list.filter(
        (i) =>
          i.voucher_number.toLowerCase().includes(q) ||
          i.department.toLowerCase().includes(q) ||
          i.receiving_employee.toLowerCase().includes(q)
      )
    }
    return { data: list, total: list.length }
  }
}

export const getIssue = async (id) => {
  try {
    const response = await apiClient.get(`/transactions/issues/${id}`)
    return response.data
  } catch (err) {
    const list = getMockIssues()
    const found = list.find((i) => i.id === id || i.voucher_number === id)
    if (found) return { data: found }
    throw err
  }
}

export const createIssue = async (data, currentUser) => {
  try {
    const response = await apiClient.post('/transactions/issues', data)
    return response.data
  } catch (err) {
    const saved = saveMockIssue(data, currentUser)
    return { data: saved, message: 'Issue voucher posted successfully (Offline Demo Mode)' }
  }
}

export const postIssue = async (id) => {
  const response = await apiClient.post(`/transactions/issues/${id}/post`)
  return response.data
}

// ─── Returns ─────────────────────────────────────────────────────────────────
export const getReturns = async (params = {}) => {
  try {
    const response = await apiClient.get('/transactions/returns', { params })
    return response.data
  } catch (err) {
    let list = getMockReturns()
    if (params.search) {
      const q = params.search.toLowerCase()
      list = list.filter(
        (r) =>
          r.voucher_number.toLowerCase().includes(q) ||
          r.returning_department.toLowerCase().includes(q) ||
          (r.original_issue_voucher && r.original_issue_voucher.toLowerCase().includes(q))
      )
    }
    return { data: list, total: list.length }
  }
}

export const getReturn = async (id) => {
  try {
    const response = await apiClient.get(`/transactions/returns/${id}`)
    return response.data
  } catch (err) {
    const list = getMockReturns()
    const found = list.find((r) => r.id === id || r.voucher_number === id)
    if (found) return { data: found }
    throw err
  }
}

export const createReturn = async (data, currentUser) => {
  try {
    const response = await apiClient.post('/transactions/returns', data)
    return response.data
  } catch (err) {
    const saved = saveMockReturn(data, currentUser)
    return { data: saved, message: 'Stock return processed successfully (Offline Demo Mode)' }
  }
}

export const postReturn = async (id) => {
  const response = await apiClient.post(`/transactions/returns/${id}/post`)
  return response.data
}

// ─── Transfers ───────────────────────────────────────────────────────────────
export const getTransfers = async (params = {}) => {
  try {
    const response = await apiClient.get('/transactions/transfers', { params })
    return response.data
  } catch (err) {
    let list = getMockTransfers()
    if (params.search) {
      const q = params.search.toLowerCase()
      list = list.filter(
        (t) =>
          t.transfer_number.toLowerCase().includes(q) ||
          t.source_office.toLowerCase().includes(q) ||
          t.destination_office.toLowerCase().includes(q)
      )
    }
    if (params.status && params.status !== 'ALL') {
      list = list.filter((t) => t.status === params.status)
    }
    return { data: list, total: list.length }
  }
}

export const getTransfer = async (id) => {
  try {
    const response = await apiClient.get(`/transactions/transfers/${id}`)
    return response.data
  } catch (err) {
    const list = getMockTransfers()
    const found = list.find((t) => t.id === id || t.transfer_number === id)
    if (found) return { data: found }
    throw err
  }
}

export const createTransfer = async (data, currentUser) => {
  try {
    const response = await apiClient.post('/transactions/transfers', data)
    return response.data
  } catch (err) {
    const saved = saveMockTransfer(data, currentUser)
    return { data: saved, message: 'Transfer request submitted (Offline Demo Mode)' }
  }
}

export const approveTransfer = async (id, data, currentUser) => {
  try {
    const response = await apiClient.post(`/transactions/transfers/${id}/approve`, data)
    return response.data
  } catch (err) {
    const approved = approveMockTransfer(id, data, currentUser)
    return { data: approved, message: 'Transfer review updated (Offline Demo Mode)' }
  }
}

export const dispatchTransfer = async (id, data, currentUser) => {
  try {
    const response = await apiClient.post(`/transactions/transfers/${id}/dispatch`, data)
    return response.data
  } catch (err) {
    const dispatched = dispatchMockTransfer(id, data, currentUser)
    return { data: dispatched, message: 'Transfer dispatched (Offline Demo Mode)' }
  }
}

export const completeTransfer = async (id, data, currentUser) => {
  try {
    const response = await apiClient.post(`/transactions/transfers/${id}/complete`, data)
    return response.data
  } catch (err) {
    const completed = completeMockTransfer(id, data, currentUser)
    return { data: completed, message: 'Transfer acknowledged & completed (Offline Demo Mode)' }
  }
}

// ─── Unified Transaction Ledger ──────────────────────────────────────────────
export const getTransactions = async (params = {}) => {
  try {
    const response = await apiClient.get('/transactions', { params })
    return response.data
  } catch (err) {
    const list = getUnifiedTransactionLedger(params)
    return { data: list, total: list.length }
  }
}

export const getTransaction = async (id) => {
  const response = await apiClient.get(`/transactions/${id}`)
  return response.data
}

export const createReversal = async (id, { reversal_reason }) => {
  const response = await apiClient.post(`/transactions/${id}/reversal`, { reversal_reason })
  return response.data
}
