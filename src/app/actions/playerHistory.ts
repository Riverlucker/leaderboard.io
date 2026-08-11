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
        const activeHoles = round.holesPlayed && round.holesPlayed.length > 0
          ? [...round.holesPlayed].sort((a, b) => a - b)
          : Array.from({ length: 18 }, (_, i) => i + 1)

        // Filter participant scores for this round
        const roundScores = participant.scores.filter(s => s.roundId === round.id)

        // Only include round if at least one score exists or was entered for this round
        const hasPlayedHoles = roundScores.some(s => s.grossStrokes !== null || (s.status !== null && s.status !== 'NOT_PLAYED'))
        if (!hasPlayedHoles) continue

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

        for (const num of activeHoles) {
          const adjusted = getRoundHoleInfo(round, num)
          const hole = round.course.holes.find(h => h.number === num)
          if (!hole) continue

          const holePar = adjusted ? adjusted.par : hole.par
          const holeStrokeIndex = adjusted ? adjusted.strokeIndex : hole.strokeIndex

          const hcpStrokes = getHandicapStrokesOnHole(courseHandicap, holeStrokeIndex)
          const score = roundScores.find(s => s.holeId === hole.id)

          let holeGross = 0

          if (score && score.status === 'WIPED') {
            hasWipedHoles = true
            // Rule: WIPED hole yields 0 points and net strokes = holePar + 3
            holeGross = holePar + hcpStrokes + 3
            totalGrossPoints += 0
            totalNetPoints += 0
          } else if (score && score.grossStrokes !== null && score.grossStrokes !== undefined) {
            holeGross = score.grossStrokes
            const netPts = calculateStablefordPoints(holeGross, holePar, hcpStrokes, true) ?? 0
            const brutPts = calculateStablefordPoints(holeGross, holePar, 0, false) ?? 0

            totalNetPoints += netPts
            totalGrossPoints += brutPts
          } else {
            // Unplayed hole fallback
            holeGross = holePar
            totalNetPoints += 2
            totalGrossPoints += 2
          }

          totalGrossStrokes += holeGross
        }

        // Target Stableford Points for the played holes (2 points per hole)
        const targetStablefordPoints = activeHoles.length * 2

        // Relative to par in Stableford: (targetPoints - earnedPoints)
        // e.g. 6 holes (target 12 pts): 8 Net pts -> 12 - 8 = +4 (4 points below target / 4 strokes over net par)
        const grossRelToPar = targetStablefordPoints - totalGrossPoints
        const netRelToPar = targetStablefordPoints - totalNetPoints

        const formatRelToPar = (val: number) => {
          if (val === 0) return "E"
          return val > 0 ? `+${val}` : `${val}`
        }

        const rawDate = round.startDate || round.endDate || competition.startDate || new Date()
        const d = new Date(rawDate)
        const dateFormatted = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

        let holesText = "1-18"
        if (activeHoles.length > 0) {
          if (activeHoles.length === 18 && activeHoles[0] === 1 && activeHoles[17] === 18) {
            holesText = "1-18"
          } else if (activeHoles.length === 9 && activeHoles[0] === 1 && activeHoles[8] === 9) {
            holesText = "1-9"
          } else if (activeHoles.length === 9 && activeHoles[0] === 10 && activeHoles[8] === 18) {
            holesText = "10-18"
          } else {
            holesText = `${activeHoles[0]}-${activeHoles[activeHoles.length - 1]}`
          }
        }

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
          holesPlayedCount: activeHoles.length,
          holesPlayedList: activeHoles,
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
