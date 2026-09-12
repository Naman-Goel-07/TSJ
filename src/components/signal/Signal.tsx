/**
 * The signal layer — everything that makes the void look transmitted rather
 * than merely dark.
 *
 * Four pieces:
 *   <Starfield />  drifting particulate on a canvas
 *   <Haze />       a static bloom so the page does not photograph as flat black
 *   <Wordmark />   ECHO, or any word, with scanlines and RGB split
 *   <VoidScreen /> the three stacked, plus the glass overlay
 *
 * Everything here reads prefers-reduced-motion and holds still when asked. The
 * starfield still paints one frame in that case — the depth is the point, the
 * drift is decoration.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

function usePrefersReducedMotion(): boolean {
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
 * 130 points, one pass, no physics. It exists to give the void depth and it
 * must never be the reason a phone drops frames during a demo.
 */
export function Starfield({ count = 130 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    let pts: { x: number; y: number; r: number; v: number; a: number; t: number }[] = []

    function seed() {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      w = canvas!.clientWidth
      h = canvas!.clientHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.25,
        v: Math.random() * 0.16 + 0.03,
        a: Math.random() * 0.55 + 0.12,
        t: Math.random() * Math.PI * 2,
      }))
    }

    function paint(animated: boolean) {
      ctx!.clearRect(0, 0, w, h)
      for (const p of pts) {
        if (animated) {
          p.y -= p.v
          p.t += 0.012
          if (p.y < -4) {
            p.y = h + 4
            p.x = Math.random() * w
          }
        }
        ctx!.globalAlpha = animated ? p.a * (0.6 + 0.4 * Math.sin(p.t)) : p.a
        ctx!.fillStyle = '#fff'
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
      if (animated) raf = requestAnimationFrame(() => paint(true))
    }

    seed()
    paint(!reduced)

    const onResize = () => {
      seed()
      if (reduced) paint(false)
    }
    addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', onResize)
    }
  }, [count, reduced])

  return <canvas ref={ref} className="absolute inset-0 -z-20" aria-hidden="true" />
}

export function Haze() {
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="haze absolute inset-0" />
      <div className="haze-flare" />
      <div className="haze-glow" />
      <div className="haze-grain" />
      <div className="haze-vignette" />
    </div>
  )
}

/**
 * Transmitted type. The word is repeated three times for the colour split and
 * once more as a line grid, so it is set as an aria-label with the copies
 * hidden — a screen reader hears the word once.
 */
export function Wordmark({
  children,
  size = 'hero',
  glitch = true,
  className = '',
}: {
  children: string
  size?: 'hero' | 'board' | 'sm'
  glitch?: boolean
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (!glitch || reduced) return
    let timer = 0
    let clear = 0
    const tick = () => {
      timer = window.setTimeout(() => {
        ref.current?.classList.add('is-glitch')
        clear = window.setTimeout(() => ref.current?.classList.remove('is-glitch'), 220)
        tick()
      }, 3200 + Math.random() * 4200)
    }
    tick()
    return () => {
      clearTimeout(timer)
      clearTimeout(clear)
    }
  }, [glitch, reduced])

  const sizes = {
    hero: 'text-hero',
    board: 'text-board',
    sm: 'text-2xl tracking-sign',
  }

  return (
    <span
      ref={ref}
      className={`wm ${sizes[size]} ${className}`}
      role="img"
      aria-label={children}
    >
      <span className="wm-layer wm-rose" aria-hidden="true">{children}</span>
      <span className="wm-layer wm-cyan" aria-hidden="true">{children}</span>
      <span className="wm-top" aria-hidden="true">{children}</span>
      <span className="wm-grid" aria-hidden="true" />
    </span>
  )
}

/** The void, assembled: particulate, bloom, content, glass. */
export function VoidScreen({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`glass relative min-h-screen bg-transparent overflow-hidden isolate ${className}`}>
      <Starfield />
      <Haze />
      {children}
    </div>
  )
}
