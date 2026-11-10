import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Trophy,
  Activity,
  Calendar,
  MapPin,
  Clock,
  RotateCw,
  TrendingUp,
  Percent,
  Hash,
  Info,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Team, SportMatch, CricketMatch, CricketDelivery } from '../types'
import { Modal, ColourDot, Spinner } from './ui'
import {
  calculateCricketScorecard,
  formatBallBadge,
  ballsToOvers,
} from '../lib/cricket'
import CricketChartsAndAnalytics from './CricketChartsAndAnalytics'

interface CricketLiveScorecardProps {
  open: boolean
  onClose: () => void
  match: SportMatch
  teams: Team[]
}

function PlayerAvatar({
  name,
  colour,
  isBowler,
}: {
  name: string
  colour?: string | null
  isBowler?: boolean
}) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-md font-bold text-xs ring-2 ring-white/20 select-none"
      style={{
        background: colour
          ? `linear-gradient(135deg, ${colour}, #1e293b)`
          : isBowler
          ? 'linear-gradient(135deg, #0284c7, #0f172a)'
          : 'linear-gradient(135deg, #ec4899, #1e1b4b)',
      }}
    >
      <span>{initials || (isBowler ? '⚾' : '🏏')}</span>
      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[9px] text-white ring-1 ring-white/60">
        {isBowler ? '⚾' : '🏏'}
      </span>
    </div>
  )
}

export default function CricketLiveScorecard({
  open,
  onClose,
  match,
  teams,
}: CricketLiveScorecardProps) {
  const teamA = teams.find(t => t.id === match.team_a_id)
  const teamB = teams.find(t => t.id === match.team_b_id)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [, setLastUpdated] = useState<string>('')
  const [liveMatch, setLiveMatch] = useState<SportMatch>(match)
  const [cricketMatch, setCricketMatch] = useState<CricketMatch | null>(null)
  const [deliveries, setDeliveries] = useState<CricketDelivery[]>([])

  // Tabs matching Cricbuzz reference: 'match_info' | 'live' | 'scorecard' | 'charts'
  const [activeTab, setActiveTab] = useState<'live' | 'scorecard' | 'charts' | 'info'>('live')
  const [selectedScorecardInnings, setSelectedScorecardInnings] = useState<1 | 2>(1)
  const [probViewMode, setProbViewMode] = useState<'% View' | 'Number View'>('% View')

  // Load cricket data
  const loadData = useCallback(async () => {
    try {
      // 1. Fetch latest sport_match to catch score_data changes
      const { data: sm } = await supabase
        .from('sport_matches')
        .select('*')
        .eq('id', match.id)
        .maybeSingle()
      if (sm) {
        setLiveMatch(sm as SportMatch)
      }

      // 2. Fetch cricket_match
      const { data: cm, error: cmErr } = await supabase
        .from('cricket_matches')
        .select('*')
        .eq('match_id', match.id)
        .maybeSingle()

      if (cmErr) throw cmErr
      setCricketMatch(cm as CricketMatch | null)

      // 3. Fetch deliveries
      if (cm) {
        const { data: delData, error: delErr } = await supabase
          .from('cricket_deliveries')
          .select('*')
          .eq('cricket_match_id', cm.id)
          .order('created_at', { ascending: false })

        if (delErr) throw delErr
        setDeliveries((delData ?? []) as CricketDelivery[])
      } else {
        setDeliveries([])
      }

      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [match.id])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setTimeout(() => setRefreshing(false), 400)
  }

  useEffect(() => {
    if (!open) return
    void loadData()

    // REALTIME WEBSOCKET SUBSCRIPTION FOR ZERO-CLICK LIVE UPDATES
    const channel = supabase
      .channel(`cricket_live_${match.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cricket_deliveries' },
        () => {
          void loadData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cricket_matches', filter: `match_id=eq.${match.id}` },
        payload => {
          if (payload.new) {
            setCricketMatch(payload.new as CricketMatch)
          }
          void loadData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sport_matches', filter: `id=eq.${match.id}` },
        payload => {
          if (payload.new) {
            setLiveMatch(payload.new as SportMatch)
          }
          void loadData()
        }
      )
      .subscribe()

    // 2-second background auto-polling guarantees live updates without clicking refresh
    const pollTimer = setInterval(() => {
      void loadData()
    }, 2000)

    return () => {
      clearInterval(pollTimer)
      void supabase.removeChannel(channel)
    }
  }, [open, match.id, loadData])

  // Fallback active cricket match so modal always works even if cricketMatch row hasn't initialized
  const activeCricketMatch: CricketMatch = useMemo(() => {
    if (cricketMatch) return cricketMatch
    const teamAScore = liveMatch.score_data?.team_a_cricket
    const teamBScore = liveMatch.score_data?.team_b_cricket

    return {
      id: 'pending',
      match_id: liveMatch.id,
      overs_limit: typeof (liveMatch.score_data as any)?.overs === 'number' ? (liveMatch.score_data as any).overs : 20,
      toss_winner_team_id: liveMatch.score_data?.toss_winner_team_id ?? null,
      toss_decision: liveMatch.score_data?.toss_decision ?? null,
      current_innings: ((liveMatch.score_data as any)?.current_innings as 1 | 2) ?? 1,
      batting_first_team_id: liveMatch.team_a_id ?? null,
      striker_name: (liveMatch.score_data as any)?.striker_name ?? null,
      non_striker_name: (liveMatch.score_data as any)?.non_striker_name ?? null,
      bowler_name: (liveMatch.score_data as any)?.bowler_name ?? null,
      status: liveMatch.status === 'live' ? 'innings1' : liveMatch.status === 'completed' ? 'completed' : 'not_started',
      target_runs: null,
      innings1_runs: Number(teamAScore?.runs) || 0,
      innings1_wickets: Number(teamAScore?.wickets) || 0,
      innings1_legal_balls: 0,
      innings2_runs: Number(teamBScore?.runs) || 0,
      innings2_wickets: Number(teamBScore?.wickets) || 0,
      innings2_legal_balls: 0,
      winner_team_id: liveMatch.winner_team_id,
      result_summary: liveMatch.score_data?.result_summary ?? null,
      player_of_match: liveMatch.score_data?.player_of_match ?? null,
    }
  }, [cricketMatch, liveMatch])

  // Innings scorecards
  const scorecard1 = useMemo(() => {
    const sc = calculateCricketScorecard(deliveries, 1)
    // If no deliveries yet, fall back to score_data from sport_match
    if (sc.batting.length === 0 && liveMatch.score_data?.team_a_cricket) {
      const ta = liveMatch.score_data.team_a_cricket
      const runs = Number(ta.runs) || 0
      const wickets = Number(ta.wickets) || 0
      const oversStr = String(ta.overs || '0.0')
      const [ovPart, bPart] = oversStr.split('.').map(Number)
      const balls = (ovPart || 0) * 6 + (bPart || 0)
      const rr = balls > 0 ? Number(((runs / balls) * 6).toFixed(2)) : 0
      return {
        ...sc,
        totalRuns: runs,
        totalWickets: wickets,
        legalBalls: balls,
        oversFormatted: oversStr,
        runRate: rr,
      }
    }
    return sc
  }, [deliveries, liveMatch.score_data])

  const scorecard2 = useMemo(() => {
    const sc = calculateCricketScorecard(deliveries, 2)
    if (sc.batting.length === 0 && liveMatch.score_data?.team_b_cricket) {
      const tb = liveMatch.score_data.team_b_cricket
      const runs = Number(tb.runs) || 0
      const wickets = Number(tb.wickets) || 0
      const oversStr = String(tb.overs || '0.0')
      const [ovPart, bPart] = oversStr.split('.').map(Number)
      const balls = (ovPart || 0) * 6 + (bPart || 0)
      const rr = balls > 0 ? Number(((runs / balls) * 6).toFixed(2)) : 0
      return {
        ...sc,
        totalRuns: runs,
        totalWickets: wickets,
        legalBalls: balls,
        oversFormatted: oversStr,
        runRate: rr,
      }
    }
    return sc
  }, [deliveries, liveMatch.score_data])

  const currentInningsNum = activeCricketMatch.current_innings ?? 1
  const currentScorecard = currentInningsNum === 1 ? scorecard1 : scorecard2

  // Update selected scorecard innings on load
  useEffect(() => {
    setSelectedScorecardInnings(currentInningsNum)
  }, [currentInningsNum])

  const battingTeam = useMemo(() => {
    if (activeCricketMatch.current_innings === 1) {
      return activeCricketMatch.batting_first_team_id === teamA?.id ? teamA : teamB
    } else {
      return activeCricketMatch.batting_first_team_id === teamA?.id ? teamB : teamA
    }
  }, [activeCricketMatch, teamA, teamB])

  const bowlingTeam = useMemo(() => {
    return battingTeam?.id === teamA?.id ? teamB : teamA
  }, [battingTeam, teamA, teamB])

  // Innings teams
  const innings1Team = useMemo(() => {
    return activeCricketMatch.batting_first_team_id === teamA?.id ? teamA : teamB
  }, [activeCricketMatch, teamA, teamB])

  const innings2Team = useMemo(() => {
    return innings1Team?.id === teamA?.id ? teamB : teamA
  }, [innings1Team, teamA, teamB])

  // Current over number & deliveries in sequence
  const currentOverNumber = Math.floor(currentScorecard.legalBalls / 6)
  const currentOverDeliveries = useMemo(() => {
    return deliveries
      .filter(d => d.innings === currentInningsNum && d.over_number === currentOverNumber)
      .reverse() // show in chronological order
  }, [deliveries, currentInningsNum, currentOverNumber])

  // Calculate runs in current over
  const currentOverRuns = useMemo(() => {
    return currentOverDeliveries.reduce((sum, d) => sum + (d.runs_batter || 0) + (d.extra_runs || (d.is_extra ? 1 : 0)), 0)
  }, [currentOverDeliveries])

  // Partnership & Last Wicket stats
  const partnership = useMemo(() => {
    const innDeliveries = deliveries
      .filter(d => d.innings === currentInningsNum)
      .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime())

    // find last wicket delivery index
    let lastWktIdx = -1
    for (let i = innDeliveries.length - 1; i >= 0; i--) {
      if (innDeliveries[i].is_wicket) {
        lastWktIdx = i
        break
      }
    }

    const partDels = innDeliveries.slice(lastWktIdx + 1)
    const runs = partDels.reduce(
      (sum, d) => sum + (d.runs_batter || 0) + (d.extra_runs || (d.is_extra ? 1 : 0)),
      0
    )
    const balls = partDels.filter(d => !d.is_extra || (d.extra_type !== 'wide' && d.extra_type !== 'no_ball')).length

    return { runs, balls }
  }, [deliveries, currentInningsNum])

  const lastWicket = useMemo(() => {
    if (currentScorecard.fallOfWickets.length > 0) {
      return currentScorecard.fallOfWickets[currentScorecard.fallOfWickets.length - 1]
    }
    return null
  }, [currentScorecard])

  // Active batter stats
  const strikerName = activeCricketMatch.striker_name || (currentScorecard.batting.find(b => b.isNotOut)?.name ?? 'Batter')
  const strikerStats = currentScorecard.batting.find(b => b.name === strikerName)

  // Non-striker / second batter
  const otherNotOut = currentScorecard.batting.find(b => b.isNotOut && b.name !== strikerName)
  const nonStrikerName = activeCricketMatch.non_striker_name || otherNotOut?.name || 'Partner'
  const nonStrikerStats = otherNotOut || currentScorecard.batting.find(b => b.name === nonStrikerName)

  // Active bowler
  const bowlerName = activeCricketMatch.bowler_name || (currentScorecard.bowling[0]?.name ?? 'Bowler')
  const bowlerStats = currentScorecard.bowling.find(b => b.name === bowlerName)

  // Required Run Rate & Target info
  const targetRuns = activeCricketMatch.target_runs || (scorecard1.totalRuns ? scorecard1.totalRuns + 1 : null)
  const isSecondInnings = activeCricketMatch.current_innings === 2
  const runsNeeded = targetRuns ? Math.max(0, targetRuns - currentScorecard.totalRuns) : 0
  const ballsRemaining = Math.max(0, (activeCricketMatch.overs_limit || 20) * 6 - currentScorecard.legalBalls)
  const requiredRunRate = ballsRemaining > 0 ? Number(((runsNeeded / ballsRemaining) * 6).toFixed(2)) : 0

  // Win probability calculation
  const winProbability = useMemo(() => {
    if (!teamA || !teamB) return { teamA: 50, teamB: 50 }
    if (liveMatch.winner_team_id) {
      return {
        teamA: liveMatch.winner_team_id === teamA.id ? 100 : 0,
        teamB: liveMatch.winner_team_id === teamB.id ? 100 : 0,
      }
    }
    if (!isSecondInnings) {
      // Innings 1 estimate based on CRR
      const crr = Number(currentScorecard.runRate) || 6.0
      const wktsDown = currentScorecard.totalWickets
      let prob = 50 + (crr - 7.5) * 4 - wktsDown * 4
      prob = Math.max(10, Math.min(90, Math.round(prob)))
      return battingTeam?.id === teamA.id ? { teamA: prob, teamB: 100 - prob } : { teamA: 100 - prob, teamB: prob }
    } else {
      // Innings 2 estimate based on RRR vs CRR and balls left
      if (runsNeeded <= 0) {
        return battingTeam?.id === teamA.id ? { teamA: 100, teamB: 0 } : { teamA: 0, teamB: 100 }
      }
      if (currentScorecard.totalWickets >= 10 || ballsRemaining <= 0) {
        return bowlingTeam?.id === teamA.id ? { teamA: 100, teamB: 0 } : { teamA: 0, teamB: 100 }
      }
      const rrr = requiredRunRate
      const crr = Number(currentScorecard.runRate) || 6.0
      let chaseProb = 50 - (rrr - crr) * 8 - currentScorecard.totalWickets * 3
      chaseProb = Math.max(1, Math.min(99, Math.round(chaseProb)))
      return battingTeam?.id === teamA.id
        ? { teamA: chaseProb, teamB: 100 - chaseProb }
        : { teamA: 100 - chaseProb, teamB: chaseProb }
    }
  }, [teamA, teamB, liveMatch.winner_team_id, isSecondInnings, currentScorecard, battingTeam, bowlingTeam, runsNeeded, ballsRemaining, requiredRunRate])

  // Projected score at current RR
  const projectedScore = useMemo(() => {
    const oversLimit = activeCricketMatch.overs_limit || 20
    const rr = Number(currentScorecard.runRate) || 6.0
    return Math.round(rr * oversLimit)
  }, [activeCricketMatch.overs_limit, currentScorecard.runRate])

  // Active scorecard for 'Scorecard' tab
  const displayedScorecard = selectedScorecardInnings === 1 ? scorecard1 : scorecard2
  const displayedTeam = selectedScorecardInnings === 1 ? innings1Team : innings2Team
  const displayedBowlingTeam = selectedScorecardInnings === 1 ? innings2Team : innings1Team

  // "YET TO BAT" squad list
  const yetToBatPlayers = useMemo(() => {
    const rawRoster = displayedTeam?.team_members ?? []
    const battedNames = new Set(displayedScorecard.batting.map(b => b.name.toLowerCase().trim()))
    return rawRoster.filter(m => !battedNames.has(m.name.toLowerCase().trim()))
  }, [displayedTeam, displayedScorecard.batting])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${liveMatch.round_name || 'Match'} · Match #${liveMatch.match_number}`}
      wide
    >
      {loading ? (
        <div className="py-12 text-center">
          <Spinner />
          <p className="mt-2 text-sm text-bark-soft">Loading live cricket scorecard...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ========================================================= */}
          {/* 1. HERO HEADER (CRICBUZZ MODERN NAVY THEME - IMAGE 2)      */}
          {/* ========================================================= */}
          <div className="rounded-3xl bg-[#0B1E36] p-5 text-white shadow-xl border border-slate-800">
            {/* Top row: Match subtitle & real-time badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium truncate max-w-xs sm:max-w-md">
                  {teamA?.name ?? 'Team A'} vs {teamB?.name ?? 'Team B'}, {liveMatch.round_name} · Match #{liveMatch.match_number}
                </span>
                {liveMatch.status === 'live' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-white" />
                    LIVE
                  </span>
                ) : liveMatch.status === 'completed' ? (
                  <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold uppercase text-white">
                    Final
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    Scheduled
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {/* Auto-updating live badge */}
                <div
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300"
                  title="Scores update automatically without clicking refresh"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Live Auto-Sync</span>
                </div>

                {/* Instant Sync Button */}
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() => void handleManualRefresh()}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200 hover:bg-white/20 active:scale-95 transition cursor-pointer"
                  title="Sync latest ball immediately"
                >
                  <RotateCw className={`h-3 w-3 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
                  <span className="hidden sm:inline">{refreshing ? 'Syncing...' : 'Sync'}</span>
                </button>
              </div>
            </div>

            {/* Middle Main Row: Big Cricbuzz Score Display */}
            <div className="my-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {/* Team emblem flag circle */}
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white font-bold text-lg shadow-lg ring-2 ring-white/20"
                  style={{
                    backgroundColor: battingTeam?.colour || '#0284c7',
                  }}
                >
                  {battingTeam?.name?.slice(0, 2).toUpperCase() || '🏏'}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-sans text-xl sm:text-2xl font-black text-white">
                      {battingTeam?.name ?? 'Batting Team'}
                    </h3>
                    <span className="rounded-md bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                      Inn {currentInningsNum}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2.5 mt-0.5">
                    <span className="font-sans text-4xl sm:text-5xl font-black tracking-tight text-[#2dd4bf]">
                      {currentScorecard.totalRuns}-{currentScorecard.totalWickets}
                    </span>
                    <span className="text-xl sm:text-2xl font-semibold text-slate-300">
                      {currentScorecard.oversFormatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rates and Equation (Image 2) */}
              <div className="text-right ml-auto">
                <div className="flex items-center justify-end gap-4 text-xs font-semibold text-slate-300">
                  <span>
                    CRR : <strong className="text-white text-sm">{currentScorecard.runRate}</strong>
                  </span>
                  {isSecondInnings && (
                    <span>
                      RRR : <strong className="text-amber-400 text-sm">{requiredRunRate}</strong>
                    </span>
                  )}
                </div>

                {/* Chase equation or Projected score in bold amber (Image 2) */}
                <div className="mt-1">
                  {isSecondInnings && targetRuns ? (
                    <p className="text-sm font-bold text-[#fbbf24]">
                      {battingTeam?.name} need {runsNeeded} runs in {ballsRemaining} balls
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-slate-300">
                      {activeCricketMatch.overs_limit} Overs Match · Projected: <strong className="text-white">{projectedScore}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Toss note & Match result if finished */}
            <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              {activeCricketMatch.toss_winner_team_id ? (
                <span>
                  🪙 {(activeCricketMatch.toss_winner_team_id === teamA?.id ? teamA?.name : teamB?.name) ?? 'Team'}{' '}
                  chose to {activeCricketMatch.toss_decision ?? 'bat'}
                </span>
              ) : (
                <span>Match venue: {liveMatch.venue || 'Main Pitch'}</span>
              )}

              {activeCricketMatch.result_summary && (
                <span className="font-bold text-amber-400">
                  🏆 {activeCricketMatch.result_summary}
                </span>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. SUB-NAVIGATION TABS (IMAGE 2 & 3 STYLE)                  */}
          {/* ========================================================= */}
          <div className="flex items-center gap-1 border-b border-sand pb-1 text-sm overflow-x-auto">
            {[
              { id: 'info', label: 'Match info' },
              { id: 'live', label: 'Live' },
              { id: 'scorecard', label: 'Scorecard' },
              { id: 'charts', label: 'Manhattan & Worm' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative px-4 py-2 font-bold transition text-xs sm:text-sm cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-bark'
                    : 'text-bark-soft hover:text-bark'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-red-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* ========================================================= */}
          {/* 3. TAB CONTENT: LIVE (IMAGE 2)                             */}
          {/* ========================================================= */}
          {activeTab === 'live' && (
            <div className="grid gap-4 lg:grid-cols-12 items-start">
              {/* LEFT 7/12: On-Field Active Players & Recent Overs Bar */}
              <div className="lg:col-span-7 space-y-4">
                {/* On-Field Active Cards (Batter 1, Batter 2, Bowler) */}
                <div className="rounded-3xl border border-sand bg-white p-4 shadow-soft">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {/* Striker Batter */}
                    <div className="rounded-2xl border border-sand/70 bg-cream/30 p-3 flex flex-col justify-between">
                      <div className="flex items-start gap-2.5">
                        <PlayerAvatar name={strikerName} colour={battingTeam?.colour} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-bark text-xs truncate" title={strikerName}>
                              {strikerName}
                            </span>
                            <span title="On Strike" className="text-xs">🏏</span>
                          </div>
                          <div className="mt-0.5 flex items-baseline gap-1">
                            <span className="font-serif text-lg font-black text-terracotta-deep">
                              {strikerStats?.runs ?? 0}
                            </span>
                            <span className="text-xs text-bark-soft">
                              ({strikerStats?.balls ?? 0})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-sand/40 flex items-center justify-between text-[10px] text-bark-soft">
                        <span>4s: <strong>{strikerStats?.fours ?? 0}</strong></span>
                        <span>6s: <strong>{strikerStats?.sixes ?? 0}</strong></span>
                        <span>SR: <strong>{strikerStats?.strikeRate ?? 0}</strong></span>
                      </div>
                    </div>

                    {/* Non-Striker / Partner */}
                    <div className="rounded-2xl border border-sand/70 bg-white p-3 flex flex-col justify-between">
                      <div className="flex items-start gap-2.5">
                        <PlayerAvatar name={nonStrikerName} colour={battingTeam?.colour} />
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-bark text-xs truncate block" title={nonStrikerName}>
                            {nonStrikerName}
                          </span>
                          <div className="mt-0.5 flex items-baseline gap-1">
                            <span className="font-serif text-lg font-black text-bark">
                              {nonStrikerStats?.runs ?? 0}
                            </span>
                            <span className="text-xs text-bark-soft">
                              ({nonStrikerStats?.balls ?? 0})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-sand/40 flex items-center justify-between text-[10px] text-bark-soft">
                        <span>4s: <strong>{nonStrikerStats?.fours ?? 0}</strong></span>
                        <span>6s: <strong>{nonStrikerStats?.sixes ?? 0}</strong></span>
                        <span>SR: <strong>{nonStrikerStats?.strikeRate ?? 0}</strong></span>
                      </div>
                    </div>

                    {/* Current Bowler */}
                    <div className="rounded-2xl border border-sand/70 bg-cream/30 p-3 flex flex-col justify-between">
                      <div className="flex items-start gap-2.5">
                        <PlayerAvatar name={bowlerName} colour={bowlingTeam?.colour} isBowler />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-bark text-xs truncate" title={bowlerName}>
                              {bowlerName}
                            </span>
                            <span title="Bowling" className="text-xs">⚾</span>
                          </div>
                          <div className="mt-0.5 flex items-baseline gap-1">
                            <span className="font-serif text-lg font-black text-terracotta-deep">
                              {bowlerStats ? `${bowlerStats.wickets}-${bowlerStats.runs}` : '0-0'}
                            </span>
                            <span className="text-xs text-bark-soft">
                              ({bowlerStats?.overs ?? '0.0'})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-sand/40 flex items-center justify-between text-[10px] text-bark-soft">
                        <span>M: <strong>{bowlerStats?.maidens ?? 0}</strong></span>
                        <span>Dots: <strong>{bowlerStats?.dots ?? 0}</strong></span>
                        <span>Econ: <strong>{bowlerStats?.economy ?? 0}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Partnership & Last Wicket line (Image 2) */}
                  <div className="mt-3 pt-3 border-t border-sand/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-bark">
                      P'ship : <strong>{partnership.runs}({partnership.balls})</strong>
                    </span>
                    <span className="text-bark-soft">
                      Last Wkt :{' '}
                      <strong className="text-terracotta-deep">
                        {lastWicket ? `${lastWicket.player} (${lastWicket.score}/${lastWicket.wickets}, ${lastWicket.overs} ov)` : 'None'}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* RECENT OVERS BAR (IMAGE 2) */}
                <div className="rounded-2xl border border-sand bg-white p-3.5 shadow-soft">
                  <div className="flex items-center gap-3 overflow-x-auto py-1">
                    <span className="font-bold text-xs text-bark whitespace-nowrap">
                      Over {currentOverNumber + 1}
                    </span>

                    <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                      {currentOverDeliveries.length === 0 ? (
                        <span className="text-xs text-bark-faint italic">Over starting...</span>
                      ) : (
                        currentOverDeliveries.map(b => {
                          const badge = formatBallBadge(b)
                          return (
                            <span
                              key={b.id}
                              className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-xs font-bold shadow-xs ${badge.bgClass}`}
                            >
                              {badge.text}
                            </span>
                          )
                        })
                      )}
                    </div>

                    <div className="text-xs font-bold text-bark whitespace-nowrap border-l border-sand/60 pl-3">
                      = {currentOverRuns}
                    </div>
                  </div>
                </div>

                {/* Ball-by-ball commentary feed */}
                <div className="rounded-3xl border border-sand bg-white p-4 shadow-soft space-y-3">
                  <h4 className="font-serif text-sm font-bold text-bark flex items-center justify-between">
                    <span>Recent Deliveries & Commentary</span>
                    <span className="text-xs font-sans text-bark-soft font-normal">
                      {deliveries.length} ball{deliveries.length === 1 ? '' : 's'} recorded
                    </span>
                  </h4>

                  {!deliveries.length ? (
                    <p className="text-xs text-bark-soft italic py-6 text-center">
                      No balls bowled yet in this match. Ball-by-ball commentary will appear here live!
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {deliveries.slice(0, 30).map(b => {
                        const badge = formatBallBadge(b)
                        return (
                          <div
                            key={b.id}
                            className={`flex items-start gap-3 rounded-2xl border p-2.5 text-xs transition ${
                              b.is_wicket
                                ? 'border-red-300 bg-red-50/60'
                                : b.runs_batter >= 4
                                ? 'border-blue-200 bg-blue-50/40'
                                : 'border-sand/60 bg-cream/30'
                            }`}
                          >
                            <span
                              className={`mt-0.5 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-bold ${badge.bgClass}`}
                            >
                              {badge.text}
                            </span>

                            <div className="flex-1">
                              <div className="flex items-center justify-between text-bark-soft">
                                <span className="font-bold text-bark">
                                  Over {b.over_number}.{b.ball_in_over} · {b.bowler_name} to {b.striker_name}
                                </span>
                                <span className="text-[10px]">Inn {b.innings}</span>
                              </div>
                              {b.commentary && <p className="mt-0.5 text-bark">{b.commentary}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT 5/12: Win Probability & Projection (Image 2) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Win Probability Card (Image 2) */}
                <div className="rounded-3xl border border-sand bg-white p-4 shadow-soft space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif text-base font-bold text-bark flex items-center gap-1.5">
                      <span>Probability</span>
                    </h4>

                    {/* % View vs Number View toggle */}
                    <div className="flex rounded-lg border border-sand bg-cream/50 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setProbViewMode('% View')}
                        className={`rounded-md px-2.5 py-0.5 font-semibold transition ${
                          probViewMode === '% View'
                            ? 'bg-white shadow-xs text-bark'
                            : 'text-bark-soft hover:text-bark'
                        }`}
                      >
                        % View
                      </button>
                      <button
                        type="button"
                        onClick={() => setProbViewMode('Number View')}
                        className={`rounded-md px-2.5 py-0.5 font-semibold transition ${
                          probViewMode === 'Number View'
                            ? 'bg-white shadow-xs text-bark'
                            : 'text-bark-soft hover:text-bark'
                        }`}
                      >
                        Number View
                      </button>
                    </div>
                  </div>

                  {/* Team split probabilities */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-bark">
                      <span className="flex items-center gap-1.5">
                        <ColourDot colour={teamA?.colour} />
                        {teamA?.name ?? 'Team A'}
                      </span>
                      <span className="font-serif text-sm">
                        {probViewMode === '% View' ? `${winProbability.teamA}%` : `${winProbability.teamA}`}
                      </span>
                    </div>

                    {/* Visual meter bar */}
                    <div className="h-2.5 w-full rounded-full bg-sand/40 overflow-hidden flex">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${winProbability.teamA}%`,
                          backgroundColor: teamA?.colour || '#0284c7',
                        }}
                      />
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${winProbability.teamB}%`,
                          backgroundColor: teamB?.colour || '#dc2626',
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-bark">
                      <span className="flex items-center gap-1.5">
                        <ColourDot colour={teamB?.colour} />
                        {teamB?.name ?? 'Team B'}
                      </span>
                      <span className="font-serif text-sm">
                        {probViewMode === '% View' ? `${winProbability.teamB}%` : `${winProbability.teamB}`}
                      </span>
                    </div>
                  </div>

                  {/* Score Projection section */}
                  <div className="pt-3 border-t border-sand/60">
                    <p className="text-xs font-bold uppercase tracking-wider text-bark-soft mb-2">
                      Score Projection
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl border border-sand bg-cream/40 p-2">
                        <p className="text-[10px] text-bark-soft uppercase">At CRR</p>
                        <p className="font-serif text-base font-bold text-bark">{projectedScore}</p>
                      </div>
                      <div className="rounded-xl border border-sand bg-cream/40 p-2">
                        <p className="text-[10px] text-bark-soft uppercase">@ 8 RPO</p>
                        <p className="font-serif text-base font-bold text-bark">
                          {Math.round(8 * (activeCricketMatch.overs_limit || 20))}
                        </p>
                      </div>
                      <div className="rounded-xl border border-sand bg-cream/40 p-2">
                        <p className="text-[10px] text-bark-soft uppercase">@ 10 RPO</p>
                        <p className="font-serif text-base font-bold text-bark">
                          {Math.round(10 * (activeCricketMatch.overs_limit || 20))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Match Situation / Context */}
                <div className="rounded-3xl border border-sand bg-cream/30 p-4 shadow-soft space-y-2 text-xs">
                  <h4 className="font-serif text-sm font-bold text-bark">Match Situation</h4>
                  <p className="text-bark-soft">
                    {isSecondInnings
                      ? `${battingTeam?.name} require ${runsNeeded} runs in ${ballsRemaining} balls to win with ${10 - currentScorecard.totalWickets} wickets in hand.`
                      : `${battingTeam?.name} are batting in 1st innings (${currentScorecard.totalRuns}/${currentScorecard.totalWickets} in ${currentScorecard.oversFormatted} ov).`}
                  </p>
                  {activeCricketMatch.overs_limit && (
                    <p className="text-[11px] text-bark-faint">
                      Format: {activeCricketMatch.overs_limit} overs match · Legal balls bowled: {currentScorecard.legalBalls}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. TAB CONTENT: SCORECARD (IMAGE 3)                        */}
          {/* ========================================================= */}
          {activeTab === 'scorecard' && (
            <div className="space-y-4">
              {/* TOP INNINGS TOGGLE BUTTONS (IMAGE 3 STYLE) */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedScorecardInnings(1)}
                  className={`flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer ${
                    selectedScorecardInnings === 1
                      ? 'border-sky-500 bg-white ring-2 ring-sky-500/30 text-bark'
                      : 'border-sand bg-cream/50 text-bark-soft hover:bg-white'
                  }`}
                >
                  <ColourDot colour={innings1Team?.colour} />
                  <span>{innings1Team?.name ?? 'Team A'}</span>
                  <span className="font-serif font-black text-terracotta-deep">
                    {scorecard1.totalRuns}-{scorecard1.totalWickets}
                  </span>
                  <span className="text-bark-soft font-normal">
                    ({scorecard1.oversFormatted})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedScorecardInnings(2)}
                  className={`flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer ${
                    selectedScorecardInnings === 2
                      ? 'border-sky-500 bg-white ring-2 ring-sky-500/30 text-bark'
                      : 'border-sand bg-cream/50 text-bark-soft hover:bg-white'
                  }`}
                >
                  <ColourDot colour={innings2Team?.colour} />
                  <span>{innings2Team?.name ?? 'Team B'}</span>
                  <span className="font-serif font-black text-terracotta-deep">
                    {scorecard2.totalRuns}-{scorecard2.totalWickets}
                  </span>
                  <span className="text-bark-soft font-normal">
                    ({scorecard2.oversFormatted})
                  </span>
                </button>
              </div>

              {/* SCORECARD SPLIT: BATTING & BOWLING (LEFT 8/12), YET TO BAT (RIGHT 4/12) */}
              <div className="grid gap-4 lg:grid-cols-12 items-start">
                <div className="lg:col-span-8 space-y-5">
                  {/* BATTING TABLE (IMAGE 3) */}
                  <div className="rounded-3xl border border-sand bg-white p-4 shadow-soft">
                    <h3 className="font-sans text-base font-black uppercase tracking-wider text-bark mb-3">
                      BATTING
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-sand bg-cream/40 text-[11px] font-semibold text-bark-soft">
                          <tr>
                            <th className="px-3 py-2.5">Batter</th>
                            <th className="px-2 py-2.5"></th>
                            <th className="px-3 py-2.5 text-right font-bold">R</th>
                            <th className="px-3 py-2.5 text-right">B</th>
                            <th className="px-3 py-2.5 text-right">4s</th>
                            <th className="px-3 py-2.5 text-right">6s</th>
                            <th className="px-3 py-2.5 text-right">SR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sand/40">
                          {!displayedScorecard.batting.length ? (
                            <tr>
                              <td colSpan={7} className="px-3 py-4 text-center text-bark-soft italic">
                                No batting records entered for Innings {selectedScorecardInnings} yet.
                              </td>
                            </tr>
                          ) : (
                            displayedScorecard.batting.map(b => (
                              <tr key={b.name} className="hover:bg-cream/20 transition">
                                <td className="px-3 py-2.5 font-bold text-bark">
                                  <span>{b.name}</span>
                                  {b.isNotOut && <span className="text-terracotta-deep ml-0.5">*</span>}
                                </td>
                                <td className="px-2 py-2.5 text-bark-soft text-[11px]">
                                  {b.dismissal}
                                </td>
                                <td className="px-3 py-2.5 text-right font-black text-bark text-sm">
                                  {b.runs}
                                </td>
                                <td className="px-3 py-2.5 text-right text-bark-soft">{b.balls}</td>
                                <td className="px-3 py-2.5 text-right text-bark">{b.fours}</td>
                                <td className="px-3 py-2.5 text-right text-bark">{b.sixes}</td>
                                <td className="px-3 py-2.5 text-right text-bark-soft">{b.strikeRate}</td>
                              </tr>
                            ))
                          )}

                          {/* Extras row */}
                          <tr className="bg-sand/15 text-bark">
                            <td className="px-3 py-2 font-semibold">Extras</td>
                            <td colSpan={6} className="px-3 py-2 text-right text-bark-soft">
                              <strong>{displayedScorecard.extras.total}</strong> (b {displayedScorecard.extras.byes}, lb {displayedScorecard.extras.legByes}, w {displayedScorecard.extras.wides}, nb {displayedScorecard.extras.noBalls})
                            </td>
                          </tr>

                          {/* Total row */}
                          <tr className="bg-sand/30 font-bold text-bark border-t border-sand">
                            <td className="px-3 py-2.5">Total</td>
                            <td colSpan={6} className="px-3 py-2.5 text-right">
                              <span className="font-serif text-base font-black text-terracotta-deep">
                                {displayedScorecard.totalRuns}/{displayedScorecard.totalWickets}
                              </span>
                              <span className="text-xs text-bark-soft ml-2">
                                ({displayedScorecard.oversFormatted} Overs, RR: {displayedScorecard.runRate})
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* BOWLING TABLE */}
                  <div className="rounded-3xl border border-sand bg-white p-4 shadow-soft">
                    <h3 className="font-sans text-base font-black uppercase tracking-wider text-bark mb-3">
                      BOWLING
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-sand bg-cream/40 text-[11px] font-semibold text-bark-soft">
                          <tr>
                            <th className="px-3 py-2.5">Bowler</th>
                            <th className="px-3 py-2.5 text-right">O</th>
                            <th className="px-3 py-2.5 text-right">M</th>
                            <th className="px-3 py-2.5 text-right">R</th>
                            <th className="px-3 py-2.5 text-right font-bold">W</th>
                            <th className="px-3 py-2.5 text-right">Econ</th>
                            <th className="px-3 py-2.5 text-right">0s</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sand/40">
                          {!displayedScorecard.bowling.length ? (
                            <tr>
                              <td colSpan={7} className="px-3 py-4 text-center text-bark-soft italic">
                                No bowling figures recorded for this innings yet.
                              </td>
                            </tr>
                          ) : (
                            displayedScorecard.bowling.map(b => (
                              <tr key={b.name} className="hover:bg-cream/20 transition">
                                <td className="px-3 py-2.5 font-bold text-bark">{b.name}</td>
                                <td className="px-3 py-2.5 text-right text-bark">{b.overs}</td>
                                <td className="px-3 py-2.5 text-right text-bark-soft">{b.maidens}</td>
                                <td className="px-3 py-2.5 text-right text-bark">{b.runs}</td>
                                <td className="px-3 py-2.5 text-right font-black text-terracotta-deep text-sm">
                                  {b.wickets}
                                </td>
                                <td className="px-3 py-2.5 text-right text-bark-soft">{b.economy}</td>
                                <td className="px-3 py-2.5 text-right text-bark-soft">{b.dots}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Fall of Wickets */}
                  {displayedScorecard.fallOfWickets.length > 0 && (
                    <div className="rounded-3xl border border-sand bg-white p-4 shadow-soft">
                      <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-bark mb-2">
                        Fall of Wickets
                      </h4>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {displayedScorecard.fallOfWickets.map((f, i) => (
                          <span key={i} className="rounded-full bg-sand/30 border border-sand px-3 py-1 text-bark">
                            <strong>{f.score}/{f.wickets}</strong> ({f.player}, {f.overs} ov)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT 4/12: YET TO BAT (IMAGE 3) */}
                <div className="lg:col-span-4 rounded-3xl border border-sand bg-white p-4 shadow-soft space-y-3">
                  <h3 className="font-sans text-base font-black uppercase tracking-wider text-bark">
                    YET TO BAT
                  </h3>

                  {!yetToBatPlayers.length ? (
                    <p className="text-xs text-bark-soft italic py-4">
                      All squad members have batted or squad roster is pending.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {yetToBatPlayers.map(p => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 rounded-2xl border border-sand/60 bg-cream/20 p-2.5 hover:bg-cream/40 transition"
                        >
                          <PlayerAvatar name={p.name} colour={displayedTeam?.colour} />
                          <div>
                            <p className="font-bold text-xs text-bark">{p.name}</p>
                            <p className="text-[10px] text-bark-soft">Avg: —</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. TAB CONTENT: CHARTS (MANHATTAN & WORM)                  */}
          {/* ========================================================= */}
          {activeTab === 'charts' && (
            <CricketChartsAndAnalytics
              match={liveMatch}
              cricketMatch={activeCricketMatch}
              deliveries={deliveries}
              teamA={teamA}
              teamB={teamB}
            />
          )}

          {/* ========================================================= */}
          {/* 6. TAB CONTENT: MATCH INFO                                 */}
          {/* ========================================================= */}
          {activeTab === 'info' && (
            <div className="rounded-3xl border border-sand bg-white p-5 space-y-4 text-xs shadow-soft">
              <h4 className="font-serif text-base font-bold text-bark">Tournament & Match Info</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-sand/60 p-3 bg-cream/30">
                  <span className="text-bark-soft block text-[11px] uppercase">Match Fixture</span>
                  <p className="font-bold text-bark mt-1">
                    Match #{liveMatch.match_number} ({liveMatch.round_name})
                  </p>
                </div>
                <div className="rounded-2xl border border-sand/60 p-3 bg-cream/30">
                  <span className="text-bark-soft block text-[11px] uppercase">Overs Limit</span>
                  <p className="font-bold text-bark mt-1">
                    {activeCricketMatch.overs_limit} overs per side
                  </p>
                </div>
                <div className="rounded-2xl border border-sand/60 p-3 bg-cream/30">
                  <span className="text-bark-soft block text-[11px] uppercase">Toss Details</span>
                  <p className="font-bold text-bark mt-1">
                    {(activeCricketMatch.toss_winner_team_id === teamA?.id ? teamA?.name : teamB?.name) ?? '—'}{' '}
                    (elected to {activeCricketMatch.toss_decision ?? '—'})
                  </p>
                </div>
                <div className="rounded-2xl border border-sand/60 p-3 bg-cream/30">
                  <span className="text-bark-soft block text-[11px] uppercase">Venue / Date</span>
                  <p className="font-bold text-bark mt-1">
                    {liveMatch.venue || 'Main Ground'} · {liveMatch.scheduled_date || 'TBD'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
