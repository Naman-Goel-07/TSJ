import { ReactNode } from 'react'

export function BoardLayout({ children, topbar }: { children: ReactNode, topbar?: ReactNode }) {
  return (
    <div className="min-h-screen bg-recess flex flex-col items-center">
      <header className="w-full bg-enamel border-b border-seam h-[56px] sticky top-0 z-header flex items-center justify-between px-gutter">
        {topbar}
      </header>
      <main className="w-full max-w-board px-gutter py-stack flex flex-col gap-stack">
        {children}
      </main>
    </div>
  )
}
