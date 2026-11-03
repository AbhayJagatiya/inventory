import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROUTES } from '../constants/routes'
import PageLoader from '../components/feedback/PageLoader'

/**
 * ProtectedRoute – wraps routes that require authentication.
 * Redirects to /login if not authenticated.
 * Optionally checks a required permission.
 */
function ProtectedRoute({ children, requiredPermission }) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <PageLoader message="Verifying session…" />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />
  }

  return children
}

export default ProtectedRoute

