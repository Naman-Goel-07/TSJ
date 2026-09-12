/**
 * App router — all routes, all guards.
 *
 * Guard logic:
 *   - /login     public; redirect to / if already signed in
 *   - /onboarding requires session but no profile
 *   - /          requires session + profile
 *   - /submit    requires session + profile
 *   - /profile   requires session + profile
 *   - /review    requires core or lead role
 *   - /admin     requires lead role
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RequireAuth, RequireProfile, RequireRole } from './guards/RouteGuards'
import { Skeleton } from './components/primitives/Skeleton'

import { Login } from './pages/Login'
import { Onboarding } from './pages/Onboarding'
import { Board } from './pages/Board'
import { Submit } from './pages/Submit'
import { Submissions } from './pages/Submissions'
import { Profile } from './pages/Profile'
import { Review } from './pages/Review'
import { RollCall } from './pages/RollCall'
import { Export } from './pages/Export'
import { Admin } from './pages/Admin'
import { NotFound } from './pages/Placeholders'

import { Intro } from './pages/Intro'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Skeleton variant="card" />
      </div>
    )
  }
  if (session) return <Navigate to="/" replace />
  return <>{children}</>
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Intro />} />
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />

            <Route path="/onboarding" element={
              <RequireAuth>
                <OnboardingGate />
              </RequireAuth>
            } />

            <Route path="/board" element={
              <RequireProfile>
                <Board />
              </RequireProfile>
            } />

            <Route path="/submit" element={
              <RequireProfile>
                <Submit />
              </RequireProfile>
            } />

            <Route path="/submissions" element={
              <RequireProfile>
                <Submissions />
              </RequireProfile>
            } />

            <Route path="/profile" element={
              <RequireProfile>
                <Profile />
              </RequireProfile>
            } />

            <Route path="/review" element={
              <RequireRole minRole="core">
                <Review />
              </RequireRole>
            } />

            {/* The roadmap calls this /booth. Both paths reach the same screen. */}
            <Route path="/booth" element={<Navigate to="/review" replace />} />

            <Route path="/booth/meetups" element={
              <RequireRole minRole="core">
                <RollCall />
              </RequireRole>
            } />

            <Route path="/booth/export" element={
              <RequireRole minRole="lead">
                <Export />
              </RequireRole>
            } />

            <Route path="/admin" element={
              <RequireRole minRole="lead">
                <Admin />
              </RequireRole>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

/** Onboarding gate: if you already have a profile, go home. */
function OnboardingGate() {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (profile) return <Navigate to="/" replace />
  return <Onboarding />
}
