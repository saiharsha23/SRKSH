import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { LeaderSession } from '../types'

interface LeaderAuthCtx {
  session: LeaderSession | null
  loading: boolean
  login: (teamId: string, pin: string) => Promise<void>
  logout: () => void
  registerSport: (sportId: string, register: boolean) => Promise<void>
  saveSquad: (sportId: string, memberIds: string[]) => Promise<void>
}

const STORAGE_KEY = 'srksh_leader_session'

const LeaderCtx = createContext<LeaderAuthCtx>({
  session: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  registerSport: async () => {},
  saveSquad: async () => {},
})

export function LeaderAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LeaderSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as LeaderSession
        if (parsed?.teamId && parsed?.pin) {
          setSession(parsed)
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      setLoading(false)
    }
  }, [])

  async function login(teamId: string, pin: string) {
    const cleanPin = pin.trim()
    const { data: isValid, error: rpcErr } = await supabase.rpc('verify_team_leader_pin', {
      p_team_id: teamId,
      p_pin: cleanPin,
    })

    if (rpcErr) throw new Error(rpcErr.message)
    if (!isValid) throw new Error('Incorrect passcode for this team.')

    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('id, name, captain_name')
      .eq('id', teamId)
      .single()

    if (teamErr || !team) throw new Error('Team not found.')

    const newSession: LeaderSession = {
      teamId: team.id,
      teamName: team.name,
      captainName: team.captain_name,
      pin: cleanPin,
    }

    setSession(newSession)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession))
  }

  function logout() {
    setSession(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  async function registerSport(sportId: string, register: boolean) {
    if (!session) throw new Error('Not logged in as team leader')
    const { error } = await supabase.rpc('team_leader_register_sport', {
      p_team_id: session.teamId,
      p_pin: session.pin,
      p_sport_id: sportId,
      p_register: register,
    })
    if (error) throw error
  }

  async function saveSquad(sportId: string, memberIds: string[]) {
    if (!session) throw new Error('Not logged in as team leader')
    const { error } = await supabase.rpc('team_leader_save_squad', {
      p_team_id: session.teamId,
      p_pin: session.pin,
      p_sport_id: sportId,
      p_member_ids: memberIds,
    })
    if (error) throw error
  }

  return (
    <LeaderCtx.Provider
      value={{
        session,
        loading,
        login,
        logout,
        registerSport,
        saveSquad,
      }}
    >
      {children}
    </LeaderCtx.Provider>
  )
}

export const useLeaderAuth = () => useContext(LeaderCtx)
