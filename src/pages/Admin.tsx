/**
 * /admin — lead only. Roster, roles, the sprint window, and the audit trail.
 *
 * Roles are not stored in this app. They live in public.user_roles and ride into
 * the access token through custom_access_token_hook, which is what makes the
 * "no hardcoded emails" rule real rather than aspirational. The consequence is
 * that a role change lands on the target user's NEXT token, not immediately.
 * The screen says so rather than leaving it as a surprise.
 */
import { useState } from 'react'
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
import { EmptyState, ErrorState } from '../components/feedback/EmptyState'
import { Field, Input, Select } from '../components/primitives/Field'
import { TextButton } from '../components/primitives/Controls'

type AppRole = 'member' | 'core' | 'lead'

const ROLE_WORD: Record<AppRole, string> = {
  member: 'Member',
  core: 'Core',
  lead: 'Lead',
}

const ROLE_CAN: Record<AppRole, string> = {
  member: 'Submits achievements. Sees the team total and nothing else.',
  core: 'Verifies submissions, pulls them back off, runs roll call.',
  lead: 'Everything core can do, plus overriding points, roles and the export.',
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function Admin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session, refreshSession } = useAuth()
  const myId = session?.user.id

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [start, setStart] = useState('')
  const [days, setDays] = useState('')

  const rosterQuery = useQuery({
    queryKey: ['members-with-roles'],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('get_members_with_roles')
      if (rpcError) throw rpcError
      return data ?? []
    },
  })

  const configQuery = useQuery({
    queryKey: ['sprint-config'],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('sprint_config')
        .select('sprint_start, total_days')
        .single()
      if (qError) throw qError
      return data
    },
  })

  const auditQuery = useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('get_audit_log', { p_limit: 25 })
      if (rpcError) throw rpcError
      return data ?? []
    },
  })

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error: rpcError } = await supabase.rpc('set_user_role', {
        p_user_id: userId,
        p_role: role,
      })
      if (rpcError) throw rpcError
      return { userId, role }
    },
    onSuccess: async ({ userId, role }) => {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['members-with-roles'] })
      queryClient.invalidateQueries({ queryKey: ['audit-log'] })
      if (userId === myId) {
        // Our own claim is stale until the token is reissued. Do it now.
        await refreshSession()
        setNotice(`You are now ${ROLE_WORD[role].toLowerCase()}. Your session has been refreshed.`)
      } else {
        setNotice(
          `Saved. It takes effect on their next token, so ask them to sign out and back in.`,
        )
      }
    },
    onError: (err: Error) => { setNotice(''); setError(err.message) },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error: rpcError } = await supabase.rpc('set_member_active', {
        p_member_id: id,
        p_is_active: active,
      })
      if (rpcError) throw rpcError
    },
    onSuccess: () => {
      setError('')
      setNotice('Roster updated. Their existing submissions are untouched.')
      queryClient.invalidateQueries({ queryKey: ['members-with-roles'] })
      queryClient.invalidateQueries({ queryKey: ['meetup-roster'] })
    },
    onError: (err: Error) => { setNotice(''); setError(err.message) },
  })

  const saveConfig = useMutation({
    mutationFn: async () => {
      const total = Number(days)
      if (!start) throw new Error('Pick the day the sprint started')
      if (!Number.isInteger(total) || total < 1) throw new Error('Give a whole number of days')
      const { error: rpcError } = await supabase.rpc('set_sprint_config', {
        p_sprint_start: start,
        p_total_days: total,
      })
      if (rpcError) throw rpcError
    },
    onSuccess: () => {
      setError('')
      setNotice('Sprint window saved. The day counter on the board follows it.')
      queryClient.invalidateQueries({ queryKey: ['sprint-config'] })
    },
    onError: (err: Error) => { setNotice(''); setError(err.message) },
  })

  const roster = rosterQuery.data ?? []
  const config = configQuery.data

  const topbar = (
    <div className="flex items-center justify-between w-full gap-4">
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="font-display font-bold text-xl text-chalk tracking-sign uppercase">ECHO</span>
        <span className="text-sm text-chalk/60 truncate">Admin</span>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <TextButton
          onClick={() => navigate('/booth/export')}
        >
          Export
        </TextButton>
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

  return (
    <BoardLayout topbar={topbar}>
      {(error || notice) && (
        <div className={`text-sm rounded-slot px-3 py-2 border-hair
          ${error ? 'text-flare border-flag' : 'text-posted border-seam'}`}>
          {error || notice}
        </div>
      )}

      {/* Roster and roles */}
      <BoardPanel padded={false}>
        <div className="px-panel pt-panel pb-2">
          <SignLabel>Roster</SignLabel>
          <p className="text-sm text-chalk/60 mt-2 max-w-[62ch]">
            Roles are stored in the database and travel in the access token, never keyed off an
            email address. Changing one here takes effect on that person's next token, so they
            need to sign out and back in before they can reach anything new.
          </p>
        </div>
        <Seam />

        {rosterQuery.isLoading ? (
          <div>{[...Array(3)].map((_, i) => <Skeleton key={i} variant="row" />)}</div>
        ) : rosterQuery.isError ? (
          <div className="px-panel py-8">
            <ErrorState
              headline="Could not load the roster"
              body="get_members_with_roles refused or failed. Check that migration 0007 ran and that you hold the lead role."
              retry={() => rosterQuery.refetch()}
            />
          </div>
        ) : roster.length === 0 ? (
          <EmptyState
            headline="Nobody has joined yet."
            body="Members appear here once they sign up and finish onboarding."
          />
        ) : (
          <div>
            {roster.map(m => (
              <div
                key={m.id}
                className={`px-4 py-3 border-b border-seam flex flex-wrap items-center gap-x-4 gap-y-2
                  ${m.is_active ? '' : 'opacity-50'}`}
              >
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-chalk truncate">{m.full_name}</span>
                    {m.id === myId && <span className="text-xs text-chalk/60">you</span>}
                  </div>
                  <div className="text-xs text-chalk/60 truncate">
                    {m.department}
                    {m.enrollment_no ? `, ${m.enrollment_no}` : ''}
                    {m.sprint_track ? `, ${m.sprint_track.replace('_', ' ')} track` : ''}
                  </div>
                </div>

                <div className="text-xs text-chalk/60 tabular-nums shrink-0 w-28">
                  {m.posted_count} posted, {m.posted_points} pts
                </div>

                <div className="shrink-0 w-36">
                  <Select
                    aria-label={`Role for ${m.full_name}`}
                    value={m.role}
                    disabled={changeRole.isPending}
                    onChange={e =>
                      changeRole.mutate({ userId: m.id, role: e.target.value as AppRole })
                    }
                  >
                    <option value="member">Member</option>
                    <option value="core">Core</option>
                    <option value="lead">Lead</option>
                  </Select>
                </div>

                <TextButton
                  onClick={() => toggleActive.mutate({ id: m.id, active: !m.is_active })}
                  disabled={toggleActive.isPending}
                  className="shrink-0"
        >
                  {m.is_active ? 'Take off roster' : 'Put back on'}
                </TextButton>
              </div>
            ))}
            <div className="px-panel py-4 flex flex-col gap-1">
              {(Object.keys(ROLE_CAN) as AppRole[]).map(r => (
                <p key={r} className="text-xs text-chalk/60">
                  <span className="text-chalk">{ROLE_WORD[r]}.</span> {ROLE_CAN[r]}
                </p>
              ))}
            </div>
          </div>
        )}
      </BoardPanel>

      {/* Sprint window */}
      <BoardPanel>
        <div className="flex flex-col gap-4">
          <SignLabel>Sprint window</SignLabel>
          <p className="text-sm text-chalk/60">
            The day counter on the board is computed from these two values. It is never hardcoded.
            {config && (
              <span className="block mt-1 text-chalk tabular-nums">
                Currently day 1 on {config.sprint_start}, running {config.total_days} days.
              </span>
            )}
          </p>

          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <Field label="Sprint started" htmlFor="sprint-start">
                <Input
                  id="sprint-start"
                  type="date"
                  className="tabular-nums"
                  value={start || config?.sprint_start || ''}
                  onChange={e => setStart(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Total days" htmlFor="sprint-days">
                <Input
                  id="sprint-days"
                  type="number"
                  min={1}
                  max={365}
                  className="tabular-nums"
                  value={days || String(config?.total_days ?? '')}
                  onChange={e => setDays(e.target.value)}
                />
              </Field>
            </div>
            <Button
              onClick={() => {
                if (!start) setStart(config?.sprint_start ?? '')
                if (!days) setDays(String(config?.total_days ?? ''))
                saveConfig.mutate()
              }}
              loading={saveConfig.isPending}
            >
              Save window
            </Button>
          </div>
        </div>
      </BoardPanel>

      {/* Audit trail */}
      <BoardPanel padded={false}>
        <div className="px-panel pt-panel pb-2">
          <SignLabel>Recent activity</SignLabel>
          <p className="text-sm text-chalk/60 mt-2">
            Every decision, revocation, roll call, role change and export writes a row here.
            Nothing that moves a point is invisible.
          </p>
        </div>
        <Seam />

        {auditQuery.isLoading ? (
          <div>{[...Array(3)].map((_, i) => <Skeleton key={i} variant="row" />)}</div>
        ) : auditQuery.isError ? (
          <div className="px-panel py-8">
            <ErrorState
              headline="Could not load the audit trail"
              body="get_audit_log failed. Check that migration 0007 ran."
              retry={() => auditQuery.refetch()}
            />
          </div>
        ) : (auditQuery.data ?? []).length === 0 ? (
          <EmptyState
            headline="No activity recorded yet."
            body="Verify or pull a submission and it shows up here."
          />
        ) : (
          <div>
            {(auditQuery.data ?? []).map(row => (
              <div key={row.id} className="px-4 py-2 border-b border-seam flex items-baseline gap-4">
                <span className="text-sm text-chalk flex-1 truncate">
                  {row.actor_name ?? 'System'} — {row.action} on {row.entity}
                </span>
                <span className="text-xs text-chalk/60 tabular-nums shrink-0">
                  {formatWhen(row.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </BoardPanel>
    </BoardLayout>
  )
}
