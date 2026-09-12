/**
 * The rest of the controls, so no screen has to fall back to a raw <button>.
 *
 * There are 26 bare buttons across the pages right now — topbar links, "try
 * again", row actions, the proof viewer's arrows, the sign-in / sign-up switch.
 * Each one styled itself, which is why the reskin only reached the background.
 * These three cover all of them, and they emit the same echo as Button at a
 * radius that suits their size: a link inside a table row must not flood the
 * row beneath it.
 *
 *   <TextButton>    topbar, inline actions, mode switches
 *   <IconButton>    proof viewer, pagination, dismiss
 *   <Segmented>     the Member / Leader switch from the reference frame
 */
import { useEcho } from './Button'

/* ── Text ──────────────────────────────────────────────────────────────── */

export function TextButton({
  children,
  tone = 'default',
  className = '',
  onPointerDown,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 'signal' for the one text action that is really a call to act. */
  tone?: 'default' | 'signal'
}) {
  const { emit, rings } = useEcho()
  const tones = {
    default: 'text-muted hover:enabled:text-chalk hover:enabled:bg-chalk/[0.04]',
    signal: 'text-lamp/85 hover:enabled:text-lamp hover:enabled:bg-lamp/[0.06]',
  }

  return (
    <button
      className={
        'echo-host relative inline-flex items-center gap-1.5 rounded-slot px-2.5 py-1.5 ' +
        'font-mono font-bold text-[11px] tracking-[0.18em] uppercase leading-none ' +
        'transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed ' +
        `${tones[tone]} ${className}`
      }
      style={{ ['--echo' as string]: tone === 'signal' ? '255 46 85' : '242 242 245' }}
      disabled={disabled}
      onPointerDown={e => {
        if (!disabled) emit()
        onPointerDown?.(e)
      }}
      {...props}
    >
      {rings}
      {children}
    </button>
  )
}

/* ── Icon ──────────────────────────────────────────────────────────────── */

export function IconButton({
  children,
  label,
  className = '',
  onPointerDown,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: an icon with no accessible name is a dead end for a screen reader. */
  label: string
}) {
  const { emit, rings } = useEcho()

  return (
    <button
      aria-label={label}
      title={label}
      className={
        'echo-host relative inline-flex items-center justify-center w-[38px] h-[38px] ' +
        'rounded-pill border-hair border-seam text-muted transition-colors duration-200 ' +
        'hover:enabled:text-chalk hover:enabled:border-lip hover:enabled:bg-chalk/[0.03] ' +
        `disabled:opacity-40 disabled:cursor-not-allowed ${className}`
      }
      style={{ ['--echo' as string]: '242 242 245' }}
      disabled={disabled}
      onPointerDown={e => {
        if (!disabled) emit()
        onPointerDown?.(e)
      }}
      {...props}
    >
      {rings}
      {children}
    </button>
  )
}

/* ── Select row ────────────────────────────────────────────────────────── */

/**
 * A selectable row in a queue or list — the review queue, the meetup list.
 *
 * The echo here is inset and half the radius: a full-width row throwing a 20px
 * ring would wash straight over the row beneath it, which turns "I picked this
 * one" into "something happened somewhere". Inset keeps the return inside the
 * row that was chosen.
 */
export function SelectRow({
  children,
  selected,
  className = '',
  onPointerDown,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  const { emit, rings } = useEcho({ tight: true })

  return (
    <button
      aria-current={selected}
      className={
        'echo-host relative w-full text-left px-4 py-3 border-b border-seam border-l-2 ' +
        'transition-colors duration-200 ' +
        (selected
          ? 'border-l-lamp bg-lit '
          : 'border-l-transparent hover:bg-lit ') +
        className
      }
      style={{ ['--echo' as string]: '255 46 85' }}
      onPointerDown={e => {
        if (!selected) emit()
        onPointerDown?.(e)
      }}
      {...props}
    >
      {rings}
      {children}
    </button>
  )
}

/* ── Segmented ─────────────────────────────────────────────────────────── */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = '',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
  /** Names the group for assistive tech, e.g. "View as" or "Filter queue". */
  label: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={
        'inline-flex items-center gap-0.5 rounded-pill border-hair border-seam ' +
        `bg-enamel/60 p-[3px]  ${className}`
      }
    >
      {options.map(opt => (
        <Segment
          key={opt.value}
          selected={opt.value === value}
          onSelect={() => onChange(opt.value)}
        >
          {opt.label}
        </Segment>
      ))}
    </div>
  )
}

/**
 * Its own component so each segment owns its echo state — the ring has to fire
 * on the segment you moved to, not on the group, or the selection changes
 * without ever landing anywhere.
 */
function Segment({
  children,
  selected,
  onSelect,
}: {
  children: React.ReactNode
  selected: boolean
  onSelect: () => void
}) {
  const { emit, rings } = useEcho()

  return (
    <button
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      onPointerDown={() => { if (!selected) emit() }}
      className={
        'echo-host relative rounded-pill border-hair px-4 py-2 ' +
        'font-mono font-bold text-label uppercase transition-[color,border-color,box-shadow] duration-200 ' +
        (selected
          ? 'border-lip text-chalk shadow-[inset_0_0_12px_rgba(255,46,85,0.16),0_0_14px_rgba(255,46,85,0.10)]'
          : 'border-transparent text-dim hover:text-muted')
      }
      style={{ ['--echo' as string]: '255 46 85' }}
    >
      {rings}
      {children}
    </button>
  )
}
