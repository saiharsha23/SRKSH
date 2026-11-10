import { useMemo } from 'react'
import {
  TrendingUp,
  BarChart2,
  Printer,
  Sparkles,
  Award,
  AlertCircle,
} from 'lucide-react'
import type { Team, SportMatch, CricketMatch, CricketDelivery } from '../types'
import { ColourDot } from './ui'
import { calculateCricketScorecard, ballsToOvers } from '../lib/cricket'

interface CricketChartsAndAnalyticsProps {
  match: SportMatch
  cricketMatch: CricketMatch
  deliveries: CricketDelivery[]
  teamA?: Team
  teamB?: Team
}

export default function CricketChartsAndAnalytics({
  match,
  cricketMatch,
  deliveries,
  teamA,
  teamB,
}: CricketChartsAndAnalyticsProps) {
  const oversLimit = cricketMatch.overs_limit || 15

  const battingFirstTeam =
    cricketMatch.batting_first_team_id === teamA?.id ? teamA : teamB
  const battingSecondTeam =
    battingFirstTeam?.id === teamA?.id ? teamB : teamA

  const score1 = useMemo(() => calculateCricketScorecard(deliveries, 1), [deliveries])
  const score2 = useMemo(() => calculateCricketScorecard(deliveries, 2), [deliveries])

  // Over-by-over aggregation for Manhattan & Worm
  const { overData, maxRunsInOver, maxCumulativeRuns } = useMemo(() => {
    const data: Array<{
      over: number
      runs1: number
      wickets1: number
      cum1: number
      runs2: number
      wickets2: number
      cum2: number
    }> = []

    let cum1 = 0
    let cum2 = 0
    let maxOver = 0

    for (let o = 0; o < oversLimit; o++) {
      const inngs1Balls = deliveries.filter(d => d.innings === 1 && d.over_number === o)
      const inngs2Balls = deliveries.filter(d => d.innings === 2 && d.over_number === o)

      const runs1 = inngs1Balls.reduce(
        (sum, d) => sum + (d.runs_batter || 0) + (d.extra_runs || 0),
        0
      )
      const wickets1 = inngs1Balls.filter(d => d.is_wicket).length
      if (inngs1Balls.length > 0) cum1 += runs1

      const runs2 = inngs2Balls.reduce(
        (sum, d) => sum + (d.runs_batter || 0) + (d.extra_runs || 0),
        0
      )
      const wickets2 = inngs2Balls.filter(d => d.is_wicket).length
      if (inngs2Balls.length > 0) cum2 += runs2

      maxOver = Math.max(maxOver, runs1, runs2)

      data.push({
        over: o + 1,
        runs1,
        wickets1,
        cum1: inngs1Balls.length > 0 ? cum1 : 0,
        runs2,
        wickets2,
        cum2: inngs2Balls.length > 0 ? cum2 : 0,
      })
    }

    const maxCum = Math.max(cum1, cum2, cricketMatch.target_runs || 0, 50)
    return {
      overData: data,
      maxRunsInOver: Math.max(maxOver, 15),
      maxCumulativeRuns: maxCum,
    }
  }, [deliveries, oversLimit, cricketMatch.target_runs])

  // Win Probability & Projected Score Computations
  const predictor = useMemo(() => {
    if (cricketMatch.current_innings === 1) {
      const runs = score1.totalRuns
      const legal = score1.legalBalls
      const ballsLeft = Math.max(0, oversLimit * 6 - legal)
      const crr = legal > 0 ? (runs / (legal / 6)) : 6.0

      const projCurrent = Math.round(runs + crr * (ballsLeft / 6))
      const proj8 = Math.round(runs + 8.0 * (ballsLeft / 6))
      const proj10 = Math.round(runs + 10.0 * (ballsLeft / 6))
      const proj12 = Math.round(runs + 12.0 * (ballsLeft / 6))

      return {
        mode: 'innings1' as const,
        crr: crr.toFixed(2),
        projCurrent,
        proj8,
        proj10,
        proj12,
      }
    } else {
      // 2nd innings win probability
      const target = cricketMatch.target_runs || score1.totalRuns + 1
      const runs = score2.totalRuns
      const wicketsLost = score2.totalWickets
      const wicketsInHand = 10 - wicketsLost
      const legal = score2.legalBalls
      const ballsLeft = Math.max(0, oversLimit * 6 - legal)
      const runsNeeded = target - runs

      if (runs >= target) {
        return { mode: 'innings2' as const, probChasing: 100, probDefending: 0, runsNeeded: 0, ballsLeft: 0 }
      }
      if (wicketsLost >= 10 || ballsLeft <= 0) {
        return { mode: 'innings2' as const, probChasing: 0, probDefending: 100, runsNeeded, ballsLeft: 0 }
      }

      const crr = legal > 0 ? runs / (legal / 6) : 0
      const rrr = ballsLeft > 0 ? runsNeeded / (ballsLeft / 6) : 99

      // Statistical win probability model
      let probChasing = 50 + (crr - rrr) * 5 + (wicketsInHand - 5) * 6
      probChasing = Math.max(2, Math.min(98, Math.round(probChasing)))
      const probDefending = 100 - probChasing

      return {
        mode: 'innings2' as const,
        probChasing,
        probDefending,
        runsNeeded,
        ballsLeft,
        rrr: rrr.toFixed(2),
        crr: crr.toFixed(2),
      }
    }
  }, [cricketMatch, score1, score2, oversLimit])

  // Print Match Sheet Handler
  function handlePrint() {
    window.print()
  }

  // SVG Chart Dimensions
  const svgWidth = 620
  const svgHeight = 220
  const paddingLeft = 40
  const paddingRight = 20
  const paddingTop = 20
  const paddingBottom = 30
  const chartWidth = svgWidth - paddingLeft - paddingRight
  const chartHeight = svgHeight - paddingTop - paddingBottom

  const teamAColour = teamA?.colour || '#C2A15A'
  const teamBColour = teamB?.colour || '#4A3E3D'

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand pb-3">
        <div>
          <h4 className="font-serif text-base font-bold text-bark flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-terracotta" />
            Visual Analytics & Predictor
          </h4>
          <p className="text-xs text-bark-soft">
            Over-by-over Manhattan bar charts, cumulative worm progression, and live win probabilities.
          </p>
        </div>

        <button
          type="button"
          className="btn-outline btn-sm text-xs font-semibold flex items-center gap-1.5"
          onClick={handlePrint}
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF Scorecard
        </button>
      </div>

      {/* WIN PROBABILITY / SCORE PREDICTOR */}
      <div className="rounded-2xl border border-sand bg-gradient-to-br from-cream/90 to-sand/30 p-4 shadow-soft">
        {predictor.mode === 'innings2' ? (
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-bark pb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-saffron" />
                Live Win Probability
              </span>
              <span className="text-bark-soft">
                Need {predictor.runsNeeded} runs off {predictor.ballsLeft} balls (RRR: {predictor.rrr})
              </span>
            </div>

            {/* Split Probability Bar */}
            <div className="mt-2 h-7 w-full overflow-hidden rounded-full bg-sand/60 flex text-xs font-bold shadow-inner">
              <div
                className="flex items-center justify-start pl-3 text-white transition-all duration-500"
                style={{
                  width: `${predictor.probDefending}%`,
                  backgroundColor: battingFirstTeam?.colour || '#7A2E1D',
                }}
              >
                {predictor.probDefending >= 15 && `${battingFirstTeam?.name}: ${predictor.probDefending}%`}
              </div>
              <div
                className="flex items-center justify-end pr-3 text-white transition-all duration-500"
                style={{
                  width: `${predictor.probChasing}%`,
                  backgroundColor: battingSecondTeam?.colour || '#C2A15A',
                }}
              >
                {predictor.probChasing >= 15 && `${battingSecondTeam?.name}: ${predictor.probChasing}%`}
              </div>
            </div>

            <div className="mt-2 flex justify-between text-[11px] text-bark-soft">
              <span>🛡️ Defending: <strong>{battingFirstTeam?.name} ({predictor.probDefending}%)</strong></span>
              <span>🏏 Chasing: <strong>{battingSecondTeam?.name} ({predictor.probChasing}%)</strong></span>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-bark pb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-saffron" />
                1st Innings Projected Score
              </span>
              <span className="text-bark-soft">Current Run Rate: {predictor.crr}</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center mt-2">
              <div className="rounded-xl bg-white p-2 border border-sand">
                <span className="text-[10px] text-bark-soft block">At Current Rate</span>
                <span className="font-serif text-lg font-bold text-terracotta-deep">
                  {predictor.projCurrent}
                </span>
              </div>
              <div className="rounded-xl bg-white p-2 border border-sand">
                <span className="text-[10px] text-bark-soft block">At 8.0 RPO</span>
                <span className="font-serif text-lg font-bold text-bark">
                  {predictor.proj8}
                </span>
              </div>
              <div className="rounded-xl bg-white p-2 border border-sand">
                <span className="text-[10px] text-bark-soft block">At 10.0 RPO</span>
                <span className="font-serif text-lg font-bold text-blue-700">
                  {predictor.proj10}
                </span>
              </div>
              <div className="rounded-xl bg-white p-2 border border-sand">
                <span className="text-[10px] text-bark-soft block">At 12.0 RPO</span>
                <span className="font-serif text-lg font-bold text-purple-700">
                  {predictor.proj12}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MANHATTAN CHART (Runs Per Over) */}
      <div className="rounded-2xl border border-sand bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-sand/40">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-terracotta" />
            <h5 className="font-serif text-sm font-bold text-bark">Manhattan Chart (Runs Per Over)</h5>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <ColourDot colour={battingFirstTeam?.colour} />
              <span>{battingFirstTeam?.name ?? 'Innings 1'}</span>
            </span>
            <span className="flex items-center gap-1">
              <ColourDot colour={battingSecondTeam?.colour} />
              <span>{battingSecondTeam?.name ?? 'Innings 2'}</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-red-600 font-bold">
              ● Wicket
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full min-w-[540px] h-52">
            {/* Grid lines */}
            {[0, 5, 10, 15, 20].map(val => {
              if (val > maxRunsInOver) return null
              const y = paddingTop + chartHeight - (val / maxRunsInOver) * chartHeight
              return (
                <g key={val}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={paddingLeft + chartWidth}
                    y2={y}
                    stroke="#E6DFD5"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#7A6F68"
                  >
                    {val}
                  </text>
                </g>
              )
            })}

            {/* Bars for each over */}
            {overData.map((d, i) => {
              const xOver = paddingLeft + (i / oversLimit) * chartWidth
              const overSlotWidth = chartWidth / oversLimit
              const barWidth = Math.max(4, overSlotWidth * 0.35)

              const h1 = (d.runs1 / maxRunsInOver) * chartHeight
              const y1 = paddingTop + chartHeight - h1

              const h2 = (d.runs2 / maxRunsInOver) * chartHeight
              const y2 = paddingTop + chartHeight - h2

              return (
                <g key={d.over}>
                  {/* Innings 1 Bar */}
                  {d.runs1 > 0 && (
                    <rect
                      x={xOver + overSlotWidth * 0.1}
                      y={y1}
                      width={barWidth}
                      height={h1}
                      fill={battingFirstTeam?.colour || '#7A2E1D'}
                      rx="2"
                    />
                  )}
                  {/* Innings 1 Wicket Dot */}
                  {d.wickets1 > 0 && (
                    <circle
                      cx={xOver + overSlotWidth * 0.1 + barWidth / 2}
                      cy={Math.max(paddingTop + 5, y1 - 6)}
                      r="3.5"
                      fill="#DC2626"
                    />
                  )}

                  {/* Innings 2 Bar */}
                  {d.runs2 > 0 && (
                    <rect
                      x={xOver + overSlotWidth * 0.5}
                      y={y2}
                      width={barWidth}
                      height={h2}
                      fill={battingSecondTeam?.colour || '#C2A15A'}
                      rx="2"
                    />
                  )}
                  {/* Innings 2 Wicket Dot */}
                  {d.wickets2 > 0 && (
                    <circle
                      cx={xOver + overSlotWidth * 0.5 + barWidth / 2}
                      cy={Math.max(paddingTop + 5, y2 - 6)}
                      r="3.5"
                      fill="#DC2626"
                    />
                  )}

                  {/* X Axis Label */}
                  <text
                    x={xOver + overSlotWidth / 2}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#7A6F68"
                  >
                    {d.over}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* WORM CHART (Cumulative Score Progression) */}
      <div className="rounded-2xl border border-sand bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-sand/40">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-terracotta" />
            <h5 className="font-serif text-sm font-bold text-bark">Worm Chart (Cumulative Score)</h5>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 font-semibold text-bark">
              <span className="h-1.5 w-4 rounded" style={{ backgroundColor: battingFirstTeam?.colour || '#7A2E1D' }} />
              {battingFirstTeam?.name ?? 'Innings 1'}
            </span>
            <span className="flex items-center gap-1 font-semibold text-bark">
              <span className="h-1.5 w-4 rounded" style={{ backgroundColor: battingSecondTeam?.colour || '#C2A15A' }} />
              {battingSecondTeam?.name ?? 'Innings 2'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full min-w-[540px] h-52">
            {/* Grid lines */}
            {[0, 50, 100, 150, 200].map(val => {
              if (val > maxCumulativeRuns + 20) return null
              const y = paddingTop + chartHeight - (val / maxCumulativeRuns) * chartHeight
              return (
                <g key={val}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={paddingLeft + chartWidth}
                    y2={y}
                    stroke="#E6DFD5"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#7A6F68"
                  >
                    {val}
                  </text>
                </g>
              )
            })}

            {/* Path 1: Innings 1 Curve */}
            {(() => {
              const points1: Array<{ x: number; y: number; wicket: boolean }> = [
                { x: paddingLeft, y: paddingTop + chartHeight, wicket: false },
              ]
              overData.forEach((d, i) => {
                if (d.cum1 > 0 || i === 0) {
                  const x = paddingLeft + ((i + 1) / oversLimit) * chartWidth
                  const y = paddingTop + chartHeight - (d.cum1 / maxCumulativeRuns) * chartHeight
                  points1.push({ x, y, wicket: d.wickets1 > 0 })
                }
              })

              const pathD = points1.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

              return (
                <g>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={battingFirstTeam?.colour || '#7A2E1D'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {points1.map((p, idx) =>
                    p.wicket ? (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill="#DC2626"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                    ) : null
                  )}
                </g>
              )
            })()}

            {/* Path 2: Innings 2 Curve */}
            {(() => {
              const points2: Array<{ x: number; y: number; wicket: boolean }> = [
                { x: paddingLeft, y: paddingTop + chartHeight, wicket: false },
              ]
              overData.forEach((d, i) => {
                if (d.cum2 > 0 || i === 0) {
                  const x = paddingLeft + ((i + 1) / oversLimit) * chartWidth
                  const y = paddingTop + chartHeight - (d.cum2 / maxCumulativeRuns) * chartHeight
                  points2.push({ x, y, wicket: d.wickets2 > 0 })
                }
              })

              if (points2.length <= 1) return null
              const pathD = points2.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

              return (
                <g>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={battingSecondTeam?.colour || '#C2A15A'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {points2.map((p, idx) =>
                    p.wicket ? (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill="#DC2626"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                    ) : null
                  )}
                </g>
              )
            })()}

            {/* X Axis Labels */}
            {overData.map((d, i) => (
              <text
                key={d.over}
                x={paddingLeft + ((i + 1) / oversLimit) * chartWidth}
                y={svgHeight - 10}
                textAnchor="middle"
                fontSize="9"
                fill="#7A6F68"
              >
                {d.over}
              </text>
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}

