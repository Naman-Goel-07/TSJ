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
  import { useEffect, useState } from 'react'
  import { useQuery, useQueryClient } from '@tanstack/react-query'
  import { useNavigate } from 'react-router-dom'
  import { supabase } from '../supabase'
  import { useAuth } from '../context/AuthContext'
  import { BoardLayout } from '../components/layout/BoardLayout'
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

  function computeSprintDay(sprintStart: string, totalDays: number): { day: number; total: number } {
    const start = new Date(sprintStart)
    const today = new Date()
    // zero out time component for clean day diff
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

  export function Board() {
    const { session, profile, role } = useAuth()
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // Team total — the only point number a member ever sees
    const totalQuery = useQuery({
      queryKey: ['team-total'],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_team_total')
        if (error) throw error
        return (data as number) ?? 0
      },
    })

    // Sprint config — for the day counter
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

    // Verified feed — no point values in get_board_feed return type
    const feedQuery = useQuery({
      queryKey: ['board-feed'],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_board_feed', { p_limit: 30 })
        if (error) throw error
        return data ?? []
      },
    })

    const sprintInfo = configQuery.data
      ? computeSprintDay(configQuery.data.sprint_start, configQuery.data.total_days)
      : null

    // My calls — from get_my_submissions (no points in return type)
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

    // A verify in the booth should move the number on everyone's board without a
    // refresh. The payload is ignored on purpose — we refetch through the RPCs so
    // no point value ever arrives over the realtime socket.
    useEffect(() => {
      if (!session) return
      const channel = supabase
        .channel('board-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
          queryClient.invalidateQueries({ queryKey: ['team-total'] })
          queryClient.invalidateQueries({ queryKey: ['board-feed'] })
          queryClient.invalidateQueries({ queryKey: ['my-submissions'] })
        })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }, [session, queryClient])

    const feed = feedQuery.data ?? []
    const mine = myQuery.data ?? []

    return (
      <BoardLayout
        topbar={
          <div className="flex items-center justify-between w-full">
            <span className="font-display font-bold text-xl text-chalk tracking-sign uppercase">ECHO</span>
            <div className="flex items-center gap-1 sm:gap-2">
              {sprintInfo && (
                <span className="label hidden sm:inline text-dim">
                  Day {sprintInfo.day} / {sprintInfo.total}
                </span>
              )}
              {isCore && <TextButton onClick={() => navigate('/review')}>The Booth</TextButton>}
              {/* Your own record. First name only — the rail is 56px and shared with three other controls. */}
              <TextButton onClick={() => navigate('/profile')} className="max-w-[12ch] truncate">
                {profile?.full_name.split(' ')[0] ?? 'Profile'}
              </TextButton>
              <TextButton
                onClick={async () => {
                  await supabase.auth.signOut()
                  queryClient.clear()
                }}
              >
                Sign out
              </TextButton>
            </div>
          </div>
        }
      >
        {/* The Board — team total */}
        <BoardPanel>
          <div className="flex flex-col items-center gap-6 py-4">
            {/* Total score */}
            {totalQuery.isLoading ? (
              <Skeleton variant="total" />
            ) : totalQuery.isError ? (
              <ErrorState
                headline="Could not load the score"
                body="The board total failed to load. Check your connection."
                retry={() => totalQuery.refetch()}
              />
            ) : (
              <>
                <div className="font-display font-black text-board text-white tabular-nums total-glow">
                  {formatTotal(totalQuery.data ?? 0)}
                </div>
                <p className="label text-dim">Posted to the board</p>
              </>
            )}

            {/* Sprint progress meter */}
            {configQuery.data && sprintInfo && (
              <div className="w-full max-w-sm">
                <Meter value={sprintInfo.day} max={sprintInfo.total} label="Sprint progress" />
              </div>
            )}
          </div>

          <Seam />

          {/* Submit CTA */}
          <div className="pt-4">
            <Button
              variant="primary"
              size="lg"
              lead="+"
              className="w-full sm:w-auto"
              onClick={() => navigate('/submit')}
            >
              Submit achievement
            </Button>
          </div>
        </BoardPanel>

        {/* ON THE BOARD — verified feed */}
        <BoardPanel padded={false}>
          <div className="px-panel pt-panel pb-2">
            <SignLabel>On the board</SignLabel>
          </div>
          <Seam />

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
                <div key={row.id}>
                  <FeedRow
                    who={row.member_name}
                    what={row.activity_label}
                    level={row.activity_level}
                    when={row.posted_at ?? row.occurred_on}
                  />
                  <Seam />
                </div>
              ))}
              <p className="px-panel py-3 text-xs text-chalk/60">
                Showing the last {feed.length} posts
              </p>
            </div>
          )}
        </BoardPanel>

        {/* YOUR CALLS — own submissions, no points */}
        <BoardPanel padded={false}>
          <div className="px-panel pt-panel pb-2">
            <SignLabel>Your calls</SignLabel>
          </div>
          <Seam />

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
            <EmptyState
              headline="Nothing called in yet."
              body="Submit an achievement and it will appear here while a core member checks it."
              action={
                <Button variant="secondary" lead="+" onClick={() => navigate('/submit')}>
                  Submit achievement
                </Button>
              }
            />
          ) : (
            <div>
              {(mine as any[]).map((row) => (
                <div key={row.id}>
                  <MyCallRow row={row} onEdit={() => navigate(`/submit?edit=${row.id}`)} />
                  <Seam />
                </div>
              ))}
            </div>
          )}
        </BoardPanel>
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
          <div className="bg-recess px-4 py-3 border-t border-seam flex flex-col gap-2">
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
