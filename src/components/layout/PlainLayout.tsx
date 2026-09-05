import { ReactNode } from 'react'

export function PlainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-recess flex flex-col items-center justify-center p-gutter">
      <div className="w-full max-w-form">
        <h1 className="font-display text-2xl font-bold text-chalk text-center mb-8 tracking-sign uppercase">ECHO</h1>
        {children}
      </div>
    </div>
  )
}
