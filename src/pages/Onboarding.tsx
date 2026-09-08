import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { PlainLayout } from '../components/layout/PlainLayout'
import { BoardPanel } from '../components/board/BoardPanel'
import { Field, Input } from '../components/primitives/Field'
import { Button } from '../components/primitives/Button'

export function Onboarding() {
  const navigate = useNavigate()
  const { session, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('')
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [sprintTrack, setSprintTrack] = useState<'code' | 'open_source' | 'build' | 'pitch' | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
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

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: session.user.id,
          full_name: fullName,
          department,
          enrollment_no: enrollmentNo || null,
          team_id: team.id,
          sprint_track: sprintTrack || null,
          is_active: true,
        },
        { onConflict: 'id' },
      )

    if (profileError) {
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
          <p className="text-sm text-chalk/60">Tell us who you are.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="text-flare text-sm">{error}</p>}
          <Field label="Name">
            <Input value={fullName} onChange={e => setFullName(e.target.value)} required />
          </Field>
          <Field label="Department">
            <Input value={department} onChange={e => setDepartment(e.target.value)} required />
          </Field>
          <Field label="Enrollment No (optional)">
            <Input value={enrollmentNo} onChange={e => setEnrollmentNo(e.target.value)} />
          </Field>

          <div className="flex flex-col gap-2 mb-4">
            <label className="text-base text-chalk">Track (optional)</label>
            <select
              className="bg-recess border-hair border-seam rounded-slot h-11 px-3 text-chalk"
              value={sprintTrack}
              onChange={e => setSprintTrack(e.target.value as any)}
            >
              <option value="">None</option>
              <option value="code">Code</option>
              <option value="open_source">Open Source</option>
              <option value="build">Build</option>
              <option value="pitch">Pitch</option>
            </select>
          </div>

          <Button type="submit" loading={loading}>Join the board</Button>
        </form>
      </BoardPanel>
    </PlainLayout>
  )
}
