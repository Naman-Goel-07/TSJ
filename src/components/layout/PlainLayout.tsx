/**
 * PlainLayout — the signed-out frame: login, onboarding, anything before there
 * is a board to show.
 *
 * This is the screen from the reference loop. The wordmark is the hero, not a
 * heading above a form, so it gets the full treatment: particulate behind it,
 * bloom under it, scanlines over everything.
 *
 * The form sits on a surface because it is the one thing here you can touch.
 * Everything else is void.
 */
import type { ReactNode } from 'react'
import { VoidScreen, Wordmark } from '../signal/Signal'

export function PlainLayout({
  children,
  eyebrow = 'Signal active',
  tagline,
}: {
  children: ReactNode
  /** The line above the wordmark. The reference reads "Cycle 07 · Signal active". */
  eyebrow?: string
  /** Optional line under the wordmark. Login uses it; onboarding does not. */
  tagline?: string
}) {
  return (
    <VoidScreen className="flex flex-col items-center justify-center p-gutter py-16">
      <div className="w-full max-w-form flex flex-col items-center">
        <p className="label flex items-center gap-3 text-muted mb-6">
          {eyebrow}
          <span className="w-[5px] h-[5px] rounded-pill bg-lamp shadow-[0_0_8px_#FF2E55] animate-signal" />
        </p>

        <Wordmark size="board" className="mb-4">ECHO</Wordmark>

        {tagline && (
          <p className="text-center text-chalk/85 mb-10 max-w-[42ch]">{tagline}</p>
        )}
        {!tagline && <div className="mb-10" />}

        <div className="w-full">{children}</div>
      </div>
    </VoidScreen>
  )
}
