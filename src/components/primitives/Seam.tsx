export function Seam({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  if (orientation === 'vertical') {
    return <div className="w-px bg-seam self-stretch" />
  }
  return <div className="w-full h-px bg-seam" />
}
