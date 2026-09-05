import { useState } from 'react'
import { supabase } from '../supabase'
import { PlainLayout } from '../components/layout/PlainLayout'
import { BoardPanel } from '../components/board/BoardPanel'
import { Field, Input } from '../components/primitives/Field'
import { Button } from '../components/primitives/Button'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <PlainLayout>
      <BoardPanel>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="text-flare text-sm">{error}</p>}
          <Field label="Email">
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </Field>
          <Button type="submit" loading={loading}>{isSignUp ? 'Sign up' : 'Sign in'}</Button>
        </form>
        <div className="mt-8 text-center text-sm text-chalk/60">
          <button type="button" className="underline hover:text-chalk" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>
      </BoardPanel>
    </PlainLayout>
  )
}
