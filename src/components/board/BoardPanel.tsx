export function BoardPanel({ children, padded = true, className = '' }: { children: React.ReactNode, padded?: boolean, className?: string }) {
  return (
    <div className={`glass-card rounded-panel ${padded ? 'p-panel' : ''} ${className}`}>
      {children}
    </div>
  )
}
