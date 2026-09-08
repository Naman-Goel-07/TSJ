/**
 * AuthContext — single source of truth for session, profile, and role.
 *
 * Role is read exclusively from the decoded JWT `user_role` claim injected by
 * custom_access_token_hook. A null claim is treated as 'member'. Role is never
 * derived from email and never read from localStorage as authority.
 */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Database } from '../types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type AppRole = 'member' | 'core' | 'lead'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  role: AppRole
  loading: boolean
  refreshSession: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  role: 'member',
  loading: true,
  refreshSession: async () => {},
  refreshProfile: async () => {},
})

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

function getRoleFromSession(session: Session | null): AppRole {
  if (!session?.access_token) return 'member'
  // custom_access_token_hook writes user_role into the ACCESS TOKEN claims.
  // It is not present on session.user, so the token has to be decoded.
  const raw = decodeJwtPayload(session.access_token)?.user_role
  if (raw === 'lead') return 'lead'
  if (raw === 'core') return 'core'
  return 'member'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) console.error('[auth] could not read profile:', error.message)
    setProfile(data)
  }

  async function refreshProfile() {
    const { data } = await supabase.auth.getSession()
    if (data.session) await fetchProfile(data.session.user.id)
  }

  async function refreshSession() {
    const { data } = await supabase.auth.refreshSession()
    if (data.session) {
      setSession(data.session)
      await fetchProfile(data.session.user.id)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await fetchProfile(data.session.user.id)
      setLoading(false)
    })

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        await fetchProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const role = getRoleFromSession(session)

  return (
    <AuthContext.Provider value={{ session, profile, role, loading, refreshSession, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
