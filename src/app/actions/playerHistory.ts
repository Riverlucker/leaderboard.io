"use server"

import prisma from "@/lib/prisma"
import {
  calculateCourseHandicap,
  getHandicapStrokesOnHole,
  getRoundHoleInfo
} from "@/lib/scoring"

export interface PlayerHistoryRound {
  roundId: string
  competitionId: string
  competitionName: string
  competitionSlug: string
  date: string // ISO string or formatted date
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
        competition: true,
        user: true,
        scores: true,
        manualRoundHandicaps: true
      }
    })

    if (participants.length === 0) {
      return { success: true, data: [] }
    }

    const participantIds = participants.map(p => p.id)
    const compIds = participants.map(p => p.competitionId)

    // Fetch all rounds associated with these competitions
    const rounds = await prisma.round.findMany({
      where: { competitionId: { in: compIds } },
      include: {
        competition: true,
        course: {
          include: {
            holes: true,
            tees: true
          }
        },
        tee: true
      },
      orderBy: { startDate: 'desc' }
    })

    const roundHistories: PlayerHistoryRound[] = []

    for (const round of rounds) {
      // Find participant entry for this competition
      const participant = participants.find(p => p.competitionId === round.competitionId)
      if (!participant) continue

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
      let totalNetStrokes = 0
      let totalPar = 0
      let hasWipedHoles = false

      for (const num of activeHoles) {
        const adjusted = getRoundHoleInfo(round, num)
        const hole = round.course.holes.find(h => h.number === num)
        if (!hole) continue

        const holePar = adjusted ? adjusted.par : hole.par
        const holeStrokeIndex = adjusted ? adjusted.strokeIndex : hole.strokeIndex

        totalPar += holePar

        const hcpStrokes = getHandicapStrokesOnHole(courseHandicap, holeStrokeIndex)
        const score = roundScores.find(s => s.holeId === hole.id)

        let holeGross = 0
        let holeNet = 0

        if (score && score.status === 'WIPED') {
          hasWipedHoles = true
          // Rule: WIPED hole yields -1 net points (i.e. 3 over net par)
          // Net strokes = holePar + 3
          // Gross strokes = holePar + hcpStrokes + 3
          holeNet = holePar + 3
          holeGross = holePar + hcpStrokes + 3
        } else if (score && score.grossStrokes !== null && score.grossStrokes !== undefined) {
          holeGross = score.grossStrokes
          holeNet = Math.max(0, holeGross - hcpStrokes)
        } else {
          // Unplayed hole within played round fallback
          holeGross = holePar
          holeNet = holePar
        }

        totalGrossStrokes += holeGross
        totalNetStrokes += holeNet
      }

      const grossRelToPar = totalGrossStrokes - totalPar
      const netRelToPar = totalNetStrokes - totalPar

      const formatRelToPar = (val: number) => {
        if (val === 0) return "E"
        return val > 0 ? `+${val}` : `${val}`
      }

      const rawDate = round.startDate || round.endDate || participant.competition.startDate || new Date()
      const d = new Date(rawDate)
      const dateFormatted = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

      // Holes played text string e.g. "1-18" or "13-18"
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
        competitionName: round.competition.name,
        competitionSlug: round.competition.uniqueSlug,
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
        hasWipedHoles,
        participant,
        round,
        competition: round.competition
      })
    }

    // Sort descending by date
    roundHistories.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return { success: true, data: roundHistories }
  } catch (error: any) {
    console.error("Error in getPlayerRoundHistory:", error)
    return { success: false, error: error?.message || "Failed to fetch player history" }
  }
}
