import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { VoidScreen, Wordmark } from '../components/signal/Signal'
import { Button } from '../components/primitives/Button'
import { BoardPanel } from '../components/board/BoardPanel'
import { Skeleton } from '../components/primitives/Skeleton'

const TEAM = [
  { name: 'Aman K.', dept: 'CSE' },
  { name: 'Ishita R.', dept: 'IT' },
  { name: 'Rohan M.', dept: 'ECE' },
  { name: 'Neha S.', dept: 'CSE' },
]

export function Intro() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-recess flex items-center justify-center">
        <Skeleton variant="card" />
      </div>
    )
  }

  // If already signed in, redirect them to the board.
  if (session) {
    return <Navigate to="/" replace />
  }

  return (
    <VoidScreen className="flex flex-col min-h-screen py-16 px-gutter items-center overflow-y-auto">
      <div className="w-full max-w-[800px] flex flex-col items-center">
        <Wordmark size="hero" className="mb-4 mt-8">ECHO</Wordmark>
        <p className="text-xl text-chalk/90 mb-12 font-medium tracking-wide">
          we echo around win
        </p>

        <Button onClick={() => navigate('/login')} size="lg" className="mb-24 px-12">
          Sign In
        </Button>

        <div className="w-full mt-12 mb-16">
          <h2 className="text-2xl text-chalk font-display font-bold mb-8 text-center uppercase tracking-sign">
            Meet Our Team
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {TEAM.map((member, i) => (
              <BoardPanel key={i}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full bg-recess border-2 border-seam shadow-slot shadow-lip mb-4 flex items-center justify-center overflow-hidden">
                    <span className="text-chalk/40 text-xs">No Photo</span>
                  </div>
                  <h3 className="text-chalk font-semibold text-lg">{member.name}</h3>
                  <p className="text-chalk/60 text-sm mt-1">{member.dept}</p>
                </div>
              </BoardPanel>
            ))}
          </div>
        </div>
      </div>
    </VoidScreen>
  )
}
