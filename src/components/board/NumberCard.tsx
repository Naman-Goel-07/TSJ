export function NumberCard({ value, label, size = 'lg', countUp }: { value: string | number, label?: string, size?: 'board' | 'lg' | 'sm', countUp?: boolean }) {
  const sizeClass = size === 'board' ? 'text-board' : size === 'lg' ? 'text-2xl' : 'text-xl'
  return (
    <div className="flex flex-col items-center">
      <div className={`bg-chalk text-graphite font-display font-bold tabular-nums shadow-slot shadow-lip rounded-slot px-4 py-2 ${sizeClass}`}>
        {value}
      </div>
      {label && <div className="text-xs text-chalk/60 mt-2 uppercase tracking-sign">{label}</div>}
    </div>
  )
}
