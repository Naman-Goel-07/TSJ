/**
 * /onboarding — the one time a profile row is created.
 *
 * This used to upsert. It cannot any more: the profile migration revokes UPDATE
 * on public.profiles from authenticated, and Postgres requires UPDATE privilege
 * to plan an INSERT ... ON CONFLICT DO UPDATE even when no row conflicts. So the
 * statement would fail before it ever ran.
 *
 * Plain insert is the right shape anyway. OnboardingGate only renders this page
 * when there is no profile, so a conflict means the row was created in another
 * tab. That is not an error worth showing — pick the profile up and move on.
 *
 * Everything editable here is editable later at /profile, through
 * update_my_profile(). team_id and is_active are set once, here, and are a
 * lead's from then on.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { PlainLayout } from '../components/layout/PlainLayout'
import { BoardPanel } from '../components/board/BoardPanel'
import { Field, Input, Select } from '../components/primitives/Field'
import { Button } from '../components/primitives/Button'
import { Notice } from '../components/feedback/Notice'

type Track = 'code' | 'open_source' | 'build' | 'pitch'

export function Onboarding() {
  const navigate = useNavigate()
  const { session, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('')
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [sprintTrack, setSprintTrack] = useState<Track | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session || loading) return
    setLoading(true)
    setError('')

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('slug', 'echo')
      .maybeSingle()

    if (teamError || !team) {
      setError('The ECHO team row is missing. Run the seed insert on public.teams, then try again.')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: session.user.id,
      full_name: fullName.trim(),
      department: department.trim(),
      enrollment_no: enrollmentNo.trim() || null,
      team_id: team.id,
      sprint_track: sprintTrack || null,
      is_active: true,
    })

    // 23505: the row already exists, created in another tab. Not a failure.
    if (profileError && profileError.code !== '23505') {
      setError(`${profileError.message} (code ${profileError.code ?? 'none'})`)
      setLoading(false)
      return
    }

    await refreshProfile()
    setLoading(false)
    navigate('/', { replace: true })
  }

  return (
    <PlainLayout>
      <BoardPanel>
        <div className="mb-6">
          <h2 className="text-xl text-chalk font-semibold mb-2">Welcome to the board</h2>
          <p className="text-sm text-chalk/60">
            Tell us who you are. You can change any of this later from your profile.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <Notice tone="error">{error}</Notice>}

          <Field label="Name" htmlFor="full_name">
            <Input
              id="full_name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              maxLength={80}
              autoComplete="name"
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

          <Field label="Enrollment number" htmlFor="enrollment_no" help="Optional.">
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
              value={sprintTrack}
              onChange={e => setSprintTrack(e.target.value as Track | '')}
            >
              <option value="">None</option>
              <option value="code">Code</option>
              <option value="open_source">Open Source</option>
              <option value="build">Build</option>
              <option value="pitch">Pitch</option>
            </Select>
          </Field>

          <div className="pt-2">
            <Button type="submit" loading={loading} loadingLabel="Joining..." className="w-full">
              Join the board
            </Button>
          </div>
        </form>
      </BoardPanel>
    </PlainLayout>
  )
}
