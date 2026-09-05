export function BoardPanel({ children, padded = true }: { children: React.ReactNode, padded?: boolean }) {
  return (
    <div className={`bg-enamel border-inset border-seam rounded-panel ${padded ? 'p-panel' : ''}`}>
      {children}
    </div>
  )
}
