/**
 * Route guards — read role from JWT claim via AuthContext.
 * Client guards are UX only; the database enforces real boundaries via RLS + RPCs.
 *
 * A member hitting /review gets a clean "not available" screen, not a crash or redirect loop.
 */
import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Skeleton } from '../components/primitives/Skeleton'

type AppRole = 'member' | 'core' | 'lead'

function roleLevel(role: AppRole): number {
  return role === 'lead' ? 2 : role === 'core' ? 1 : 0
}

/** Requires the user to be authenticated. Redirects to /login otherwise. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-transparent flex items-center justify-center"><Skeleton variant="card" /></div>
  if (!session) return <Navigate to="/" replace />
  return <>{children}</>
}

/** Requires a completed profile. Sends to /onboarding if missing. */
export function RequireProfile({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-transparent flex items-center justify-center"><Skeleton variant="card" /></div>
  if (!session) return <Navigate to="/" replace />
  if (!profile) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

/** Requires at least a minimum role level. Shows "not available" if denied — no crash, no redirect loop. */
export function RequireRole({
  minRole,
  children,
}: {
  minRole: AppRole
  children: ReactNode
}) {
  const { session, profile, role, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-transparent flex items-center justify-center"><Skeleton variant="card" /></div>
  if (!session) return <Navigate to="/" replace />
  if (!profile) return <Navigate to="/onboarding" replace />

  if (roleLevel(role) < roleLevel(minRole)) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-10 bg-enamel border-hair border-seam rounded-slot shadow-slot shadow-lip mx-auto mb-4" />
          <p className="text-chalk font-medium">Not available</p>
          <p className="text-sm text-muted mt-1">This area is for core members.</p>
          <a
            href="/"
            className="label inline-block mt-5 rounded-slot px-2.5 py-1.5 text-lamp/85
                       transition-colors duration-200 hover:text-lamp hover:bg-lamp/[0.06]"
          >
            Back to the board
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
