import apiClient from './client'

// ─── Report Endpoints ──────────────────────────────────────────────────────────
const REPORT_PATHS = {
  'stock-register': '/reports/stock-register',
  'asset-register': '/reports/asset-register',
  'stock-quantity': '/reports/stock-quantity',
  'asset-valuation': '/reports/asset-valuation',
  'movements': '/reports/movements',
  'dead-stock': '/reports/dead-stock',
  'condemnations': '/reports/condemnations',
  'disposals': '/reports/disposals',
  'suppliers-procurement': '/reports/suppliers-procurement',
  'warranties': '/reports/warranties',
  'maintenance': '/reports/maintenance',
  'physical-verification': '/reports/physical-verification',
}

export const getReport = async (reportType, params = {}) => {
  const path = REPORT_PATHS[reportType]
  if (!path) throw new Error(`Unknown report type: ${reportType}`)
  const response = await apiClient.get(path, { params })
  return response.data
}

export const generateExport = async ({ reportType, format, ...params }) => {
  const response = await apiClient.post('/reports/generate-export', {
    report_type: reportType,
    format,
    ...params,
  }, {
    responseType: 'blob',
  })
  return response
}

