"use server"

import prisma from "@/lib/prisma"
import {
  calculateCourseHandicap,
  getHandicapStrokesOnHole,
  calculateStablefordPoints,
  getRoundHoleInfo
} from "@/lib/scoring"

export interface PlayerHistoryRound {
  roundId: string
  competitionId: string
  competitionName: string
  competitionSlug: string
  date: string
  dateFormatted: string
  courseId: string
  courseName: string
  holesPlayedText: string
  holesPlayedCount: number
  holesPlayedList: number[]
  grossRelToPar: number
  grossRelToParFormatted: string
  netRelToPar: number
  netRelToParFormatted: string
  totalStrokes: number
  grossStablefordPoints: number
  netStablefordPoints: number
  hasWipedHoles: boolean
  participant: any
  round: any
  competition: any
}

function formatHoleRangeString(holes: number[]): string {
  if (holes.length === 0) return "-"
  if (holes.length === 18 && holes[0] === 1 && holes[17] === 18) return "1-18"
  if (holes.length === 9 && holes[0] === 1 && holes[8] === 9) return "1-9"
  if (holes.length === 9 && holes[0] === 10 && holes[8] === 18) return "10-18"

  const parts: string[] = []
  let start = holes[0]
  let prev = holes[0]

  for (let i = 1; i < holes.length; i++) {
    const current = holes[i]
    if (current === prev + 1) {
      prev = current
    } else {
      if (start === prev) {
        parts.push(String(start))
      } else {
        parts.push(`${start}-${prev}`)
      }
      start = current
      prev = current
    }
  }
  if (start === prev) {
    parts.push(String(start))
  } else {
    parts.push(`${start}-${prev}`)
  }
  return parts.join(",")
}

export async function getPlayerRoundHistory(input: {
  userId?: string | null
  dummyName?: string | null
}): Promise<{ success: boolean; data?: PlayerHistoryRound[]; error?: string }> {
  try {
    const { userId, dummyName } = input

    if (!userId && !dummyName) {
      return { success: false, error: "Either userId or dummyName must be provided" }
    }

    // Find all participants matching userId or dummyName
    const participants = await prisma.participant.findMany({
      where: userId
        ? { userId }
        : { dummyName, userId: null },
      include: {
        competition: {
          include: {
            rounds: {
              include: {
                course: {
                  include: {
                    holes: true,
                    tees: true
                  }
                },
                tee: true
              }
            },
            participants: {
              include: {
                user: true,
                scores: true,
                manualRoundHandicaps: true
              }
            }
          }
        },
        user: true,
        scores: true,
        manualRoundHandicaps: true
      }
    })

    if (participants.length === 0) {
      return { success: true, data: [] }
    }

    const roundHistories: PlayerHistoryRound[] = []

    for (const participant of participants) {
      const competition = participant.competition
      if (!competition || !competition.rounds) continue

      for (const round of competition.rounds) {
        // Filter participant scores for this round that are actually played (or wiped)
        const roundScores = participant.scores.filter(
          s => s.roundId === round.id && (s.grossStrokes !== null || s.status === 'WIPED')
        )

        // Only include round if at least one hole was actually played
        if (roundScores.length === 0) continue

        // Get the set of hole IDs actually played
        const playedHoleIds = new Set(roundScores.map(s => s.holeId))

        // Get the matching hole objects from round course, ordered by number
        const playedCourseHoles = round.course.holes
          .filter(h => playedHoleIds.has(h.id))
          .sort((a, b) => a.number - b.number)

        if (playedCourseHoles.length === 0) continue

        const activeHolesList = playedCourseHoles.map(h => h.number)

        // Tee selection
        const tee = round.tee ||
                    round.course.tees.find(t => t.name.toLowerCase().includes('yellow')) ||
                    round.course.tees.find(t => t.name.toLowerCase().includes('white')) ||
                    round.course.tees[0]

        const courseParTotal = round.course.holes.reduce((sum, h) => sum + h.par, 0)

        // Manual or calculated Course Handicap
        const manualHcp = participant.manualRoundHandicaps.find(m => m.roundId === round.id)
        const courseHandicap = manualHcp !== undefined && manualHcp !== null
          ? manualHcp.handicapValue
          : (participant.compHandicap !== null && participant.compHandicap !== undefined && tee
              ? calculateCourseHandicap(participant.compHandicap, tee, courseParTotal)
              : 0)

        let totalGrossStrokes = 0
        let totalGrossPoints = 0
        let totalNetPoints = 0
        let hasWipedHoles = false

        for (const hole of playedCourseHoles) {
          const adjusted = getRoundHoleInfo(round, hole.number)
          const holePar = adjusted ? adjusted.par : hole.par
          const holeStrokeIndex = adjusted ? adjusted.strokeIndex : hole.strokeIndex

          const hcpStrokes = getHandicapStrokesOnHole(courseHandicap, holeStrokeIndex)
          const score = roundScores.find(s => s.holeId === hole.id)

          let holeGross = 0

          if (score && score.status === 'WIPED') {
            hasWipedHoles = true
            // Rule: WIPED hole yields 0 points and gross stroke substitute = holePar + hcpStrokes + 3
            holeGross = holePar + hcpStrokes + 3
            totalGrossPoints += 0
            totalNetPoints += 0
          } else if (score && score.grossStrokes !== null && score.grossStrokes !== undefined) {
            holeGross = score.grossStrokes
            const netPts = calculateStablefordPoints(holeGross, holePar, hcpStrokes, true) ?? 0
            const brutPts = calculateStablefordPoints(holeGross, holePar, 0, false) ?? 0

            totalNetPoints += netPts
            totalGrossPoints += brutPts
          }

          totalGrossStrokes += holeGross
        }

        // Target Stableford Points for the played holes (2 points per hole)
        const targetStablefordPoints = playedCourseHoles.length * 2

        // Relative to par in Stableford: (targetPoints - earnedPoints)
        const grossRelToPar = targetStablefordPoints - totalGrossPoints
        const netRelToPar = targetStablefordPoints - totalNetPoints

        const formatRelToPar = (val: number) => {
          if (val === 0) return "E"
          return val > 0 ? `+${val}` : `${val}`
        }

        const rawDate = round.startDate || round.endDate || competition.startDate || new Date()
        const d = new Date(rawDate)
        const dateFormatted = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
        const holesText = formatHoleRangeString(activeHolesList)

        roundHistories.push({
          roundId: round.id,
          competitionId: round.competitionId,
          competitionName: competition.name,
          competitionSlug: competition.uniqueSlug,
          date: d.toISOString(),
          dateFormatted,
          courseId: round.courseId,
          courseName: round.course.name,
          holesPlayedText: holesText,
          holesPlayedCount: playedCourseHoles.length,
          holesPlayedList: activeHolesList,
          grossRelToPar,
          grossRelToParFormatted: formatRelToPar(grossRelToPar),
          netRelToPar,
          netRelToParFormatted: formatRelToPar(netRelToPar),
          totalStrokes: totalGrossStrokes,
          grossStablefordPoints: totalGrossPoints,
          netStablefordPoints: totalNetPoints,
          hasWipedHoles,
          participant,
          round,
          competition
        })
      }
    }

    // Sort descending by date
    roundHistories.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return { success: true, data: roundHistories }
  } catch (error: any) {
    console.error("Error in getPlayerRoundHistory:", error)
    return { success: false, error: error?.message || "Failed to fetch player history" }
  }
}
