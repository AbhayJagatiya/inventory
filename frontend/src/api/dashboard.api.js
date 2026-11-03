import apiClient from './client'

export const getDashboardAdmin = async () => {
  const response = await apiClient.get('/dashboard/admin')
  return response.data
}

export const getDashboardOfficer = async () => {
  const response = await apiClient.get('/dashboard/officer')
  return response.data
}

export const getDashboardStaff = async () => {
  const response = await apiClient.get('/dashboard/staff')
  return response.data
}

export const getDashboardAlertsSummary = async () => {
  const response = await apiClient.get('/dashboard/alerts-summary')
  return response.data
}

