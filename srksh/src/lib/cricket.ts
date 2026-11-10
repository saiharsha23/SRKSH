import type {
  CricketDelivery,
  BattingStats,
  BowlingStats,
  FallOfWicket,
  Team,
  SportMatch,
  CricketMatch,
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
    // Also track non-striker if provided
    if (b.non_striker_name && b.non_striker_name.trim() !== '' && !battingMap.has(b.non_striker_name)) {
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
  if (runs === 1) return `Tapped into the covers for a quick single.`
  return `No run. Solid defensive block from ${striker} off ${bowler}.`
}

/* ============================================================
   PHASE 4: TOURNAMENT ANALYTICS, NRR & LEADERBOARDS
============================================================ */

export interface CricketStandingRow {
  teamId: string
  teamName: string
  teamColour: string | null
  played: number
  won: number
  lost: number
  tied: number
  points: number
  runsFor: number
  oversFor: number
  runsAgainst: number
  oversAgainst: number
  nrr: number
  nrrFormatted: string
}

export interface TournamentBattingLeader {
  name: string
  teamName: string
  teamColour: string | null
  innings: number
  runs: number
  balls: number
  highestScore: number
  isHighestNotOut: boolean
  fours: number
  sixes: number
  strikeRate: number
  average: number | null
}

export interface TournamentBowlingLeader {
  name: string
  teamName: string
  teamColour: string | null
  innings: number
  overs: string
  maidens: number
  runs: number
  wickets: number
  economy: number
  dots: number
  bestFigures: string
}

export interface TournamentMVPLeader {
  name: string
  teamName: string
  teamColour: string | null
  points: number
  runs: number
  wickets: number
  catches: number
}

/**
 * Calculates official ICC/IPL Net Run Rate (NRR) and points standings.
 * Rule: If a team is bowled out, full quota of overs is used for NRR.
 */
export function calculateCricketTournamentStandings(
  sportMatches: SportMatch[],
  cricketMatches: CricketMatch[],
  teams: Team[]
): CricketStandingRow[] {
  const standingsMap = new Map<string, {
    played: number
    won: number
    lost: number
    tied: number
    runsFor: number
    oversFor: number
    runsAgainst: number
    oversAgainst: number
  }>()

  teams.forEach(t => {
    standingsMap.set(t.id, {
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      runsFor: 0,
      oversFor: 0,
      runsAgainst: 0,
      oversAgainst: 0,
    })
  })

  const cmMap = new Map<string, CricketMatch>()
  cricketMatches.forEach(cm => cmMap.set(cm.match_id, cm))

  for (const sm of sportMatches) {
    if (sm.status !== 'completed' || !sm.team_a_id || !sm.team_b_id) continue

    const tA = sm.team_a_id
    const tB = sm.team_b_id
    const statsA = standingsMap.get(tA)
    const statsB = standingsMap.get(tB)
    if (!statsA || !statsB) continue

    statsA.played++
    statsB.played++

    if (sm.winner_team_id === tA) {
      statsA.won++
      statsB.lost++
    } else if (sm.winner_team_id === tB) {
      statsB.won++
      statsA.lost++
    } else {
      statsA.tied++
      statsB.tied++
    }

    const cm = cmMap.get(sm.id)
    if (cm) {
      const bat1Id = cm.batting_first_team_id || tA
      const bat2Id = bat1Id === tA ? tB : tA
      const statsBat1 = standingsMap.get(bat1Id)!
      const statsBat2 = standingsMap.get(bat2Id)!

      const oversLimit = cm.overs_limit || 15

      // Innings 1:
      const inngs1Runs = cm.innings1_runs || 0
      // If all out (10 wickets), use full overs limit for NRR
      const inngs1Overs = cm.innings1_wickets >= 10 ? oversLimit : (cm.innings1_legal_balls || 0) / 6

      // Innings 2:
      const inngs2Runs = cm.innings2_runs || 0
      const inngs2Overs = cm.innings2_wickets >= 10 ? oversLimit : (cm.innings2_legal_balls || 0) / 6

      // Team 1: Batting 1st
      statsBat1.runsFor += inngs1Runs
      statsBat1.oversFor += inngs1Overs
      statsBat1.runsAgainst += inngs2Runs
      statsBat1.oversAgainst += inngs2Overs

      // Team 2: Batting 2nd
      statsBat2.runsFor += inngs2Runs
      statsBat2.oversFor += inngs2Overs
      statsBat2.runsAgainst += inngs1Runs
      statsBat2.oversAgainst += inngs1Overs
    }
  }

  const rows: CricketStandingRow[] = []

  for (const [teamId, st] of standingsMap.entries()) {
    const t = teams.find(x => x.id === teamId)
    if (!t) continue

    const pts = st.won * 2 + st.tied * 1

    const rrFor = st.oversFor > 0 ? st.runsFor / st.oversFor : 0
    const rrAgainst = st.oversAgainst > 0 ? st.runsAgainst / st.oversAgainst : 0
    const nrr = Number((rrFor - rrAgainst).toFixed(3))
    const nrrFormatted = nrr > 0 ? `+${nrr.toFixed(3)}` : nrr.toFixed(3)

    rows.push({
      teamId,
      teamName: t.name,
      teamColour: t.colour,
      played: st.played,
      won: st.won,
      lost: st.lost,
      tied: st.tied,
      points: pts,
      runsFor: st.runsFor,
      oversFor: Number(st.oversFor.toFixed(1)),
      runsAgainst: st.runsAgainst,
      oversAgainst: Number(st.oversAgainst.toFixed(1)),
      nrr,
      nrrFormatted,
    })
  }

  // Sort by Points DESC, then NRR DESC, then Won DESC
  return rows.sort((a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won)
}

/**
 * Calculates Tournament Batting Leaders for Orange Cap.
 */
export function calculateTournamentBattingLeaders(
  deliveries: CricketDelivery[],
  cricketMatches: CricketMatch[],
  sportMatches: SportMatch[],
  teams: Team[]
): TournamentBattingLeader[] {
  // Map delivery to batting team
  const matchTeamMap = new Map<string, { teamAId: string | null; teamBId: string | null }>()
  sportMatches.forEach(sm => matchTeamMap.set(sm.id, { teamAId: sm.team_a_id, teamBId: sm.team_b_id }))

  const cmMap = new Map<string, CricketMatch>()
  cricketMatches.forEach(cm => cmMap.set(cm.id, cm))

  // Batter name -> Stats
  const map = new Map<string, {
    runs: number
    balls: number
    fours: number
    sixes: number
    inningsSet: Set<string>
    matchScores: Map<string, { runs: number; isOut: boolean }>
    teamId: string | null
  }>()

  for (const d of deliveries) {
    if (!map.has(d.striker_name)) {
      // Determine team
      const cm = cmMap.get(d.cricket_match_id)
      const smTeams = cm ? matchTeamMap.get(cm.match_id) : null
      let tId: string | null = null
      if (cm && smTeams) {
        if (d.innings === 1) {
          tId = cm.batting_first_team_id || smTeams.teamAId
        } else {
          tId = cm.batting_first_team_id === smTeams.teamAId ? smTeams.teamBId : smTeams.teamAId
        }
      }

      map.set(d.striker_name, {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        inningsSet: new Set(),
        matchScores: new Map(),
        teamId: tId,
      })
    }

    const b = map.get(d.striker_name)!
    b.runs += d.runs_batter || 0
    if (d.extra_type !== 'wide') {
      b.balls++
    }
    if (d.runs_batter === 4) b.fours++
    if (d.runs_batter === 6) b.sixes++

    const matchKey = `${d.cricket_match_id}-${d.innings}`
    b.inningsSet.add(matchKey)

    const mScore = b.matchScores.get(matchKey) || { runs: 0, isOut: false }
    mScore.runs += d.runs_batter || 0
    if (d.is_wicket && (d.player_dismissed === d.striker_name || !d.player_dismissed)) {
      mScore.isOut = true
    }
    b.matchScores.set(matchKey, mScore)
  }

  // Handle dismissals for non-strikers (run outs)
  for (const d of deliveries) {
    if (d.is_wicket && d.player_dismissed && map.has(d.player_dismissed)) {
      const b = map.get(d.player_dismissed)!
      const matchKey = `${d.cricket_match_id}-${d.innings}`
      const mScore = b.matchScores.get(matchKey) || { runs: 0, isOut: false }
      mScore.isOut = true
      b.matchScores.set(matchKey, mScore)
    }
  }

  const list: TournamentBattingLeader[] = []

  for (const [name, st] of map.entries()) {
    if (!name.trim()) continue
    const t = teams.find(x => x.id === st.teamId)

    // Calculate highest score across matches
    let highestScore = 0
    let isHighestNotOut = false
    let totalOuts = 0

    for (const [, ms] of st.matchScores.entries()) {
      if (ms.runs > highestScore || (ms.runs === highestScore && !ms.isOut)) {
        highestScore = ms.runs
        isHighestNotOut = !ms.isOut
      }
      if (ms.isOut) totalOuts++
    }

    const strikeRate = st.balls > 0 ? Number(((st.runs / st.balls) * 100).toFixed(1)) : 0
    const average = totalOuts > 0 ? Number((st.runs / totalOuts).toFixed(1)) : null

    list.push({
      name,
      teamName: t?.name ?? 'Team',
      teamColour: t?.colour ?? null,
      innings: st.inningsSet.size,
      runs: st.runs,
      balls: st.balls,
      highestScore,
      isHighestNotOut,
      fours: st.fours,
      sixes: st.sixes,
      strikeRate,
      average,
    })
  }

  // Sort by runs DESC, then strikeRate DESC
  return list.sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate)
}

/**
 * Calculates Tournament Bowling Leaders for Purple Cap.
 */
export function calculateTournamentBowlingLeaders(
  deliveries: CricketDelivery[],
  cricketMatches: CricketMatch[],
  sportMatches: SportMatch[],
  teams: Team[]
): TournamentBowlingLeader[] {
  const matchTeamMap = new Map<string, { teamAId: string | null; teamBId: string | null }>()
  sportMatches.forEach(sm => matchTeamMap.set(sm.id, { teamAId: sm.team_a_id, teamBId: sm.team_b_id }))

  const cmMap = new Map<string, CricketMatch>()
  cricketMatches.forEach(cm => cmMap.set(cm.id, cm))

  const map = new Map<string, {
    runs: number
    legalBalls: number
    wickets: number
    maidens: number
    dots: number
    inningsSet: Set<string>
    matchFigures: Map<string, { runs: number; wickets: number }>
    teamId: string | null
  }>()

  // Track over runs for maidens
  const overRunsMap = new Map<string, number>()

  for (const d of deliveries) {
    if (!map.has(d.bowler_name)) {
      const cm = cmMap.get(d.cricket_match_id)
      const smTeams = cm ? matchTeamMap.get(cm.match_id) : null
      let tId: string | null = null
      if (cm && smTeams) {
        // Bowling team is the opposite of batting team
        if (d.innings === 1) {
          tId = cm.batting_first_team_id === smTeams.teamAId ? smTeams.teamBId : smTeams.teamAId
        } else {
          tId = cm.batting_first_team_id || smTeams.teamAId
        }
      }

      map.set(d.bowler_name, {
        runs: 0,
        legalBalls: 0,
        wickets: 0,
        maidens: 0,
        dots: 0,
        inningsSet: new Set(),
        matchFigures: new Map(),
        teamId: tId,
      })
    }

    const b = map.get(d.bowler_name)!
    const isLegal = !d.is_extra || (d.extra_type !== 'wide' && d.extra_type !== 'no_ball')
    const bowlerConceded =
      (d.runs_batter || 0) +
      (d.extra_type === 'wide' || d.extra_type === 'no_ball' ? d.extra_runs || 1 : 0)

    b.runs += bowlerConceded
    if (isLegal) {
      b.legalBalls++
      if (bowlerConceded === 0 && !d.is_extra) {
        b.dots++
      }
    }

    if (d.is_wicket && d.wicket_type !== 'run_out') {
      b.wickets++
    }

    const matchKey = `${d.cricket_match_id}-${d.innings}`
    b.inningsSet.add(matchKey)

    const fig = b.matchFigures.get(matchKey) || { runs: 0, wickets: 0 }
    fig.runs += bowlerConceded
    if (d.is_wicket && d.wicket_type !== 'run_out') fig.wickets++
    b.matchFigures.set(matchKey, fig)

    // Over maidens tracking
    const overKey = `${matchKey}-${d.over_number}-${d.bowler_name}`
    overRunsMap.set(overKey, (overRunsMap.get(overKey) || 0) + bowlerConceded)
  }

  const list: TournamentBowlingLeader[] = []

  for (const [name, st] of map.entries()) {
    if (!name.trim()) continue
    const t = teams.find(x => x.id === st.teamId)

    // Calculate best bowling figures across matches
    let bestWickets = 0
    let bestRuns = 999
    for (const [, fig] of st.matchFigures.entries()) {
      if (
        fig.wickets > bestWickets ||
        (fig.wickets === bestWickets && fig.runs < bestRuns)
      ) {
        bestWickets = fig.wickets
        bestRuns = fig.runs
      }
    }

    const bestFigures = bestWickets > 0 ? `${bestWickets}/${bestRuns}` : `0/${st.runs}`
    const oversNum = st.legalBalls / 6
    const economy = oversNum > 0 ? Number((st.runs / oversNum).toFixed(2)) : 0

    list.push({
      name,
      teamName: t?.name ?? 'Team',
      teamColour: t?.colour ?? null,
      innings: st.inningsSet.size,
      overs: ballsToOvers(st.legalBalls),
      maidens: st.maidens,
      runs: st.runs,
      wickets: st.wickets,
      economy,
      dots: st.dots,
      bestFigures,
    })
  }

  // Sort by wickets DESC, then economy ASC
  return list.sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
}

/**
 * Calculates Tournament MVP (Most Valuable Player) Rankings.
 */
export function calculateTournamentMVPLeaders(
  batting: TournamentBattingLeader[],
  bowling: TournamentBowlingLeader[],
  deliveries: CricketDelivery[]
): TournamentMVPLeader[] {
  const map = new Map<string, TournamentMVPLeader>()

  // Catches / Fielding points
  const fieldingMap = new Map<string, number>()
  for (const d of deliveries) {
    if (d.is_wicket && d.fielder_name) {
      const f = d.fielder_name.trim()
      fieldingMap.set(f, (fieldingMap.get(f) || 0) + 1)
    }
  }

  // Batting contribution: 1 pt per run, 2.5 pts per four, 5 pts per six
  for (const b of batting) {
    const pts = b.runs * 1 + b.fours * 2.5 + b.sixes * 5
    map.set(b.name, {
      name: b.name,
      teamName: b.teamName,
      teamColour: b.teamColour,
      points: pts,
      runs: b.runs,
      wickets: 0,
      catches: fieldingMap.get(b.name) || 0,
    })
  }

  // Bowling contribution: 20 pts per wicket, 1 pt per dot ball
  for (const bw of bowling) {
    const existing = map.get(bw.name) || {
      name: bw.name,
      teamName: bw.teamName,
      teamColour: bw.teamColour,
      points: 0,
      runs: 0,
      wickets: 0,
      catches: fieldingMap.get(bw.name) || 0,
    }

    existing.wickets = bw.wickets
    existing.points += bw.wickets * 20 + bw.dots * 1
    map.set(bw.name, existing)
  }

  // Add fielding points: 10 pts per catch/stumping
  for (const [name, catches] of fieldingMap.entries()) {
    if (map.has(name)) {
      const p = map.get(name)!
      p.points += catches * 10
    }
  }

  const list = Array.from(map.values())
  // Round points and sort DESC
  list.forEach(p => {
    p.points = Math.round(p.points)
  })

  return list.sort((a, b) => b.points - a.points)
}


