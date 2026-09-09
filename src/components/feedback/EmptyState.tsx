/**
 * Empty and error states.
 *
 * The old chalk-slot illustration was a lit rectangle on a dark green board.
 * In void it becomes what it always meant: an unlit slot — a plate with a
 * hairline and no signal in it. When something is posted there, it lights.
 *
 * "Try again" was a bare <button> with its own underline styling, which is
 * exactly why the reskin did not reach it. It is a TextButton now, and it
 * echoes like everything else.
 */
import { TextButton } from '../primitives/Controls'

function Slot({ lit = false }: { lit?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={
        'w-16 h-10 rounded-slot border-hair ' +
        (lit
          ? 'border-lamp/40 bg-lamp/[0.05] shadow-glow'
          : 'border-seam bg-enamel shadow-slot shadow-lip')
      }
    />
  )
}

export function EmptyState({
  headline,
  body,
  action,
}: {
  headline: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
      <Slot />
      <div>
        <p className="text-base text-chalk font-medium">{headline}</p>
        {body && <p className="text-sm text-muted mt-1.5 max-w-[40ch] mx-auto">{body}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function ErrorState({
  headline,
  body,
  retry,
}: {
  headline: string
  body: string
  retry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
      <div
        aria-hidden="true"
        className="w-16 h-10 rounded-slot border-hair border-flag/40 bg-flag/[0.05]"
      />
      <div>
        <p className="text-base text-flare font-medium">{headline}</p>
        <p className="text-sm text-muted mt-1.5 max-w-[40ch] mx-auto">{body}</p>
      </div>
      {retry && <TextButton onClick={retry}>Try again</TextButton>}
    </div>
  )
}
