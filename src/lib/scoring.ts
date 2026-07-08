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
  entries: any[],
  sortByRelToPar: boolean = false
): any[] {
  // Sort descending by totalPoints (or ascending by relToPar if active), then by holesPlayed
  const sorted = [...entries].sort((a, b) => {
    if (sortByRelToPar) {
      if (a.relToPar !== b.relToPar) {
        return a.relToPar - b.relToPar
      }
    } else {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
      }
    }
    return b.holesPlayed - a.holesPlayed
  })

  const results: any[] = []
  
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]
    
    const compareField = sortByRelToPar ? 'relToPar' : 'totalPoints'
    const ties = sorted.filter(x => x[compareField] === current[compareField])
    const isTied = ties.length > 1

    let rankString = ""
    if (isTied) {
      // Find the index of the first tied player (1-based)
      const firstTiedIndex = sorted.findIndex(x => x[compareField] === current[compareField]) + 1
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

/**
 * Resolves hole par and stroke index adjusting for 9-hole loop presets
 */
export function getRoundHoleInfo(round: any, holeNum: number) {
  const course = round?.course
  if (!course || !course.holes) return null

  const preset = round.ninePreset // 'FRONT_9_TWICE' or 'BACK_9_TWICE' or null
  
  let targetHoleNum = holeNum
  let isSecondLoop = false

  if (preset === 'FRONT_9_TWICE') {
    if (holeNum <= 9) {
      targetHoleNum = holeNum
    } else {
      targetHoleNum = holeNum - 9
      isSecondLoop = true
    }
  } else if (preset === 'BACK_9_TWICE') {
    if (holeNum <= 9) {
      targetHoleNum = holeNum + 9
    } else {
      targetHoleNum = holeNum
      isSecondLoop = true
    }
  }

  const courseHole = course.holes.find((h: any) => h.number === targetHoleNum)
  if (!courseHole) return null

  const I = courseHole.strokeIndex
  let adjustedIndex = I
  if (preset === 'FRONT_9_TWICE' || preset === 'BACK_9_TWICE') {
    if (!isSecondLoop) {
      adjustedIndex = (I % 2 === 0) ? I - 1 : I
    } else {
      adjustedIndex = (I % 2 === 0) ? I : I + 1
    }
  }

  return {
    ...courseHole,
    par: courseHole.par,
    strokeIndex: adjustedIndex,
    originalHole: courseHole
  }
}

