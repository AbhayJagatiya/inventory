import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROUTES } from '../constants/routes'
import PageLoader from '../components/feedback/PageLoader'

/**
 * PublicOnlyRoute – wraps routes like /login that should not be accessible
 * when the user is already authenticated.
 */
function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <PageLoader message="Loading…" />
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return children
}

export default PublicOnlyRoute

