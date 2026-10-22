import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isConfigured } from './supabase'

interface AuthCtx { session: Session | null; isAdmin: boolean; loading: boolean; signOut: () => Promise<void> }
const Ctx = createContext<AuthCtx>({ session: null, isAdmin: false, loading: true, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(isConfigured)

  async function check(s: Session | null) {
    setSession(s)
    if (!s) { setIsAdmin(false); setLoading(false); return }
    // profiles RLS lets a user read only their own row; presence of an admin row = authorised
    const { data } = await supabase.from('profiles').select('role').eq('id', s.user.id).maybeSingle()
    setIsAdmin(data?.role === 'admin')
    setLoading(false)
  }

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => check(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { void check(s) })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <Ctx.Provider value={{ session, isAdmin, loading, signOut: async () => { await supabase.auth.signOut() } }}>
      {children}
    </Ctx.Provider>
  )
}
export const useAuth = () => useContext(Ctx)
