import { Seam } from '../primitives/Seam'
import { Avatar } from '../media/Avatar'

type FeedRowProps = {
  who: string
  what: string
  level?: string | null
  when: string
  avatarUrl?: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function FeedRow({ who, what, level, when, avatarUrl }: FeedRowProps) {
  const label = level ? `${what} — ${level}` : what
  return (
    <div className="h-row flex items-center gap-0 hover:bg-lit transition-none group">
      {/* Name column — the picture is decorative, the name beside it is the label */}
      <div className="w-40 px-3 flex items-center gap-2.5 shrink-0">
        <Avatar name={who} url={avatarUrl} size="sm" />
        <span className="text-sm text-chalk font-medium truncate">{who}</span>
      </div>
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
