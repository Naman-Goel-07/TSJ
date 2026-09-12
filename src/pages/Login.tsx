/**
 * Login and sign-up.
 *
 * The bug this file fixes: signUp() with email confirmations on returns
 * { user, session: null } and no error. Nothing lands in the auth store, so
 * onAuthStateChange never fires and the page just sits there while a
 * confirmation mail arrives out of band. To the person clicking, the button
 * did nothing.
 *
 * Two stages now:
 *   form         email + password, in either mode
 *   check-email  the account exists but is unconfirmed; resend, or go back
 *
 * Supabase behaviour handled here, in the order it bites:
 *   - Confirmations ON  -> signUp() succeeds with session === null. Show the
 *     check-email stage.
 *   - Confirmations OFF -> signUp() returns a session. Do nothing; AuthContext
 *     and PublicOnly do the redirect.
 *   - Email enumeration protection (on by default) -> signing up with an
 *     address that already exists returns no error and an obfuscated user with
 *     identities: []. That empty array is the only available signal, so it is
 *     what the "already registered" branch reads.
 *   - Signing in to an unconfirmed account fails with 'email_not_confirmed'.
 *     That drops into the same check-email stage rather than showing a raw
 *     error, because the fix is the same: open the link.
 *
 * The confirmation link comes back to /login?verified=1. If the token in the
 * URL hash still resolves, detectSessionInUrl signs the person in and
 * PublicOnly forwards them before this component paints. If it does not, they
 * see the form with a "confirmed, now sign in" notice instead of a dead end.
 */
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { SplitLayout } from '../components/layout/SplitLayout'
import { Field, Input } from '../components/primitives/Field'
import { Button } from '../components/primitives/Button'
import { TextButton } from '../components/primitives/Controls'
import { Notice } from '../components/feedback/Notice'

/** Supabase rate-limits confirmation mail per address. Match it in the UI. */
const RESEND_COOLDOWN_SECONDS = 60

function confirmationRedirect() {
  return `${window.location.origin}/login?verified=1`
}

/**
 * Auth errors are written for developers. Rewrite the ones a member will
 * actually hit, and say what to do about them. Match on code first; the
 * message strings change between Supabase releases.
 */
function readable(err: { message?: string; code?: string }): string {
  const code = err.code ?? ''
  const message = err.message ?? ''

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message))
    return 'That email and password do not match an account. Check both, or sign up if you have not yet.'
  if (code === 'user_already_exists' || /already registered/i.test(message))
    return 'That email already has an account. Sign in instead.'
  if (code === 'weak_password' || /password should be/i.test(message))
    return 'That password is too short. Use at least 6 characters.'
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(message))
    return 'Too many emails sent to this address. Wait a minute, then try again.'
  if (code === 'over_request_rate_limit')
    return 'Too many attempts. Wait a minute, then try again.'
  if (code === 'validation_failed' || /invalid email/i.test(message))
    return 'Check the email address and try again.'

  return message || 'That did not go through. Try again.'
}

type Mode = 'signin' | 'signup'
type Stage = 'form' | 'check-email'

export function Login() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [mode, setMode] = useState<Mode>('signin')
  const [stage, setStage] = useState<Stage>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cooldown, setCooldown] = useState(0)

  // Landing back from the confirmation link without a live session.
  useEffect(() => {
    if (searchParams.get('verified') !== '1') return
    setNotice('Email confirmed. Sign in to reach the board.')
    const next = new URLSearchParams(searchParams)
    next.delete('verified')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setNotice('')
  }

  function backToForm() {
    setStage('form')
    setMode('signin')
    setError('')
    setNotice('')
    setPassword('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return

    const address = email.trim().toLowerCase()
    setLoading(true)
    setError('')
    setNotice('')

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo: confirmationRedirect() },
      })
      setLoading(false)

      if (signUpError) {
        setError(readable(signUpError))
        return
      }

      // Confirmations are off on this project: a session came back and
      // AuthContext is already reacting to it.
      if (data.session) return

      // Enumeration protection: an existing address returns an empty
      // identities array rather than an error.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        setMode('signin')
        setPassword('')
        setNotice('That email already has an account. Sign in below.')
        return
      }

      setEmail(address)
      setPassword('')
      setCooldown(RESEND_COOLDOWN_SECONDS)
      setStage('check-email')
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: address,
      password,
    })
    setLoading(false)

    // Success needs no branch: onAuthStateChange fires, PublicOnly redirects.
    if (!signInError) return

    if (signInError.code === 'email_not_confirmed' || /email not confirmed/i.test(signInError.message)) {
      setEmail(address)
      setPassword('')
      setStage('check-email')
      setNotice('This account has not been confirmed yet.')
      return
    }

    setError(readable(signInError))
  }

  async function handleResend() {
    if (loading || cooldown > 0) return
    setLoading(true)
    setError('')
    setNotice('')

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: confirmationRedirect() },
    })
    setLoading(false)

    if (resendError) {
      setError(readable(resendError))
      return
    }
    setCooldown(RESEND_COOLDOWN_SECONDS)
    setNotice('Sent again. It can take a minute to arrive.')
  }

  if (stage === 'check-email') {
    return (
      <SplitLayout>
        <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-chalk">Check your inbox</h2>
              <p className="mt-2 text-sm text-chalk/70">
                A confirmation link is on its way to <span className="text-chalk">{email}</span>. Open it, then
                come back here and sign in.
              </p>
            </div>

            {notice && <Notice tone="info">{notice}</Notice>}
            {error && <Notice tone="error">{error}</Notice>}

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleResend}
                disabled={cooldown > 0}
                loading={loading}
                loadingLabel="Sending..."
                className="w-full"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send the link again'}
              </Button>
              <Button type="button" variant="quiet" onClick={backToForm} className="w-full">
                Use a different email
              </Button>
            </div>

            <p className="text-xs text-chalk/60">
              The mail comes from Supabase, not from a college address, so check spam if it has not arrived after
              a couple of minutes.
            </p>
          </div>
      </SplitLayout>
    )
  }

  return (
    <SplitLayout>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {notice && <Notice tone="good">{notice}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}

          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            help={mode === 'signup' ? 'At least 6 characters.' : undefined}
          >
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={mode === 'signup' ? 6 : undefined}
              required
            />
          </Field>

          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              loading={loading}
              loadingLabel={mode === 'signup' ? 'Creating account...' : 'Signing in...'}
              className="w-full"
            >
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
          </div>
        </form>

        <div className="mt-8 flex justify-center">
          <TextButton
            type="button"
            tone="signal"
            onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
          >
            {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </TextButton>
        </div>
      </SplitLayout>
  )
}
