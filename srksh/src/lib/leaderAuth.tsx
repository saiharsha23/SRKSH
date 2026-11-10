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
  addMember: (name: string, photoPath?: string | null) => Promise<{ id: string; name: string }>
  updateMember: (memberId: string, name: string, photoPath?: string | null) => Promise<void>
  deleteMember: (memberId: string) => Promise<void>
  updateCaptainPhoto: (photoPath: string | null) => Promise<void>
}

const STORAGE_KEY = 'srksh_leader_session'

const LeaderCtx = createContext<LeaderAuthCtx>({
  session: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  registerSport: async () => {},
  saveSquad: async () => {},
  addMember: async () => ({ id: '', name: '' }),
  updateMember: async () => {},
  deleteMember: async () => {},
  updateCaptainPhoto: async () => {},
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
    // If 'captain' or pseudo-ID is passed, find or create the captain's real UUID in team_members
    const resolvedIds = await Promise.all(
      memberIds.map(async id => {
        if (id === 'captain' || id.startsWith('captain-')) {
          const { data: cap } = await supabase
            .from('team_members')
            .select('id')
            .eq('team_id', session.teamId)
            .ilike('name', session.captainName.trim())
            .maybeSingle()
          if (cap?.id) return cap.id
          const { data: newCap } = await supabase
            .from('team_members')
            .insert({ team_id: session.teamId, name: session.captainName.trim(), sort_order: 0 })
            .select('id')
            .single()
          return newCap?.id ?? id
        }
        return id
      })
    )
    const { error } = await supabase.rpc('team_leader_save_squad', {
      p_team_id: session.teamId,
      p_pin: session.pin,
      p_sport_id: sportId,
      p_member_ids: resolvedIds,
    })
    if (error) throw error
  }

  async function addMember(name: string, photoPath?: string | null) {
    if (!session) throw new Error('Not logged in as team leader')
    const cleanName = name.trim()
    if (!cleanName) throw new Error('Member name cannot be empty')

    // Try RPC first (security definer bypasses client table policies)
    const { data: rpcData, error: rpcErr } = await supabase.rpc('team_leader_add_member', {
      p_team_id: session.teamId,
      p_pin: session.pin,
      p_name: cleanName,
      p_photo_path: photoPath ?? null,
    })

    if (!rpcErr && rpcData) {
      return rpcData as { id: string; name: string }
    }

    // Fallback: direct table insert
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        team_id: session.teamId,
        name: cleanName,
        photo_path: photoPath ?? null,
      })
      .select('id, name')
      .single()

    if (error) throw new Error(rpcErr?.message || error.message)
    return data as { id: string; name: string }
  }

  async function updateMember(memberId: string, name: string, photoPath?: string | null) {
    if (!session) throw new Error('Not logged in as team leader')
    const cleanName = name.trim()
    if (!cleanName) throw new Error('Member name cannot be empty')

    // If captain pseudo-id, update captain
    if (memberId === 'captain' || memberId.startsWith('captain-')) {
      await updateCaptainPhoto(photoPath ?? null)
      // Also ensure captain exists in team_members
      const { data: cap } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', session.teamId)
        .ilike('name', session.captainName.trim())
        .maybeSingle()
      if (cap?.id) {
        memberId = cap.id
      } else {
        return
      }
    }

    // Try RPC
    const { error: rpcErr } = await supabase.rpc('team_leader_update_member', {
      p_team_id: session.teamId,
      p_pin: session.pin,
      p_member_id: memberId,
      p_name: cleanName,
      p_photo_path: photoPath ?? null,
    })

    if (!rpcErr) return

    // Fallback: direct update
    const { error } = await supabase
      .from('team_members')
      .update({
        name: cleanName,
        photo_path: photoPath ?? null,
      })
      .eq('id', memberId)
      .eq('team_id', session.teamId)

    if (error) throw new Error(rpcErr?.message || error.message)

    // Keep participant name in sync
    await supabase
      .from('sport_participants')
      .update({ player_name: cleanName })
      .eq('member_id', memberId)
      .eq('team_id', session.teamId)
  }

  async function deleteMember(memberId: string) {
    if (!session) throw new Error('Not logged in as team leader')
    if (memberId === 'captain' || memberId.startsWith('captain-')) {
      throw new Error('Cannot remove team captain from the roster')
    }

    // Try RPC
    const { error: rpcErr } = await supabase.rpc('team_leader_delete_member', {
      p_team_id: session.teamId,
      p_pin: session.pin,
      p_member_id: memberId,
    })

    if (!rpcErr) return

    // Fallback: direct delete
    await supabase
      .from('sport_participants')
      .delete()
      .eq('member_id', memberId)
      .eq('team_id', session.teamId)

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('team_id', session.teamId)

    if (error) throw new Error(rpcErr?.message || error.message)
  }

  async function updateCaptainPhoto(photoPath: string | null) {
    if (!session) throw new Error('Not logged in as team leader')

    // Try RPC
    const { error: rpcErr } = await supabase.rpc('team_leader_update_captain_photo', {
      p_team_id: session.teamId,
      p_pin: session.pin,
      p_photo_path: photoPath,
    })

    if (!rpcErr) return

    // Fallback: direct update
    await supabase
      .from('teams')
      .update({ captain_photo_path: photoPath, updated_at: new Date().toISOString() })
      .eq('id', session.teamId)

    await supabase
      .from('team_members')
      .update({ photo_path: photoPath })
      .eq('team_id', session.teamId)
      .ilike('name', session.captainName.trim())
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
        addMember,
        updateMember,
        deleteMember,
        updateCaptainPhoto,
      }}
    >
      {children}
    </LeaderCtx.Provider>
  )
}

export const useLeaderAuth = () => useContext(LeaderCtx)
