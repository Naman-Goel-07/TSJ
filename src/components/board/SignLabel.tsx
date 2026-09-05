export function SignLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-xs font-semibold uppercase tracking-sign text-chalk/60">
      {children}
    </span>
  )
}
