/**
 * /booth/meetups — bi-weekly meetup roll call. Needs meetups.manage.
 *
 * Attendance reuses the submission pipeline: record_meetup_attendance() writes
 * one already-verified submission per member present, so the score view stays a
 * single SUM and nothing else in the system needs to know meetups are special.
 *
 * The RPC is idempotent on (meetup_id, member_id). Saving the same roll call
 * twice records nothing the second time.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { BoardLayout } from '../components/layout/BoardLayout'
import { BoardPanel } from '../components/board/BoardPanel'
import { SignLabel } from '../components/board/SignLabel'
import { Seam } from '../components/primitives/Seam'
import { Button } from '../components/primitives/Button'
import { Skeleton } from '../components/primitives/Skeleton'
import { EmptyState, ErrorState } from '../components/feedback/EmptyState'
import { Field, Input } from '../components/primitives/Field'
import { TextButton, SelectRow } from '../components/primitives/Controls'

const POINTS_PER_MEMBER = 5

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function RollCall() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [newDate, setNewDate] = useState(today())
  const [newTitle, setNewTitle] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const meetupsQuery = useQuery({
    queryKey: ['meetups'],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('get_meetups')
      if (rpcError) throw rpcError
      return data ?? []
    },
  })

  const rosterQuery = useQuery({
    queryKey: ['meetup-roster', activeId],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('get_meetup_roster', {
        p_meetup_id: activeId,
      })
      if (rpcError) throw rpcError
      return data ?? []
    },
    enabled: !!activeId,
  })

  const roster = useMemo(() => rosterQuery.data ?? [], [rosterQuery.data])
  const alreadyPresent = useMemo(
    () => new Set(roster.filter(r => r.present).map(r => r.id)),
    [roster],
  )

  function openMeetup(id: string) {
    setActiveId(id)
    setChecked(new Set())
    setError('')
    setSaved('')
  }

  function toggle(memberId: string) {
    const next = new Set(checked)
    if (next.has(memberId)) next.delete(memberId)
    else next.add(memberId)
    setChecked(next)
    setSaved('')
  }

  const newlyChecked = useMemo(
    () => [...checked].filter(id => !alreadyPresent.has(id)),
    [checked, alreadyPresent],
  )
  const totalPresent = alreadyPresent.size + newlyChecked.length

  const createMeetup = useMutation({
    mutationFn: async () => {
      if (newTitle.trim().length < 3) {
        throw new Error('Give the meetup a title of at least 3 characters')
      }
      if (newDate > today()) {
        throw new Error('A meetup cannot be recorded before it has happened')
      }
      const { data, error: insertError } = await supabase
        .from('meetups')
        .insert({ held_on: newDate, title: newTitle.trim() })
        .select('id')
        .single()
      if (insertError) throw insertError
      return data.id
    },
    onSuccess: id => {
      setCreating(false)
      setNewTitle('')
      setNewDate(today())
      setError('')
      queryClient.invalidateQueries({ queryKey: ['meetups'] })
      openMeetup(id)
    },
    onError: (err: Error) => setError(`${err.message}. Fix that and try again.`),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!activeId) return 0
      const { data, error: rpcError } = await supabase.rpc('record_meetup_attendance', {
        p_meetup_id: activeId,
        p_member_ids: newlyChecked,
      })
      if (rpcError) throw rpcError
      return (data as number) ?? 0
    },
    onSuccess: inserted => {
      setChecked(new Set())
      setError('')
      setSaved(
        inserted === 0
          ? 'Everyone selected was already recorded for this meetup. Nothing was double counted.'
          : `${inserted} recorded. ${inserted * POINTS_PER_MEMBER} points went to the board.`,
      )
      queryClient.invalidateQueries({ queryKey: ['meetup-roster', activeId] })
      queryClient.invalidateQueries({ queryKey: ['meetups'] })
      queryClient.invalidateQueries({ queryKey: ['team-total'] })
      queryClient.invalidateQueries({ queryKey: ['board-feed'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const topbar = (
    <div className="flex items-center justify-between w-full gap-4">
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="font-display font-bold text-xl text-chalk tracking-sign uppercase">ECHO</span>
        <span className="text-sm text-chalk/60 truncate">Roll call</span>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <TextButton
          onClick={() => navigate('/review')}
        >
          The Booth
        </TextButton>
        <TextButton
          onClick={() => navigate('/')}
        >
          Back to the board
        </TextButton>
      </div>
    </div>
  )

  const activeMeetup = meetupsQuery.data?.find(m => m.id === activeId) ?? null

  return (
    <BoardLayout topbar={topbar}>
      {/* Meetups */}
      <BoardPanel padded={false}>
        <div className="px-panel pt-panel pb-2 flex items-center justify-between gap-4">
          <SignLabel>Meetups</SignLabel>
          <TextButton
            onClick={() => { setCreating(v => !v); setError('') }}
        >
            {creating ? 'Cancel' : 'New meetup'}
          </TextButton>
        </div>
        <Seam />

        {creating && (
          <div className="p-panel flex flex-col gap-4 bg-recess">
            <Field label="Date held" htmlFor="held-on">
              <Input
                id="held-on"
                type="date"
                max={today()}
                className="tabular-nums"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
              />
            </Field>
            <Field label="Title" htmlFor="meetup-title" help="What the session was, e.g. 'Bi-weekly meetup 3'.">
              <Input
                id="meetup-title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                maxLength={120}
              />
            </Field>
            <div>
              <Button onClick={() => createMeetup.mutate()} loading={createMeetup.isPending}>
                Create meetup
              </Button>
            </div>
          </div>
        )}

        {meetupsQuery.isLoading ? (
          <div>{[...Array(2)].map((_, i) => <Skeleton key={i} variant="row" />)}</div>
        ) : meetupsQuery.isError ? (
          <div className="px-panel py-8">
            <ErrorState
              headline="Could not load meetups"
              body="get_meetups refused or failed. If it said not authorised, sign out and back in so your role claim refreshes."
              retry={() => meetupsQuery.refetch()}
            />
          </div>
        ) : (meetupsQuery.data ?? []).length === 0 ? (
          <EmptyState
            headline="No meetups recorded yet."
            body="Create one for the session you just ran, then check off who turned up."
          />
        ) : (
          <div>
            {(meetupsQuery.data ?? []).map(m => {
              const active = m.id === activeId
              return (
                <SelectRow
                  key={m.id}
                  selected={active}
                  onClick={() => openMeetup(m.id)}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-chalk">{m.title}</span>
                    <span className="text-xs text-chalk/60 tabular-nums">{formatDate(m.held_on)}</span>
                  </div>
                  <div className="text-xs text-chalk/60 mt-1 tabular-nums">
                    {m.present_count} present, {m.points_posted} points on the board
                  </div>
                </SelectRow>
              )
            })}
          </div>
        )}
      </BoardPanel>

      {/* Roster */}
      {activeId && (
        <BoardPanel padded={false}>
          <div className="px-panel pt-panel pb-2">
            <SignLabel>Who turned up</SignLabel>
            {activeMeetup && (
              <h2 className="text-lg text-chalk font-medium mt-2">{activeMeetup.title}</h2>
            )}
            <p className="text-sm text-chalk/60 mt-1">
              Five points per member present. Members already recorded are locked, because
              un-ticking here cannot undo points that are already on the board. To reverse one,
              pull it from the Posted list in the Booth.
            </p>
          </div>
          <Seam />

          {rosterQuery.isLoading ? (
            <div>{[...Array(4)].map((_, i) => <Skeleton key={i} variant="row" />)}</div>
          ) : rosterQuery.isError ? (
            <div className="px-panel py-8">
              <ErrorState
                headline="Could not load the roster"
                body="get_meetup_roster failed. Check that migration 0005 ran."
                retry={() => rosterQuery.refetch()}
              />
            </div>
          ) : roster.length === 0 ? (
            <EmptyState
              headline="Nobody on the roster yet."
              body="Members appear here once they have finished onboarding."
            />
          ) : (
            <>
              <div className="max-h-[50vh] overflow-y-auto">
                {roster.map(member => {
                  const locked = member.present
                  const isChecked = locked || checked.has(member.id)
                  return (
                    <label
                      key={member.id}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-seam
                        ${locked ? 'opacity-60' : 'hover:bg-lit cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={locked || save.isPending}
                        onChange={() => toggle(member.id)}
                        className="w-5 h-5 accent-lamp shrink-0 focus:outline-none focus:shadow-ring rounded-slot"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-chalk truncate">{member.full_name}</span>
                        <span className="block text-xs text-chalk/60 truncate">{member.department}</span>
                      </span>
                      {locked && <span className="text-xs text-posted shrink-0">Recorded</span>}
                    </label>
                  )
                })}
              </div>

              <Seam />

              <div className="p-panel flex flex-col gap-4">
                <p className="text-base text-chalk tabular-nums">
                  {totalPresent} present, {newlyChecked.length * POINTS_PER_MEMBER} points to add
                </p>

                {error && (
                  <p className="text-sm text-flare border-hair border-flag rounded-slot px-3 py-2">{error}</p>
                )}
                {saved && <p className="text-sm text-posted">{saved}</p>}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => save.mutate()}
                    loading={save.isPending}
                    disabled={newlyChecked.length === 0}
                    className="w-full sm:w-auto"
                  >
                    Record attendance
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={save.isPending || checked.size === 0}
                    onClick={() => { setChecked(new Set()); setSaved('') }}
                    className="w-full sm:w-auto"
                  >
                    Clear selection
                  </Button>
                </div>
              </div>
            </>
          )}
        </BoardPanel>
      )}
    </BoardLayout>
  )
}
