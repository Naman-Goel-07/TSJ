/**
 * /intro — the public face of the board.
 *
 * The roster is not a constant in this file. It comes from get_intro_roster(),
 * a security-definer function granted to `anon`, which returns exactly four
 * columns: id, name, department, and the storage path of a picture. No points,
 * no email, no enrollment number, no role. A signed-out visitor gets the team
 * and nothing else, and that is enforced by the function's return type rather
 * than by what this component chooses to render.
 *
 * Pictures live in a private bucket, so every path is exchanged for a five
 * minute signed link, the same way the booth reads proof files.
 */
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { VoidScreen, Wordmark } from '../components/signal/Signal'
import { Button } from '../components/primitives/Button'
import { BoardPanel } from '../components/board/BoardPanel'
import { Skeleton } from '../components/primitives/Skeleton'
import { EmptyState, ErrorState } from '../components/feedback/EmptyState'
import { Avatar } from '../components/media/Avatar'
import { signAvatarPaths, AVATAR_REFRESH_MS } from '../lib/avatars'

type IntroMember = {
  id: string
  full_name: string
  department: string
  avatar_path: string | null
}

export function Intro() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()

  // Declared before the early returns below so the hook order never changes.
  const rosterQuery = useQuery({
    queryKey: ['intro-roster'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_intro_roster')
      if (error) throw error

      const rows = (data ?? []) as IntroMember[]
      const urls = await signAvatarPaths(rows.map(r => r.avatar_path))

      return rows.map(row => ({
        ...row,
        url: row.avatar_path ? urls[row.avatar_path] ?? null : null,
      }))
    },
    staleTime: AVATAR_REFRESH_MS,
    refetchInterval: AVATAR_REFRESH_MS,
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-recess flex items-center justify-center">
        <Skeleton variant="card" />
      </div>
    )
  }

  // If already signed in, redirect them to the board.
  if (session) {
    return <Navigate to="/" replace />
  }

  const roster = rosterQuery.data ?? []

  return (
    <VoidScreen className="flex flex-col min-h-screen py-16 px-gutter items-center overflow-y-auto">
      <div className="w-full max-w-[800px] flex flex-col items-center">
        <Wordmark size="hero" className="mb-4 mt-8">ECHO</Wordmark>
        <p className="text-xl text-chalk/90 mb-12 font-medium tracking-wide">
          we echo around win
        </p>

        <Button onClick={() => navigate('/login')} size="lg" className="mb-24 px-12">
          Sign In
        </Button>

        <div className="w-full mt-12 mb-16">
          <h2 className="text-2xl text-chalk font-display font-bold mb-8 text-center uppercase tracking-sign">
            Meet Our Team
          </h2>

          {rosterQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => <Skeleton key={i} variant="card" />)}
            </div>
          ) : rosterQuery.isError ? (
            <BoardPanel>
              <ErrorState
                headline="Could not load the team"
                body="The roster failed to load. Check your connection and try again."
                retry={() => rosterQuery.refetch()}
              />
            </BoardPanel>
          ) : roster.length === 0 ? (
            <BoardPanel>
              <EmptyState
                headline="Nobody on the roster yet."
                body="Members appear here once they sign up and finish onboarding."
              />
            </BoardPanel>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {roster.map(member => (
                <BoardPanel key={member.id}>
                  <div className="flex flex-col items-center text-center">
                    <Avatar
                      name={member.full_name}
                      url={member.url}
                      size="xl"
                      className="mb-4"
                    />
                    <h3 className="text-chalk font-semibold text-lg">{member.full_name}</h3>
                    <p className="text-chalk/60 text-sm mt-1">{member.department}</p>
                  </div>
                </BoardPanel>
              ))}
            </div>
          )}
        </div>
      </div>
    </VoidScreen>
  )
}
