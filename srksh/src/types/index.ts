export type EditionStatus = 'upcoming' | 'active' | 'completed'
export type SportStatus = 'upcoming' | 'in_progress' | 'completed'
export type GameType = 'team' | 'individual'

export interface Edition { id: string; name: string; status: EditionStatus; is_current: boolean; tie_break: 'none' | 'wins'; created_at: string }
export interface Member { id: string; team_id: string; name: string; photo_path: string | null; sort_order: number }
export interface Team {
  id: string; edition_id: string; name: string; colour: string | null; description: string | null
  logo_path: string | null; captain_name: string; captain_photo_path: string | null
  captain_phone?: string | null
  team_members?: Member[]
}
export interface Sport {
  id: string; edition_id: string; name: string; category: string | null; description: string | null
  image_path: string | null; status: SportStatus; registration_deadline: string | null; created_at: string
  game_type?: GameType
  max_participants?: number | null
}

export interface SportTeam { sport_id: string; team_id: string }
export interface Participant { id: string; sport_id: string; team_id: string; member_id: string | null; player_name: string; is_manual: boolean; sort_order?: number; created_at?: string }
export interface SportResult { id: string; sport_id: string; status: 'pending' | 'completed'; notes: string | null }
export interface Placement { id: string; result_id: string; team_id: string; placement: number; points: number | null; player_name?: string | null }

export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'
export type ScoringType = 'cricket' | 'football' | 'sets' | 'points' | 'custom'

export interface MatchScoreData {
  scoring_type?: ScoringType
  // Cricket
  toss_winner_team_id?: string | null
  toss_decision?: 'bat' | 'field' | null
  team_a_cricket?: { runs: number | string; wickets: number | string; overs: number | string }
  team_b_cricket?: { runs: number | string; wickets: number | string; overs: number | string }
  // Football / Hockey
  team_a_goals?: number | string
  team_b_goals?: number | string
  penalty_shootout?: { team_a: number | string; team_b: number | string } | null
  // Sets (Volleyball, Badminton, TT)
  team_a_sets?: number | string
  team_b_sets?: number | string
  set_scores?: string[]
  // Points / Raids (Kabaddi, Basketball, Tug of war)
  team_a_points?: number | string
  team_b_points?: number | string
  // Common
  result_summary?: string | null
  player_of_match?: string | null
  notes?: string | null
}

export interface SportMatch {
  id: string
  sport_id: string
  team_a_id: string | null
  team_b_id: string | null
  round_name: string
  match_number: number
  scheduled_date: string | null
  scheduled_time: string | null
  venue: string | null
  status: MatchStatus
  winner_team_id: string | null
  score_data: MatchScoreData
  created_at?: string
  updated_at?: string
}
export interface LeaderRow {
  team_id: string; edition_id: string; team_name: string; colour: string | null; logo_path: string | null
  captain_name: string; captain_photo_path: string | null
  total_points: number; wins: number; runner_ups: number; rank: number
}
export interface GalleryImage { id: string; title: string | null; caption: string | null; category: string | null; storage_path: string; is_published?: boolean; is_pinned?: boolean; created_at: string }
export interface AboutImage { slot: number; title: string | null; caption: string | null; storage_path: string }
export interface SiteSettings {
  contact_email: string | null; contact_phone: string | null; contact_address: string | null
  facebook_url: string | null; instagram_url: string | null; youtube_url: string | null
  whatsapp_group_url?: string | null
  whatsapp_sender_phone?: string | null
}
export interface TeamCredential { team_id: string; pin: string; updated_at?: string }
export interface LeaderSession { teamId: string; teamName: string; captainName: string; pin: string }

export interface WhatsAppRecipient {
  id: string
  name: string
  phone: string
  role?: string | null
  created_at?: string
}

export type WhatsAppApiProvider = 'none' | 'meta' | 'ultramsg' | 'green_api' | 'generic_webhook'

export interface WhatsAppApiSettings {
  id?: number
  provider: WhatsAppApiProvider
  phone_number_id?: string | null
  access_token?: string | null
  webhook_url?: string | null
  updated_at?: string
}
