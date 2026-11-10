import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Trophy,
  Activity,
  Calendar,
  MapPin,
  Clock,
  ExternalLink,
  ChevronRight,
  Shield,
  Volume2,
  RotateCw,
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
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [liveMatch, setLiveMatch] = useState<SportMatch>(match)
  const [cricketMatch, setCricketMatch] = useState<CricketMatch | null>(null)
  const [deliveries, setDeliveries] = useState<CricketDelivery[]>([])
  const [activeTab, setActiveTab] = useState<'live' | 'inngs1' | 'inngs2' | 'charts' | 'info'>('live')

  // Load cricket data
  const loadData = useCallback(async () => {
    try {
      // 1. Fetch latest sport_match to catch status changes
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

  // Innings scorecards
  const scorecard1 = useMemo(() => {
    return calculateCricketScorecard(deliveries, 1)
  }, [deliveries])

  const scorecard2 = useMemo(() => {
    return calculateCricketScorecard(deliveries, 2)
  }, [deliveries])

  const currentInningsNum = cricketMatch?.current_innings ?? 1
  const currentScorecard = currentInningsNum === 1 ? scorecard1 : scorecard2

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

  const currentOverNumber = Math.floor(currentScorecard.legalBalls / 6)
  const currentOverDeliveries = useMemo(() => {
    return deliveries
      .filter(d => d.innings === currentInningsNum && d.over_number === currentOverNumber)
      .reverse() // show in delivery sequence
  }, [deliveries, currentInningsNum, currentOverNumber])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${match.round_name} · Match #${match.match_number}`}
      wide
    >
      {loading ? (
        <div className="py-12 text-center">
          <Spinner />
          <p className="mt-2 text-sm text-bark-soft">Loading live cricket scorecard...</p>
        </div>
      ) : !cricketMatch ? (
        <div className="space-y-5 p-2">
          {/* Match preview hero */}
          <div className="rounded-3xl bg-gradient-to-br from-bark to-bark-deep p-6 text-ivory text-center space-y-3 shadow-md">
            <div className="flex items-center justify-center gap-2">
              <span className="rounded-full bg-sand/30 px-3 py-1 text-xs font-semibold text-ivory">
                {liveMatch.round_name} · Match #{liveMatch.match_number}
              </span>
              <span className="rounded-full bg-sand/20 px-2.5 py-1 text-xs text-sand">
                {liveMatch.status === 'live' ? '🔴 Live' : liveMatch.status === 'completed' ? 'Final' : '⏳ Scheduled'}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 py-2 font-serif text-2xl font-bold">
              <div className="flex items-center gap-2">
                <ColourDot colour={teamA?.colour} />
                <span>{teamA?.name ?? 'Team A'}</span>
              </div>
              <span className="text-sand/50 text-base font-normal">vs</span>
              <div className="flex items-center gap-2">
                <ColourDot colour={teamB?.colour} />
                <span>{teamB?.name ?? 'Team B'}</span>
              </div>
            </div>

            {(liveMatch.scheduled_date || liveMatch.scheduled_time || liveMatch.venue) && (
              <p className="text-xs text-sand/80">
                {liveMatch.venue || 'Main Ground'} {liveMatch.scheduled_date && `· ${liveMatch.scheduled_date}`} {liveMatch.scheduled_time && `at ${liveMatch.scheduled_time}`}
              </p>
            )}

            {/* Quick score summary if exists */}
            {(liveMatch.score_data?.team_a_cricket || liveMatch.score_data?.team_b_cricket) && (
              <div className="mt-3 rounded-2xl bg-white/10 p-3 text-xs max-w-sm mx-auto flex justify-around">
                <div>
                  <span className="text-sand/70 block">{teamA?.name}</span>
                  <span className="font-serif text-lg font-bold">
                    {liveMatch.score_data.team_a_cricket?.runs ?? 0}/{liveMatch.score_data.team_a_cricket?.wickets ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-sand/70 block">{teamB?.name}</span>
                  <span className="font-serif text-lg font-bold">
                    {liveMatch.score_data.team_b_cricket?.runs ?? 0}/{liveMatch.score_data.team_b_cricket?.wickets ?? 0}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-sand bg-cream/40 p-6 text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
              <span>Listening for live match start...</span>
            </div>
            <p className="text-sm font-semibold text-bark">
              Ball-by-ball commentary, active batter and bowler figures will stream here automatically without refreshing as soon as the scorer starts the match!
            </p>
            <p className="text-xs text-bark-faint">
              Auto-syncing every 2 seconds in real time · No refresh needed
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* LIVE HEADER HERO */}
          <div className="rounded-3xl bg-gradient-to-br from-bark to-bark-deep p-5 text-ivory shadow-lg">
            {/* Top row status */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bark-soft/40 pb-3">
              <div className="flex items-center gap-2">
                {liveMatch.status === 'live' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-white" />
                    LIVE · INNINGS {cricketMatch.current_innings}
                  </span>
                ) : liveMatch.status === 'completed' ? (
                  <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold uppercase text-white">
                    Match Completed
                  </span>
                ) : (
                  <span className="rounded-full bg-sand/30 px-3 py-1 text-xs font-medium text-ivory">
                    Scheduled
                  </span>
                )}
                <span className="text-xs text-sand/80">
                  {cricketMatch.overs_limit} Overs Match
                </span>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {cricketMatch.toss_winner_team_id && (
                  <span className="text-xs text-sand hidden md:inline">
                    🪙 {(cricketMatch.toss_winner_team_id === teamA?.id ? teamA?.name : teamB?.name) ?? 'Toss winner'} chose to {cricketMatch.toss_decision}
                  </span>
                )}

                {/* AUTO-UPDATING LIVE BADGE */}
                <div
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-xs font-semibold text-emerald-300"
                  title="Scores automatically update live in real time without clicking refresh"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Live Auto-Sync</span>
                </div>

                {/* Optional instant sync button */}
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() => void handleManualRefresh()}
                  className="inline-flex items-center gap-1 rounded-full border border-sand/30 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-sand hover:bg-white/20 active:scale-95 transition shadow-xs cursor-pointer"
                  title="Force instant sync (scores also update automatically)"
                >
                  <RotateCw className={`h-3 w-3 ${refreshing ? 'animate-spin text-saffron' : ''}`} />
                  <span className="hidden sm:inline">{refreshing ? 'Syncing...' : 'Sync'}</span>
                </button>
              </div>
            </div>

            {/* Big Score Display */}
            <div className="my-4 flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-sand">Batting: {battingTeam?.name}</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="font-serif text-5xl font-black text-white">
                    {currentScorecard.totalRuns} / {currentScorecard.totalWickets}
                  </span>
                  <span className="text-xl text-sand">
                    ({currentScorecard.oversFormatted} ov)
                  </span>
                </div>
              </div>

              <div className="flex gap-4 text-right">
                <div>
                  <p className="text-[11px] text-sand/70 uppercase">CRR</p>
                  <p className="text-xl font-bold text-saffron">{currentScorecard.runRate}</p>
                </div>
                {cricketMatch.current_innings === 2 && cricketMatch.target_runs && (
                  <div>
                    <p className="text-[11px] text-sand/70 uppercase">Target</p>
                    <p className="text-xl font-bold text-emerald-400">
                      {cricketMatch.target_runs}
                      <span className="text-xs text-sand ml-1 block">
                        need {Math.max(0, cricketMatch.target_runs - currentScorecard.totalRuns)} off{' '}
                        {Math.max(0, cricketMatch.overs_limit * 6 - currentScorecard.legalBalls)} balls
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Over balls pill sequence */}
            <div className="flex items-center gap-2 pt-2 border-t border-bark-soft/40 overflow-x-auto">
              <span className="text-xs text-sand/70 whitespace-nowrap">This Over:</span>
              <div className="flex items-center gap-1.5">
                {currentOverDeliveries.length === 0 ? (
                  <span className="text-xs text-sand/50 italic">Over starting...</span>
                ) : (
                  currentOverDeliveries.map(b => {
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

            {/* Result text if completed */}
            {cricketMatch.result_summary && (
              <div className="mt-3 rounded-2xl bg-saffron-deep/30 border border-saffron/40 p-2.5 text-center text-xs font-bold text-saffron">
                🏆 {cricketMatch.result_summary}
              </div>
            )}
          </div>

          {/* Current Batter & Bowler On Field */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-sand bg-white p-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-bark">Batting</span>
              <div className="mt-2 text-sm">
                <div className="flex items-center justify-between font-bold text-bark bg-saffron-soft/20 px-2.5 py-1.5 rounded-lg">
                  <span>🏏 {cricketMatch.striker_name || 'Batter'}</span>
                  {(() => {
                    const bt = currentScorecard.batting.find(b => b.name === cricketMatch.striker_name)
                    return (
                      <span className="font-serif text-terracotta-deep">
                        {bt ? `${bt.runs} (${bt.balls}b · ${bt.fours}x4 · ${bt.sixes}x6 · SR: ${bt.strikeRate})` : '0 (0b)'}
                      </span>
                    )
                  })()}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-sand bg-white p-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-bark">Bowling</span>
              <div className="mt-2 flex items-center justify-between text-sm font-bold text-bark px-2 py-1 bg-sand/20 rounded-lg">
                <span>🎯 {cricketMatch.bowler_name || 'Bowler'}</span>
                {(() => {
                  const bw = currentScorecard.bowling.find(b => b.name === cricketMatch.bowler_name)
                  return (
                    <span className="font-serif text-terracotta-deep">
                      {bw ? `${bw.overs} ov · ${bw.maidens}m · ${bw.runs}r · ${bw.wickets}w` : '0.0 ov'}
                    </span>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* SUB-TABS */}
          <div className="flex flex-wrap gap-2 border-b border-sand pb-2">
            {[
              ['live', '🔴 Live Commentary'],
              ['inngs1', `Scorecard (Innings 1)`],
              ['inngs2', `Scorecard (Innings 2)`],
              ['charts', '📈 Manhattan & Worm'],
              ['info', 'ℹ️ Match Info'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  activeTab === k
                    ? 'bg-bark text-ivory'
                    : 'bg-sand/40 text-bark hover:bg-sand/70'
                }`}
                onClick={() => setActiveTab(k as 'live' | 'inngs1' | 'inngs2' | 'charts' | 'info')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* TAB: LIVE COMMENTARY */}
          {activeTab === 'live' && (
            <div className="space-y-3">
              <h4 className="font-serif text-base font-bold text-bark">Ball-by-Ball Feed</h4>
              {!deliveries.length ? (
                <p className="text-xs text-bark-soft italic py-4 text-center">
                  No balls bowled yet in this match.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {deliveries.slice(0, 50).map(b => {
                    const badge = formatBallBadge(b)
                    return (
                      <div
                        key={b.id}
                        className={`flex items-start gap-3 rounded-2xl border p-3 text-xs transition ${
                          b.is_wicket
                            ? 'border-red-300 bg-red-50/60'
                            : b.runs_batter >= 4
                            ? 'border-blue-200 bg-blue-50/40'
                            : 'border-sand/60 bg-white'
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
                            <span className="text-[10px]">
                              Inn {b.innings}
                            </span>
                          </div>
                          <p className="mt-1 text-bark">{b.commentary}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: INNINGS 1 SCORECARD */}
          {activeTab === 'inngs1' && (
            <InningsScorecardView
              scorecard={scorecard1}
              teamName={cricketMatch.batting_first_team_id === teamA?.id ? teamA?.name : teamB?.name}
            />
          )}

          {/* TAB: INNINGS 2 SCORECARD */}
          {activeTab === 'inngs2' && (
            <InningsScorecardView
              scorecard={scorecard2}
              teamName={cricketMatch.batting_first_team_id === teamA?.id ? teamB?.name : teamA?.name}
            />
          )}

          {/* TAB: CHARTS & ANALYTICS */}
          {activeTab === 'charts' && (
            <CricketChartsAndAnalytics
              match={match}
              cricketMatch={cricketMatch}
              deliveries={deliveries}
              teamA={teamA}
              teamB={teamB}
            />
          )}

          {/* TAB: MATCH INFO */}
          {activeTab === 'info' && (
            <div className="rounded-2xl border border-sand bg-white p-5 space-y-4 text-xs">
              <h4 className="font-serif text-base font-bold text-bark">Tournament & Venue Info</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-bark-soft">Match:</span>
                  <p className="font-bold text-bark">Match #{match.match_number} ({match.round_name})</p>
                </div>
                <div>
                  <span className="text-bark-soft">Overs:</span>
                  <p className="font-bold text-bark">{cricketMatch.overs_limit} overs per side</p>
                </div>
                <div>
                  <span className="text-bark-soft">Toss:</span>
                  <p className="font-bold text-bark">
                    {(cricketMatch.toss_winner_team_id === teamA?.id ? teamA?.name : teamB?.name) ?? '—'}{' '}
                    (elected to {cricketMatch.toss_decision ?? '—'})
                  </p>
                </div>
                <div>
                  <span className="text-bark-soft">Venue / Date:</span>
                  <p className="font-bold text-bark">{match.venue || 'Main Ground'} · {match.scheduled_date || 'TBD'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function InningsScorecardView({
  scorecard,
  teamName,
}: {
  scorecard: ReturnType<typeof calculateCricketScorecard>
  teamName?: string
}) {
  return (
    <div className="space-y-5">
      {/* Batting Table */}
      <div className="overflow-x-auto rounded-2xl border border-sand bg-white shadow-soft">
        <div className="bg-sand/30 px-4 py-2 font-serif text-sm font-bold text-bark flex justify-between">
          <span>Batting · {teamName ?? 'Team'}</span>
          <span>{scorecard.totalRuns} / {scorecard.totalWickets} ({scorecard.oversFormatted} ov)</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-sand bg-cream/50 text-[11px] uppercase tracking-wider text-bark-soft">
            <tr>
              <th className="px-4 py-2">Batter</th>
              <th className="px-3 py-2">Dismissal</th>
              <th className="px-3 py-2 text-right">R</th>
              <th className="px-3 py-2 text-right">B</th>
              <th className="px-3 py-2 text-right">4s</th>
              <th className="px-3 py-2 text-right">6s</th>
              <th className="px-4 py-2 text-right">SR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand/40">
            {!scorecard.batting.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center text-bark-faint">
                  No batters recorded yet.
                </td>
              </tr>
            ) : (
              scorecard.batting.map(b => (
                <tr key={b.name} className={b.isNotOut ? 'font-bold text-bark' : 'text-bark'}>
                  <td className="px-4 py-2 font-medium">{b.name} {b.isNotOut && '*'}</td>
                  <td className="px-3 py-2 text-bark-soft italic">{b.dismissal}</td>
                  <td className="px-3 py-2 text-right font-bold text-terracotta-deep">{b.runs}</td>
                  <td className="px-3 py-2 text-right text-bark-soft">{b.balls}</td>
                  <td className="px-3 py-2 text-right">{b.fours}</td>
                  <td className="px-3 py-2 text-right">{b.sixes}</td>
                  <td className="px-4 py-2 text-right text-bark-soft">{b.strikeRate}</td>
                </tr>
              ))
            )}
            <tr className="bg-sand/15 font-semibold">
              <td className="px-4 py-2">Extras</td>
              <td colSpan={6} className="px-3 py-2 text-right">
                {scorecard.extras.total} (b {scorecard.extras.byes}, lb {scorecard.extras.legByes}, w {scorecard.extras.wides}, nb {scorecard.extras.noBalls})
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bowling Table */}
      <div className="overflow-x-auto rounded-2xl border border-sand bg-white shadow-soft">
        <div className="bg-sand/30 px-4 py-2 font-serif text-sm font-bold text-bark">
          Bowling
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-sand bg-cream/50 text-[11px] uppercase tracking-wider text-bark-soft">
            <tr>
              <th className="px-4 py-2">Bowler</th>
              <th className="px-3 py-2 text-right">O</th>
              <th className="px-3 py-2 text-right">M</th>
              <th className="px-3 py-2 text-right">R</th>
              <th className="px-3 py-2 text-right font-bold">W</th>
              <th className="px-4 py-2 text-right">Econ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand/40">
            {!scorecard.bowling.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-center text-bark-faint">
                  No bowlers recorded yet.
                </td>
              </tr>
            ) : (
              scorecard.bowling.map(b => (
                <tr key={b.name}>
                  <td className="px-4 py-2 font-medium">{b.name}</td>
                  <td className="px-3 py-2 text-right">{b.overs}</td>
                  <td className="px-3 py-2 text-right">{b.maidens}</td>
                  <td className="px-3 py-2 text-right">{b.runs}</td>
                  <td className="px-3 py-2 text-right font-bold text-terracotta-deep">{b.wickets}</td>
                  <td className="px-4 py-2 text-right text-bark-soft">{b.economy}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Fall of Wickets */}
      {scorecard.fallOfWickets.length > 0 && (
        <div className="rounded-2xl border border-sand bg-white p-4">
          <h5 className="font-serif text-xs font-bold uppercase tracking-wider text-bark mb-2">
            Fall of Wickets
          </h5>
          <div className="flex flex-wrap gap-2 text-xs">
            {scorecard.fallOfWickets.map((f, i) => (
              <span key={i} className="rounded-full bg-sand/30 px-2.5 py-1 text-bark">
                <strong>{f.score}/{f.wickets}</strong> ({f.player}, {f.overs} ov)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

