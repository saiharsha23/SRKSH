import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  RotateCcw,
  Swords,
  Trophy,
  ArrowRightLeft,
  UserCheck,
  CheckCircle,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Team, SportMatch, CricketMatch, CricketDelivery, CricketWicketType, CricketExtraType } from '../types'
import { Modal, ColourDot, useToast, Spinner } from './ui'
import { Field } from '../pages/admin/common'
import {
  calculateCricketScorecard,
  formatBallBadge,
  generateAutoCommentary,
  ballsToOvers,
} from '../lib/cricket'

interface CricketScorerConsoleProps {
  open: boolean
  onClose: () => void
  match: SportMatch
  teams: Team[]
  onChanged: () => void
}

export default function CricketScorerConsole({
  open,
  onClose,
  match,
  teams,
  onChanged,
}: CricketScorerConsoleProps) {
  const toast = useToast()
  const teamA = teams.find(t => t.id === match.team_a_id)
  const teamB = teams.find(t => t.id === match.team_b_id)

  const [loading, setLoading] = useState(true)
  const [cricketMatch, setCricketMatch] = useState<CricketMatch | null>(null)
  const [deliveries, setDeliveries] = useState<CricketDelivery[]>([])

  // Setup state (for new cricket match)
  const [oversLimit, setOversLimit] = useState(15)
  const [tossWinner, setTossWinner] = useState(match.team_a_id ?? '')
  const [tossDecision, setTossDecision] = useState<'bat' | 'field'>('bat')
  const [striker, setStriker] = useState('')
  const [nonStriker, setNonStriker] = useState('')
  const [bowler, setBowler] = useState('')

  // Modals inside scorer
  const [wicketModalOpen, setWicketModalOpen] = useState(false)
  const [wicketType, setWicketType] = useState<CricketWicketType>('caught')
  const [wicketDismissed, setWicketDismissed] = useState<'striker' | 'non_striker'>('striker')
  const [wicketFielder, setWicketFielder] = useState('')
  const [nextBatter, setNextBatter] = useState('')

  const [newBowlerModalOpen, setNewBowlerModalOpen] = useState(false)
  const [newBowlerName, setNewBowlerName] = useState('')

  const [endInningsConfirm, setEndInningsConfirm] = useState(false)
  const [finishMatchConfirm, setFinishMatchConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  // Load or initialize cricket_match
  const loadCricketData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: existing, error } = await supabase
        .from('cricket_matches')
        .select('*')
        .eq('match_id', match.id)
        .maybeSingle()

      if (error) throw error

      if (existing) {
        setCricketMatch(existing as CricketMatch)
        setStriker(existing.striker_name ?? '')
        setNonStriker(existing.non_striker_name ?? '')
        setBowler(existing.bowler_name ?? '')
        setOversLimit(existing.overs_limit ?? 15)

        // Load deliveries
        const { data: delData, error: delError } = await supabase
          .from('cricket_deliveries')
          .select('*')
          .eq('cricket_match_id', existing.id)
          .order('created_at', { ascending: true })

        if (delError) throw delError
        setDeliveries((delData ?? []) as CricketDelivery[])
      } else {
        setCricketMatch(null)
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Error loading cricket match')
    } finally {
      setLoading(false)
    }
  }, [match.id, toast])

  useEffect(() => {
    if (open) void loadCricketData()
  }, [open, loadCricketData])

  // Setup & Start Match
  async function handleStartMatch() {
    if (!striker.trim() || !nonStriker.trim() || !bowler.trim()) {
      toast('error', 'Please enter Striker, Non-Striker, and Opening Bowler.')
      return
    }
    if (striker.trim().toLowerCase() === nonStriker.trim().toLowerCase()) {
      toast('error', 'Striker and Non-Striker must be different players.')
      return
    }

    setBusy(true)
    try {
      const battingFirst =
        tossDecision === 'bat'
          ? tossWinner
          : tossWinner === match.team_a_id
          ? match.team_b_id
          : match.team_a_id

      const { data, error } = await supabase
        .from('cricket_matches')
        .insert([
          {
            match_id: match.id,
            overs_limit: oversLimit,
            toss_winner_team_id: tossWinner,
            toss_decision: tossDecision,
            current_innings: 1,
            batting_first_team_id: battingFirst,
            striker_name: striker.trim(),
            non_striker_name: nonStriker.trim(),
            bowler_name: bowler.trim(),
            status: 'innings1',
          },
        ])
        .select()
        .single()

      if (error) throw error

      // Update sport_match status to 'live'
      await supabase
        .from('sport_matches')
        .update({ status: 'live', updated_at: new Date().toISOString() })
        .eq('id', match.id)

      setCricketMatch(data as CricketMatch)
      setDeliveries([])
      toast('success', 'Match started! Live scoring is active.')
      onChanged()
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Could not initialize match')
    } finally {
      setBusy(false)
    }
  }

  // Current innings calculation
  const currentInningsNum = cricketMatch?.current_innings ?? 1
  const scorecard = useMemo(() => {
    return calculateCricketScorecard(deliveries, currentInningsNum)
  }, [deliveries, currentInningsNum])

  // Current over balls
  const currentOverNumber = Math.floor(scorecard.legalBalls / 6)
  const currentOverBalls = useMemo(() => {
    return deliveries.filter(
      d => d.innings === currentInningsNum && d.over_number === currentOverNumber
    )
  }, [deliveries, currentInningsNum, currentOverNumber])

  // Determine Batting Team & Bowling Team
  const battingTeam = useMemo(() => {
    if (!cricketMatch) return null
    if (cricketMatch.current_innings === 1) {
      return cricketMatch.batting_first_team_id === teamA?.id ? teamA : teamB
    } else {
      return cricketMatch.batting_first_team_id === teamA?.id ? teamB : teamA
    }
  }, [cricketMatch, teamA, teamB])

  const bowlingTeam = useMemo(() => {
    return battingTeam?.id === teamA?.id ? teamB : teamA
  }, [battingTeam, teamA, teamB])

  // Available player lists for dropdown suggestions
  const battingSquad = useMemo(() => {
    return battingTeam?.team_members?.map(m => m.name) ?? []
  }, [battingTeam])

  const bowlingSquad = useMemo(() => {
    return bowlingTeam?.team_members?.map(m => m.name) ?? []
  }, [bowlingTeam])

  // Ball Delivery Record
  async function recordDelivery(params: {
    runsBatter: number
    isExtra: boolean
    extraType?: CricketExtraType | null
    extraRuns?: number
    isWicket: boolean
    wicketType?: CricketWicketType | null
    playerDismissed?: string | null
    fielderName?: string | null
    nextBatterName?: string | null
  }) {
    if (!cricketMatch) return
    setBusy(true)

    try {
      const isLegal = !params.isExtra || (params.extraType !== 'wide' && params.extraType !== 'no_ball')
      const nextLegalBall = isLegal ? (scorecard.legalBalls % 6) + 1 : scorecard.legalBalls % 6

      // Commentary
      const commentary = generateAutoCommentary({
        striker: striker.trim(),
        bowler: bowler.trim(),
        runs: params.runsBatter,
        isExtra: params.isExtra,
        extraType: params.extraType,
        extraRuns: params.extraRuns,
        isWicket: params.isWicket,
        wicketType: params.wicketType,
        playerDismissed: params.playerDismissed,
        fielder: params.fielderName,
      })

      const deliveryPayload = {
        cricket_match_id: cricketMatch.id,
        innings: currentInningsNum,
        over_number: currentOverNumber,
        ball_in_over: nextLegalBall,
        striker_name: striker.trim(),
        non_striker_name: nonStriker.trim(),
        bowler_name: bowler.trim(),
        runs_batter: params.runsBatter,
        is_extra: params.isExtra,
        extra_type: params.extraType || null,
        extra_runs: params.extraRuns || (params.isExtra ? 1 : 0),
        is_wicket: params.isWicket,
        wicket_type: params.wicketType || null,
        player_dismissed: params.playerDismissed || (params.isWicket ? striker.trim() : null),
        fielder_name: params.fielderName || null,
        commentary,
      }

      const { data: newDel, error: delErr } = await supabase
        .from('cricket_deliveries')
        .insert([deliveryPayload])
        .select()
        .single()

      if (delErr) throw delErr

      const updatedDeliveries = [...deliveries, newDel as CricketDelivery]
      setDeliveries(updatedDeliveries)

      // Calculate new score after this ball
      const newScore = calculateCricketScorecard(updatedDeliveries, currentInningsNum)

      // Strike rotation logic
      let newStriker = striker
      let newNonStriker = nonStriker

      // 1. If wicket fell, introduce next batter
      if (params.isWicket && params.nextBatterName) {
        if (params.playerDismissed === nonStriker) {
          newNonStriker = params.nextBatterName.trim()
        } else {
          newStriker = params.nextBatterName.trim()
        }
      }

      // 2. Rotate strike on odd runs (1, 3, or singles off no-ball/bye)
      const runsToRotate = params.runsBatter + (params.extraType === 'bye' || params.extraType === 'leg_bye' ? params.extraRuns || 0 : 0)
      if (runsToRotate % 2 !== 0) {
        const temp = newStriker
        newStriker = newNonStriker
        newNonStriker = temp
      }

      // 3. Over completion check (6 legal balls)
      const overJustCompleted = isLegal && nextLegalBall === 6
      if (overJustCompleted) {
        // Strike rotates at end of over
        const temp = newStriker
        newStriker = newNonStriker
        newNonStriker = temp
      }

      setStriker(newStriker)
      setNonStriker(newNonStriker)

      // Sync summary to cricket_matches and sport_matches
      const matchPatch: Partial<CricketMatch> = {
        striker_name: newStriker,
        non_striker_name: newNonStriker,
        updated_at: new Date().toISOString(),
      }

      if (currentInningsNum === 1) {
        matchPatch.innings1_runs = newScore.totalRuns
        matchPatch.innings1_wickets = newScore.totalWickets
        matchPatch.innings1_legal_balls = newScore.legalBalls
      } else {
        matchPatch.innings2_runs = newScore.totalRuns
        matchPatch.innings2_wickets = newScore.totalWickets
        matchPatch.innings2_legal_balls = newScore.legalBalls
      }

      await supabase
        .from('cricket_matches')
        .update(matchPatch)
        .eq('id', cricketMatch.id)

      // Also update sport_matches score_data for instant visibility on cards
      const formattedScoreA =
        cricketMatch.batting_first_team_id === teamA?.id
          ? `${newScore.totalRuns}/${newScore.totalWickets} (${newScore.oversFormatted} ov)`
          : match.score_data?.team_a_cricket
          ? `${match.score_data.team_a_cricket.runs}/${match.score_data.team_a_cricket.wickets} (${match.score_data.team_a_cricket.overs} ov)`
          : ''

      const formattedScoreB =
        cricketMatch.batting_first_team_id === teamB?.id
          ? `${newScore.totalRuns}/${newScore.totalWickets} (${newScore.oversFormatted} ov)`
          : match.score_data?.team_b_cricket
          ? `${match.score_data.team_b_cricket.runs}/${match.score_data.team_b_cricket.wickets} (${match.score_data.team_b_cricket.overs} ov)`
          : ''

      await supabase
        .from('sport_matches')
        .update({
          score_data: {
            ...match.score_data,
            scoring_type: 'cricket',
            team_a_cricket: {
              runs: formattedScoreA ? formattedScoreA.split('/')[0] : 0,
              wickets: formattedScoreA ? formattedScoreA.split('/')[1]?.split(' ')[0] : 0,
              overs: formattedScoreA ? formattedScoreA.split('(')[1]?.replace(' ov)', '') : '0.0',
            },
            team_b_cricket: {
              runs: formattedScoreB ? formattedScoreB.split('/')[0] : 0,
              wickets: formattedScoreB ? formattedScoreB.split('/')[1]?.split(' ')[0] : 0,
              overs: formattedScoreB ? formattedScoreB.split('(')[1]?.replace(' ov)', '') : '0.0',
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id)

      // Prompt for next bowler if over completed
      if (overJustCompleted) {
        setNewBowlerModalOpen(true)
      }

      // Check if 2nd innings target reached
      if (currentInningsNum === 2 && cricketMatch.target_runs && newScore.totalRuns >= cricketMatch.target_runs) {
        toast('success', `TARGET REACHED! ${battingTeam?.name} wins the match! 🎉`)
        setFinishMatchConfirm(true)
      }

      // Check if 10 wickets down or overs completed
      if (newScore.totalWickets >= 10 || newScore.legalBalls >= (cricketMatch.overs_limit * 6)) {
        if (currentInningsNum === 1) {
          toast('success', `Innings 1 Completed! ${newScore.totalRuns} runs scored.`)
          setEndInningsConfirm(true)
        } else {
          toast('success', `Innings 2 Completed!`)
          setFinishMatchConfirm(true)
        }
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Failed to record ball')
    } finally {
      setBusy(false)
    }
  }

  // Strike Swap button
  async function handleSwapStrike() {
    if (!cricketMatch) return
    const nextStriker = nonStriker
    const nextNonStriker = striker
    setStriker(nextStriker)
    setNonStriker(nextNonStriker)

    await supabase
      .from('cricket_matches')
      .update({ striker_name: nextStriker, non_striker_name: nextNonStriker })
      .eq('id', cricketMatch.id)
    toast('success', `Strike swapped: ${nextStriker} is now on strike.`)
  }

  // Undo Last Ball
  async function handleUndo() {
    if (!deliveries.length) return
    setBusy(true)
    try {
      const last = deliveries[deliveries.length - 1]
      await supabase.from('cricket_deliveries').delete().eq('id', last.id)

      const remaining = deliveries.slice(0, -1)
      setDeliveries(remaining)

      toast('success', 'Last ball undone.')
      void loadCricketData()
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Undo failed')
    } finally {
      setBusy(false)
    }
  }

  // End 1st Innings & Switch
  async function handleSwitchToInnings2() {
    if (!cricketMatch) return
    setBusy(true)
    try {
      const target = scorecard.totalRuns + 1
      await supabase
        .from('cricket_matches')
        .update({
          current_innings: 2,
          target_runs: target,
          status: 'innings2',
          striker_name: '',
          non_striker_name: '',
          bowler_name: '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', cricketMatch.id)

      setStriker('')
      setNonStriker('')
      setBowler('')
      setEndInningsConfirm(false)
      toast('success', `Innings 2 Started! Target: ${target} runs.`)
      void loadCricketData()
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Failed to switch innings')
    } finally {
      setBusy(false)
    }
  }

  // Complete Match & Declare Winner
  async function handleFinishMatch(winnerId: string, summaryText: string) {
    if (!cricketMatch) return
    setBusy(true)
    try {
      await supabase
        .from('cricket_matches')
        .update({
          status: 'completed',
          winner_team_id: winnerId || null,
          result_summary: summaryText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cricketMatch.id)

      await supabase
        .from('sport_matches')
        .update({
          status: 'completed',
          winner_team_id: winnerId || null,
          score_data: {
            ...match.score_data,
            result_summary: summaryText,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id)

      toast('success', 'Match completed and saved successfully!')
      setFinishMatchConfirm(false)
      onClose()
      onChanged()
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Failed to finish match')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Live Cricket Scorer · Match #${match.match_number}`}
      wide
    >
      {loading ? (
        <div className="py-12 text-center">
          <Spinner />
          <p className="mt-2 text-sm text-bark-soft">Loading cricket scoring engine...</p>
        </div>
      ) : !cricketMatch ? (
        /* SETUP SCREEN */
        <div className="space-y-6">
          <div className="rounded-2xl bg-cream/70 p-4 border border-sand">
            <h3 className="font-serif text-lg font-bold text-bark flex items-center gap-2">
              <Swords className="h-5 w-5 text-terracotta" />
              Cricket Match Setup
            </h3>
            <p className="text-xs text-bark-soft mt-1">
              Configure overs, toss result, and opening players to start live ball-by-ball scoring.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Overs per Innings">
              <input
                type="number"
                min="1"
                max="50"
                className="input font-bold"
                value={oversLimit}
                onChange={e => setOversLimit(Number(e.target.value))}
              />
            </Field>

            <Field label="Toss Winner">
              <select
                className="input"
                value={tossWinner}
                onChange={e => setTossWinner(e.target.value)}
              >
                {teamA && <option value={teamA.id}>{teamA.name}</option>}
                {teamB && <option value={teamB.id}>{teamB.name}</option>}
              </select>
            </Field>

            <Field label="Toss Decision">
              <select
                className="input"
                value={tossDecision}
                onChange={e => setTossDecision(e.target.value as 'bat' | 'field')}
              >
                <option value="bat">Elected to Bat First</option>
                <option value="field">Elected to Bowl / Field First</option>
              </select>
            </Field>
          </div>

          <div className="rounded-2xl border border-sand bg-white p-4 space-y-4">
            <h4 className="font-serif text-base font-semibold text-bark">Opening Lineup</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Striker (Batter 1)">
                <input
                  list="striker-squad"
                  className="input"
                  placeholder="Select or type name"
                  value={striker}
                  onChange={e => setStriker(e.target.value)}
                />
                <datalist id="striker-squad">
                  {(tossDecision === 'bat' ? (tossWinner === teamA?.id ? teamA : teamB) : (tossWinner === teamA?.id ? teamB : teamA))
                    ?.team_members?.map(m => (
                      <option key={m.id} value={m.name} />
                    ))}
                </datalist>
              </Field>

              <Field label="Non-Striker (Batter 2)">
                <input
                  list="non-striker-squad"
                  className="input"
                  placeholder="Select or type name"
                  value={nonStriker}
                  onChange={e => setNonStriker(e.target.value)}
                />
                <datalist id="non-striker-squad">
                  {(tossDecision === 'bat' ? (tossWinner === teamA?.id ? teamA : teamB) : (tossWinner === teamA?.id ? teamB : teamA))
                    ?.team_members?.map(m => (
                      <option key={m.id} value={m.name} />
                    ))}
                </datalist>
              </Field>

              <Field label="Opening Bowler">
                <input
                  list="bowler-squad"
                  className="input"
                  placeholder="Select or type name"
                  value={bowler}
                  onChange={e => setBowler(e.target.value)}
                />
                <datalist id="bowler-squad">
                  {(tossDecision === 'field' ? (tossWinner === teamA?.id ? teamA : teamB) : (tossWinner === teamA?.id ? teamB : teamA))
                    ?.team_members?.map(m => (
                      <option key={m.id} value={m.name} />
                    ))}
                </datalist>
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-sand">
            <button type="button" className="btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleStartMatch()}
              disabled={busy}
            >
              {busy ? 'Starting...' : '⚡ Start Live Match'}
            </button>
          </div>
        </div>
      ) : (
        /* LIVE SCORER CONSOLE */
        <div className="space-y-5">
          {/* Main Scoreboard Header */}
          <div className="rounded-3xl bg-bark p-5 text-ivory shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bark-soft/40 pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white animate-pulse">
                  🔴 LIVE INNINGS {currentInningsNum}
                </span>
                <span className="text-xs text-sand/80">
                  Max {cricketMatch.overs_limit} overs
                </span>
              </div>
              <div className="text-xs text-sand">
                Bowling: <strong>{bowlingTeam?.name}</strong>
              </div>
            </div>

            <div className="my-4 flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-sand">Batting: {battingTeam?.name}</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="font-serif text-5xl font-black text-white">
                    {scorecard.totalRuns} / {scorecard.totalWickets}
                  </span>
                  <span className="text-xl text-sand">
                    ({scorecard.oversFormatted} ov)
                  </span>
                </div>
              </div>

              <div className="flex gap-4 text-right">
                <div>
                  <p className="text-[11px] text-sand/70 uppercase">CRR</p>
                  <p className="text-xl font-bold text-saffron">{scorecard.runRate}</p>
                </div>
                {currentInningsNum === 2 && cricketMatch.target_runs && (
                  <div>
                    <p className="text-[11px] text-sand/70 uppercase">Target / RRR</p>
                    <p className="text-xl font-bold text-emerald-400">
                      {cricketMatch.target_runs}
                      <span className="text-xs text-sand ml-1">
                        (need {Math.max(0, cricketMatch.target_runs - scorecard.totalRuns)} off{' '}
                        {Math.max(0, cricketMatch.overs_limit * 6 - scorecard.legalBalls)} b)
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Over balls timeline */}
            <div className="flex items-center gap-2 pt-2 border-t border-bark-soft/40 overflow-x-auto">
              <span className="text-xs text-sand/70 whitespace-nowrap">This Over:</span>
              <div className="flex items-center gap-1.5">
                {currentOverBalls.length === 0 ? (
                  <span className="text-xs text-sand/50 italic">New over starting...</span>
                ) : (
                  currentOverBalls.map(b => {
                    const badge = formatBallBadge(b)
                    return (
                      <span
                        key={b.id}
                        className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-xs ${badge.bgClass}`}
                      >
                        {badge.text}
                      </span>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* On-Field Players (Batters & Bowler) */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Batters */}
            <div className="rounded-2xl border border-sand bg-white p-4">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-sand/40">
                <span className="text-xs font-bold uppercase tracking-wider text-bark">Batters</span>
                <button
                  type="button"
                  className="btn-outline btn-sm py-0.5 px-2 text-xs flex items-center gap-1"
                  onClick={() => void handleSwapStrike()}
                  title="Swap Strike"
                >
                  <ArrowRightLeft className="h-3 w-3" />
                  Swap Strike
                </button>
              </div>

              <div className="space-y-2 text-sm">
                {/* Striker */}
                <div className="flex items-center justify-between font-bold text-bark bg-saffron-soft/30 p-2 rounded-xl border border-saffron/40">
                  <span>🏏 {striker || 'Striker'} *</span>
                  <span className="font-serif text-terracotta-deep">
                    {scorecard.batting.find(b => b.name === striker)?.runs ?? 0} (
                    {scorecard.batting.find(b => b.name === striker)?.balls ?? 0}b)
                  </span>
                </div>
                {/* Non-Striker */}
                <div className="flex items-center justify-between text-bark p-2">
                  <span>{nonStriker || 'Non-Striker'}</span>
                  <span className="font-serif text-bark-soft">
                    {scorecard.batting.find(b => b.name === nonStriker)?.runs ?? 0} (
                    {scorecard.batting.find(b => b.name === nonStriker)?.balls ?? 0}b)
                  </span>
                </div>
              </div>
            </div>

            {/* Bowler */}
            <div className="rounded-2xl border border-sand bg-white p-4">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-sand/40">
                <span className="text-xs font-bold uppercase tracking-wider text-bark">Current Bowler</span>
                <button
                  type="button"
                  className="btn-outline btn-sm py-0.5 px-2 text-xs"
                  onClick={() => setNewBowlerModalOpen(true)}
                >
                  Change Bowler
                </button>
              </div>

              <div className="flex items-center justify-between p-2 font-bold text-bark">
                <span>🎯 {bowler || 'Bowler'}</span>
                {(() => {
                  const bw = scorecard.bowling.find(b => b.name === bowler)
                  return (
                    <span className="font-serif text-terracotta-deep">
                      {bw ? `${bw.overs} ov · ${bw.maidens}m · ${bw.runs}r · ${bw.wickets}w` : '0.0 ov'}
                    </span>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* MAIN SCORING PAD BUTTONS */}
          <div className="rounded-3xl border border-sand bg-sand/20 p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-bark text-center">
              Tap to Record Ball
            </h4>

            {/* Run Buttons (0, 1, 2, 3, 4, 6) */}
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 6].map(runs => (
                <button
                  key={runs}
                  type="button"
                  disabled={busy}
                  className={`h-14 rounded-2xl font-serif text-2xl font-black shadow transition active:scale-95 ${
                    runs === 6
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : runs === 4
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : runs === 0
                      ? 'bg-white text-bark hover:bg-sand/60'
                      : 'bg-white text-bark hover:bg-sand/60'
                  }`}
                  onClick={() =>
                    void recordDelivery({
                      runsBatter: runs,
                      isExtra: false,
                      isWicket: false,
                    })
                  }
                >
                  {runs}
                </button>
              ))}
            </div>

            {/* Extras Buttons */}
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                disabled={busy}
                className="btn-outline py-2.5 text-xs font-bold border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100"
                onClick={() =>
                  void recordDelivery({
                    runsBatter: 0,
                    isExtra: true,
                    extraType: 'wide',
                    extraRuns: 1,
                    isWicket: false,
                  })
                }
              >
                Wide (Wd)
              </button>

              <button
                type="button"
                disabled={busy}
                className="btn-outline py-2.5 text-xs font-bold border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100"
                onClick={() =>
                  void recordDelivery({
                    runsBatter: 0,
                    isExtra: true,
                    extraType: 'no_ball',
                    extraRuns: 1,
                    isWicket: false,
                  })
                }
              >
                No Ball (Nb)
              </button>

              <button
                type="button"
                disabled={busy}
                className="btn-outline py-2.5 text-xs font-medium bg-white"
                onClick={() =>
                  void recordDelivery({
                    runsBatter: 0,
                    isExtra: true,
                    extraType: 'leg_bye',
                    extraRuns: 1,
                    isWicket: false,
                  })
                }
              >
                Leg Bye (1)
              </button>

              <button
                type="button"
                disabled={busy}
                className="btn-outline py-2.5 text-xs font-medium bg-white"
                onClick={() =>
                  void recordDelivery({
                    runsBatter: 0,
                    isExtra: true,
                    extraType: 'bye',
                    extraRuns: 1,
                    isWicket: false,
                  })
                }
              >
                Bye (1)
              </button>
            </div>

            {/* WICKET & UNDO BUTTONS */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-2xl bg-red-600 py-3.5 text-base font-bold text-white shadow hover:bg-red-700 active:scale-95 transition"
                onClick={() => {
                  setWicketDismissed('striker')
                  setNextBatter('')
                  setWicketFielder('')
                  setWicketModalOpen(true)
                }}
              >
                🚨 WICKET!
              </button>

              <button
                type="button"
                disabled={busy || !deliveries.length}
                className="btn-outline py-3.5 text-sm font-semibold flex items-center justify-center gap-1.5"
                onClick={() => void handleUndo()}
              >
                <RotateCcw className="h-4 w-4" />
                Undo Last Ball
              </button>
            </div>
          </div>

          {/* Innings & Match Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-sand">
            {currentInningsNum === 1 ? (
              <button
                type="button"
                className="btn-outline btn-sm border-saffron bg-saffron-soft/40 text-bark font-semibold"
                onClick={() => setEndInningsConfirm(true)}
              >
                Declare / End 1st Innings
              </button>
            ) : (
              <button
                type="button"
                className="btn-outline btn-sm border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold"
                onClick={() => setFinishMatchConfirm(true)}
              >
                🏆 Complete Match & Declare Winner
              </button>
            )}

            <button type="button" className="btn-outline btn-sm" onClick={onClose}>
              Close Console
            </button>
          </div>
        </div>
      )}

      {/* WICKET POPUP MODAL */}
      <Modal
        open={wicketModalOpen}
        onClose={() => setWicketModalOpen(false)}
        title="Record Wicket Fall"
      >
        <div className="space-y-4">
          <Field label="Dismissal Type">
            <select
              className="input font-semibold"
              value={wicketType}
              onChange={e => setWicketType(e.target.value as CricketWicketType)}
            >
              <option value="bowled">Bowled</option>
              <option value="caught">Caught</option>
              <option value="lbw">LBW</option>
              <option value="run_out">Run Out</option>
              <option value="stumped">Stumped</option>
              <option value="hit_wicket">Hit Wicket</option>
            </select>
          </Field>

          {wicketType === 'run_out' && (
            <Field label="Who was run out?">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    name="runout"
                    checked={wicketDismissed === 'striker'}
                    onChange={() => setWicketDismissed('striker')}
                  />
                  Striker ({striker})
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    name="runout"
                    checked={wicketDismissed === 'non_striker'}
                    onChange={() => setWicketDismissed('non_striker')}
                  />
                  Non-Striker ({nonStriker})
                </label>
              </div>
            </Field>
          )}

          {(wicketType === 'caught' || wicketType === 'run_out' || wicketType === 'stumped') && (
            <Field label="Fielder / Wicketkeeper (optional)">
              <input
                list="fielder-list"
                className="input"
                placeholder="Name of fielder"
                value={wicketFielder}
                onChange={e => setWicketFielder(e.target.value)}
              />
              <datalist id="fielder-list">
                {bowlingSquad.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>
          )}

          <Field label="Next Batter Coming In">
            <input
              list="next-batter-list"
              className="input"
              placeholder="Name of incoming batter"
              value={nextBatter}
              onChange={e => setNextBatter(e.target.value)}
            />
            <datalist id="next-batter-list">
              {battingSquad.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>

          <div className="flex justify-end gap-3 pt-3 border-t border-sand">
            <button type="button" className="btn-outline" onClick={() => setWicketModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary bg-red-600 hover:bg-red-700"
              onClick={() => {
                setWicketModalOpen(false)
                void recordDelivery({
                  runsBatter: 0,
                  isExtra: false,
                  isWicket: true,
                  wicketType,
                  playerDismissed: wicketDismissed === 'striker' ? striker : nonStriker,
                  fielderName: wicketFielder,
                  nextBatterName: nextBatter,
                })
              }}
            >
              Confirm Wicket
            </button>
          </div>
        </div>
      </Modal>

      {/* NEW BOWLER MODAL */}
      <Modal
        open={newBowlerModalOpen}
        onClose={() => setNewBowlerModalOpen(false)}
        title="Select Next Bowler"
      >
        <div className="space-y-4">
          <Field label="Next Bowler Name">
            <input
              list="new-bowler-list"
              className="input"
              placeholder="Select or enter bowler name"
              value={newBowlerName}
              onChange={e => setNewBowlerName(e.target.value)}
            />
            <datalist id="new-bowler-list">
              {bowlingSquad
                .filter(name => name.toLowerCase() !== bowler.toLowerCase())
                .map(name => (
                  <option key={name} value={name} />
                ))}
            </datalist>
          </Field>

          <div className="flex justify-end gap-3 pt-3 border-t border-sand">
            <button
              type="button"
              className="btn-primary"
              disabled={!newBowlerName.trim()}
              onClick={async () => {
                const bName = newBowlerName.trim()
                setBowler(bName)
                if (cricketMatch) {
                  await supabase
                    .from('cricket_matches')
                    .update({ bowler_name: bName })
                    .eq('id', cricketMatch.id)
                }
                setNewBowlerModalOpen(false)
                setNewBowlerName('')
                toast('success', `${bName} is now bowling.`)
              }}
            >
              Set Bowler
            </button>
          </div>
        </div>
      </Modal>

      {/* END 1ST INNINGS CONFIRM */}
      <Modal
        open={endInningsConfirm}
        onClose={() => setEndInningsConfirm(false)}
        title="End 1st Innings?"
      >
        <div className="space-y-4">
          <p className="text-sm text-bark">
            1st Innings total: <strong>{scorecard.totalRuns} / {scorecard.totalWickets}</strong> ({scorecard.oversFormatted} ov).
          </p>
          <p className="text-sm font-semibold text-terracotta">
            Target for {bowlingTeam?.name}: {scorecard.totalRuns + 1} runs.
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-sand">
            <button type="button" className="btn-outline" onClick={() => setEndInningsConfirm(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleSwitchToInnings2()}
            >
              Start 2nd Innings
            </button>
          </div>
        </div>
      </Modal>

      {/* COMPLETE MATCH CONFIRM */}
      <Modal
        open={finishMatchConfirm}
        onClose={() => setFinishMatchConfirm(false)}
        title="Complete Match & Declare Winner"
      >
        <div className="space-y-4">
          <Field label="Match Winner">
            <select
              className="input font-bold"
              id="winner-select"
              defaultValue={
                scorecard.totalRuns >= (cricketMatch?.target_runs ?? 999)
                  ? battingTeam?.id
                  : bowlingTeam?.id
              }
            >
              {teamA && <option value={teamA.id}>🏆 {teamA.name}</option>}
              {teamB && <option value={teamB.id}>🏆 {teamB.name}</option>}
            </select>
          </Field>

          <Field label="Result Summary">
            <input
              className="input"
              id="summary-input"
              defaultValue={
                currentInningsNum === 2 && cricketMatch?.target_runs
                  ? scorecard.totalRuns >= cricketMatch.target_runs
                    ? `${battingTeam?.name} won by ${10 - scorecard.totalWickets} wickets`
                    : `${bowlingTeam?.name} won by ${cricketMatch.target_runs - 1 - scorecard.totalRuns} runs`
                  : 'Match completed'
              }
            />
          </Field>

          <div className="flex justify-end gap-3 pt-3 border-t border-sand">
            <button type="button" className="btn-outline" onClick={() => setFinishMatchConfirm(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const wId = (document.getElementById('winner-select') as HTMLSelectElement)?.value
                const sum = (document.getElementById('summary-input') as HTMLInputElement)?.value
                void handleFinishMatch(wId, sum)
              }}
            >
              Confirm & Save Result
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  )
}

