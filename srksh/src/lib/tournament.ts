import type { Team, SportMatch, ScoringType, MatchScoreData } from '../types'

/**
 * Detects the best scoring engine for a given sport name or category.
 */
export function detectScoringType(sportName: string, category?: string | null): ScoringType {
  const combined = `${sportName} ${category ?? ''}`.toLowerCase()
  if (combined.includes('cricket')) return 'cricket'
  if (
    combined.includes('football') ||
    combined.includes('soccer') ||
    combined.includes('futsal') ||
    combined.includes('hockey')
  ) {
    return 'football'
  }
  if (
    combined.includes('volleyball') ||
    combined.includes('badminton') ||
    combined.includes('table tennis') ||
    combined.includes('tennis') ||
    combined.includes('throwball')
  ) {
    return 'sets'
  }
  if (
    combined.includes('kabaddi') ||
    combined.includes('basketball') ||
    combined.includes('tug of war') ||
    combined.includes('kho kho') ||
    combined.includes('dodgeball') ||
    combined.includes('carrom') ||
    combined.includes('chess')
  ) {
    return 'points'
  }
  return 'points'
}

type FixtureDraft = Omit<SportMatch, 'id' | 'created_at' | 'updated_at'>

/**
 * Generates Round-Robin (League) matches using the standard Berger rotation algorithm.
 * Every participating team plays every other team once.
 */
export function generateRoundRobinFixtures(
  teams: Team[],
  sportId: string,
  defaultVenue?: string | null,
  scoringType: ScoringType = 'points'
): FixtureDraft[] {
  if (teams.length < 2) return []

  const list: (Team | null)[] = [...teams]
  // If odd number of teams, pad with null (represents a "BYE")
  if (list.length % 2 !== 0) {
    list.push(null)
  }

  const n = list.length
  const rounds = n - 1
  const matchesPerRound = n / 2
  const fixtures: FixtureDraft[] = []
  let matchCounter = 1

  for (let r = 0; r < rounds; r++) {
    for (let m = 0; m < matchesPerRound; m++) {
      const teamA = list[m]
      const teamB = list[n - 1 - m]

      // Ignore BYE matches
      if (!teamA || !teamB) continue

      fixtures.push({
        sport_id: sportId,
        team_a_id: teamA.id,
        team_b_id: teamB.id,
        round_name: `Round ${r + 1}`,
        match_number: matchCounter++,
        scheduled_date: null,
        scheduled_time: null,
        venue: defaultVenue || null,
        status: 'scheduled',
        winner_team_id: null,
        score_data: { scoring_type: scoringType },
      })
    }

    // Rotate elements, keeping list[0] fixed (Berger table rotation)
    const fixed = list[0]
    const rotated = [fixed, list[n - 1], ...list.slice(1, n - 1)]
    for (let i = 0; i < n; i++) {
      list[i] = rotated[i]
    }
  }

  return fixtures
}

/**
 * Generates Knockout (Bracket / Single Elimination) fixtures.
 */
export function generateKnockoutFixtures(
  teams: Team[],
  sportId: string,
  includeThirdPlace: boolean = true,
  defaultVenue?: string | null,
  scoringType: ScoringType = 'points'
): FixtureDraft[] {
  if (teams.length < 2) return []
  const fixtures: FixtureDraft[] = []
  let matchCounter = 1

  if (teams.length === 2) {
    // Direct Final
    fixtures.push({
      sport_id: sportId,
      team_a_id: teams[0].id,
      team_b_id: teams[1].id,
      round_name: 'Final',
      match_number: matchCounter++,
      scheduled_date: null,
      scheduled_time: null,
      venue: defaultVenue || null,
      status: 'scheduled',
      winner_team_id: null,
      score_data: { scoring_type: scoringType },
    })
    return fixtures
  }

  if (teams.length <= 4) {
    // 3 or 4 teams: 2 Semi-Finals, optional 3rd Place match, Final
    const [t1, t2, t3, t4] = teams
    fixtures.push({
      sport_id: sportId,
      team_a_id: t1.id,
      team_b_id: t4 ? t4.id : t2.id,
      round_name: 'Semi-Final 1',
      match_number: matchCounter++,
      scheduled_date: null,
      scheduled_time: null,
      venue: defaultVenue || null,
      status: 'scheduled',
      winner_team_id: null,
      score_data: { scoring_type: scoringType },
    })

    fixtures.push({
      sport_id: sportId,
      team_a_id: t4 ? t2.id : t3.id,
      team_b_id: t4 ? t3.id : null,
      round_name: 'Semi-Final 2',
      match_number: matchCounter++,
      scheduled_date: null,
      scheduled_time: null,
      venue: defaultVenue || null,
      status: 'scheduled',
      winner_team_id: null,
      score_data: { scoring_type: scoringType },
    })

    if (includeThirdPlace) {
      fixtures.push({
        sport_id: sportId,
        team_a_id: null, // to be populated when SFs finish
        team_b_id: null,
        round_name: '3rd Place Playoff',
        match_number: matchCounter++,
        scheduled_date: null,
        scheduled_time: null,
        venue: defaultVenue || null,
        status: 'scheduled',
        winner_team_id: null,
        score_data: { scoring_type: scoringType, notes: 'Loser SF1 vs Loser SF2' },
      })
    }

    fixtures.push({
      sport_id: sportId,
      team_a_id: null, // to be populated when SFs finish
      team_b_id: null,
      round_name: 'Final',
      match_number: matchCounter++,
      scheduled_date: null,
      scheduled_time: null,
      venue: defaultVenue || null,
      status: 'scheduled',
      winner_team_id: null,
      score_data: { scoring_type: scoringType, notes: 'Winner SF1 vs Winner SF2' },
    })

    return fixtures
  }

  // 5 to 8 teams: Quarter-Finals -> Semi-Finals -> Final
  const quarterCount = 4
  for (let q = 0; q < quarterCount; q++) {
    const a = teams[q] ?? null
    const b = teams[7 - q] ?? teams[quarterCount + q] ?? null
    fixtures.push({
      sport_id: sportId,
      team_a_id: a?.id ?? null,
      team_b_id: b?.id ?? null,
      round_name: `Quarter-Final ${q + 1}`,
      match_number: matchCounter++,
      scheduled_date: null,
      scheduled_time: null,
      venue: defaultVenue || null,
      status: 'scheduled',
      winner_team_id: null,
      score_data: { scoring_type: scoringType },
    })
  }

  // Semi-Finals
  fixtures.push({
    sport_id: sportId,
    team_a_id: null,
    team_b_id: null,
    round_name: 'Semi-Final 1',
    match_number: matchCounter++,
    scheduled_date: null,
    scheduled_time: null,
    venue: defaultVenue || null,
    status: 'scheduled',
    winner_team_id: null,
    score_data: { scoring_type: scoringType, notes: 'Winner QF1 vs Winner QF2' },
  })

  fixtures.push({
    sport_id: sportId,
    team_a_id: null,
    team_b_id: null,
    round_name: 'Semi-Final 2',
    match_number: matchCounter++,
    scheduled_date: null,
    scheduled_time: null,
    venue: defaultVenue || null,
    status: 'scheduled',
    winner_team_id: null,
    score_data: { scoring_type: scoringType, notes: 'Winner QF3 vs Winner QF4' },
  })

  if (includeThirdPlace) {
    fixtures.push({
      sport_id: sportId,
      team_a_id: null,
      team_b_id: null,
      round_name: '3rd Place Playoff',
      match_number: matchCounter++,
      scheduled_date: null,
      scheduled_time: null,
      venue: defaultVenue || null,
      status: 'scheduled',
      winner_team_id: null,
      score_data: { scoring_type: scoringType, notes: 'Loser SF1 vs Loser SF2' },
    })
  }

  fixtures.push({
    sport_id: sportId,
    team_a_id: null,
    team_b_id: null,
    round_name: 'Final',
    match_number: matchCounter++,
    scheduled_date: null,
    scheduled_time: null,
    venue: defaultVenue || null,
    status: 'scheduled',
    winner_team_id: null,
    score_data: { scoring_type: scoringType, notes: 'Winner SF1 vs Winner SF2' },
  })

  return fixtures
}

/**
 * Formats scores nicely based on scoring_type (cricket, football, sets, points, custom).
 */
export function formatMatchScoreDisplay(
  match: SportMatch,
  teamA?: Team | null,
  teamB?: Team | null
): {
  aScore: string
  bScore: string
  summary: string
  tossText?: string | null
  playerOfMatch?: string | null
} {
  const d: MatchScoreData = match.score_data || {}
  const type = d.scoring_type || 'points'
  const winner = match.winner_team_id
    ? match.winner_team_id === teamA?.id
      ? teamA
      : match.winner_team_id === teamB?.id
      ? teamB
      : null
    : null

  let aScore = ''
  let bScore = ''
  let defaultSummary = ''
  let tossText: string | null = null

  if (type === 'cricket') {
    const cA = d.team_a_cricket
    const cB = d.team_b_cricket

    if (cA && cA.runs !== '' && cA.runs != null) {
      const wkts = cA.wickets !== '' && cA.wickets != null ? `/${cA.wickets}` : ''
      const ov = cA.overs !== '' && cA.overs != null ? ` (${cA.overs} ov)` : ''
      aScore = `${cA.runs}${wkts}${ov}`
    }

    if (cB && cB.runs !== '' && cB.runs != null) {
      const wkts = cB.wickets !== '' && cB.wickets != null ? `/${cB.wickets}` : ''
      const ov = cB.overs !== '' && cB.overs != null ? ` (${cB.overs} ov)` : ''
      bScore = `${cB.runs}${wkts}${ov}`
    }

    if (d.toss_winner_team_id && d.toss_decision) {
      const tWinner = d.toss_winner_team_id === teamA?.id ? teamA?.name : teamB?.name
      tossText = `${tWinner || 'Toss winner'} chose to ${d.toss_decision}`
    }

    if (winner) {
      defaultSummary = `${winner.name} won`
    }
  } else if (type === 'football') {
    const gA = d.team_a_goals
    const gB = d.team_b_goals
    if (gA != null && gA !== '') aScore = String(gA)
    if (gB != null && gB !== '') bScore = String(gB)

    if (d.penalty_shootout && (d.penalty_shootout.team_a !== '' || d.penalty_shootout.team_b !== '')) {
      const pens = `(${d.penalty_shootout.team_a ?? 0} - ${d.penalty_shootout.team_b ?? 0} pens)`
      defaultSummary = winner ? `${winner.name} won ${pens}` : pens
    } else if (winner) {
      defaultSummary = `${winner.name} won`
    }
  } else if (type === 'sets') {
    const sA = d.team_a_sets
    const sB = d.team_b_sets
    if (sA != null && sA !== '') aScore = `${sA} sets`
    if (sB != null && sB !== '') bScore = `${sB} sets`

    if (d.set_scores && d.set_scores.length > 0) {
      const validSets = d.set_scores.filter(Boolean).join(', ')
      if (validSets) {
        defaultSummary = winner ? `${winner.name} won (${validSets})` : validSets
      }
    } else if (winner) {
      defaultSummary = `${winner.name} won`
    }
  } else {
    // points / generic
    const pA = d.team_a_points
    const pB = d.team_b_points
    if (pA != null && pA !== '') aScore = `${pA} pts`
    if (pB != null && pB !== '') bScore = `${pB} pts`

    if (winner) {
      defaultSummary = `${winner.name} won`
    }
  }

  const summary = d.result_summary?.trim() || defaultSummary

  return {
    aScore,
    bScore,
    summary,
    tossText,
    playerOfMatch: d.player_of_match || null,
  }
}
