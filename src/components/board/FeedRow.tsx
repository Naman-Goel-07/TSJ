import { Avatar } from '../media/Avatar'

type FeedRowProps = {
  who: string
  what: string
  level?: string | null
  when: string
  avatarUrl?: string | null
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${Math.max(1, m)}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function FeedRow({ who, what, level, when, avatarUrl }: FeedRowProps) {
  const label = level ? `${what} — ${level}` : what
  const timeAgo = formatTimeAgo(when)

  return (
    <div className="flex items-center gap-4 px-6 py-4 hover:bg-lamp/[0.04] transition-colors duration-200 group border-b border-lamp/10 last:border-b-0 relative z-10">
      <div className="shrink-0 flex items-center justify-center">
        <Avatar name={who} url={avatarUrl} size="md" />
      </div>
      <div className="w-32 shrink-0 text-sm text-chalk font-semibold truncate">{who}</div>
      <div className="flex-1 text-sm text-muted truncate">{label}</div>
      <div className="text-xs text-dim text-right tabular-nums shrink-0">{timeAgo}</div>
    </div>
  )
}
