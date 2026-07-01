/**
 * Scoring calculations utility for golf app
 */

export interface Tee {
  name: string
  courseRating: number
  slope: number
}

export interface Hole {
  number: number
  par: number
  strokeIndex: number
}

/**
 * Calculates the Course Handicap for a player.
 * CH = Handicap Index * (Slope / 113) + (Course Rating - Par)
 */
export function calculateCourseHandicap(
  handicapIndex: number,
  tee: Tee,
  coursePar: number
): number {
  const courseHandicap = (handicapIndex * tee.slope) / 113 + (tee.courseRating - coursePar)
  return Math.round(courseHandicap)
}

/**
 * Determines how many handicap strokes a player receives on a specific hole
 * based on the Course Handicap and the hole's Stroke Index (1 to 18).
 */
export function getHandicapStrokesOnHole(courseHandicap: number, strokeIndex: number): number {
  if (courseHandicap >= 0) {
    const base = Math.floor(courseHandicap / 18)
    const remainder = courseHandicap % 18
    return base + (strokeIndex <= remainder ? 1 : 0)
  } else {
    // Plus handicap: player gives strokes back on the easiest holes (highest Stroke Indexes)
    const absCH = Math.abs(courseHandicap)
    const base = Math.floor(absCH / 18)
    const remainder = absCH % 18
    const isOwed = strokeIndex > 18 - remainder
    return -(base + (isOwed ? 1 : 0))
  }
}

/**
 * Calculates Stableford points for a single hole.
 * Gross Points: max(0, 2 + Par - Strokes)
 * Netto Points: max(0, 2 + Par + HandicapStrokes - Strokes)
 */
export function calculateStablefordPoints(
  strokes: number | null,
  par: number,
  handicapStrokes: number,
  isNetto: boolean = true
): number | null {
  if (strokes === null || strokes === undefined) return null

  // A wiped/picked up hole is represented by 0 strokes (or -1 in code status) and yields 0 points
  if (strokes <= 0) return 0

  const allowance = isNetto ? handicapStrokes : 0
  const points = 2 + par + allowance - strokes
  return Math.max(0, points)
}

/**
 * Assigns ranks to leaderboard entries, prefixing tied positions with 'T'.
 */
export function assignLeaderboardRanks(
  entries: any[]
): any[] {
  // Sort descending by totalPoints, then by holesPlayed (if tied, more holes played is listed first/custom rules)
  const sorted = [...entries].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints
    }
    return b.holesPlayed - a.holesPlayed
  })

  const results: any[] = []
  
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]
    
    // Find all entries that have the exact same totalPoints (and optionally same holesPlayed or just score-wise)
    // In golf, standard rank ties are based on score alone.
    const ties = sorted.filter(x => x.totalPoints === current.totalPoints)
    const isTied = ties.length > 1

    let rankString = ""
    if (isTied) {
      // Find the index of the first tied player (1-based)
      const firstTiedIndex = sorted.findIndex(x => x.totalPoints === current.totalPoints) + 1
      rankString = `T${firstTiedIndex}`
    } else {
      rankString = `${i + 1}`
    }

    results.push({
      ...current,
      rank: rankString
    })
  }

  return results
}
