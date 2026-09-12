type Status = 'pending' | 'needs_info' | 'verified' | 'rejected' | 'revoked'

const STATUS_MAP: Record<Status, { label: string; dotClass: string; textClass: string; borderClass: string }> = {
  pending:    { label: 'In the queue', dotClass: 'bg-amber',  textClass: 'text-amber',  borderClass: 'border-amber/20'  },
  needs_info: { label: 'Sent back',    dotClass: 'bg-amber',  textClass: 'text-amber',  borderClass: 'border-amber/20'  },
  verified:   { label: 'Posted',       dotClass: 'bg-posted', textClass: 'text-posted', borderClass: 'border-posted/20' },
  rejected:   { label: 'Not posted',   dotClass: 'bg-flare',  textClass: 'text-flare',  borderClass: 'border-flare/20'  },
  revoked:    { label: 'Pulled',       dotClass: 'bg-flare',  textClass: 'text-flare',  borderClass: 'border-flare/20'  },
}

export function StatusPill({ status, size = 'md' }: { status: Status; size?: 'sm' | 'md' }) {
  const { label, dotClass, textClass, borderClass } = STATUS_MAP[status]
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 ${textSize} font-medium ${textClass} ${borderClass}`}>
      <span className={`w-2 h-2 rounded-pill shrink-0 ${dotClass}`} aria-hidden="true" />
      {label}
    </span>
  )
}
