import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { Field, Input, Select } from '../components/primitives/Field'
import { Button } from '../components/primitives/Button'
import { Notice } from '../components/feedback/Notice'
import { Skeleton } from '../components/primitives/Skeleton'
import { TextButton } from '../components/primitives/Controls'
import { AvatarPanel } from '../components/media/AvatarPanel'
import { CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react'

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
    <div className="min-h-screen bg-recess haze flex flex-col items-center">
      <header className="glass-topbar w-full h-[56px] sticky top-0 z-header flex items-center justify-between px-6">
        <button
          className="font-display font-bold text-xl text-chalk tracking-sign uppercase hover:text-lamp transition-colors"
          onClick={() => navigate('/')}
        >
          ECHO
        </button>
        <div className="flex items-center gap-4">
          {isCore && <TextButton onClick={() => navigate('/review')}>The Booth</TextButton>}
          <TextButton onClick={() => navigate('/')}>Board</TextButton>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl px-6 py-12">
        
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-medium text-chalk tracking-tight mb-2">Command Center</h1>
            <p className="text-muted text-sm">Manage your identity, settings, and track your contributions.</p>
          </div>
          {profile && (
            <div className={`px-3 py-1 rounded-pill text-xs font-medium border ${profile.is_active ? 'bg-posted/10 text-posted border-posted/20' : 'bg-flag/10 text-flag border-flag/20'}`}>
              {profile.is_active ? 'Active Roster' : 'Inactive'}
            </div>
          )}
        </div>

        {!profile ? (
          <Skeleton variant="card" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">
            
            {/* LEFT COLUMN: Identity Card */}
            <div className="flex flex-col gap-6">
              <div className="bg-enamel border border-seam rounded-2xl overflow-hidden relative shadow-[0_8px_32px_-12px_rgba(0,0,0,0.4)]">
                <div className="h-28 bg-gradient-to-br from-lamp/20 to-recess border-b border-lamp/10" />
                <div className="px-6 pb-8 relative">
                  <div className="-mt-12 mb-5">
                    <AvatarPanel />
                  </div>
                  
                  <h2 className="text-xl font-semibold text-chalk mb-1">{profile.full_name}</h2>
                  <p className="text-lamp text-sm font-medium mb-6">
                    {ROLE_LABEL[role]} <span className="opacity-50 mx-1">•</span> {teamQuery.data?.name ?? 'ECHO'}
                  </p>
                  
                  <div className="space-y-4 pt-6 border-t border-seam/50">
                    <IdentityRow label="Email" value={session?.user.email ?? '—'} />
                    <IdentityRow label="Department" value={profile.department} />
                    <IdentityRow label="Enrollment" value={profile.enrollment_no || 'Not given'} />
                    <IdentityRow label="Joined" value={formatDate(profile.created_at)} />
                  </div>
                </div>
              </div>

              <div className="bg-recess border border-seam rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-chalk mb-2">Session Security</h3>
                <p className="text-xs text-muted mb-5 leading-relaxed">
                  Sign out on this device. Other sessions will remain active until their tokens expire.
                </p>
                <Button 
                  variant="secondary" 
                  className="w-full text-dim hover:text-flag hover:border-flag/40 transition-colors"
                  onClick={async () => {
                    await supabase.auth.signOut()
                    queryClient.clear()
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </div>

            {/* RIGHT COLUMN: Settings & Records */}
            <div className="flex flex-col gap-8">
              
              {/* Record Summary */}
              <div className="bg-enamel border border-seam rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber/5 rounded-full blur-[60px] pointer-events-none" />
                <h2 className="text-base font-semibold text-chalk mb-6 relative z-10">Contribution Record</h2>
                
                {myQuery.isLoading ? (
                  <Skeleton variant="card" />
                ) : (
                  <div className="flex flex-col sm:flex-row gap-6 relative z-10">
                    
                    {/* Primary Highlight */}
                    <div className="sm:w-1/3 bg-posted/10 border border-posted/20 rounded-xl p-6 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-5 h-5 text-posted" />
                        <span className="text-xs font-semibold text-posted uppercase tracking-wide">Posted</span>
                      </div>
                      <span className="text-5xl font-display font-black text-chalk">{counts.verified}</span>
                    </div>
                    
                    {/* Secondary Metrics */}
                    <div className="flex-1 grid grid-cols-3 bg-recess border border-seam/50 rounded-xl divide-x divide-seam/50 overflow-hidden">
                      <MiniStat icon={<Clock className="w-4 h-4 text-amber" />} label="Queue" value={counts.pending} color="text-amber" />
                      <MiniStat icon={<AlertCircle className="w-4 h-4 text-amber" />} label="Sent Back" value={counts.needs_info} color="text-amber" />
                      <MiniStat icon={<XCircle className="w-4 h-4 text-dim" />} label="Closed" value={counts.closed} color="text-dim" />
                    </div>

                  </div>
                )}
              </div>

              {/* Profile Editor */}
              <div className="bg-enamel border border-seam rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-base font-semibold text-chalk">Profile Settings</h2>
                  {!editing && <TextButton onClick={startEdit}>Edit Profile</TextButton>}
                </div>
                
                {saved && !editing && (
                  <div className="mb-6"><Notice tone="good">{saved}</Notice></div>
                )}

                {editing ? (
                  <form onSubmit={e => { e.preventDefault(); if (dirty) save.mutate(); }} className="flex flex-col gap-5">
                    {save.isError && <Notice tone="error">{readable(save.error as any)}</Notice>}
                    <Field label="Name" htmlFor="full_name">
                      <Input id="full_name" value={fullName} onChange={e => setFullName(e.target.value)} maxLength={80} required />
                    </Field>
                    <Field label="Department" htmlFor="department">
                      <Input id="department" value={department} onChange={e => setDepartment(e.target.value)} maxLength={80} required />
                    </Field>
                    <Field label="Enrollment number" htmlFor="enrollment_no" help="Optional.">
                      <Input id="enrollment_no" value={enrollmentNo} onChange={e => setEnrollmentNo(e.target.value)} maxLength={40} />
                    </Field>
                    <Field label="Track" htmlFor="sprint_track" help="Sets which sprint-track achievements apply to you.">
                      <Select id="sprint_track" value={track} onChange={e => setTrack(e.target.value as Track | '')}>
                        <option value="">None</option>
                        <option value="code">Code</option>
                        <option value="open_source">Open Source</option>
                        <option value="build">Build</option>
                        <option value="pitch">Pitch</option>
                      </Select>
                    </Field>
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 mt-2 border-t border-seam/50">
                      <Button type="submit" loading={save.isPending} loadingLabel="Saving..." disabled={!dirty} className="w-full sm:w-auto">
                        Save Changes
                      </Button>
                      <Button type="button" variant="quiet" onClick={cancelEdit} className="w-full sm:w-auto">
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-6">
                    <DataRow label="Name" value={profile.full_name} />
                    <DataRow label="Department" value={profile.department} />
                    <DataRow label="Enrollment number" value={profile.enrollment_no || 'Not given'} />
                    <DataRow label="Track" value={profile.sprint_track ? TRACK_LABEL[profile.sprint_track] : 'None'} />
                  </div>
                )}
              </div>

              {/* Password Settings */}
              <div className="bg-enamel border border-seam rounded-2xl p-8">
                <PasswordEditor />
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-mono tracking-label uppercase text-dim">{label}</span>
      <span className="text-sm font-medium text-chalk truncate">{value}</span>
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="text-base text-chalk">{value}</span>
    </div>
  )
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode, label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col justify-center items-center text-center p-4">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-2xl font-display font-black tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

function PasswordEditor() {
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-chalk">Password</h2>
        {!open && <TextButton onClick={() => { setDone(''); setOpen(true) }}>Change Password</TextButton>}
      </div>

      {done && !open && <div className="mb-4"><Notice tone="good">{done}</Notice></div>}

      {open ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-4">
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="New password" htmlFor="new_password" help="At least 6 characters.">
            <Input id="new_password" type="password" value={next} onChange={e => setNext(e.target.value)} minLength={6} required />
          </Field>
          <Field label="New password again" htmlFor="confirm_password">
            <Input id="confirm_password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </Field>
          <div className="flex flex-col sm:flex-row gap-3 pt-4 mt-2 border-t border-seam/50">
            <Button type="submit" loading={loading} loadingLabel="Saving..." className="w-full sm:w-auto">Update Password</Button>
            <Button type="button" variant="quiet" onClick={close} className="w-full sm:w-auto">Cancel</Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted">
          Set a new password for this account. Other sessions stay signed in until their token expires.
        </p>
      )}
    </div>
  )
}
