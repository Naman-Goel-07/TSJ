/**
 * /intro — the public face of the board.
 *
 * The roster is not a constant in this file. It comes from get_intro_roster(),
 * a security-definer function granted to `anon`, which returns exactly four
 * columns: id, name, department, and the storage path of a picture. No points,
 * no email, no enrollment number, no role. A signed-out visitor gets the team
 * and nothing else, and that is enforced by the function's return type rather
 * than by what this component chooses to render.
 *
 * Pictures live in a private bucket, so every path is exchanged for a five
 * minute signed link, the same way the booth reads proof files.
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { Starfield, Haze, Wordmark } from '../components/signal/Signal'
import { Button } from '../components/primitives/Button'
import { BoardPanel } from '../components/board/BoardPanel'
import { Skeleton } from '../components/primitives/Skeleton'
import { EmptyState, ErrorState } from '../components/feedback/EmptyState'
import { Avatar } from '../components/media/Avatar'
import { signAvatarPaths, AVATAR_REFRESH_MS } from '../lib/avatars'

type IntroMember = {
  id: string
  full_name: string
  department: string
  avatar_path: string | null
}

type IntroMemberWithUrl = IntroMember & { url: string | null }

/** A member whose department contains "lead" (case-insensitive) is a lead. */
function isLead(member: IntroMember): boolean {
  return /lead/i.test(member.department)
}

// ─── Orbital Avatar ──────────────────────────────────────────────────────────

function OrbitalAvatar({
  name,
  url,
  isLeadMember,
}: {
  name: string
  url?: string | null
  isLeadMember: boolean
}) {
  const size = isLeadMember ? 80 : 64
  const ringInset = 14
  const ringSize = size + ringInset * 2
  const rx = ringSize / 2 - 2
  const ry = rx * 0.38

  return (
    <div className="orbital-wrap" style={{ width: size, height: size }}>
      {/* The SVG ring */}
      <svg
        className="orbital-ring"
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        width={ringSize}
        height={ringSize}
        aria-hidden="true"
      >
        <ellipse cx={ringSize / 2} cy={ringSize / 2} rx={rx} ry={ry} />
      </svg>

      {/* Orbiting dot — flattened to match the ellipse */}
      <div className="orbital-orbit" aria-hidden="true">
        <span className={`orbital-dot animate-orbit ${isLeadMember ? 'orbital-dot--lead' : ''}`} />
      </div>

      {/* The actual avatar */}
      <Avatar name={name} url={url} size={isLeadMember ? 'xl' : 'lg'} />
    </div>
  )
}

// ─── Team Card ───────────────────────────────────────────────────────────────

function TeamCard({
  member,
  index,
  isLeadMember,
}: {
  member: IntroMemberWithUrl
  index: number
  isLeadMember: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect prefers-reduced-motion: show immediately.
    const prefersReduced =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px 60px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`glass-card rounded-panel p-panel flex flex-col items-center text-center transition-none ${
        visible ? 'animate-card-in' : 'opacity-0'
      }`}
      style={visible ? { animationDelay: `${index * 80}ms` } : undefined}
    >
      <div className="mb-4 mt-2">
        <OrbitalAvatar
          name={member.full_name}
          url={member.url}
          isLeadMember={isLeadMember}
        />
      </div>

      <h3 className="text-chalk font-display font-bold text-lg">{member.full_name}</h3>
      <p className="label text-muted mt-1">{member.department}</p>

      {isLeadMember && (
        <span className="mt-3 inline-block rounded-pill bg-chalk text-graphite font-mono font-bold text-[10px] uppercase tracking-label px-3 py-1">
          Team Lead
        </span>
      )}
    </div>
  )
}

// ─── Animated Hero Wordmark ────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function smoothstep(min: number, max: number, v: number) {
  const x = clamp((v - min) / (max - min), 0, 1)
  return x * x * (3 - 2 * x)
}

function HeroWordmark() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ticking = false
    const isMobile = window.innerWidth < 640
    const widthFactor = isMobile ? 0.6 : 1

    const updateTransforms = () => {
      const scrollY = window.scrollY
      const innerHeight = window.innerHeight
      const p = clamp(scrollY / (innerHeight * 0.8), 0, 1)

      const centerOpacity = clamp(1 - smoothstep(0.24, 0.46, p), 0, 1)
      const centerBlur = smoothstep(0.2, 0.5, p) * 4
      const prog = smoothstep(0, 0.6, p)

      if (containerRef.current) {
        const centerSpan = containerRef.current.children[3] as HTMLSpanElement
        if (centerSpan) {
          centerSpan.style.opacity = centerOpacity.toString()
          if (!isMobile) {
            centerSpan.style.filter = `blur(${centerBlur}px)`
          }
        }

        [3, 2, 1].forEach((i, idx) => {
          const span = containerRef.current?.children[idx] as HTMLSpanElement
          if (!span) return

          const dir = i % 2 === 0 ? 1 : -1
          const x = dir * prog * (18 + i * 16) * widthFactor
          const sc = 1 + prog * (0.18 * i)
          const op = (0.42 / i) * (1 - smoothstep(0.15, 0.62, p))

          span.style.transform = `translate(calc(-50% + ${x}vw), -50%) scale(${sc})`
          span.style.opacity = op.toString()
          if (!isMobile) {
            span.style.filter = `blur(${prog * i * 3.2}px)`
          }
        })
      }
      ticking = false
    }

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateTransforms)
        ticking = true
      }
    }

    updateTransforms()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full mb-6 font-display font-black uppercase text-chalk tracking-[0.06em] leading-[1.04] text-[clamp(56px,18.5vw,254px)]"
    >
      {[3, 2, 1].map(i => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 z-0"
          style={{
            color: 'rgba(242,222,214,0.9)',
            textShadow: '0 0 40px rgba(184,63,90,.42), 3px 0 rgba(184,63,90,.4), -3px 0 rgba(242,214,197,.4)',
            transform: `translate(-50%, -50%) scale(1)`,
            opacity: 0.42 / i,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
          aria-hidden="true"
        >
          ECHO
        </span>
      ))}

      <span
        className="relative z-10 block"
        style={{
          willChange: 'opacity',
          textShadow:
            '0 0 22px rgba(247,232,220,.58), 0 0 60px rgba(242,214,197,.32), 0 0 130px rgba(184,63,90,.20), 3px 0 rgba(184,63,90,.55), -3px 0 rgba(242,214,197,.5)',
        }}
      >
        ECHO
      </span>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function Intro() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const teamRef = useRef<HTMLDivElement>(null)

  // Declared before the early returns below so the hook order never changes.
  const rosterQuery = useQuery({
    queryKey: ['intro-roster'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_intro_roster')
      if (error) throw error

      const rows = (data ?? []) as IntroMember[]
      const urls = await signAvatarPaths(rows.map(r => r.avatar_path))

      return rows.map(row => ({
        ...row,
        url: row.avatar_path ? urls[row.avatar_path] ?? null : null,
      }))
    },
    staleTime: AVATAR_REFRESH_MS,
    refetchInterval: AVATAR_REFRESH_MS,
  })

  const scrollToTeam = useCallback(() => {
    teamRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-recess flex items-center justify-center">
        <Skeleton variant="card" />
      </div>
    )
  }

  // If already signed in, redirect them to the board.
  if (session) {
    return <Navigate to="/" replace />
  }

  const roster = rosterQuery.data ?? []
  const leads = roster.filter(isLead)
  const members = roster.filter(m => !isLead(m))

  return (
    <div className="relative bg-recess">
      {/* ─── Nav bar ──────────────────────────────────────────────────── */}
      <nav className="intro-nav glass-topbar" aria-label="Site navigation">
        <div className="flex items-center gap-2">
          <span className="text-lamp text-lg" aria-hidden="true">✦</span>
          <span className="font-display font-black uppercase text-chalk tracking-sign text-sm">
            ECHO
          </span>
        </div>

        <div className="intro-nav-links hidden sm:flex items-center gap-8">
          <a
            href="#"
            onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className="label text-muted"
          >
            Home
          </a>
          <a
            href="#team"
            onClick={e => { e.preventDefault(); scrollToTeam() }}
            className="label text-muted"
          >
            Team
          </a>
          
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/login')}
        >
          Sign In
        </Button>
      </nav>

      {/* ─── Hero section ─────────────────────────────────────────────── */}
      <section className="glass relative min-h-screen overflow-hidden isolate flex flex-col items-center justify-center px-gutter pt-16">
        <Starfield />
        <Haze />

        <p className="label text-muted mb-6 relative z-[1]">
          ECHO&ensp;·&ensp;TEAM SIGNAL
        </p>

        <HeroWordmark />

        <p className="text-xl text-chalk/80 font-body italic tracking-wide mb-12 relative z-[1]">
          ideas that resonate
        </p>

        <div className="flex items-center gap-3 flex-wrap justify-center relative z-[1]">
          <Button
            onClick={() => navigate('/login')}
            size="lg"
            lead="+"
          >
            Make an Echo
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={scrollToTeam}
          >
            Meet the Team
          </Button>
        </div>

        <div className="hero-accent-line relative z-[1]" aria-hidden="true" />
      </section>

      {/* ─── Team section ─────────────────────────────────────────────── */}
      <section
        ref={teamRef}
        id="team"
        className="glass relative overflow-hidden isolate flex flex-col items-center px-gutter py-24 w-full"
      >
        <Starfield count={80} />
        <Haze />

        <div className="w-full max-w-booth mx-auto relative z-[1]">
          {rosterQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full">
              {[...Array(6)].map((_, i) => <Skeleton key={i} variant="card" />)}
            </div>
          ) : rosterQuery.isError ? (
            <BoardPanel>
              <ErrorState
                headline="Could not load the team"
                body="The roster failed to load. Check your connection and try again."
                retry={() => rosterQuery.refetch()}
              />
            </BoardPanel>
          ) : roster.length === 0 ? (
            <BoardPanel>
              <EmptyState
                headline="Nobody on the roster yet."
                body="Members appear here once they sign up and finish onboarding."
              />
            </BoardPanel>
          ) : (
            <>
              {/* Leads — 2-column row */}
              {leads.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-[600px] mx-auto mb-8">
                  {leads.map((member, i) => (
                    <TeamCard
                      key={member.id}
                      member={member}
                      index={i}
                      isLeadMember
                    />
                  ))}
                </div>
              )}

              {/* Members — 3-column grid */}
              {members.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full">
                  {members.map((member, i) => (
                    <TeamCard
                      key={member.id}
                      member={member}
                      index={i + leads.length}
                      isLeadMember={false}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
