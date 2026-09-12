import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Starfield, Haze } from '../signal/Signal'

export function SplitLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-transparent flex flex-col md:flex-row w-full">
      {/* Left side: Void & Wordmark */}
      <div className="relative w-full md:w-1/2 flex items-center justify-center isolate overflow-hidden min-h-[35vh] md:min-h-screen border-b md:border-b-0 md:border-r border-chalk/5">
        <Starfield count={40} />
        <Haze />
        
        {/* Back Button */}
        <button 
          onClick={() => navigate('/')} 
          className="absolute top-6 left-6 md:top-8 md:left-8 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-chalk/5 hover:bg-chalk/10 text-muted hover:text-chalk transition-colors border border-chalk/10"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5 -ml-0.5" />
        </button>

        <div className="relative z-10 flex flex-col items-center">
          <img src="/logo.png" alt="ECHO" className="w-48 sm:w-64 max-w-[80%] h-auto object-contain" />
        </div>
      </div>

      {/* Right side: Form content */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 relative bg-transparent">
        <div className="w-full max-w-form">
          {children}
        </div>
      </div>
    </div>
  )
}
