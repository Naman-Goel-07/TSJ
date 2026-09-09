/**
 * A message in a slot: one line of feedback attached to a form or a panel.
 *
 * Errors are announced immediately because the person is waiting on the answer.
 * Confirmations wait for a pause in whatever the screen reader is already saying.
 */
import type { ReactNode } from 'react'

const TONES = {
  info: 'border-lamp/40 text-chalk',
  good: 'border-posted/50 text-posted',
  error: 'border-flag/60 text-flare',
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'good' | 'error'
  children: ReactNode
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`rounded-slot border-hair bg-recess px-3 py-2 text-sm ${TONES[tone]}`}
    >
      {children}
    </p>
  )
}
