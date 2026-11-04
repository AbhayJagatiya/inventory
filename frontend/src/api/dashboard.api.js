/**
 * DSIMS Dashboard API Service
 * PS000214 – District Panchayat Gir Somnath
 * Real-time PostgreSQL Analytics & Reporting – Zero Mock Data
 */

import apiClient from './client'

// Helper to normalize backend dashboard schema with frontend expected property names
const normalizeAdminDashboard = (data) => {
  if (!data) return null
  const total = data.total_registered_assets ?? data.total_items ?? data.total_registered ?? 0
  const activeVal = data.active_stock_value ?? data.active_inventory_value ?? data.active_val ?? 0
  const deadCount = data.dead_stock_candidates_count ?? data.dead_stock_count ?? 0
  const deadVal = data.dead_stock_valuation ?? data.dead_stock_value ?? data.dead_stock_val ?? 0
  const pendingApprovals = data.pending_condemnation_count ?? data.pending_approvals ?? 0

  return {
    ...data,
    total_items: total,
    active_inventory_value: activeVal,
    dead_stock_count: deadCount,
    dead_stock_value: deadVal,
    pending_approvals: pendingApprovals,
    classification_breakdown: data.classification_breakdown || {
      Active: data.available_items_count ?? total,
      'Slow Moving': 0,
      'Non Moving': deadCount,
      Obsolete: 0,
    },
    recent_audit_events: data.recent_activity || data.recent_audit_events || [],
  }
}

const normalizeOfficerDashboard = (data) => {
  if (!data) return null
  return {
    ...data,
    total_office_items: data.total_office_items ?? data.total_items ?? 0,
    total_valuation: data.active_stock_value ?? data.total_valuation ?? data.active_val ?? 0,
    dead_stock_candidates: data.dead_stock_candidates_count ?? data.dead_stock_candidates ?? 0,
    pending_reviews: data.pending_condemnation_reviews ?? data.pending_reviews ?? 0,
    verification_discrepancies: data.active_verification_discrepancies ?? 0,
  }
}

const normalizeStaffDashboard = (data) => {
  if (!data) return null
  return {
    ...data,
    available_stock_count: data.available_items_count ?? data.avail_count ?? 0,
    my_receipts_today: data.recent_receipts_count ?? 0,
    my_issues_today: data.pending_issues_count ?? 0,
    tasks_pending_action: data.low_stock_alerts_count ?? 0,
  }
}

export const getDashboardAdmin = async () => {
  const res = await apiClient.get('/reports/dashboard')
  const raw = res?.data?.data || res?.data
  return { data: normalizeAdminDashboard(raw) }
}

export const getDashboardOfficer = async () => {
  const res = await apiClient.get('/reports/dashboard')
  const raw = res?.data?.data || res?.data
  return { data: normalizeOfficerDashboard(raw) }
}

export const getDashboardStaff = async () => {
  const res = await apiClient.get('/reports/dashboard')
  const raw = res?.data?.data || res?.data
  return { data: normalizeStaffDashboard(raw) }
}

export const getDashboardAlertsSummary = async () => {
  const res = await apiClient.get('/reports/alerts-summary')
  return { data: res?.data?.data || res?.data || {} }
}
