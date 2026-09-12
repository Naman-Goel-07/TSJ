import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../supabase'
import { useAuth } from '../../context/AuthContext'
import { Avatar } from '../media/Avatar'

export function GlobalNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, role } = useAuth()
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isCore = role === 'core' || role === 'lead'
  const firstName = profile?.full_name.split(' ')[0] ?? 'Profile'

  async function handleSignOut() {
    await supabase.auth.signOut()
    queryClient.clear()
    navigate('/')
  }

  const navLinkClass = (path: string) => {
    const active = location.pathname === path
    return `text-sm transition-colors ${active ? 'text-chalk font-semibold' : 'text-chalk/60 hover:text-chalk'}`
  }

  // Use handwritten font class
  const fontHand = 'font-body' // If there is a handwritten font, replace this, but for now we'll stick to font-body or similar if not defined. Actually, the user says "change the header navbar to the handdrawn one". I will just style it lowercase as in the sketch.

  return (
    <div className="flex items-center justify-between w-full font-body">
      {/* Left */}
      <button 
        onClick={() => navigate('/board')}
        className="flex items-center hover:opacity-80 transition-opacity"
      >
        <img src="/logo.png" alt="ECHO" className="h-8 w-auto object-contain" />
      </button>

      {/* Center */}
      <div className="hidden sm:flex items-center gap-8">
        <button onClick={() => navigate('/board')} className={navLinkClass('/board')}>home</button>
        <button onClick={() => navigate('/')} className="text-sm text-chalk/60 hover:text-chalk transition-colors lowercase">team</button>
        <button onClick={() => navigate('/submissions')} className={navLinkClass('/submissions')}>submissions</button>
        {isCore && (
          <button onClick={() => navigate('/review')} className={navLinkClass('/review')}>verify</button>
        )}
      </div>

      {/* Right */}
      <div className="relative" ref={menuRef}>
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-sm text-chalk hidden sm:inline-block lowercase">{firstName}</span>
          <div className="w-8 h-8 rounded-full border border-chalk/30 flex items-center justify-center overflow-hidden">
            <Avatar name={profile?.full_name ?? '?'} url={undefined} size="sm" />
          </div>
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute top-full right-0 mt-4 w-40 bg-enamel border border-chalk/10 rounded-xl shadow-glow py-2 z-50 flex flex-col font-body">
            <button onClick={() => { navigate('/profile'); setMenuOpen(false) }} className="w-full text-left px-4 py-2 text-sm text-chalk/80 hover:text-chalk hover:bg-chalk/5 transition-colors lowercase">
              profile
            </button>
            <div className="my-1 border-t border-chalk/10" />
            <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-lamp hover:bg-lamp/10 transition-colors lowercase">
              sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
