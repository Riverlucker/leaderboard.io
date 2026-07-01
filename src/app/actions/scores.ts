"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  calculateCourseHandicap,
  getHandicapStrokesOnHole,
  calculateStablefordPoints
} from "@/lib/scoring"

interface SaveScoreInput {
  participantId: string
  roundId: string
  holeId: string
  grossStrokes: number | null // null or 1..9, or 0 representing wiped (if status === 'WIPED')
  status: string | null // "WIPED" or "NOT_PLAYED" or null
  enteredByUserId: string
  enteredByUserName: string
}

export async function saveHoleScore(input: SaveScoreInput) {
  const { participantId, roundId, holeId, grossStrokes, status, enteredByUserId, enteredByUserName } = input

  // 1. Fetch participant, round, hole, and course details
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { competition: true, user: true }
  })
  if (!participant) throw new Error("Participant not found")

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { course: { include: { tees: true } } }
  })
  if (!round) throw new Error("Round not found")

  const hole = await prisma.hole.findUnique({
    where: { id: holeId }
  })
  if (!hole) throw new Error("Hole not found")

  // 2. Determine playing handicap and strokes received
  // Find the Yellow/White/Default tee of the course
  const tee = round.course.tees.find(t => t.name.toLowerCase() === 'yellow') ||
              round.course.tees.find(t => t.name.toLowerCase() === 'white') ||
              round.course.tees[0]

  let netStrokes = null
  let points = null
  let resolvedStrokes = grossStrokes

  if (status === 'WIPED') {
    resolvedStrokes = 0 // use 0 internally to signify wiped
    netStrokes = 0
    points = 0
  } else if (status === 'NOT_PLAYED') {
    resolvedStrokes = null
    netStrokes = null
    points = null
  } else if (grossStrokes !== null) {
    if (tee && participant.compHandicap !== null) {
      // Get the course par
      const courseHoles = await prisma.hole.findMany({
        where: { courseId: round.courseId }
      })
      const coursePar = courseHoles.reduce((sum, h) => sum + h.par, 0)

      // Course Handicap
      const courseHandicap = calculateCourseHandicap(participant.compHandicap, tee, coursePar)
      
      // Handicap strokes for this specific hole
      const hcpStrokes = getHandicapStrokesOnHole(courseHandicap, hole.strokeIndex)

      netStrokes = Math.max(0, grossStrokes - hcpStrokes)
      
      // Calculate Stableford points (default Netto Stableford points for this app's main type)
      points = calculateStablefordPoints(grossStrokes, hole.par, hcpStrokes, true)
    } else {
      netStrokes = grossStrokes
      points = calculateStablefordPoints(grossStrokes, hole.par, 0, false)
    }
  }

  // 3. Upsert Score in the database
  const existingScore = await prisma.score.findFirst({
    where: {
      participantId,
      roundId,
      holeId
    }
  })

  let updatedScore
  if (existingScore) {
    updatedScore = await prisma.score.update({
      where: { id: existingScore.id },
      data: {
        grossStrokes: resolvedStrokes,
        netStrokes,
        points,
        status,
        enteredBy: enteredByUserName
      }
    })
  } else {
    updatedScore = await prisma.score.create({
      data: {
        participantId,
        roundId,
        holeId,
        grossStrokes: resolvedStrokes,
        netStrokes,
        points,
        status,
        enteredBy: enteredByUserName
      }
    })
  }

  // 4. Group Audit Log: Check if there's a recent log in the last 15 seconds for this user
  const compId = participant.competitionId
  const playerName = participant.userId ? (participant.user?.name || participant.user?.email) : participant.dummyName
  const fifteenSecondsAgo = new Date(Date.now() - 15000)

  const recentLog = await prisma.auditLog.findFirst({
    where: {
      competitionId: compId,
      action: "SCORE_UPDATE",
      userId: enteredByUserId,
      createdAt: { gte: fifteenSecondsAgo }
    },
    orderBy: { createdAt: 'desc' }
  })

  const detailsString = `Player: ${playerName}, Hole: ${hole.number}, Strokes: ${status === 'WIPED' ? '/' : status === 'NOT_PLAYED' ? '-' : grossStrokes}`

  if (recentLog) {
    // Append or update existing log entry to prevent spamming
    await prisma.auditLog.update({
      where: { id: recentLog.id },
      data: {
        details: `${recentLog.details.split("\n").filter(line => !line.startsWith(`Player: ${playerName}, Hole: ${hole.number}`)).join("\n")}\n${detailsString}`.trim(),
        createdAt: new Date() // reset timestamp to keep it active
      }
    })
  } else {
    // Create new log entry
    await prisma.auditLog.create({
      data: {
        competitionId: compId,
        action: "SCORE_UPDATE",
        details: detailsString,
        userId: enteredByUserId,
        userName: enteredByUserName
      }
    })
  }

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath(`/c/${participant.competition.uniqueSlug}`)
  return { success: true, score: updatedScore }
}

export async function clearPlayerRoundScores(roundId: string, participantId: string, enteredByUserId: string, enteredByUserName: string) {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { user: true }
  })
  if (!participant) throw new Error("Participant not found")

  await prisma.score.deleteMany({
    where: {
      roundId,
      participantId
    }
  })

  const playerName = participant.userId ? (participant.user?.name || participant.user?.email) : participant.dummyName
  await prisma.auditLog.create({
    data: {
      competitionId: participant.competitionId,
      action: "SCORE_CLEAR",
      details: `Cleared all scores for round ID: ${roundId} of player: ${playerName}`,
      userId: enteredByUserId,
      userName: enteredByUserName
    }
  })

  revalidatePath(`/admin/competitions/${participant.competitionId}`)
  return { success: true }
}

export async function saveManualCourseHandicap(
  participantId: string,
  courseId: string,
  value: number
) {
  await prisma.manualCourseHandicap.upsert({
    where: {
      participantId_courseId: {
        participantId,
        courseId
      }
    },
    update: {
      handicapValue: value
    },
    create: {
      participantId,
      courseId,
      handicapValue: value
    }
  })

  const part = await prisma.participant.findUnique({
    where: { id: participantId }
  })
  if (part) {
    revalidatePath(`/admin/competitions/${part.competitionId}`)
  }
  return { success: true }
}

export async function recalculateCourseHandicaps(compId: string, courseId: string) {
  const participants = await prisma.participant.findMany({
    where: { competitionId: compId }
  })
  const partIds = participants.map(p => p.id)

  await prisma.manualCourseHandicap.deleteMany({
    where: {
      courseId,
      participantId: { in: partIds }
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}

export async function recalculatePlayerHandicaps(compId: string, participantId: string) {
  await prisma.manualCourseHandicap.deleteMany({
    where: { participantId }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}

export async function resetAllScores(compId: string, enteredByUserId: string, enteredByUserName: string) {
  const rounds = await prisma.round.findMany({
    where: { competitionId: compId }
  })
  const roundIds = rounds.map(r => r.id)

  await prisma.score.deleteMany({
    where: {
      roundId: { in: roundIds }
    }
  })

  await prisma.auditLog.create({
    data: {
      competitionId: compId,
      action: "SCORE_CLEAR",
      details: "Reset ALL scores for the entire competition",
      userId: enteredByUserId,
      userName: enteredByUserName
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}

export async function resetRoundScores(compId: string, roundId: string, enteredByUserId: string, enteredByUserName: string) {
  await prisma.score.deleteMany({
    where: { roundId }
  })

  const round = await prisma.round.findUnique({ where: { id: roundId } })
  const roundName = round?.name || roundId

  await prisma.auditLog.create({
    data: {
      competitionId: compId,
      action: "SCORE_CLEAR",
      details: `Reset all scores for round: ${roundName}`,
      userId: enteredByUserId,
      userName: enteredByUserName
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}

export async function resetPlayerScores(compId: string, participantId: string, enteredByUserId: string, enteredByUserName: string) {
  const rounds = await prisma.round.findMany({
    where: { competitionId: compId }
  })
  const roundIds = rounds.map(r => r.id)

  await prisma.score.deleteMany({
    where: {
      participantId,
      roundId: { in: roundIds }
    }
  })

  const p = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { user: true }
  })
  const playerName = p?.userId ? (p.user?.name || p.user?.email) : p?.dummyName

  await prisma.auditLog.create({
    data: {
      competitionId: compId,
      action: "SCORE_CLEAR",
      details: `Reset all scores for player: ${playerName}`,
      userId: enteredByUserId,
      userName: enteredByUserName
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}

export async function resetPlayerRoundScores(compId: string, roundId: string, participantId: string, enteredByUserId: string, enteredByUserName: string) {
  await prisma.score.deleteMany({
    where: {
      participantId,
      roundId
    }
  })

  const round = await prisma.round.findUnique({ where: { id: roundId } })
  const roundName = round?.name || roundId

  const p = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { user: true }
  })
  const playerName = p?.userId ? (p.user?.name || p.user?.email) : p?.dummyName

  await prisma.auditLog.create({
    data: {
      competitionId: compId,
      action: "SCORE_CLEAR",
      details: `Reset scores for player: ${playerName} in round: ${roundName}`,
      userId: enteredByUserId,
      userName: enteredByUserName
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}
