/**
 * Button — the piece that carries the team's name.
 *
 * An echo is a shape returning, weaker and further out, with silence between
 * the returns. So a press emits the button's own silhouette three times, 130ms
 * apart, each fainter than the last.
 *
 * The rings are box-shadow spread, not transform: scale. A scaled pill fattens
 * its corner radius as it grows and stops being the same shape — which is the
 * one thing an echo must not do.
 *
 * The primary control also rests: one ring every four seconds, with a long dead
 * interval. A pulse with no silence between beats is a loading spinner, and the
 * page has exactly one thing that should be moving on its own.
 *
 * prefers-reduced-motion removes every ring. The press still lights the border
 * and still moves a pixel, so it is never silent.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

type Variant = 'primary' | 'secondary' | 'destructive' | 'quiet'
type Size = 'sm' | 'md' | 'lg'

const BASE =
  'echo-host relative inline-flex items-center justify-center gap-2.5 rounded-pill border-hair ' +
  'font-mono font-bold uppercase leading-none text-chalk ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ' +
  'active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0'

const SIZES: Record<Size, string> = {
  sm: 'h-[34px] px-3.5 text-[10px] tracking-[0.18em]',
  md: 'h-11 px-[22px] text-label',
  lg: 'h-[52px] px-[30px] text-label',
}

/**
 * Each variant owns its echo colour through --echo, so a destructive press
 * returns in warm red and never borrows the primary's rose.
 */
const VARIANTS: Record<Variant, { className: string; echo: string }> = {
  primary: {
    echo: '184 63 90',
    className:
      'border-lamp/40 bg-lamp/[0.06] shadow-glow ' +
      'hover:enabled:border-lamp/[0.78] hover:enabled:bg-lamp/[0.12] hover:enabled:shadow-glow-lg',
  },
  secondary: {
    echo: '247 232 220',
    className:
      'border-lip text-muted ' +
      'hover:enabled:border-chalk hover:enabled:text-chalk hover:enabled:bg-chalk/[0.03]',
  },
  destructive: {
    echo: '154 113 128',
    className:
      'border-flag/45 bg-flag/[0.05] text-flare ' +
      'hover:enabled:border-flag/85 hover:enabled:text-chalk hover:enabled:shadow-glow-danger',
  },
  quiet: {
    echo: '247 232 220',
    className: 'border-transparent text-muted hover:enabled:text-chalk hover:enabled:bg-chalk/[0.04]',
  },
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Emits the rings. Shared by every control in the system, so a text link in a
 * table and the hero CTA answer a press with the same gesture at different
 * radii.
 *
 * Waves are React state rather than appended DOM nodes: a screen that has been
 * clicked two hundred times must not still be carrying two hundred dead spans.
 */
export function useEcho({ tight = false }: { tight?: boolean } = {}) {
  const reduced = usePrefersReducedMotion()
  const [waves, setWaves] = useState<number[]>([])
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const emit = useCallback(() => {
    if (reduced) return
    const id = performance.now()
    setWaves(w => [...w, id])
    timers.current.push(window.setTimeout(() => setWaves(w => w.filter(x => x !== id)), 1400))
  }, [reduced])

  const rings = waves.flatMap(id =>
    [0, 1, 2].map(i => (
      <span
        key={`${id}-${i}`}
        className={tight ? 'echo-wave echo-wave--tight' : 'echo-wave'}
        aria-hidden="true"
        style={{ animationDelay: `${i * 130}ms`, opacity: 1 - i * 0.3 }}
      />
    )),
  )

  return { emit, rings, reduced }
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  loadingLabel = 'Posting...',
  lead,
  resting,
  className = '',
  onPointerDown,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  loadingLabel?: string
  /** A glyph before the label, in the accent colour. The reference uses "+". */
  lead?: React.ReactNode
  /** Resting pulse. On for primary unless switched off; never on anything else. */
  resting?: boolean
}) {
  const { emit, rings, reduced } = useEcho()
  const v = VARIANTS[variant]
  const isOff = disabled || loading
  const rests = (resting ?? variant === 'primary') && !isOff && !reduced

  return (
    <button
      className={`${BASE} ${SIZES[size]} ${v.className} ${className}`}
      style={{ ['--echo' as string]: v.echo }}
      disabled={isOff}
      aria-busy={loading || undefined}
      onPointerDown={e => {
        if (!isOff) emit()
        onPointerDown?.(e)
      }}
      {...props}
    >
      {rests && <span className="echo-rest" aria-hidden="true" />}
      {rings}
      {lead && !loading && (
        <span className={variant === 'primary' ? 'text-lamp' : 'text-current'} aria-hidden="true">
          {lead}
        </span>
      )}
      {loading ? loadingLabel : children}
    </button>
  )
}
