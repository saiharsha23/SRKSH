import type {
  CricketDelivery,
  BattingStats,
  BowlingStats,
  FallOfWicket,
} from '../types'

export function ballsToOvers(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6)
  const balls = legalBalls % 6
  return `${overs}.${balls}`
}

export function formatRunRate(runs: number, legalBalls: number): string {
  if (legalBalls === 0) return '0.00'
  const overs = legalBalls / 6
  return (runs / overs).toFixed(2)
}

export function calculateCricketScorecard(
  deliveries: CricketDelivery[],
  inningsNumber: 1 | 2
) {
  const inningsBalls = deliveries
    .filter(d => d.innings === inningsNumber)
    .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())

  const battingMap = new Map<string, BattingStats>()
  const bowlingMap = new Map<string, { runs: number; legalBalls: number; wickets: number; maidens: number; dots: number }>()
  const overBallsMap = new Map<number, CricketDelivery[]>()
  const fallOfWickets: FallOfWicket[] = []

  let totalRuns = 0
  let totalWickets = 0
  let legalBalls = 0

  let wides = 0
  let noBalls = 0
  let byes = 0
  let legByes = 0

  for (const b of inningsBalls) {
    // 1. Extras accounting
    if (b.is_extra) {
      if (b.extra_type === 'wide') wides += b.extra_runs || 1
      else if (b.extra_type === 'no_ball') noBalls += b.extra_runs || 1
      else if (b.extra_type === 'bye') byes += b.extra_runs || 1
      else if (b.extra_type === 'leg_bye') legByes += b.extra_runs || 1
    }

    const ballRuns = (b.runs_batter || 0) + (b.extra_runs || 0)
    totalRuns += ballRuns

    const isLegal = !b.is_extra || (b.extra_type !== 'wide' && b.extra_type !== 'no_ball')
    if (isLegal) {
      legalBalls++
    }

    // 2. Batting Stats
    if (!battingMap.has(b.striker_name)) {
      battingMap.set(b.striker_name, {
        name: b.striker_name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        dismissal: 'not out',
        isNotOut: true,
      })
    }
    // Also track non-striker in case they haven't faced a ball yet
    if (!battingMap.has(b.non_striker_name)) {
      battingMap.set(b.non_striker_name, {
        name: b.non_striker_name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        dismissal: 'not out',
        isNotOut: true,
      })
    }

    const striker = battingMap.get(b.striker_name)!
    // Only count balls faced for non-wides
    if (b.extra_type !== 'wide') {
      striker.balls++
    }
    striker.runs += b.runs_batter || 0
    if (b.runs_batter === 4) striker.fours++
    if (b.runs_batter === 6) striker.sixes++

    // 3. Wicket accounting
    if (b.is_wicket) {
      totalWickets++
      const dismissedPlayer = b.player_dismissed || b.striker_name
      const dismissedBatter = battingMap.get(dismissedPlayer)

      let dismissalText = 'out'
      if (b.wicket_type === 'bowled') dismissalText = `b ${b.bowler_name}`
      else if (b.wicket_type === 'caught') dismissalText = `c ${b.fielder_name || 'sub'} b ${b.bowler_name}`
      else if (b.wicket_type === 'lbw') dismissalText = `lbw b ${b.bowler_name}`
      else if (b.wicket_type === 'stumped') dismissalText = `st ${b.fielder_name || 'wk'} b ${b.bowler_name}`
      else if (b.wicket_type === 'run_out') dismissalText = `run out (${b.fielder_name || 'sub'})`
      else if (b.wicket_type === 'hit_wicket') dismissalText = `hit wicket b ${b.bowler_name}`

      if (dismissedBatter) {
        dismissedBatter.dismissal = dismissalText
        dismissedBatter.isNotOut = false
      }

      fallOfWickets.push({
        score: totalRuns,
        wickets: totalWickets,
        player: dismissedPlayer,
        overs: ballsToOvers(legalBalls),
      })
    }

    // 4. Bowling Stats
    if (!bowlingMap.has(b.bowler_name)) {
      bowlingMap.set(b.bowler_name, {
        runs: 0,
        legalBalls: 0,
        wickets: 0,
        maidens: 0,
        dots: 0,
      })
    }
    const bowler = bowlingMap.get(b.bowler_name)!
    // Runs charged to bowler (runs off bat + wides + no-balls; byes and leg-byes are team extras)
    const bowlerConceded =
      (b.runs_batter || 0) +
      (b.extra_type === 'wide' || b.extra_type === 'no_ball' ? b.extra_runs || 1 : 0)
    bowler.runs += bowlerConceded

    if (isLegal) {
      bowler.legalBalls++
      if (bowlerConceded === 0 && !b.is_extra) {
        bowler.dots++
      }
    }

    // Wickets credited to bowler (run outs are not bowler wickets)
    if (b.is_wicket && b.wicket_type !== 'run_out') {
      bowler.wickets++
    }

    // Track balls by over for maiden calculation
    const currentOverBalls = overBallsMap.get(b.over_number) ?? []
    currentOverBalls.push(b)
    overBallsMap.set(b.over_number, currentOverBalls)
  }

  // Calculate Strike Rates
  for (const b of battingMap.values()) {
    b.strikeRate = b.balls > 0 ? Number(((b.runs / b.balls) * 100).toFixed(1)) : 0
  }

  // Calculate Maidens and Economy
  const bowling: BowlingStats[] = []
  for (const [name, stats] of bowlingMap.entries()) {
    const oversNum = stats.legalBalls / 6
    const economy = oversNum > 0 ? Number((stats.runs / oversNum).toFixed(2)) : 0

    // Count maidens
    let maidens = 0
    for (const [, ballsInOver] of overBallsMap.entries()) {
      if (ballsInOver.some(d => d.bowler_name === name)) {
        const legalInThisOver = ballsInOver.filter(
          d => !d.is_extra || (d.extra_type !== 'wide' && d.extra_type !== 'no_ball')
        )
        if (legalInThisOver.length === 6) {
          const runsInOver = ballsInOver.reduce((sum, d) => {
            const conceded =
              (d.runs_batter || 0) +
              (d.extra_type === 'wide' || d.extra_type === 'no_ball' ? d.extra_runs || 1 : 0)
            return sum + conceded
          }, 0)
          if (runsInOver === 0) maidens++
        }
      }
    }

    bowling.push({
      name,
      overs: ballsToOvers(stats.legalBalls),
      maidens,
      runs: stats.runs,
      wickets: stats.wickets,
      economy,
      dots: stats.dots,
    })
  }

  const extrasTotal = wides + noBalls + byes + legByes

  return {
    batting: Array.from(battingMap.values()),
    bowling,
    fallOfWickets,
    extras: {
      wides,
      noBalls,
      byes,
      legByes,
      total: extrasTotal,
    },
    totalRuns,
    totalWickets,
    oversFormatted: ballsToOvers(legalBalls),
    legalBalls,
    runRate: formatRunRate(totalRuns, legalBalls),
  }
}

/**
 * Returns clean string representation of a ball for over timeline pill (e.g. "4", "Wd", "W", "•").
 */
export function formatBallBadge(b: CricketDelivery): { text: string; bgClass: string } {
  if (b.is_wicket) {
    return { text: 'W', bgClass: 'bg-red-600 text-white font-bold' }
  }
  if (b.is_extra) {
    if (b.extra_type === 'wide') {
      const extra = b.extra_runs > 1 ? `Wd+${b.extra_runs - 1}` : 'Wd'
      return { text: extra, bgClass: 'bg-amber-500 text-white font-semibold' }
    }
    if (b.extra_type === 'no_ball') {
      const total = (b.runs_batter || 0) + 1
      return { text: `Nb${b.runs_batter ? `+${b.runs_batter}` : ''}`, bgClass: 'bg-amber-600 text-white font-semibold' }
    }
    if (b.extra_type === 'bye') {
      return { text: `B${b.extra_runs}`, bgClass: 'bg-bark-soft text-white' }
    }
    if (b.extra_type === 'leg_bye') {
      return { text: `Lb${b.extra_runs}`, bgClass: 'bg-bark-soft text-white' }
    }
  }

  if (b.runs_batter === 6) {
    return { text: '6', bgClass: 'bg-purple-600 text-white font-bold' }
  }
  if (b.runs_batter === 4) {
    return { text: '4', bgClass: 'bg-blue-600 text-white font-bold' }
  }
  if (b.runs_batter === 0) {
    return { text: '•', bgClass: 'bg-sand/60 text-bark font-bold' }
  }
  return { text: String(b.runs_batter), bgClass: 'bg-cream text-bark font-semibold border border-sand' }
}

/**
 * Generates an exciting commentary line for a ball.
 */
export function generateAutoCommentary(d: {
  striker: string
  bowler: string
  runs: number
  isExtra: boolean
  extraType?: string | null
  extraRuns?: number
  isWicket: boolean
  wicketType?: string | null
  playerDismissed?: string | null
  fielder?: string | null
}): string {
  const { striker, bowler, runs, isExtra, extraType, isWicket, wicketType, playerDismissed, fielder } = d

  if (isWicket) {
    const p = playerDismissed || striker
    if (wicketType === 'bowled') return `OUT! Clean bowled! ${bowler} produces an absolute peach that rattles the timber! ${p} has to walk back.`
    if (wicketType === 'caught') return `OUT! Caught! ${p} tries to go big, but mistimes it straight down the throat of ${fielder || 'the fielder'} off ${bowler}!`
    if (wicketType === 'lbw') return `OUT! That's plumb in front! Loud appeal from ${bowler} and the umpire raises the finger! ${p} departs LBW.`
    if (wicketType === 'run_out') return `OUT! Run out! Direct hit from ${fielder || 'the fielder'} and ${p} is caught well short of the crease!`
    if (wicketType === 'stumped') return `OUT! Stumped! Clever bowling from ${bowler}, drags the length back and ${fielder || 'the keeper'} whips the bails off in a flash!`
    return `OUT! ${p} is dismissed!`
  }

  if (isExtra) {
    if (extraType === 'wide') return `Wide ball called! ${bowler} sprays it well outside off stump.`
    if (extraType === 'no_ball') return `NO BALL called by the umpire! Overstepping from ${bowler}, free hit coming up!`
    if (extraType === 'bye') return `Byes taken. The ball beats both batter and keeper.`
    if (extraType === 'leg_bye') return `Leg bye signaled as the ball deflects off the pads.`
  }

  if (runs === 6) {
    return `SIX! In the slot and hoisted high into the night sky! Magnificent hit from ${striker} off ${bowler}!`
  }
  if (runs === 4) {
    return `FOUR! Glorious stroke! ${striker} leans into the drive and carves it through the gap off ${bowler}!`
  }
  if (runs === 3) return `Good running between the wickets! ${striker} pushes it into the deep and they sprint back for three.`
  if (runs === 2) return `Worked away into the gap, easy two runs taken.`
  if (runs === 1) return `Tapped into the covers for a single, rotating the strike.`
  return `No run. Solid defensive block from ${striker} off ${bowler}.`
}
