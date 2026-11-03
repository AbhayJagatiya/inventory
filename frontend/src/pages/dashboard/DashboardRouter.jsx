import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../constants/enums'
import AdminDashboard from './AdminDashboard'
import OfficerDashboard from './OfficerDashboard'
import StaffDashboard from './StaffDashboard'
import PageLoader from '../../components/feedback/PageLoader'

/**
 * DashboardRouter – renders the correct dashboard based on user role.
 * The actual dashboards fetch data from role-specific API endpoints.
 */
function DashboardRouter() {
  const { userRole, isLoading } = useAuth()

  if (isLoading) return <PageLoader />

  if (userRole === ROLES.SYSTEM_ADMIN) return <AdminDashboard />
  if (userRole === ROLES.STORE_OFFICER) return <OfficerDashboard />
  if (userRole === ROLES.STORE_STAFF) return <StaffDashboard />

  // Fallback: show staff dashboard if role is unrecognised
  return <StaffDashboard />
}

export default DashboardRouter

