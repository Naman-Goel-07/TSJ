type SkeletonVariant = 'line' | 'row' | 'card' | 'total'

export function Skeleton({ variant = 'line' }: { variant?: SkeletonVariant }) {
  if (variant === 'total') {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-48 h-24 bg-enamel rounded-slot animate-pulse" />
        <div className="w-32 h-4 bg-enamel rounded-slot animate-pulse" />
      </div>
    )
  }
  if (variant === 'row') {
    return (
      <div className="h-row flex items-center gap-4 px-4 border-b border-seam">
        <div className="flex-1 h-4 bg-enamel rounded-slot animate-pulse" />
        <div className="w-24 h-4 bg-enamel rounded-slot animate-pulse" />
        <div className="w-16 h-4 bg-enamel rounded-slot animate-pulse" />
      </div>
    )
  }
  if (variant === 'card') {
    return <div className="h-32 bg-enamel rounded-panel animate-pulse" />
  }
  return <div className="h-4 w-full bg-enamel rounded-slot animate-pulse" />
}
