import { useState } from 'react'
import type { Team, SportMatch, ScoringType, MatchStatus, MatchScoreData } from '../types'
import { Modal, ColourDot, useToast } from './ui'
import { Field } from '../pages/admin/common'
import { detectScoringType } from '../lib/tournament'

interface MatchScorerModalProps {
  open: boolean
  onClose: () => void
  match: SportMatch
  teams: Team[]
  sportName: string
  onSave: (updated: Partial<SportMatch>) => Promise<void>
}

export default function MatchScorerModal({
  open,
  onClose,
  match,
  teams,
  sportName,
  onSave,
}: MatchScorerModalProps) {
  const toast = useToast()
  const initialType: ScoringType =
    match.score_data?.scoring_type || detectScoringType(sportName)

  const [scoringType, setScoringType] = useState<ScoringType>(initialType)
  const [teamAId, setTeamAId] = useState(match.team_a_id ?? '')
  const [teamBId, setTeamBId] = useState(match.team_b_id ?? '')
  const [roundName, setRoundName] = useState(match.round_name)
  const [status, setStatus] = useState<MatchStatus>(match.status)
  const [winnerTeamId, setWinnerTeamId] = useState(match.winner_team_id ?? '')
  const [scheduledDate, setScheduledDate] = useState(match.scheduled_date ?? '')
  const [scheduledTime, setScheduledTime] = useState(match.scheduled_time ?? '')
  const [venue, setVenue] = useState(match.venue ?? '')

  // Cricket state
  const [tossWinner, setTossWinner] = useState(match.score_data?.toss_winner_team_id ?? '')
  const [tossDecision, setTossDecision] = useState<'bat' | 'field' | ''>(
    match.score_data?.toss_decision ?? ''
  )
  const [aRuns, setARuns] = useState(match.score_data?.team_a_cricket?.runs ?? '')
  const [aWkts, setAWkts] = useState(match.score_data?.team_a_cricket?.wickets ?? '')
  const [aOvers, setAOvers] = useState(match.score_data?.team_a_cricket?.overs ?? '')
  const [bRuns, setBRuns] = useState(match.score_data?.team_b_cricket?.runs ?? '')
  const [bWkts, setBWkts] = useState(match.score_data?.team_b_cricket?.wickets ?? '')
  const [bOvers, setBOvers] = useState(match.score_data?.team_b_cricket?.overs ?? '')

  // Football state
  const [aGoals, setAGoals] = useState(match.score_data?.team_a_goals ?? '')
  const [bGoals, setBGoals] = useState(match.score_data?.team_b_goals ?? '')
  const [aPens, setAPens] = useState(match.score_data?.penalty_shootout?.team_a ?? '')
  const [bPens, setBPens] = useState(match.score_data?.penalty_shootout?.team_b ?? '')

  // Sets state (Volleyball, Badminton)
  const [aSets, setASets] = useState(match.score_data?.team_a_sets ?? '')
  const [bSets, setBSets] = useState(match.score_data?.team_b_sets ?? '')
  const [setScores, setSetScores] = useState<string[]>(
    match.score_data?.set_scores?.length ? match.score_data.set_scores : ['', '', '']
  )

  // Points state (Kabaddi, Basketball)
  const [aPoints, setAPoints] = useState(match.score_data?.team_a_points ?? '')
  const [bPoints, setBPoints] = useState(match.score_data?.team_b_points ?? '')

  // Common metadata
  const [summary, setSummary] = useState(match.score_data?.result_summary ?? '')
  const [playerOfMatch, setPlayerOfMatch] = useState(match.score_data?.player_of_match ?? '')
  const [notes, setNotes] = useState(match.score_data?.notes ?? '')
  const [busy, setBusy] = useState(false)

  const teamA = teams.find(t => t.id === teamAId)
  const teamB = teams.find(t => t.id === teamBId)

  function autoComputeWinnerAndSummary() {
    if (!teamA || !teamB) return

    if (scoringType === 'cricket') {
      const rA = Number(aRuns)
      const rB = Number(bRuns)
      if (aRuns !== '' && bRuns !== '') {
        if (rA > rB) {
          setWinnerTeamId(teamA.id)
          setSummary(`${teamA.name} won by ${rA - rB} runs`)
        } else if (rB > rA) {
          setWinnerTeamId(teamB.id)
          const wicketsLeft = bWkts !== '' ? 10 - Number(bWkts) : null
          setSummary(
            wicketsLeft != null
              ? `${teamB.name} won by ${wicketsLeft} wickets`
              : `${teamB.name} won`
          )
        } else {
          setWinnerTeamId('')
          setSummary('Match tied')
        }
      }
    } else if (scoringType === 'football') {
      const gA = Number(aGoals)
      const gB = Number(bGoals)
      if (aGoals !== '' && bGoals !== '') {
        if (gA > gB) {
          setWinnerTeamId(teamA.id)
          setSummary(`${teamA.name} won ${gA} - ${gB}`)
        } else if (gB > gA) {
          setWinnerTeamId(teamB.id)
          setSummary(`${teamB.name} won ${gB} - ${gA}`)
        } else {
          // Check penalties
          const pA = Number(aPens)
          const pB = Number(bPens)
          if (aPens !== '' && bPens !== '') {
            if (pA > pB) {
              setWinnerTeamId(teamA.id)
              setSummary(`${teamA.name} won ${gA}-${gB} (${pA}-${pB} on pens)`)
            } else if (pB > pA) {
              setWinnerTeamId(teamB.id)
              setSummary(`${teamB.name} won ${gB}-${gA} (${pB}-${pA} on pens)`)
            }
          } else {
            setWinnerTeamId('')
            setSummary(`Match drawn ${gA} - ${gB}`)
          }
        }
      }
    } else if (scoringType === 'sets') {
      const sA = Number(aSets)
      const sB = Number(bSets)
      const validSets = setScores.filter(Boolean).join(', ')
      if (sA > sB) {
        setWinnerTeamId(teamA.id)
        setSummary(`${teamA.name} won ${sA}-${sB}${validSets ? ` (${validSets})` : ''}`)
      } else if (sB > sA) {
        setWinnerTeamId(teamB.id)
        setSummary(`${teamB.name} won ${sB}-${sA}${validSets ? ` (${validSets})` : ''}`)
      }
    } else {
      // points
      const pA = Number(aPoints)
      const pB = Number(bPoints)
      if (aPoints !== '' && bPoints !== '') {
        if (pA > pB) {
          setWinnerTeamId(teamA.id)
          setSummary(`${teamA.name} won by ${pA - pB} pts (${pA} - ${pB})`)
        } else if (pB > pA) {
          setWinnerTeamId(teamB.id)
          setSummary(`${teamB.name} won by ${pB - pA} pts (${pB} - ${pA})`)
        } else {
          setWinnerTeamId('')
          setSummary(`Tie (${pA} - ${pB})`)
        }
      }
    }
  }

  async function handleSave() {
    setBusy(true)
    try {
      const scoreData: MatchScoreData = {
        scoring_type: scoringType,
        result_summary: summary.trim() || null,
        player_of_match: playerOfMatch.trim() || null,
        notes: notes.trim() || null,
      }

      if (scoringType === 'cricket') {
        scoreData.toss_winner_team_id = tossWinner || null
        scoreData.toss_decision = tossDecision ? (tossDecision as 'bat' | 'field') : null
        scoreData.team_a_cricket = {
          runs: aRuns,
          wickets: aWkts,
          overs: aOvers,
        }
        scoreData.team_b_cricket = {
          runs: bRuns,
          wickets: bWkts,
          overs: bOvers,
        }
      } else if (scoringType === 'football') {
        scoreData.team_a_goals = aGoals
        scoreData.team_b_goals = bGoals
        if (aPens !== '' || bPens !== '') {
          scoreData.penalty_shootout = { team_a: aPens, team_b: bPens }
        }
      } else if (scoringType === 'sets') {
        scoreData.team_a_sets = aSets
        scoreData.team_b_sets = bSets
        scoreData.set_scores = setScores.filter(Boolean)
      } else {
        scoreData.team_a_points = aPoints
        scoreData.team_b_points = bPoints
      }

      await onSave({
        team_a_id: teamAId || null,
        team_b_id: teamBId || null,
        round_name: roundName.trim() || 'Match',
        status,
        winner_team_id: winnerTeamId || null,
        scheduled_date: scheduledDate || null,
        scheduled_time: scheduledTime.trim() || null,
        venue: venue.trim() || null,
        score_data: scoreData,
      })

      toast('success', 'Match updated successfully!')
      onClose()
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Could not save match score')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Match ${match.match_number} · ${roundName}`}
      wide
    >
      <div className="space-y-6">
        {/* Match Header Config */}
        <div className="grid gap-3 rounded-2xl bg-cream/70 p-4 sm:grid-cols-3">
          <Field label="Round / Stage Name">
            <input
              className="input"
              value={roundName}
              onChange={e => setRoundName(e.target.value)}
              placeholder="e.g. Semi-Final 1, Round 1"
            />
          </Field>
          <Field label="Match Date">
            <input
              type="date"
              className="input"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
            />
          </Field>
          <Field label="Match Time">
            <input
              className="input"
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              placeholder="e.g. 04:30 PM"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Venue / Ground">
              <input
                className="input"
                value={venue}
                onChange={e => setVenue(e.target.value)}
                placeholder="e.g. Main Ground, Basketball Court 1"
              />
            </Field>
          </div>
          <Field label="Match Status">
            <select
              className="input font-semibold"
              value={status}
              onChange={e => setStatus(e.target.value as MatchStatus)}
            >
              <option value="scheduled">⏳ Scheduled</option>
              <option value="live">🔴 LIVE</option>
              <option value="completed">✅ Completed</option>
              <option value="cancelled">❌ Cancelled</option>
            </select>
          </Field>
        </div>

        {/* Teams Matchup */}
        <div className="rounded-2xl border border-sand bg-white p-4 shadow-soft">
          <h4 className="mb-3 font-serif text-base font-semibold">Teams</h4>
          <div className="grid items-center gap-4 sm:grid-cols-2">
            <div>
              <Field label="Team A">
                <select
                  className="input"
                  value={teamAId}
                  onChange={e => setTeamAId(e.target.value)}
                >
                  <option value="">— Select Team A (or TBD) —</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              {teamA && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-bark-soft">
                  <ColourDot colour={teamA.colour} />
                  <span>Captain: {teamA.captain_name}</span>
                </div>
              )}
            </div>

            <div>
              <Field label="Team B">
                <select
                  className="input"
                  value={teamBId}
                  onChange={e => setTeamBId(e.target.value)}
                >
                  <option value="">— Select Team B (or TBD) —</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              {teamB && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-bark-soft">
                  <ColourDot colour={teamB.colour} />
                  <span>Captain: {teamB.captain_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scoring Engine Picker */}
        <div className="rounded-2xl border border-sand bg-sand/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h4 className="font-serif text-base font-semibold">Sport Scoring Engine</h4>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['cricket', '🏏 Cricket'],
                  ['football', '⚽ Football'],
                  ['sets', '🏐 Sets / Rackets'],
                  ['points', '🤼 Points / Generic'],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    scoringType === t
                      ? 'bg-bark text-ivory'
                      : 'bg-white text-bark hover:bg-sand/60'
                  }`}
                  onClick={() => setScoringType(t)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* CRICKET SCORING */}
          {scoringType === 'cricket' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Toss Winner">
                  <select
                    className="input"
                    value={tossWinner}
                    onChange={e => setTossWinner(e.target.value)}
                  >
                    <option value="">— None / Not decided —</option>
                    {teamA && <option value={teamA.id}>{teamA.name}</option>}
                    {teamB && <option value={teamB.id}>{teamB.name}</option>}
                  </select>
                </Field>
                <Field label="Toss Decision">
                  <select
                    className="input"
                    value={tossDecision}
                    onChange={e => setTossDecision(e.target.value as 'bat' | 'field' | '')}
                  >
                    <option value="">— Not decided —</option>
                    <option value="bat">Elected to Bat First</option>
                    <option value="field">Elected to Field / Bowl First</option>
                  </select>
                </Field>
              </div>

              {/* Innings 1 / Team A */}
              <div className="rounded-xl border border-sand bg-white p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-bark">
                  {teamA?.name ?? 'Team A'} · Innings
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Runs">
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 142"
                      value={aRuns}
                      onChange={e => setARuns(e.target.value)}
                    />
                  </Field>
                  <Field label="Wickets">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      className="input"
                      placeholder="e.g. 6"
                      value={aWkts}
                      onChange={e => setAWkts(e.target.value)}
                    />
                  </Field>
                  <Field label="Overs">
                    <input
                      className="input"
                      placeholder="e.g. 15.0"
                      value={aOvers}
                      onChange={e => setAOvers(e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              {/* Innings 2 / Team B */}
              <div className="rounded-xl border border-sand bg-white p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-bark">
                  {teamB?.name ?? 'Team B'} · Innings
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Runs">
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 138"
                      value={bRuns}
                      onChange={e => setBRuns(e.target.value)}
                    />
                  </Field>
                  <Field label="Wickets">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      className="input"
                      placeholder="e.g. 9"
                      value={bWkts}
                      onChange={e => setBWkts(e.target.value)}
                    />
                  </Field>
                  <Field label="Overs">
                    <input
                      className="input"
                      placeholder="e.g. 15.0"
                      value={bOvers}
                      onChange={e => setBOvers(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* FOOTBALL / HOCKEY SCORING */}
          {scoringType === 'football' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <Field label={`${teamA?.name ?? 'Team A'} · Goals`}>
                  <input
                    type="number"
                    min="0"
                    className="input text-center text-lg font-bold"
                    placeholder="0"
                    value={aGoals}
                    onChange={e => setAGoals(e.target.value)}
                  />
                </Field>
                <Field label={`${teamB?.name ?? 'Team B'} · Goals`}>
                  <input
                    type="number"
                    min="0"
                    className="input text-center text-lg font-bold"
                    placeholder="0"
                    value={bGoals}
                    onChange={e => setBGoals(e.target.value)}
                  />
                </Field>
              </div>

              <div className="rounded-xl bg-white p-3 border border-sand">
                <p className="text-xs font-semibold text-bark-soft mb-2">
                  Penalty Shootout (if match tied):
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={`${teamA?.name ?? 'Team A'} Penalties`}>
                    <input
                      type="number"
                      min="0"
                      className="input"
                      placeholder="e.g. 4"
                      value={aPens}
                      onChange={e => setAPens(e.target.value)}
                    />
                  </Field>
                  <Field label={`${teamB?.name ?? 'Team B'} Penalties`}>
                    <input
                      type="number"
                      min="0"
                      className="input"
                      placeholder="e.g. 3"
                      value={bPens}
                      onChange={e => setBPens(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* SETS SCORING (Volleyball, Badminton, TT) */}
          {scoringType === 'sets' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <Field label={`${teamA?.name ?? 'Team A'} · Sets Won`}>
                  <input
                    type="number"
                    min="0"
                    className="input text-center text-lg font-bold"
                    placeholder="2"
                    value={aSets}
                    onChange={e => setASets(e.target.value)}
                  />
                </Field>
                <Field label={`${teamB?.name ?? 'Team B'} · Sets Won`}>
                  <input
                    type="number"
                    min="0"
                    className="input text-center text-lg font-bold"
                    placeholder="1"
                    value={bSets}
                    onChange={e => setBSets(e.target.value)}
                  />
                </Field>
              </div>

              <div className="rounded-xl bg-white p-3 border border-sand">
                <p className="text-xs font-semibold text-bark-soft mb-2">
                  Set-by-Set Breakdown (e.g. "25-21"):
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {setScores.map((sc, idx) => (
                    <Field key={idx} label={`Set ${idx + 1}`}>
                      <input
                        className="input"
                        placeholder="e.g. 25-21"
                        value={sc}
                        onChange={e => {
                          const next = [...setScores]
                          next[idx] = e.target.value
                          setSetScores(next)
                        }}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* POINTS / KABADDI / BASKETBALL SCORING */}
          {scoringType === 'points' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label={`${teamA?.name ?? 'Team A'} · Points`}>
                <input
                  type="number"
                  min="0"
                  className="input text-center text-lg font-bold"
                  placeholder="e.g. 38"
                  value={aPoints}
                  onChange={e => setAPoints(e.target.value)}
                />
              </Field>
              <Field label={`${teamB?.name ?? 'Team B'} · Points`}>
                <input
                  type="number"
                  min="0"
                  className="input text-center text-lg font-bold"
                  placeholder="e.g. 32"
                  value={bPoints}
                  onChange={e => setBPoints(e.target.value)}
                />
              </Field>
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="btn-outline btn-sm text-xs"
              onClick={autoComputeWinnerAndSummary}
            >
              ⚡ Auto-Calculate Winner & Summary
            </button>
          </div>
        </div>

        {/* Winner & Result Summary */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Official Match Winner">
            <select
              className="input font-semibold"
              value={winnerTeamId}
              onChange={e => setWinnerTeamId(e.target.value)}
            >
              <option value="">— No Winner / Tie / In Progress —</option>
              {teamA && <option value={teamA.id}>🏆 {teamA.name}</option>}
              {teamB && <option value={teamB.id}>🏆 {teamB.name}</option>}
            </select>
          </Field>

          <Field label="Player of the Match (optional)">
            <input
              className="input"
              value={playerOfMatch}
              onChange={e => setPlayerOfMatch(e.target.value)}
              placeholder="e.g. Rahul (42 runs, 2 wkts)"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Result Summary Note">
              <input
                className="input"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="e.g. Spartans won by 14 runs"
              />
            </Field>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-sand">
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleSave()}
            disabled={busy}
          >
            {busy ? 'Saving...' : 'Save Match & Scores'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
