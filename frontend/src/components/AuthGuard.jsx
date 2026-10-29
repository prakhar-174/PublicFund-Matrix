import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/store/AuthContext'

/**
 * Route guard component protecting private routes.
 * Handles loading spinner, authentication check, and role authorization.
 *
 * @param {Object} props
 * @param {string} [props.requiredRole] - Specific role required for access (e.g. 'admin')
 */
export default function AuthGuard({ requiredRole }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950">
        <Loader2 className="h-10 w-10 text-accent-blue animate-spin" />
        <span className="sr-only">Loading application...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
