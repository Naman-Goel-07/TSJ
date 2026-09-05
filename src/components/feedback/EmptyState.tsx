export function EmptyState({
  headline,
  body,
  action,
}: {
  headline: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      {/* Empty chalk slot illustration */}
      <div className="w-16 h-10 bg-enamel border border-seam rounded-slot shadow-slot shadow-lip" />
      <div>
        <p className="text-base text-chalk font-medium">{headline}</p>
        {body && <p className="text-sm text-chalk/60 mt-1 max-w-[40ch] mx-auto">{body}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function ErrorState({
  headline,
  body,
  retry,
}: {
  headline: string
  body: string
  retry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div>
        <p className="text-base text-flare font-medium">{headline}</p>
        <p className="text-sm text-chalk/60 mt-1 max-w-[40ch] mx-auto">{body}</p>
      </div>
      {retry && (
        <button
          onClick={retry}
          className="text-sm text-chalk underline hover:text-chalk/80"
        >
          Try again
        </button>
      )}
    </div>
  )
}
