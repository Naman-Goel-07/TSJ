/**
 * /profile — your own record.
 *
 * Split by who owns the field:
 *
 *   Yours          name, department, enrollment number, track
 *                  → update_my_profile(), the only write path that exists
 *   The lead's     role, team, active status
 *                  → read-only here, changed from /admin
 *   Supabase's     email, password
 *                  → auth.updateUser()
 *
 * The read-only block is not a UI decision being polite about it. UPDATE on
 * public.profiles is revoked from authenticated, and update_my_profile() has no
 * argument for team_id or is_active, so a member calling the RPC by hand cannot
 * reach them either. Role is read from the JWT claim and cannot be written from
 * a browser at all.
 *
 * No point value appears on this page. The counts below are statuses, not
 * scores, and they come from get_my_submissions(), whose return type has no
 * points column.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { BoardLayout } from '../components/layout/BoardLayout'
import { BoardPanel } from '../components/board/BoardPanel'
import { SignLabel } from '../components/board/SignLabel'
import { Seam } from '../components/primitives/Seam'
import { Field, Input, Select } from '../components/primitives/Field'
import { Button } from '../components/primitives/Button'
import { Notice } from '../components/feedback/Notice'
import { Skeleton } from '../components/primitives/Skeleton'

type Track = 'code' | 'open_source' | 'build' | 'pitch'

const TRACK_LABEL: Record<Track, string> = {
  code: 'Code',
  open_source: 'Open Source',
  build: 'Build',
  pitch: 'Pitch',
}

const ROLE_LABEL = {
  member: 'Member',
  core: 'Core member',
  lead: 'Lead',
}

const ROLE_NOTE = {
  member: 'You can call in achievements. A core member checks them.',
  core: 'You can verify, send back and reject what the team calls in.',
  lead: 'You hold the roster, the sprint window and the export.',
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function readable(err: { message?: string; code?: string }): string {
  const code = err.code ?? ''
  const message = err.message ?? ''

  if (code === '42501') return 'The database refused that. Your session may have gone stale — sign out and back in.'
  if (code === 'P0002' || /no profile/i.test(message)) return 'Your profile row is missing. Finish onboarding first.'
  if (code === '22023') return message
  if (code === 'weak_password' || /password should be/i.test(message))
    return 'That password is too short. Use at least 6 characters.'
  if (code === 'same_password' || /should be different/i.test(message))
    return 'That is already your password. Pick a different one.'
  if (code === 'over_request_rate_limit' || /rate limit/i.test(message))
    return 'Too many attempts. Wait a minute, then try again.'
  if (code === 'reauthentication_needed')
    return 'For a password change this project wants a fresh sign-in. Sign out, sign back in, then try again.'

  return message || 'That did not go through. Try again.'
}

export function Profile() {
  const { session, profile, role, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('')
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [track, setTrack] = useState<Track | ''>('')
  const [saved, setSaved] = useState('')

  // Mirror the stored profile into the form whenever it changes underneath us,
  // but never while someone is mid-edit — that would eat their typing.
  useEffect(() => {
    if (editing || !profile) return
    setFullName(profile.full_name)
    setDepartment(profile.department)
    setEnrollmentNo(profile.enrollment_no ?? '')
    setTrack(profile.sprint_track ?? '')
  }, [profile, editing])

  const teamQuery = useQuery({
    queryKey: ['team', profile?.team_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('name, slug')
        .eq('id', profile!.team_id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!profile?.team_id,
  })

  // Shares the Board's cache key on purpose: one fetch, two screens.
  const myQuery = useQuery({
    queryKey: ['my-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_submissions')
      if (error) throw error
      return data ?? []
    },
    enabled: !!session,
  })

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('update_my_profile', {
        p_full_name: fullName.trim(),
        p_department: department.trim(),
        p_enrollment_no: enrollmentNo.trim() || null,
        p_sprint_track: track || null,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
      // The board feed prints member names, so a rename should show there too.
      queryClient.invalidateQueries({ queryKey: ['board-feed'] })
      setEditing(false)
      setSaved('Details updated.')
    },
  })

  const dirty =
    !!profile &&
    (fullName.trim() !== profile.full_name ||
      department.trim() !== profile.department ||
      (enrollmentNo.trim() || null) !== (profile.enrollment_no ?? null) ||
      (track || null) !== (profile.sprint_track ?? null))

  function startEdit() {
    setSaved('')
    save.reset()
    setEditing(true)
  }

  function cancelEdit() {
    if (!profile) return
    setFullName(profile.full_name)
    setDepartment(profile.department)
    setEnrollmentNo(profile.enrollment_no ?? '')
    setTrack(profile.sprint_track ?? '')
    save.reset()
    setEditing(false)
  }

  const isCore = role === 'core' || role === 'lead'
  const mine = (myQuery.data ?? []) as { status: string }[]
  const counts = {
    verified: mine.filter(r => r.status === 'verified').length,
    pending: mine.filter(r => r.status === 'pending').length,
    needs_info: mine.filter(r => r.status === 'needs_info').length,
    closed: mine.filter(r => r.status === 'rejected' || r.status === 'revoked').length,
  }

  return (
    <BoardLayout
      topbar={
        <div className="flex items-center justify-between w-full">
          <button
            className="font-display font-bold text-xl text-chalk tracking-sign uppercase focus:outline-none focus:shadow-ring rounded-slot"
            onClick={() => navigate('/')}
          >
            ECHO
          </button>
          <div className="flex items-center gap-4">
            {isCore && (
              <button
                className="text-sm text-chalk/80 hover:text-chalk underline focus:outline-none focus:shadow-ring rounded-slot px-1"
                onClick={() => navigate('/review')}
              >
                The Booth
              </button>
            )}
            <button
              className="text-sm text-chalk/80 hover:text-chalk underline focus:outline-none focus:shadow-ring rounded-slot px-1"
              onClick={() => navigate('/')}
            >
              Back to the board
            </button>
          </div>
        </div>
      }
    >
      {!profile ? (
        <Skeleton variant="card" />
      ) : (
        <>
          {/* ── Your details ───────────────────────────────────────────── */}
          <BoardPanel padded={false}>
            <div className="px-panel pt-panel pb-2 flex items-center justify-between gap-4">
              <SignLabel>Your details</SignLabel>
              {!editing && (
                <button
                  className="text-sm text-chalk/80 hover:text-chalk underline focus:outline-none focus:shadow-ring rounded-slot px-1"
                  onClick={startEdit}
                >
                  Edit
                </button>
              )}
            </div>
            <Seam />

            <div className="p-panel">
              {saved && !editing && (
                <div className="mb-4">
                  <Notice tone="good">{saved}</Notice>
                </div>
              )}

              {editing ? (
                <form
                  className="flex flex-col gap-4"
                  onSubmit={e => {
                    e.preventDefault()
                    if (dirty) save.mutate()
                  }}
                >
                  {save.isError && <Notice tone="error">{readable(save.error as any)}</Notice>}

                  <Field label="Name" htmlFor="full_name">
                    <Input
                      id="full_name"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      maxLength={80}
                      required
                    />
                  </Field>

                  <Field label="Department" htmlFor="department">
                    <Input
                      id="department"
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      maxLength={80}
                      required
                    />
                  </Field>

                  <Field
                    label="Enrollment number"
                    htmlFor="enrollment_no"
                    help="Optional. Leave it blank if you would rather not."
                  >
                    <Input
                      id="enrollment_no"
                      value={enrollmentNo}
                      onChange={e => setEnrollmentNo(e.target.value)}
                      maxLength={40}
                    />
                  </Field>

                  <Field
                    label="Track"
                    htmlFor="sprint_track"
                    help="Optional. Sets which sprint-track achievements apply to you."
                  >
                    <Select
                      id="sprint_track"
                      value={track}
                      onChange={e => setTrack(e.target.value as Track | '')}
                    >
                      <option value="">None</option>
                      <option value="code">Code</option>
                      <option value="open_source">Open Source</option>
                      <option value="build">Build</option>
                      <option value="pitch">Pitch</option>
                    </Select>
                  </Field>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      type="submit"
                      loading={save.isPending}
                      loadingLabel="Saving..."
                      disabled={!dirty}
                      className="w-full sm:w-auto"
                    >
                      Save changes
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      onClick={cancelEdit}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <dl className="flex flex-col gap-4">
                  <Row label="Name" value={profile.full_name} />
                  <Row label="Department" value={profile.department} />
                  <Row label="Enrollment number" value={profile.enrollment_no || 'Not given'} />
                  <Row
                    label="Track"
                    value={profile.sprint_track ? TRACK_LABEL[profile.sprint_track] : 'None'}
                  />
                </dl>
              )}
            </div>
          </BoardPanel>

          {/* ── Account ────────────────────────────────────────────────── */}
          <BoardPanel padded={false}>
            <div className="px-panel pt-panel pb-2">
              <SignLabel>Account</SignLabel>
            </div>
            <Seam />
            <div className="p-panel">
              <dl className="flex flex-col gap-4">
                <Row label="Email" value={session?.user.email ?? '—'} />
                <Row label="Role" value={ROLE_LABEL[role]} note={ROLE_NOTE[role]} />
                <Row label="Team" value={teamQuery.data?.name ?? 'ECHO'} />
                <Row label="On the roster since" value={formatDate(profile.created_at)} />
                <Row
                  label="Status"
                  value={profile.is_active ? 'Active' : 'Inactive'}
                  note={profile.is_active ? undefined : 'A lead has taken you off the active roster.'}
                />
              </dl>
              <p className="mt-6 text-xs text-chalk/60">
                Role, team and status are set by a lead from the admin screen. A role change reaches you on
                your next token, so sign out and back in if you have just been promoted.
              </p>
            </div>
          </BoardPanel>

          {/* ── Your record ────────────────────────────────────────────── */}
          <BoardPanel padded={false}>
            <div className="px-panel pt-panel pb-2">
              <SignLabel>Your record</SignLabel>
            </div>
            <Seam />
            <div className="p-panel">
              {myQuery.isLoading ? (
                <Skeleton variant="line" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Count n={counts.verified} label="Posted" tone="text-posted" />
                  <Count n={counts.pending} label="In the queue" tone="text-amber" />
                  <Count n={counts.needs_info} label="Sent back" tone="text-amber" />
                  <Count n={counts.closed} label="Not posted" tone="text-chalk/60" />
                </div>
              )}
              <p className="mt-6 text-xs text-chalk/60">
                Counts, not points. Individual point values are not readable from a member's session — the
                team total on the board is the only figure the server will hand over.
              </p>
            </div>
          </BoardPanel>

          {/* ── Password ───────────────────────────────────────────────── */}
          <PasswordPanel />

          <div className="pb-stack">
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={async () => {
                await supabase.auth.signOut()
                queryClient.clear()
              }}
            >
              Sign out
            </Button>
          </div>
        </>
      )}
    </BoardLayout>
  )
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
      <dt className="text-sm text-chalk/60 sm:w-48 shrink-0">{label}</dt>
      <dd className="flex-1">
        <span className="text-base text-chalk break-words">{value}</span>
        {note && <p className="text-xs text-chalk/60 mt-1">{note}</p>}
      </dd>
    </div>
  )
}

function Count({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`font-display text-xl font-bold tabular-nums ${tone}`}>{n}</span>
      <span className="text-xs text-chalk/60">{label}</span>
    </div>
  )
}

/**
 * Password change. Kept in its own panel and its own state because it does not
 * touch profiles at all — it goes to Supabase auth, and its failure modes are
 * different from a profile save.
 */
function PasswordPanel() {
  const [open, setOpen] = useState(false)
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  function close() {
    setOpen(false)
    setNext('')
    setConfirm('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError('')
    setDone('')

    if (next !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    if (next.length < 6) {
      setError('Use at least 6 characters.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    setLoading(false)

    if (updateError) {
      setError(readable(updateError))
      return
    }
    close()
    setDone('Password changed. It applies the next time you sign in.')
  }

  return (
    <BoardPanel padded={false}>
      <div className="px-panel pt-panel pb-2 flex items-center justify-between gap-4">
        <SignLabel>Password</SignLabel>
        {!open && (
          <button
            className="text-sm text-chalk/80 hover:text-chalk underline focus:outline-none focus:shadow-ring rounded-slot px-1"
            onClick={() => {
              setDone('')
              setOpen(true)
            }}
          >
            Change
          </button>
        )}
      </div>
      <Seam />
      <div className="p-panel">
        {done && !open && (
          <div className="mb-4">
            <Notice tone="good">{done}</Notice>
          </div>
        )}

        {open ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <Notice tone="error">{error}</Notice>}

            <Field label="New password" htmlFor="new_password" help="At least 6 characters.">
              <Input
                id="new_password"
                type="password"
                value={next}
                onChange={e => setNext(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>

            <Field label="New password again" htmlFor="confirm_password">
              <Input
                id="confirm_password"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button type="submit" loading={loading} loadingLabel="Saving..." className="w-full sm:w-auto">
                Change password
              </Button>
              <Button type="button" variant="quiet" onClick={close} className="w-full sm:w-auto">
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-chalk/60">
            Set a new password for this account. Other sessions stay signed in until their token expires.
          </p>
        )}
      </div>
    </BoardPanel>
  )
}
