import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Trophy,
  Award,
  Zap,
  TrendingUp,
  Shield,
  Medal,
  ChevronRight,
  Flame,
  Star,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Sport, Team, CricketMatch, CricketDelivery } from '../types'
import type { SportBundle } from '../lib/data'
import { Modal, ColourDot, Spinner } from './ui'
import {
  calculateCricketTournamentStandings,
  calculateTournamentBattingLeaders,
  calculateTournamentBowlingLeaders,
  calculateTournamentMVPLeaders,
} from '../lib/cricket'

interface CricketTournamentStatsProps {
  open: boolean
  onClose: () => void
  sport: Sport
  teams: Team[]
  bundle: SportBundle
}

export default function CricketTournamentStats({
  open,
  onClose,
  sport,
  teams,
  bundle,
}: CricketTournamentStatsProps) {
  const [loading, setLoading] = useState(true)
  const [cricketMatches, setCricketMatches] = useState<CricketMatch[]>([])
  const [deliveries, setDeliveries] = useState<CricketDelivery[]>([])
  const [activeTab, setActiveTab] = useState<'table' | 'orange' | 'purple' | 'mvp'>('table')

  const sportMatches = useMemo(() => {
    return bundle.matches.filter(m => m.sport_id === sport.id)
  }, [bundle.matches, sport.id])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const matchIds = sportMatches.map(m => m.id)
      if (!matchIds.length) {
        setCricketMatches([])
        setDeliveries([])
        return
      }

      const { data: cmData, error: cmErr } = await supabase
        .from('cricket_matches')
        .select('*')
        .in('match_id', matchIds)

      if (cmErr) throw cmErr
      const cMatches = (cmData ?? []) as CricketMatch[]
      setCricketMatches(cMatches)

      const cMatchIds = cMatches.map(cm => cm.id)
      if (cMatchIds.length) {
        const { data: delData, error: delErr } = await supabase
          .from('cricket_deliveries')
          .select('*')
          .in('cricket_match_id', cMatchIds)
          .order('created_at', { ascending: true })

        if (delErr) throw delErr
        setDeliveries((delData ?? []) as CricketDelivery[])
      } else {
        setDeliveries([])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [sportMatches])

  useEffect(() => {
    if (open) void loadData()
  }, [open, loadData])

  // Analytics Computations
  const standings = useMemo(() => {
    return calculateCricketTournamentStandings(sportMatches, cricketMatches, teams)
  }, [sportMatches, cricketMatches, teams])

  const battingLeaders = useMemo(() => {
    return calculateTournamentBattingLeaders(deliveries, cricketMatches, sportMatches, teams)
  }, [deliveries, cricketMatches, sportMatches, teams])

  const bowlingLeaders = useMemo(() => {
    return calculateTournamentBowlingLeaders(deliveries, cricketMatches, sportMatches, teams)
  }, [deliveries, cricketMatches, sportMatches, teams])

  const mvpLeaders = useMemo(() => {
    return calculateTournamentMVPLeaders(battingLeaders, bowlingLeaders, deliveries)
  }, [battingLeaders, bowlingLeaders, deliveries])

  const orangeCapHolder = battingLeaders[0] ?? null
  const purpleCapHolder = bowlingLeaders[0] ?? null
  const mvpHolder = mvpLeaders[0] ?? null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Cricket Analytics & Standings · ${sport.name}`}
      wide
    >
      {loading ? (
        <div className="py-12 text-center">
          <Spinner />
          <p className="mt-2 text-sm text-bark-soft">Analyzing tournament statistics & NRR...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top Caps Spotlight Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Orange Cap Spotlight */}
            <div className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-100 p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-900">
                <span>🧢 Orange Cap</span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-950">Most Runs</span>
              </div>
              <div className="mt-2.5">
                <p className="font-serif text-lg font-bold text-bark">
                  {orangeCapHolder ? orangeCapHolder.name : '—'}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-bark-soft mt-0.5">
                  <ColourDot colour={orangeCapHolder?.teamColour} />
                  <span>{orangeCapHolder?.teamName ?? 'TBD'}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-2xl font-black text-amber-800">
                    {orangeCapHolder ? orangeCapHolder.runs : 0}
                  </span>
                  <span className="text-xs text-bark-soft">
                    runs (SR: {orangeCapHolder ? orangeCapHolder.strikeRate : 0})
                  </span>
                </div>
              </div>
            </div>

            {/* Purple Cap Spotlight */}
            <div className="rounded-2xl border border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-100 p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-purple-900">
                <span>🟣 Purple Cap</span>
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-950">Most Wickets</span>
              </div>
              <div className="mt-2.5">
                <p className="font-serif text-lg font-bold text-bark">
                  {purpleCapHolder ? purpleCapHolder.name : '—'}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-bark-soft mt-0.5">
                  <ColourDot colour={purpleCapHolder?.teamColour} />
                  <span>{purpleCapHolder?.teamName ?? 'TBD'}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-2xl font-black text-purple-900">
                    {purpleCapHolder ? purpleCapHolder.wickets : 0}
                  </span>
                  <span className="text-xs text-bark-soft">
                    wickets (Econ: {purpleCapHolder ? purpleCapHolder.economy : 0})
                  </span>
                </div>
              </div>
            </div>

            {/* Tournament MVP Spotlight */}
            <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-100 p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-900">
                <span>🏅 Tournament MVP</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-950">Impact Index</span>
              </div>
              <div className="mt-2.5">
                <p className="font-serif text-lg font-bold text-bark">
                  {mvpHolder ? mvpHolder.name : '—'}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-bark-soft mt-0.5">
                  <ColourDot colour={mvpHolder?.teamColour} />
                  <span>{mvpHolder?.teamName ?? 'TBD'}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-2xl font-black text-emerald-900">
                    {mvpHolder ? mvpHolder.points : 0}
                  </span>
                  <span className="text-xs text-bark-soft">
                    pts ({mvpHolder ? `${mvpHolder.runs}r, ${mvpHolder.wickets}w` : '0r, 0w'})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Subtabs */}
          <div className="flex gap-2 border-b border-sand pb-2">
            {[
              ['table', '🏆 Points Table & NRR'],
              ['orange', '🧢 Orange Cap (Batting)'],
              ['purple', '🟣 Purple Cap (Bowling)'],
              ['mvp', '🏅 MVP Rankings'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  activeTab === k
                    ? 'bg-bark text-ivory'
                    : 'bg-sand/40 text-bark hover:bg-sand/70'
                }`}
                onClick={() => setActiveTab(k as 'table' | 'orange' | 'purple' | 'mvp')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* TAB 1: POINTS TABLE & NRR */}
          {activeTab === 'table' && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-2xl border border-sand bg-white shadow-soft">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-sand bg-bark text-[11px] uppercase tracking-wider text-ivory">
                    <tr>
                      <th className="px-3 py-2.5 text-center">#</th>
                      <th className="px-4 py-2.5">Team</th>
                      <th className="px-3 py-2.5 text-center">P</th>
                      <th className="px-3 py-2.5 text-center font-bold">W</th>
                      <th className="px-3 py-2.5 text-center">L</th>
                      <th className="px-3 py-2.5 text-center">T</th>
                      <th className="px-4 py-2.5 text-center font-serif text-sm font-bold text-saffron">Pts</th>
                      <th className="px-4 py-2.5 text-right font-mono font-bold">NRR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand/40">
                    {!standings.length ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-bark-faint">
                          No teams added yet.
                        </td>
                      </tr>
                    ) : (
                      standings.map((s, idx) => (
                        <tr
                          key={s.teamId}
                          className={`hover:bg-cream/40 transition ${
                            idx < 2 ? 'bg-saffron-soft/10 font-medium' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center font-bold text-bark-soft">{idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <ColourDot colour={s.teamColour} />
                              <span className="font-semibold text-bark">{s.teamName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">{s.played}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-emerald-700">{s.won}</td>
                          <td className="px-3 py-2.5 text-center text-red-700">{s.lost}</td>
                          <td className="px-3 py-2.5 text-center">{s.tied}</td>
                          <td className="px-4 py-2.5 text-center font-serif text-sm font-bold text-terracotta-deep">
                            {s.points}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono font-bold ${
                              s.nrr > 0
                                ? 'text-emerald-700'
                                : s.nrr < 0
                                ? 'text-red-700'
                                : 'text-bark-soft'
                            }`}
                          >
                            {s.nrrFormatted}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-bark-faint italic">
                💡 <strong>Official NRR Formula:</strong> (Total Runs Scored / Total Overs Faced) − (Total Runs Conceded / Total Overs Bowled). When a team is bowled out, their full allotted quota is counted as overs faced.
              </p>
            </div>
          )}

          {/* TAB 2: ORANGE CAP (BATTING LEADERS) */}
          {activeTab === 'orange' && (
            <div className="overflow-x-auto rounded-2xl border border-sand bg-white shadow-soft">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-sand bg-cream/70 text-[11px] uppercase tracking-wider text-bark-soft">
                  <tr>
                    <th className="px-3 py-2.5 text-center">Rank</th>
                    <th className="px-4 py-2.5">Batter</th>
                    <th className="px-3 py-2.5 text-center">Inn</th>
                    <th className="px-3 py-2.5 text-right font-bold text-bark">Runs</th>
                    <th className="px-3 py-2.5 text-right">Balls</th>
                    <th className="px-3 py-2.5 text-center">HS</th>
                    <th className="px-3 py-2.5 text-right">SR</th>
                    <th className="px-3 py-2.5 text-right">4s</th>
                    <th className="px-4 py-2.5 text-right">6s</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand/40">
                  {!battingLeaders.length ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-bark-faint">
                        No batting data recorded yet.
                      </td>
                    </tr>
                  ) : (
                    battingLeaders.map((b, idx) => (
                      <tr
                        key={b.name}
                        className={`hover:bg-cream/40 transition ${
                          idx === 0 ? 'bg-amber-50/60 font-bold' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          {idx === 0 ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] text-white font-bold">
                              1
                            </span>
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <ColourDot colour={b.teamColour} />
                            <span className="font-semibold text-bark">{b.name}</span>
                            {idx === 0 && (
                              <span className="rounded-full bg-amber-200 px-1.5 py-0.2 text-[9px] font-bold text-amber-900">
                                🧢 ORANGE CAP
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-bark-faint">{b.teamName}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">{b.innings}</td>
                        <td className="px-3 py-2.5 text-right font-serif text-sm font-black text-amber-800">
                          {b.runs}
                        </td>
                        <td className="px-3 py-2.5 text-right text-bark-soft">{b.balls}</td>
                        <td className="px-3 py-2.5 text-center font-semibold">
                          {b.highestScore}{b.isHighestNotOut ? '*' : ''}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-bark-soft">{b.strikeRate}</td>
                        <td className="px-3 py-2.5 text-right text-blue-700 font-semibold">{b.fours}</td>
                        <td className="px-4 py-2.5 text-right text-purple-700 font-bold">{b.sixes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: PURPLE CAP (BOWLING LEADERS) */}
          {activeTab === 'purple' && (
            <div className="overflow-x-auto rounded-2xl border border-sand bg-white shadow-soft">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-sand bg-cream/70 text-[11px] uppercase tracking-wider text-bark-soft">
                  <tr>
                    <th className="px-3 py-2.5 text-center">Rank</th>
                    <th className="px-4 py-2.5">Bowler</th>
                    <th className="px-3 py-2.5 text-center">Inn</th>
                    <th className="px-3 py-2.5 text-right">Overs</th>
                    <th className="px-3 py-2.5 text-right">Runs</th>
                    <th className="px-3 py-2.5 text-right font-bold text-bark">Wkts</th>
                    <th className="px-3 py-2.5 text-center font-mono">BBI</th>
                    <th className="px-3 py-2.5 text-right font-mono">Econ</th>
                    <th className="px-4 py-2.5 text-right">Dots</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand/40">
                  {!bowlingLeaders.length ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-bark-faint">
                        No bowling data recorded yet.
                      </td>
                    </tr>
                  ) : (
                    bowlingLeaders.map((bw, idx) => (
                      <tr
                        key={bw.name}
                        className={`hover:bg-cream/40 transition ${
                          idx === 0 ? 'bg-purple-50/60 font-bold' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          {idx === 0 ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[11px] text-white font-bold">
                              1
                            </span>
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <ColourDot colour={bw.teamColour} />
                            <span className="font-semibold text-bark">{bw.name}</span>
                            {idx === 0 && (
                              <span className="rounded-full bg-purple-200 px-1.5 py-0.2 text-[9px] font-bold text-purple-900">
                                🟣 PURPLE CAP
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-bark-faint">{bw.teamName}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">{bw.innings}</td>
                        <td className="px-3 py-2.5 text-right text-bark-soft">{bw.overs}</td>
                        <td className="px-3 py-2.5 text-right text-bark-soft">{bw.runs}</td>
                        <td className="px-3 py-2.5 text-right font-serif text-sm font-black text-purple-900">
                          {bw.wickets}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-semibold">{bw.bestFigures}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-bark-soft">{bw.economy}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{bw.dots}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: MVP RANKINGS */}
          {activeTab === 'mvp' && (
            <div className="overflow-x-auto rounded-2xl border border-sand bg-white shadow-soft">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-sand bg-cream/70 text-[11px] uppercase tracking-wider text-bark-soft">
                  <tr>
                    <th className="px-3 py-2.5 text-center">Rank</th>
                    <th className="px-4 py-2.5">Player</th>
                    <th className="px-3 py-2.5 text-right">Runs</th>
                    <th className="px-3 py-2.5 text-right">Wickets</th>
                    <th className="px-3 py-2.5 text-right">Catches</th>
                    <th className="px-4 py-2.5 text-right font-serif text-sm font-bold text-emerald-800">
                      MVP Points
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand/40">
                  {!mvpLeaders.length ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-bark-faint">
                        No match performance data recorded yet.
                      </td>
                    </tr>
                  ) : (
                    mvpLeaders.map((p, idx) => (
                      <tr
                        key={p.name}
                        className={`hover:bg-cream/40 transition ${
                          idx === 0 ? 'bg-emerald-50/60 font-bold' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          {idx === 0 ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] text-white font-bold">
                              1
                            </span>
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <ColourDot colour={p.teamColour} />
                            <span className="font-semibold text-bark">{p.name}</span>
                            {idx === 0 && (
                              <span className="rounded-full bg-emerald-200 px-1.5 py-0.2 text-[9px] font-bold text-emerald-900">
                                🏅 MVP #1
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-bark-faint">{p.teamName}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">{p.runs}</td>
                        <td className="px-3 py-2.5 text-right">{p.wickets}</td>
                        <td className="px-3 py-2.5 text-right">{p.catches}</td>
                        <td className="px-4 py-2.5 text-right font-serif text-base font-black text-emerald-900">
                          {p.points}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
