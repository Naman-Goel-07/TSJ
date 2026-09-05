export function Meter({
  value,
  max,
  label,
}: {
  value: number
  max: number
  label?: string
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? `${value} of ${max}`}
        className="w-full h-2 bg-seam rounded-none overflow-hidden"
      >
        <div
          className="h-full bg-lamp rounded-none transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-chalk/60 hidden md:flex">
        <span>Day {value}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
