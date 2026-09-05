import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { PlainLayout } from '../components/layout/PlainLayout'
import { BoardPanel } from '../components/board/BoardPanel'
import { Field, Input } from '../components/primitives/Field'
import { Button } from '../components/primitives/Button'

export function Onboarding({ session }: { session: any }) {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('')
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [sprintTrack, setSprintTrack] = useState<'code' | 'open_source' | 'build' | 'pitch' | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function check() {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (data) navigate('/')
    }
    check()
  }, [session, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const { data: team, error: teamError } = await supabase.from('teams').select('id').eq('slug', 'echo').single()
    if (teamError) {
      setError("Could not find ECHO team. Have you seeded the database?")
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: session.user.id,
      full_name: fullName,
      department,
      enrollment_no: enrollmentNo || null,
      team_id: team.id,
      sprint_track: sprintTrack || null,
      is_active: true
    })

    if (profileError) {
      setError(profileError.message)
    } else {
      navigate('/')
    }
    setLoading(false)
  }

  // extract the role from wherever the hook put it
  const jwtRole = session?.user?.user_role || session?.user?.app_metadata?.user_role || 'none';

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
            <select className="bg-recess border-hair border-seam rounded-slot h-11 px-3 text-chalk" value={sprintTrack} onChange={e => setSprintTrack(e.target.value as any)}>
              <option value="">None</option>
              <option value="code">Code</option>
              <option value="open_source">Open Source</option>
              <option value="build">Build</option>
              <option value="pitch">Pitch</option>
            </select>
          </div>

          <Button type="submit" loading={loading}>Join the board</Button>
        </form>

        <div className="mt-8 p-4 bg-recess border border-seam rounded overflow-hidden">
          <p className="text-xs text-chalk/60 mb-2 uppercase tracking-sign">Debug: JWT Claims</p>
          <pre className="text-[10px] text-chalk/80 break-all whitespace-pre-wrap">
            {JSON.stringify(session.user, null, 2)}
          </pre>
        </div>
      </BoardPanel>
    </PlainLayout>
  )
}
