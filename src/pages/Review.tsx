/**
 * /review (also /booth) — the verification queue. Core and lead only.
 *
 * Rules enforced here:
 *   - Every decision goes through decide_submission(). No component in this file
 *     ever writes status, awarded_points or penalty_points with a table update.
 *   - The override control renders only for a lead. That is a UI convenience;
 *     the database refuses an override from anyone without
 *     submissions.override_points regardless of what the client sends.
 *   - Point values appear here and only here. This route is behind RequireRole.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { BoardLayout } from '../components/layout/BoardLayout'
import { BoardPanel } from '../components/board/BoardPanel'
import { SignLabel } from '../components/board/SignLabel'
import { Seam } from '../components/primitives/Seam'
import { Button } from '../components/primitives/Button'
import { Skeleton } from '../components/primitives/Skeleton'
import { StatusPill } from '../components/status/StatusPill'
import { EmptyState, ErrorState } from '../components/feedback/EmptyState'
import { Field, Input, Textarea } from '../components/primitives/Field'
import { ProofViewer } from '../components/booth/ProofViewer'

type QueueItem = {
  id: string
  member_id: string
  full_name: string
  department: string
  label: string
  level: string | null
  title: string
  details: string | null
  external_url: string | null
  occurred_on: string
  submitted_at: string
  status: 'pending' | 'needs_info'
  catalog_points: number | null
  is_variable: boolean
}

type Decision = 'verified' | 'needs_info' | 'rejected'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function relative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function Review() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { role } = useAuth()
  const isLead = role === 'lead'

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [points, setPoints] = useState('')
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const queueQuery = useQuery({
    queryKey: ['review-queue'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_review_queue')
      if (error) throw error
      return (data ?? []) as unknown as QueueItem[]
    },
  })

  const queue = useMemo(() => queueQuery.data ?? [], [queueQuery.data])
  const pendingCount = queue.filter(q => q.status === 'pending').length
  const sentBackCount = queue.filter(q => q.status === 'needs_info').length

  const selectedIndex = queue.findIndex(q => q.id === selectedId)
  const selected = selectedIndex >= 0 ? queue[selectedIndex] : null

  // Keep a selection alive as the queue drains under us.
  useEffect(() => {
    if (queue.length === 0) {
      if (selectedId !== null) setSelectedId(null)
      return
    }
    if (!queue.some(q => q.id === selectedId)) setSelectedId(queue[0].id)
  }, [queue, selectedId])

  // Reset the decision form whenever the selection changes.
  useEffect(() => {
    setNote('')
    setPoints('')
    setOverrideOpen(false)
    setOverrideReason('')
    setActionError('')
  }, [selectedId])

  const decide = useMutation({
    mutationFn: async (decision: Decision) => {
      if (!selected) return
      const overriding = decision === 'verified' && (selected.is_variable || (isLead && overrideOpen))
      const { error } = await supabase.rpc('decide_submission', {
        p_submission_id: selected.id,
        p_decision: decision,
        p_note: note.trim() || null,
        p_override_points: overriding ? Number(points) : null,
        p_override_reason: overriding && !selected.is_variable ? overrideReason.trim() || null : null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      // Advance to the next item before the refetch lands so the reviewer
      // is never dropped back to the top of the list.
      const next = queue[selectedIndex + 1] ?? queue[selectedIndex - 1] ?? null
      setSelectedId(next ? next.id : null)
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
      queryClient.invalidateQueries({ queryKey: ['team-total'] })
      queryClient.invalidateQueries({ queryKey: ['board-feed'] })
    },
    onError: (err: Error) => setActionError(err.message),
  })

  const submitDecision = useCallback(
    (decision: Decision) => {
      if (!selected || decide.isPending) return
      setActionError('')

      if (decision === 'verified' && selected.is_variable && !points.trim()) {
        setActionError('The organisers announce the value for this one. Enter the points before posting it.')
        return
      }
      if (decision === 'verified' && overrideOpen && !selected.is_variable) {
        if (!points.trim()) {
          setActionError('Enter the point value you are overriding to.')
          return
        }
        if (!overrideReason.trim()) {
          setActionError('An override needs a reason. It goes into the audit log.')
          return
        }
      }
      if (decision === 'needs_info' && !note.trim()) {
        setActionError('Say what evidence is missing, otherwise they will not know what to send.')
        return
      }
      if (decision === 'rejected' && !note.trim()) {
        setActionError('Give a reason. They see this note on their board.')
        return
      }

      decide.mutate(decision)
    },
    [selected, decide, points, note, overrideOpen, overrideReason],
  )

  const move = useCallback(
    (delta: number) => {
      if (queue.length === 0) return
      const next = Math.min(Math.max(selectedIndex + delta, 0), queue.length - 1)
      setSelectedId(queue[next].id)
    },
    [queue, selectedIndex],
  )

  // Keyboard shortcuts, suppressed while typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'Escape') {
        setShortcutsOpen(false)
        return
      }
      if (typing) return

      if (e.key === 'j') { e.preventDefault(); move(1) }
      else if (e.key === 'k') { e.preventDefault(); move(-1) }
      else if (e.key === 'v') { e.preventDefault(); submitDecision('verified') }
      else if (e.key === 'i') { e.preventDefault(); submitDecision('needs_info') }
      else if (e.key === 'r') { e.preventDefault(); submitDecision('rejected') }
      else if (e.key === '?') { e.preventDefault(); setShortcutsOpen(v => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move, submitDecision])

  const topbar = (
    <div className="flex items-center justify-between w-full gap-4">
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="font-display font-bold text-xl text-chalk tracking-sign uppercase">ECHO</span>
        <span className="text-sm text-chalk/60 truncate">The Booth</span>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-sm text-chalk/60">
          <span className="tabular-nums text-chalk">{pendingCount}</span> in the queue
        </span>
        <span className="text-sm text-chalk/60 hidden sm:inline">
          <span className="tabular-nums text-chalk">{sentBackCount}</span> sent back
        </span>
        <button
          className="text-sm text-chalk/60 hover:text-chalk underline focus:outline-none focus:shadow-ring rounded-slot px-1"
          onClick={() => navigate('/')}
        >
          Back to the board
        </button>
      </div>
    </div>
  )

  if (queueQuery.isLoading) {
    return (
      <BoardLayout topbar={topbar}>
        <BoardPanel>
          <div className="flex flex-col gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} variant="row" />)}
          </div>
        </BoardPanel>
      </BoardLayout>
    )
  }

  if (queueQuery.isError) {
    return (
      <BoardLayout topbar={topbar}>
        <BoardPanel>
          <ErrorState
            headline="Could not open the queue"
            body="get_review_queue refused or failed. If it said not authorised, your role claim is stale — sign out and back in."
            retry={() => queueQuery.refetch()}
          />
        </BoardPanel>
      </BoardLayout>
    )
  }

  return (
    <BoardLayout topbar={topbar}>
      {queue.length === 0 ? (
        <BoardPanel>
          <EmptyState
            headline="Queue is clear."
            body="Nothing is waiting on a decision. New submissions land here the moment a member sends them."
            action={<Button variant="secondary" onClick={() => navigate('/')}>Back to the board</Button>}
          />
        </BoardPanel>
      ) : (
        <div className="flex flex-col lg:flex-row gap-stack items-start">
          {/* Queue list */}
          <div className="w-full lg:w-[340px] shrink-0">
            <BoardPanel padded={false}>
              <div className="px-panel pt-panel pb-2">
                <SignLabel>Waiting</SignLabel>
              </div>
              <Seam />
              <div ref={listRef} className="max-h-[60vh] lg:max-h-[70vh] overflow-y-auto">
                {queue.map(item => {
                  const active = item.id === selectedId
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      aria-current={active}
                      className={`w-full text-left px-4 py-3 border-b border-seam border-l-4 focus:outline-none focus:shadow-ring
                        ${active ? 'border-l-lamp bg-lit' : 'border-l-transparent hover:bg-lit'}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-chalk truncate">{item.full_name}</span>
                        <span className="text-xs text-chalk/60 shrink-0 tabular-nums">
                          {relative(item.submitted_at)}
                        </span>
                      </div>
                      <div className="text-sm text-chalk/70 truncate mt-0.5">
                        {item.label}{item.level ? ` — ${item.level}` : ''}
                      </div>
                      {item.status === 'needs_info' && (
                        <div className="mt-1"><StatusPill status="needs_info" size="sm" /></div>
                      )}
                    </button>
                  )
                })}
              </div>
            </BoardPanel>
            <p className="text-xs text-chalk/40 mt-3 px-1">
              j and k move, v posts, i sends back, r rejects. Press ? for the full list.
            </p>
          </div>

          {/* Detail */}
          <div className="w-full min-w-0 flex flex-col gap-stack">
            {selected && (
              <>
                <BoardPanel>
                  <div className="flex flex-col gap-5">
                    <div>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h2 className="text-xl font-display font-bold text-chalk">{selected.full_name}</h2>
                        <span className="text-sm text-chalk/60">{selected.department}</span>
                      </div>
                      <p className="text-base text-chalk mt-2">
                        {selected.label}{selected.level ? ` — ${selected.level}` : ''}
                      </p>
                    </div>

                    <Seam />

                    <div className="flex flex-col gap-3">
                      <h3 className="text-lg text-chalk font-medium">{selected.title}</h3>
                      <p className="text-sm text-chalk/60 tabular-nums">
                        Happened on {formatDate(selected.occurred_on)}
                      </p>
                      {selected.details && (
                        <p className="text-sm text-chalk/80 whitespace-pre-wrap">{selected.details}</p>
                      )}
                      {selected.external_url && (
                        <a
                          href={selected.external_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-lamp underline break-all focus:outline-none focus:shadow-ring rounded-slot"
                        >
                          {selected.external_url}
                        </a>
                      )}
                    </div>

                    <Seam />

                    <div className="flex flex-col gap-3">
                      <SignLabel>Proof</SignLabel>
                      <ProofViewer submissionId={selected.id} />
                    </div>
                  </div>
                </BoardPanel>

                {/* Decision */}
                <BoardPanel>
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-base text-chalk">
                        {selected.is_variable
                          ? 'The organisers set the value for this one.'
                          : <>Catalog value <span className="font-display font-bold tabular-nums">{selected.catalog_points ?? 0}</span> points</>}
                      </span>
                      {isLead && !selected.is_variable && (
                        <button
                          type="button"
                          onClick={() => setOverrideOpen(v => !v)}
                          className="text-sm text-chalk/60 hover:text-chalk underline focus:outline-none focus:shadow-ring rounded-slot px-1"
                        >
                          {overrideOpen ? 'Use the catalog value' : 'Override the value'}
                        </button>
                      )}
                    </div>

                    {(selected.is_variable || overrideOpen) && (
                      <Field
                        label="Points to award"
                        htmlFor="points"
                        help={selected.is_variable
                          ? 'Take this from the challenge or judge announcement.'
                          : 'This replaces the catalog value and is written to the audit log.'}
                      >
                        <Input
                          id="points"
                          type="number"
                          min={0}
                          className="tabular-nums"
                          value={points}
                          onChange={e => setPoints(e.target.value)}
                          disabled={decide.isPending}
                        />
                      </Field>
                    )}

                    {overrideOpen && !selected.is_variable && (
                      <Field label="Why you are overriding" htmlFor="override-reason">
                        <Textarea
                          id="override-reason"
                          value={overrideReason}
                          onChange={e => setOverrideReason(e.target.value)}
                          placeholder="Announced as a double-points week by the organisers."
                          disabled={decide.isPending}
                        />
                      </Field>
                    )}

                    <Field
                      label="Note to the member"
                      htmlFor="note"
                      help="Required when sending back or rejecting. They see this on their board."
                    >
                      <Textarea
                        id="note"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="The certificate is cropped. Send the full page showing your name."
                        disabled={decide.isPending}
                      />
                    </Field>

                    {actionError && (
                      <p className="text-sm text-flare border-hair border-flag rounded-slot px-3 py-2">
                        {actionError}
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => submitDecision('verified')}
                        loading={decide.isPending}
                        className="w-full sm:w-auto"
                      >
                        Verify and post
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={decide.isPending}
                        onClick={() => submitDecision('needs_info')}
                        className="w-full sm:w-auto"
                      >
                        Ask for more proof
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={decide.isPending}
                        onClick={() => submitDecision('rejected')}
                        className="w-full sm:w-auto"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </BoardPanel>
              </>
            )}
          </div>
        </div>
      )}

      {shortcutsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          className="fixed inset-0 z-dialog bg-graphite/90 flex items-center justify-center p-gutter"
          onClick={() => setShortcutsOpen(false)}
        >
          <div className="w-full max-w-form" onClick={e => e.stopPropagation()}>
            <BoardPanel>
              <div className="flex flex-col gap-4">
                <SignLabel>Shortcuts</SignLabel>
                <dl className="flex flex-col gap-2 text-sm">
                  {[
                    ['j', 'Next submission'],
                    ['k', 'Previous submission'],
                    ['v', 'Verify and post'],
                    ['i', 'Ask for more proof'],
                    ['r', 'Reject'],
                    ['?', 'Open and close this list'],
                    ['Esc', 'Close this list'],
                  ].map(([key, what]) => (
                    <div key={key} className="flex items-center gap-4">
                      <kbd className="w-12 text-center font-display text-chalk border-hair border-seam rounded-slot px-2 py-0.5">
                        {key}
                      </kbd>
                      <span className="text-chalk/80">{what}</span>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-chalk/60">
                  Shortcuts pause while you are typing in a field.
                </p>
                <Button variant="secondary" onClick={() => setShortcutsOpen(false)}>Close</Button>
              </div>
            </BoardPanel>
          </div>
        </div>
      )}
    </BoardLayout>
  )
}
