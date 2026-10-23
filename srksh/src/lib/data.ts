import { useCallback, useEffect, useState } from 'react'
import { supabase, isConfigured } from './supabase'
import type {
  Edition, Team, Sport, SportTeam, Participant, SportResult, Placement, LeaderRow,
  GalleryImage, AboutImage, SiteSettings,
} from '../types'

/** Generic loader: always reads the latest saved data from Supabase. */
export function useQuery<T>(fn: () => Promise<T>, initial: T, deps: unknown[] = []) {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(isConfigured)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return }
    setLoading(true)
    try { setData(await fn()); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load data') }
    finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { void reload() }, [reload])
  return { data, loading, error, reload }
}

const must = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return (r.data ?? ([] as unknown)) as T
}

export async function getCurrentEdition(): Promise<Edition | null> {
  const { data, error } = await supabase.from('hpl_editions').select('*').eq('is_current', true).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Edition | null
}
export async function getEditions() {
  return must(await supabase.from('hpl_editions').select('*').order('created_at', { ascending: false })) as Edition[]
}
export async function getTeams(editionId: string) {
  const teams = must(await supabase.from('teams').select('*, team_members(*)').eq('edition_id', editionId).order('created_at')) as Team[]
  teams.forEach(t => t.team_members?.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
  return teams
}
export async function getLeaderboard(editionId: string) {
  return must(await supabase.from('leaderboard').select('*').eq('edition_id', editionId)
    .order('rank').order('team_name')) as LeaderRow[]
}
export interface SportBundle {
  sports: Sport[]; sportTeams: SportTeam[]; participants: Participant[]; results: SportResult[]; placements: Placement[]
}
export async function getSportBundle(editionId: string): Promise<SportBundle> {
  const sports = must(await supabase.from('sports').select('*').eq('edition_id', editionId).order('created_at')) as Sport[]
  const ids = sports.map(s => s.id)
  if (!ids.length) return { sports, sportTeams: [], participants: [], results: [], placements: [] }
  const [st, pa, re] = await Promise.all([
    supabase.from('sport_teams').select('*').in('sport_id', ids),
    supabase.from('sport_participants').select('*').in('sport_id', ids).order('created_at', { ascending: true }),
    supabase.from('sport_results').select('*').in('sport_id', ids),
  ])
  const results = must(re) as SportResult[]
  let placements: Placement[] = []
  if (results.length) {
    placements = must(await supabase.from('result_placements').select('*').in('result_id', results.map(r => r.id)).order('placement')) as Placement[]
  }
  return { sports, sportTeams: must(st) as SportTeam[], participants: must(pa) as Participant[], results, placements }
}
export async function getGallery() {
  return must(await supabase.from('gallery_images').select('*').eq('is_published', true).order('created_at', { ascending: false })) as GalleryImage[]
}
export async function getAbout() {
  return must(await supabase.from('about_images').select('*').order('slot')) as AboutImage[]
}
export async function getSettings() {
  const { data } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
  return (data ?? {}) as Partial<SiteSettings>
}

/** One hook that loads everything HPL-related for the current edition. */
export function useHpl() {
  return useQuery(async () => {
    const edition = await getCurrentEdition()
    if (!edition) return { edition: null as Edition | null, teams: [] as Team[], leaderboard: [] as LeaderRow[], bundle: { sports: [], sportTeams: [], participants: [], results: [], placements: [] } as SportBundle }
    const [teams, leaderboard, bundle] = await Promise.all([getTeams(edition.id), getLeaderboard(edition.id), getSportBundle(edition.id)])
    return { edition, teams, leaderboard, bundle }
  }, { edition: null as Edition | null, teams: [] as Team[], leaderboard: [] as LeaderRow[], bundle: { sports: [], sportTeams: [], participants: [], results: [], placements: [] } as SportBundle }, [])
}
