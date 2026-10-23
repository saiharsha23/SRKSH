export type EditionStatus = 'upcoming' | 'active' | 'completed'
export type SportStatus = 'upcoming' | 'in_progress' | 'completed'

export interface Edition { id: string; name: string; status: EditionStatus; is_current: boolean; tie_break: 'none' | 'wins'; created_at: string }
export interface Member { id: string; team_id: string; name: string; photo_path: string | null; sort_order: number }
export interface Team {
  id: string; edition_id: string; name: string; colour: string | null; description: string | null
  logo_path: string | null; captain_name: string; captain_photo_path: string | null
  team_members?: Member[]
}
export interface Sport {
  id: string; edition_id: string; name: string; category: string | null; description: string | null
  image_path: string | null; status: SportStatus; created_at: string
}
export interface SportTeam { sport_id: string; team_id: string }
export interface Participant { id: string; sport_id: string; team_id: string; member_id: string | null; player_name: string; is_manual: boolean }
export interface SportResult { id: string; sport_id: string; status: 'pending' | 'completed'; notes: string | null }
export interface Placement { id: string; result_id: string; team_id: string; placement: number; points: number | null }
export interface LeaderRow {
  team_id: string; edition_id: string; team_name: string; colour: string | null; logo_path: string | null
  captain_name: string; captain_photo_path: string | null
  total_points: number; wins: number; runner_ups: number; rank: number
}
export interface GalleryImage { id: string; title: string | null; caption: string | null; category: string | null; storage_path: string; created_at: string }
export interface AboutImage { slot: number; title: string | null; caption: string | null; storage_path: string }
export interface SiteSettings {
  contact_email: string | null; contact_phone: string | null; contact_address: string | null
  facebook_url: string | null; instagram_url: string | null; youtube_url: string | null
}
export interface TeamCredential { team_id: string; pin: string; updated_at?: string }
export interface LeaderSession { teamId: string; teamName: string; captainName: string; pin: string }
