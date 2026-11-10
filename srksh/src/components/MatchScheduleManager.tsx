import { useState, useMemo } from 'react'
import { Plus, Trophy, Sparkles, Trash2, Calendar, MapPin, Clock, Edit3, ArrowRight, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Sport, Team, SportMatch, MatchStatus } from '../types'
import type { SportBundle } from '../lib/data'
import { ConfirmDialog, ColourDot, useToast, Modal } from './ui'
import { Field, errMsg } from '../pages/admin/common'
import {
  detectScoringType,
  generateRoundRobinFixtures,
  generateKnockoutFixtures,
  formatMatchScoreDisplay,
} from '../lib/tournament'
import MatchScorerModal from './MatchScorerModal'
import CricketScorerConsole from './CricketScorerConsole'
import CricketLiveScorecard from './CricketLiveScorecard'
import CricketTournamentStats from './CricketTournamentStats'

interface MatchScheduleManagerProps {
  sport: Sport
  teams: Team[]
  bundle: SportBundle
  onChanged: () => void
}

export default function MatchScheduleManager({
  sport,
  teams,
  bundle,
  onChanged,
}: MatchScheduleManagerProps) {
  const toast = useToast()
  const participatingTeams = useMemo(() => {
    return teams.filter(t =>
      bundle.sportTeams.some(st => st.sport_id === sport.id && st.team_id === t.id)
    )
  }, [teams, bundle.sportTeams, sport.id])

  const sportMatches = useMemo(() => {
    return bundle.matches
      .filter(m => m.sport_id === sport.id)
      .sort((a, b) => a.match_number - b.match_number)
  }, [bundle.matches, sport.id])

  // Modals & Dialogs
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateFormat, setGenerateFormat] = useState<'round_robin' | 'knockout'>('round_robin')
  const [include3rdPlace, setInclude3rdPlace] = useState(true)
  const [activeScorerMatch, setActiveScorerMatch] = useState<SportMatch | null>(null)
  const [deleteConfirmMatch, setDeleteConfirmMatch] = useState<SportMatch | null>(null)
  const [clearAllConfirm, setClearAllConfirm] = useState(false)
  const [syncPlacementsConfirm, setSyncPlacementsConfirm] = useState(false)
  const [cricketConsoleMatch, setCricketConsoleMatch] = useState<SportMatch | null>(null)
  const [cricketScorecardMatch, setCricketScorecardMatch] = useState<SportMatch | null>(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Quick add match modal state
  const [addMatchOpen, setAddMatchOpen] = useState(false)
  const [newTeamA, setNewTeamA] = useState('')
  const [newTeamB, setNewTeamB] = useState('')
  const [newRound, setNewRound] = useState('Match')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newVenue, setNewVenue] = useState('')

  // Group matches by round_name
  const groupedMatches = useMemo(() => {
    const map = new Map<string, SportMatch[]>()
    sportMatches.forEach(m => {
      const list = map.get(m.round_name) ?? []
      list.push(m)
      map.set(m.round_name, list)
    })
    return Array.from(map.entries())
  }, [sportMatches])

  // Generate Fixtures
  async function handleAutoGenerate() {
    if (participatingTeams.length < 2) {
      toast('error', 'Add at least 2 participating teams before generating a schedule.')
      return
    }

    setBusy(true)
    try {
      const scoringType = detectScoringType(sport.name, sport.category)
      const fixtures =
        generateFormat === 'round_robin'
          ? generateRoundRobinFixtures(
              participatingTeams,
              sport.id,
              null,
              scoringType
            )
          : generateKnockoutFixtures(
              participatingTeams,
              sport.id,
              include3rdPlace,
              null,
              scoringType
            )

      if (!fixtures.length) {
        throw new Error('Not enough teams to generate schedule')
      }

      // Delete existing matches for this sport first to replace
      await supabase.from('sport_matches').delete().eq('sport_id', sport.id)

      // Insert new fixtures
      const { error } = await supabase.from('sport_matches').insert(fixtures)
      if (error) throw error

      toast('success', `Generated ${fixtures.length} matches successfully!`)
      setGenerateOpen(false)
      onChanged()
    } catch (e) {
      toast('error', `Could not generate schedule: ${errMsg(e)}`)
    } finally {
      setBusy(false)
    }
  }

  // Add Single Match
  async function handleAddSingleMatch() {
    setBusy(true)
    try {
      const nextMatchNumber =
        sportMatches.length > 0
          ? Math.max(...sportMatches.map(m => m.match_number)) + 1
          : 1

      const scoringType = detectScoringType(sport.name, sport.category)
      const { error } = await supabase.from('sport_matches').insert([
        {
          sport_id: sport.id,
          team_a_id: newTeamA || null,
          team_b_id: newTeamB || null,
          round_name: newRound.trim() || 'Match',
          match_number: nextMatchNumber,
          scheduled_date: newDate || null,
          scheduled_time: newTime.trim() || null,
          venue: newVenue.trim() || null,
          status: 'scheduled',
          winner_team_id: null,
          score_data: { scoring_type: scoringType },
        },
      ])
      if (error) throw error

      toast('success', 'Match added!')
      setAddMatchOpen(false)
      setNewTeamA('')
      setNewTeamB('')
      onChanged()
    } catch (e) {
      toast('error', errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  // Update match details / score
  async function handleSaveMatchScore(patch: Partial<SportMatch>) {
    if (!activeScorerMatch) return
    const { error } = await supabase
      .from('sport_matches')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeScorerMatch.id)

    if (error) throw error
    onChanged()
  }

  // Quick status toggle
  async function toggleStatus(m: SportMatch, nextStatus: MatchStatus) {
    try {
      const { error } = await supabase
        .from('sport_matches')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', m.id)
      if (error) throw error
      toast('success', `Match ${m.match_number} marked as ${nextStatus}`)
      onChanged()
    } catch (e) {
      toast('error', errMsg(e))
    }
  }

  // Delete match
  async function handleDeleteMatch() {
    if (!deleteConfirmMatch) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('sport_matches')
        .delete()
        .eq('id', deleteConfirmMatch.id)
      if (error) throw error
      toast('success', 'Match deleted')
      setDeleteConfirmMatch(null)
      onChanged()
    } catch (e) {
      toast('error', errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  // Clear all matches
  async function handleClearAll() {
    setBusy(true)
    try {
      const { error } = await supabase.from('sport_matches').delete().eq('sport_id', sport.id)
      if (error) throw error
      toast('success', 'All matches cleared.')
      setClearAllConfirm(false)
      onChanged()
    } catch (e) {
      toast('error', errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  // Sync Final Tournament Placements
  async function handleSyncPlacements() {
    setBusy(true)
    try {
      // Find Final match
      const finalMatch = sportMatches.find(m =>
        m.round_name.toLowerCase().includes('final') &&
        !m.round_name.toLowerCase().includes('semi') &&
        !m.round_name.toLowerCase().includes('quarter') &&
        !m.round_name.toLowerCase().includes('3rd')
      )

      if (!finalMatch || !finalMatch.winner_team_id) {
        throw new Error('Please complete the Final match and select a winner before syncing results.')
      }

      const winnerId = finalMatch.winner_team_id
      const runnerUpId =
        finalMatch.team_a_id === winnerId ? finalMatch.team_b_id : finalMatch.team_a_id

      if (!runnerUpId) {
        throw new Error('Both teams in the Final match must be specified to determine runner-up.')
      }

      // Check 3rd place match
      const thirdMatch = sportMatches.find(m =>
        m.round_name.toLowerCase().includes('3rd') || m.round_name.toLowerCase().includes('third')
      )
      const thirdPlaceId = thirdMatch?.winner_team_id

      const placementsPayload = [
        { team_id: winnerId, placement: 1, points: 10 },
        { team_id: runnerUpId, placement: 2, points: 7 },
      ]
      if (thirdPlaceId) {
        placementsPayload.push({ team_id: thirdPlaceId, placement: 3, points: 5 })
      }

      const { error } = await supabase.rpc('save_sport_result', {
        p_sport_id: sport.id,
        p_status: 'completed',
        p_notes: `Synced from tournament final: ${finalMatch.score_data?.result_summary ?? ''}`,
        p_placements: placementsPayload,
      })

      if (error) throw error
      toast('success', 'Tournament results synced to official placements and leaderboard!')
      setSyncPlacementsConfirm(false)
      onChanged()
    } catch (e) {
      toast('error', errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream/70 p-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-bark">Match Schedule & Scoring</h3>
          <p className="text-xs text-bark-soft">
            {sportMatches.length} match{sportMatches.length === 1 ? '' : 'es'} scheduled for{' '}
            {participatingTeams.length} participating team{participatingTeams.length === 1 ? '' : 's'}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sportMatches.some(m => m.status === 'completed' && m.round_name.toLowerCase().includes('final')) && (
            <button
              type="button"
              className="btn-outline btn-sm border-gold bg-gold/10 text-bark font-semibold hover:bg-gold/20"
              onClick={() => setSyncPlacementsConfirm(true)}
            >
              <Trophy className="h-3.5 w-3.5 text-gold" />
              Sync Final to Leaderboard
            </button>
          )}

          {sport.name.toLowerCase().includes('cricket') && (
            <button
              type="button"
              className="btn-outline btn-sm border-amber-500 bg-amber-50 text-amber-950 font-semibold hover:bg-amber-100 flex items-center gap-1.5"
              onClick={() => setStatsOpen(true)}
            >
              <TrendingUp className="h-3.5 w-3.5 text-amber-700" />
              Stats & NRR
            </button>
          )}

          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => setGenerateOpen(true)}
            disabled={participatingTeams.length < 2}
          >
            <Sparkles className="h-3.5 w-3.5 text-saffron" />
            Auto-Generate Schedule
          </button>

          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => setAddMatchOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Match
          </button>

          {sportMatches.length > 0 && (
            <button
              type="button"
              className="btn-outline btn-sm text-red-700 hover:bg-red-50"
              onClick={() => setClearAllConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {participatingTeams.length < 2 && (
        <div className="rounded-xl border border-saffron/40 bg-saffron-soft/30 p-3 text-xs text-bark">
          ⚠️ <strong>Participating Teams Needed:</strong> Please add at least 2 teams under "Participating Teams" before generating matches.
        </div>
      )}

      {/* Match List by Rounds */}
      {!sportMatches.length ? (
        <div className="rounded-3xl border border-dashed border-sand bg-white/50 p-8 text-center">
          <Calendar className="mx-auto h-10 w-10 text-bark-faint mb-2" />
          <h4 className="font-serif text-base font-semibold">No matches scheduled yet</h4>
          <p className="mt-1 text-xs text-bark-soft max-w-sm mx-auto">
            Click <strong>Auto-Generate Schedule</strong> above to instantly generate Round Robin or Knockout tournament fixtures for all teams!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedMatches.map(([roundName, matches]) => (
            <div key={roundName} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-terracotta" />
                <h4 className="font-serif text-base font-bold text-bark">{roundName}</h4>
                <span className="text-xs text-bark-faint">({matches.length} matches)</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {matches.map(m => {
                  const teamA = teams.find(t => t.id === m.team_a_id)
                  const teamB = teams.find(t => t.id === m.team_b_id)
                  const scoreDisplay = formatMatchScoreDisplay(m, teamA, teamB)

                  return (
                    <div
                      key={m.id}
                      className={`relative flex flex-col justify-between rounded-2xl border p-4 shadow-soft transition ${
                        m.status === 'live'
                          ? 'border-red-400 bg-red-50/40 ring-1 ring-red-400'
                          : m.status === 'completed'
                          ? 'border-emerald-300 bg-white'
                          : 'border-sand bg-white/80'
                      }`}
                    >
                      {/* Top Bar: Match #, Stage, Status */}
                      <div className="flex items-center justify-between text-xs text-bark-soft pb-2 border-b border-sand/40">
                        <span className="font-semibold text-bark">
                          Match #{m.match_number} · {m.round_name}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {m.status === 'live' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white animate-pulse">
                              🔴 Live
                            </span>
                          )}
                          {m.status === 'completed' && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                              ✅ Final
                            </span>
                          )}
                          {m.status === 'scheduled' && (
                            <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-medium text-bark uppercase tracking-wider">
                              ⏳ Scheduled
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Teams & Scores */}
                      <div className="my-3 space-y-2">
                        {/* Team A */}
                        <div
                          className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 ${
                            m.winner_team_id && m.winner_team_id === teamA?.id
                              ? 'bg-gold/15 font-bold text-bark'
                              : 'text-bark'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <ColourDot colour={teamA?.colour} />
                            <span className="text-sm">
                              {teamA?.name ?? (m.score_data?.notes ? m.score_data.notes.split(' vs ')[0] : 'TBD')}
                            </span>
                            {m.winner_team_id && m.winner_team_id === teamA?.id && (
                              <Trophy className="h-3.5 w-3.5 text-gold shrink-0" />
                            )}
                          </div>
                          <span className="text-sm font-semibold text-terracotta-deep">
                            {scoreDisplay.aScore || '—'}
                          </span>
                        </div>

                        {/* Team B */}
                        <div
                          className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 ${
                            m.winner_team_id && m.winner_team_id === teamB?.id
                              ? 'bg-gold/15 font-bold text-bark'
                              : 'text-bark'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <ColourDot colour={teamB?.colour} />
                            <span className="text-sm">
                              {teamB?.name ?? (m.score_data?.notes ? m.score_data.notes.split(' vs ')[1] : 'TBD')}
                            </span>
                            {m.winner_team_id && m.winner_team_id === teamB?.id && (
                              <Trophy className="h-3.5 w-3.5 text-gold shrink-0" />
                            )}
                          </div>
                          <span className="text-sm font-semibold text-terracotta-deep">
                            {scoreDisplay.bScore || '—'}
                          </span>
                        </div>
                      </div>

                      {/* Result summary or Toss/Venue notes */}
                      <div className="text-xs text-bark-soft space-y-1 mb-3">
                        {scoreDisplay.summary && (
                          <p className="font-semibold text-bark">
                            📢 {scoreDisplay.summary}
                          </p>
                        )}
                        {scoreDisplay.tossText && (
                          <p className="text-[11px] text-bark-faint">🪙 {scoreDisplay.tossText}</p>
                        )}
                        {scoreDisplay.playerOfMatch && (
                          <p className="text-[11px] text-saffron-deep font-medium">
                            ⭐ Player of Match: {scoreDisplay.playerOfMatch}
                          </p>
                        )}

                        {(m.scheduled_date || m.scheduled_time || m.venue) && (
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-bark-faint">
                            {m.scheduled_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {m.scheduled_date}
                              </span>
                            )}
                            {m.scheduled_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {m.scheduled_time}
                              </span>
                            )}
                            {m.venue && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {m.venue}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions Footer */}
                      <div className="flex items-center justify-between border-t border-sand/40 pt-2 text-xs">
                        {/* Status switcher */}
                        <div className="flex items-center gap-1">
                          {m.status !== 'live' && (
                            <button
                              type="button"
                              className="rounded px-2 py-0.5 text-[11px] text-red-700 hover:bg-red-50 font-medium"
                              onClick={() => void toggleStatus(m, 'live')}
                            >
                              Go Live
                            </button>
                          )}
                          {m.status !== 'completed' && (
                            <button
                              type="button"
                              className="rounded px-2 py-0.5 text-[11px] text-emerald-800 hover:bg-emerald-50 font-medium"
                              onClick={() => void toggleStatus(m, 'completed')}
                            >
                              Finish
                            </button>
                          )}
                          {m.status !== 'scheduled' && (
                            <button
                              type="button"
                              className="rounded px-2 py-0.5 text-[11px] text-bark-soft hover:bg-sand/60"
                              onClick={() => void toggleStatus(m, 'scheduled')}
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {/* Edit & Delete */}
                        <div className="flex flex-wrap items-center gap-1">
                          {(sport.name.toLowerCase().includes('cricket') || (sport as any).scoring_type === 'cricket' || m.score_data?.scoring_type === 'cricket' || m.score_data?.team_a_cricket != null) && (
                            <>
                              <button
                                type="button"
                                className="btn-outline btn-sm py-1 px-2.5 text-xs font-semibold flex items-center gap-1 border-saffron bg-saffron-soft/40 text-bark hover:bg-saffron-soft"
                                onClick={() => setCricketConsoleMatch(m)}
                              >
                                🏏 Scorer
                              </button>
                              <button
                                type="button"
                                className="btn-outline btn-sm py-1 px-2 text-xs flex items-center gap-1"
                                onClick={() => setCricketScorecardMatch(m)}
                                title="View Full Live Scorecard"
                              >
                                📊 Card
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            className="btn-outline btn-sm py-1 px-2.5 text-xs flex items-center gap-1"
                            onClick={() => setActiveScorerMatch(m)}
                          >
                            <Edit3 className="h-3 w-3" />
                            Score / Edit
                          </button>

                          <button
                            type="button"
                            aria-label="Delete match"
                            className="rounded p-1 text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteConfirmMatch(m)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Auto-Generate Modal */}
      <Modal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Auto-Generate Tournament Schedule"
      >
        <div className="space-y-4">
          <p className="text-sm text-bark-soft">
            Generate balanced match fixtures for the {participatingTeams.length} participating teams in{' '}
            <strong>{sport.name}</strong>.
          </p>

          <div className="space-y-3">
            <Field label="Tournament Format">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`rounded-2xl border p-3 text-left transition ${
                    generateFormat === 'round_robin'
                      ? 'border-bark bg-sand/40 font-semibold'
                      : 'border-sand hover:bg-sand/20'
                  }`}
                  onClick={() => setGenerateFormat('round_robin')}
                >
                  <span className="text-base">🔄 Round Robin</span>
                  <p className="text-xs text-bark-soft mt-1">
                    Every team plays each other. Ideal for small leagues (3–6 teams).
                  </p>
                </button>

                <button
                  type="button"
                  className={`rounded-2xl border p-3 text-left transition ${
                    generateFormat === 'knockout'
                      ? 'border-bark bg-sand/40 font-semibold'
                      : 'border-sand hover:bg-sand/20'
                  }`}
                  onClick={() => setGenerateFormat('knockout')}
                >
                  <span className="text-base">🥊 Knockout (Brackets)</span>
                  <p className="text-xs text-bark-soft mt-1">
                    Semi-Finals &rarr; Final. Winners advance to the championship.
                  </p>
                </button>
              </div>
            </Field>

            {generateFormat === 'knockout' && (
              <label className="flex items-center gap-2 text-sm text-bark">
                <input
                  type="checkbox"
                  checked={include3rdPlace}
                  onChange={e => setInclude3rdPlace(e.target.checked)}
                />
                Include 3rd Place Playoff Match (Loser SF1 vs Loser SF2)
              </label>
            )}
          </div>

          <div className="rounded-xl bg-saffron-soft/30 border border-saffron/40 p-3 text-xs text-bark">
            ℹ️ Generating a new schedule will replace any existing matches for this sport.
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-sand">
            <button
              type="button"
              className="btn-outline"
              onClick={() => setGenerateOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleAutoGenerate()}
              disabled={busy}
            >
              {busy ? 'Generating...' : 'Generate Fixtures'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Single Match Modal */}
      <Modal open={addMatchOpen} onClose={() => setAddMatchOpen(false)} title="Add Single Match">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Team A">
              <select
                className="input"
                value={newTeamA}
                onChange={e => setNewTeamA(e.target.value)}
              >
                <option value="">— Select Team A (or TBD) —</option>
                {participatingTeams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Team B">
              <select
                className="input"
                value={newTeamB}
                onChange={e => setNewTeamB(e.target.value)}
              >
                <option value="">— Select Team B (or TBD) —</option>
                {participatingTeams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Round / Stage Name">
              <input
                className="input"
                value={newRound}
                onChange={e => setNewRound(e.target.value)}
                placeholder="e.g. Round 1, Semi-Final"
              />
            </Field>

            <Field label="Venue / Ground">
              <input
                className="input"
                value={newVenue}
                onChange={e => setNewVenue(e.target.value)}
                placeholder="e.g. Ground 1"
              />
            </Field>

            <Field label="Date">
              <input
                type="date"
                className="input"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
              />
            </Field>

            <Field label="Time">
              <input
                className="input"
                placeholder="e.g. 04:30 PM"
                value={newTime}
                onChange={e => setNewTime(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-sand">
            <button
              type="button"
              className="btn-outline"
              onClick={() => setAddMatchOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleAddSingleMatch()}
              disabled={busy}
            >
              {busy ? 'Adding...' : 'Add Match'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Scorer Modal */}
      {activeScorerMatch && (
        <MatchScorerModal
          open={!!activeScorerMatch}
          onClose={() => setActiveScorerMatch(null)}
          match={activeScorerMatch}
          teams={teams}
          sportName={sport.name}
          onSave={handleSaveMatchScore}
        />
      )}

      {/* Delete Match Confirm */}
      <ConfirmDialog
        open={!!deleteConfirmMatch}
        busy={busy}
        confirmLabel="Delete Match"
        title="Delete this match?"
        message={`Delete Match #${deleteConfirmMatch?.match_number} (${deleteConfirmMatch?.round_name})?`}
        onCancel={() => setDeleteConfirmMatch(null)}
        onConfirm={() => void handleDeleteMatch()}
      />

      {/* Cricket Ball-by-Ball Scorer Console */}
      {cricketConsoleMatch && (
        <CricketScorerConsole
          open={!!cricketConsoleMatch}
          onClose={() => setCricketConsoleMatch(null)}
          match={cricketConsoleMatch}
          teams={teams}
          onChanged={onChanged}
        />
      )}

      {/* Cricket Live Scorecard */}
      {cricketScorecardMatch && (
        <CricketLiveScorecard
          open={!!cricketScorecardMatch}
          onClose={() => setCricketScorecardMatch(null)}
          match={cricketScorecardMatch}
          teams={teams}
        />
      )}

      {/* Cricket Tournament Stats & NRR */}
      {statsOpen && (
        <CricketTournamentStats
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          sport={sport}
          teams={teams}
          bundle={bundle}
        />
      )}

      {/* Clear All Confirm */}
      <ConfirmDialog
        open={clearAllConfirm}
        busy={busy}
        confirmLabel="Clear All Matches"
        title="Clear all matches for this sport?"
        message="This will permanently delete all scheduled and completed matches for this sport."
        onCancel={() => setClearAllConfirm(false)}
        onConfirm={() => void handleClearAll()}
      />

      {/* Sync Placements Confirm */}
      <ConfirmDialog
        open={syncPlacementsConfirm}
        busy={busy}
        confirmLabel="Sync to Leaderboard"
        title="Sync Tournament Results to Leaderboard?"
        message="This will record the Winner of the Final as 1st Place, the Runner-up as 2nd Place, and award points on the official leaderboard."
        onCancel={() => setSyncPlacementsConfirm(false)}
        onConfirm={() => void handleSyncPlacements()}
      />
    </div>
  )
}
