import apiClient from './client'

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const getAlerts = async (params = {}) => {
  const response = await apiClient.get('/alerts', { params })
  return response.data
}

export const getAlert = async (id) => {
  const response = await apiClient.get(`/alerts/${id}`)
  return response.data
}

export const runAlertCheck = async () => {
  const response = await apiClient.post('/alerts/run-check')
  return response.data
}

export const acknowledgeAlert = async (id) => {
  const response = await apiClient.post(`/alerts/${id}/acknowledge`)
  return response.data
}

export const resolveAlert = async (id, data) => {
  const response = await apiClient.post(`/alerts/${id}/resolve`, data)
  return response.data
}

export const snoozeAlert = async (id, data) => {
  const response = await apiClient.post(`/alerts/${id}/snooze`, data)
  return response.data
}

// ─── Notifications ────────────────────────────────────────────────────────────
export const getNotifications = async (params = {}) => {
  const response = await apiClient.get('/notifications', { params })
  return response.data
}

export const getUnreadNotificationCount = async () => {
  const response = await apiClient.get('/notifications/unread-count')
  return response.data
}

export const markNotificationRead = async (id) => {
  const response = await apiClient.patch(`/notifications/${id}/read`)
  return response.data
}

export const markAllNotificationsRead = async () => {
  const response = await apiClient.post('/notifications/mark-all-read')
  return response.data
}

