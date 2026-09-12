  /**
   * / — Team Board
   *
   * Data sources:
   *   - get_team_total() → one integer, the only point figure visible to members
   *   - sprint_config     → sprint start date and total days (no points)
   *   - get_board_feed()  → verified items: name, activity, level, date (no points)
   *
   * Rules enforced here:
   *   - Zero point values rendered anywhere on this page except the single team total
   *   - get_board_feed is called via RPC — never direct select from submissions
   *   - Sprint day is computed from sprint_config, never hardcoded
   */
    import { Star, Trophy, Users } from 'lucide-react'
  import { useEffect, useState } from 'react'
  import { useQuery, useQueryClient } from '@tanstack/react-query'
  import { useNavigate } from 'react-router-dom'
  import { supabase } from '../supabase'
  import { useAuth } from '../context/AuthContext'
  import { BoardLayout } from '../components/layout/BoardLayout'
  import { GlobalNav } from '../components/layout/GlobalNav'
  import { BoardPanel } from '../components/board/BoardPanel'
  import { SignLabel } from '../components/board/SignLabel'
  import { Meter } from '../components/board/Meter'
  import { FeedRow } from '../components/board/FeedRow'
  import { Skeleton } from '../components/primitives/Skeleton'
  import { Seam } from '../components/primitives/Seam'
  import { Button, useEcho } from '../components/primitives/Button'
  import { TextButton } from '../components/primitives/Controls'
  import { EmptyState, ErrorState } from '../components/feedback/EmptyState'
  import { StatusPill } from '../components/status/StatusPill'
  import { useFeedAvatars } from '../lib/avatars'

  function computeSprintDay(sprintStart: string, totalDays: number): { day: number; total: number } {
    const start = new Date(sprintStart)
    const today = new Date()
    start.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    const diffMs = today.getTime() - start.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
    const day = Math.min(Math.max(diffDays, 1), totalDays)
    return { day, total: totalDays }
  }

  function formatTotal(n: number): string {
    return new Intl.NumberFormat('en-US').format(n)
  }

  function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-full border border-lamp/20 flex items-center justify-center bg-gradient-to-b from-lamp/10 to-transparent shadow-[0_0_16px_-4px_rgba(184,63,90,0.4)] shrink-0">
          {icon}
        </div>
        <div>
          <div className="text-[10px] font-mono tracking-[0.1em] uppercase text-muted mb-1">{label}</div>
          <div className="font-display font-medium text-3xl text-chalk leading-none tabular-nums">{value}</div>
        </div>
      </div>
    )
  }

  export function Board() {
    const { session, profile, role } = useAuth()
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const teamId = 'f0ab9a4a-2e4b-4568-99ef-5b4736cc33c5'

    const totalQuery = useQuery({
      queryKey: ['team-total', teamId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('submissions')
          .select('net_points')
          .eq('status', 'verified')
          .eq('team_id', teamId)
          
        if (error) throw error
        return data?.reduce((acc, curr) => acc + (curr.net_points || 0), 0) ?? 0
      },
    })

    const configQuery = useQuery({
      queryKey: ['sprint-config'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('sprint_config')
          .select('sprint_start, total_days')
          .single()
        if (error) throw error
        return data
      },
    })

    const feedQuery = useQuery({
      queryKey: ['board-feed', teamId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('submissions')
          .select(`
            id,
            occurred_on,
            decided_at,
            profiles!submissions_member_id_fkey ( full_name ),
            activity_catalog!submissions_activity_id_fkey ( label, level )
          `)
          .eq('status', 'verified')
          .eq('team_id', teamId)
          .order('decided_at', { ascending: false })
          .limit(30)
          
        if (error) throw error
        
        return (data ?? []).map((row: any) => ({
          id: row.id,
          member_name: row.profiles?.full_name ?? 'Unknown',
          activity_label: row.activity_catalog?.label ?? 'Activity',
          activity_level: row.activity_catalog?.level,
          occurred_on: row.occurred_on,
          posted_at: row.decided_at ?? row.occurred_on
        }))
      },
    })

    const statsQuery = useQuery({
      queryKey: ['board-stats'],
      queryFn: async () => {
        const teamId = 'f0ab9a4a-2e4b-4568-99ef-5b4736cc33c5'
        const [achRes, memRes] = await Promise.all([
          supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'verified').eq('team_id', teamId),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('team_id', teamId)
        ])
        return {
          achievements: achRes.count ?? 0,
          members: memRes.count ?? 0
        }
      }
    })

    const sprintInfo = configQuery.data
      ? computeSprintDay(configQuery.data.sprint_start, configQuery.data.total_days)
      : null

    const myQuery = useQuery({
      queryKey: ['my-submissions'],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_my_submissions')
        if (error) throw error
        return data ?? []
      },
      enabled: !!session,
    })

    const isCore = role === 'core' || role === 'lead'

    useEffect(() => {
      if (!session) return
      const channel = supabase
        .channel('board-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
          queryClient.invalidateQueries({ queryKey: ['team-total'] })
          queryClient.invalidateQueries({ queryKey: ['board-feed'] })
          queryClient.invalidateQueries({ queryKey: ['my-submissions'] })
          queryClient.invalidateQueries({ queryKey: ['board-stats'] })
        })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }, [session, queryClient])

    const feed = feedQuery.data ?? []
    const mine = myQuery.data ?? []

    const feedAvatars = useFeedAvatars((feed as any[]).map(row => row.id))

    return (
      <BoardLayout topbar={<GlobalNav />}>
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-8 flex flex-col items-center">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="text-sm font-medium text-muted mb-3">
              Collective Progress
            </div>
            <h1 className="font-display font-medium text-4xl text-chalk max-w-[20ch] mx-auto leading-[1.1]">
              Small Contributions<br/>Make a Bigger <span className="text-lamp">Echo</span>
            </h1>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 w-full">
            <StatCard 
              icon={<Star className="w-6 h-6 text-chalk" strokeWidth={1.5} />}
              label="Team Points" 
              value={totalQuery.isLoading ? '-' : formatTotal(totalQuery.data ?? 0)} 
            />
            <StatCard 
              icon={<Trophy className="w-6 h-6 text-chalk" strokeWidth={1.5} />}
              label="Total Achievements" 
              value={statsQuery.isLoading ? '-' : formatTotal(statsQuery.data?.achievements ?? feed.length)} 
            />
            <StatCard 
              icon={<Users className="w-6 h-6 text-chalk" strokeWidth={1.5} />}
              label="Total Members" 
              value={statsQuery.isLoading ? '-' : formatTotal(statsQuery.data?.members ?? 6)} 
            />
          </div>

          {/* Feeds */}
          <div className="w-full flex flex-col gap-8">
            
            {/* Your Calls (Stand-out Theme) */}
            <div className="rounded-2xl border border-lamp/30 bg-gradient-to-b from-lamp/15 to-recess shadow-glow overflow-hidden relative">
              <div className="absolute top-0 right-1/4 w-64 h-64 bg-lamp/20 rounded-full blur-[80px] pointer-events-none" />

              <div className="flex items-center justify-between px-6 py-5 border-b border-lamp/20 relative z-10">
                <h2 className="text-base font-semibold text-chalk">Your Calls</h2>
                <Button variant="primary" size="sm" lead="+" onClick={() => navigate('/submit')}>
                  Submit
                </Button>
              </div>

              <div className="relative z-10">
                {myQuery.isLoading ? (
                  <div>
                    {[...Array(3)].map((_, i) => <Skeleton key={i} variant="row" />)}
                  </div>
                ) : myQuery.isError ? (
                  <div className="px-panel py-8">
                    <ErrorState
                      headline="Could not load your submissions"
                      body="Try refreshing the page."
                      retry={() => myQuery.refetch()}
                    />
                  </div>
                ) : mine.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-chalk font-medium mb-1">Nothing called in yet.</p>
                    <p className="text-muted text-sm">Submit an achievement and it will appear here while a core member checks it.</p>
                  </div>
                ) : (
                  <div>
                    {(mine as any[]).map((row, index) => (
                      <div key={row.id}>
                        <MyCallRow row={row} onEdit={() => navigate(`/submit?edit=${row.id}`)} />
                        {index < mine.length - 1 && <div className="h-px w-full bg-lamp/10" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Echoes */}
            <div className="rounded-2xl border border-lamp/30 bg-gradient-to-b from-lamp/15 to-recess shadow-glow overflow-hidden relative">
              <div className="absolute top-0 right-1/4 w-64 h-64 bg-lamp/20 rounded-full blur-[80px] pointer-events-none" />

              <div className="flex items-center justify-between px-6 py-5 border-b border-lamp/20 relative z-10">
                <h2 className="text-base font-semibold text-chalk">Recent Echoes</h2>
                <TextButton onClick={() => {}} className="text-sm animate-pulse-slow">View All</TextButton>
              </div>

              <div className="relative z-10">
                {feedQuery.isLoading ? (
                  <div>
                    {[...Array(5)].map((_, i) => <Skeleton key={i} variant="row" />)}
                  </div>
                ) : feedQuery.isError ? (
                  <div className="px-panel py-8">
                    <ErrorState
                      headline="Could not load the feed"
                      body="The board feed failed to load. Try refreshing."
                      retry={() => feedQuery.refetch()}
                    />
                  </div>
                ) : feed.length === 0 ? (
                  <EmptyState
                    headline="The board is empty."
                    body="Be the first to call something in. Submit an achievement and a core member will post it."
                  />
                ) : (
                  <div>
                    {feed.map((row: any) => (
                      <FeedRow
                        key={row.id}
                        who={row.member_name}
                        what={row.activity_label}
                        level={row.activity_level}
                        when={row.posted_at ?? row.occurred_on}
                        avatarUrl={feedAvatars[row.id]}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </BoardLayout>
    )
  }

  function MyCallRow({ row, onEdit }: { row: any; onEdit: () => void }) {
    const [expanded, setExpanded] = useState(true && row.status === 'needs_info')
    const hasNote = !!row.decision_note
    // A disclosure is still a press, so it still answers. Tight radius: a row
    // that threw a full ring would wash over the row beneath it.
    const { emit, rings } = useEcho({ tight: true })

    return (
      <div>
        <button
          className="echo-host relative w-full h-row flex items-center gap-0 hover:bg-lit transition-colors duration-200 text-left"
          style={{ ['--echo' as string]: '242 242 245' }}
          onPointerDown={() => { if (hasNote) emit() }}
          onClick={() => hasNote && setExpanded(!expanded)}
          aria-expanded={hasNote ? expanded : undefined}
        >
          {rings}
          <div className="flex-1 px-4 text-sm text-chalk truncate">
            {row.activity_label}{row.activity_level ? `, ${row.activity_level}` : ''}
          </div>
          <div className="px-4 shrink-0">
            <StatusPill status={row.status} size="sm" />
          </div>
          {hasNote && (
            <div className="w-8 px-2 text-chalk/40 text-xs shrink-0">
              {expanded ? '▴' : '▾'}
            </div>
          )}
        </button>
        {expanded && hasNote && (
          <div className="glass-panel px-4 py-3 border-t border-seam/40 flex flex-col gap-2">
            <p className="text-sm text-chalk/70">{row.decision_note}</p>
            {row.status === 'needs_info' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="text-xs text-chalk/60 flex-1">
                  Add what they asked for and it goes back into the queue.
                </p>
                <Button variant="secondary" onClick={onEdit} className="w-full sm:w-auto">
                  Send it again
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
