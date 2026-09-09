/**
 * A face, or the initials standing in for one.
 *
 * Two things worth knowing:
 *
 *   The image is object-cover inside a fixed circle, so a portrait, a landscape
 *   and a square all come out the same size and none of them is squashed. The
 *   crop happens in CSS; nothing is resized on upload.
 *
 *   alt is empty on purpose. Every place this is used prints the person's name
 *   directly beside it, so a description here would make a screen reader say the
 *   name twice. The initials are aria-hidden for the same reason.
 *
 * A signed link that has expired fires onError, which falls back to initials
 * rather than leaving a broken-image glyph on the board.
 */
import { useEffect, useState } from 'react'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZES: Record<Size, string> = {
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-[11px]',
  lg: 'w-14 h-14 text-xs',
  xl: 'w-24 h-24 text-base',
}

/** First and last initial. One name gives its first two letters. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({
  name,
  url,
  size = 'md',
  className = '',
}: {
  name: string
  url?: string | null
  size?: Size
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  // A re-signed link is a new URL and deserves a fresh attempt.
  useEffect(() => setFailed(false), [url])

  const showImage = !!url && !failed

  return (
    <span
      className={
        'shrink-0 inline-flex items-center justify-center overflow-hidden rounded-pill ' +
        'bg-lit border-hair border-seam shadow-slot shadow-lip ' +
        `${SIZES[size]} ${className}`
      }
    >
      {showImage ? (
        <img
          src={url as string}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-mono font-bold tracking-[0.06em] text-muted select-none"
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  )
}
