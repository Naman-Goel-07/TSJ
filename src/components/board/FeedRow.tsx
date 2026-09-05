import { Seam } from '../primitives/Seam'

type FeedRowProps = {
  who: string
  what: string
  level?: string | null
  when: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function FeedRow({ who, what, level, when }: FeedRowProps) {
  const label = level ? `${what} — ${level}` : what
  return (
    <div className="h-row flex items-center gap-0 hover:bg-lit transition-none group">
      {/* Name column */}
      <div className="w-32 px-4 text-sm text-chalk font-medium shrink-0 truncate">{who}</div>
      <Seam orientation="vertical" />
      {/* Activity column */}
      <div className="flex-1 px-4 text-sm text-chalk truncate">{label}</div>
      <Seam orientation="vertical" />
      {/* Date column */}
      <div className="w-20 px-4 text-sm text-chalk/60 text-right font-display tabular-nums shrink-0">
        {formatDate(when)}
      </div>
    </div>
  )
}
