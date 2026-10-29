"use server"

import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { atomic } from "@/lib/transaction"
import { requireUser, requireAdmin, assertScoreAccess, assertRoundCompetition, assertParticipantCompetition, assertTeeCourse } from "@/lib/access"
import { assertScoreValue, assertPlayingHandicap } from "@/lib/access-policy"
import { calculateCourseHandicap, getHandicapStrokesOnHole, calculateStablefordPoints, getRoundHoleInfo } from "@/lib/scoring"

interface BatchScoreInput {
  participantId: string
  roundId: string
  holeId: string
  grossStrokes: number | null
  status: string | null
}
interface SaveScoreInput extends BatchScoreInput {
  enteredByUserId: string
  enteredByUserName: string
}

export async function saveHoleScore(input: SaveScoreInput) {
  const participant = await prisma.participant.findUniqueOrThrow({where: {id: input.participantId}, select: {competitionId: true}})
  const result = await saveBatchScores(participant.competitionId, [input], "", "")
  return {success: true, score: result.scores[0]}
}

export async function saveBatchScores(
  compId: string, inputs: BatchScoreInput[], _enteredByUserId: string, _enteredByUserName: string,
) {
  const actor = await requireUser()
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 500) throw new Error("Ungültige Scoreliste.")
  const result = await atomic(async db => {
    const competition = await db.competition.findUniqueOrThrow({where: {id: compId}})
    if (["WINTERCUP", "CL_FORMAT"].includes(competition.type)) throw new Error("Für dieses Format die Match-Ergebniseingabe verwenden.")
    const scores = []
    const details: string[] = []
    const loadRound = (id: string) => db.round.findUniqueOrThrow({where: {id}, include: {tee: true, course: {include: {tees: true, holes: true}}}})
    const loadParticipant = (id: string) => db.participant.findUniqueOrThrow({where: {id}, include: {user: {select: {name: true}}, manualRoundHandicaps: {include: {tee: true}}}})
    const rounds = new Map<string, Awaited<ReturnType<typeof loadRound>>>()
    const participants = new Map<string, Awaited<ReturnType<typeof loadParticipant>>>()
    const permissions = new Map<string, Set<number>>()
    for (const input of inputs) {
      assertScoreValue(input.grossStrokes, input.status)
      const [round, participant] = await Promise.all([
        rounds.get(input.roundId) || loadRound(input.roundId),
        participants.get(input.participantId) || loadParticipant(input.participantId),
      ])
      rounds.set(round.id, round)
      participants.set(participant.id, participant)
      const hole = round.course.holes.find(h => h.id === input.holeId)
      if (!hole || hole.courseId !== round.courseId) throw new Error("Loch gehört nicht zum Golfplatz der Runde.")
      await assertScoreAccess(actor, participant.id, round.id, compId, hole.number, db, permissions)
      const manual = participant.manualRoundHandicaps.find(h => h.roundId === round.id)
      const tee = manual?.tee || round.tee || round.course.tees.find(t => /yellow|gelb/i.test(t.name)) || round.course.tees.find(t => /white|weiß/i.test(t.name)) || round.course.tees[0]
      const adjusted = getRoundHoleInfo(round, hole.number) || hole
      const handicap = manual?.handicapValue ?? (participant.compHandicap != null && tee
        ? calculateCourseHandicap(participant.compHandicap, tee, round.course.holes.reduce((sum, h) => sum + h.par, 0)) : 0)
      const strokes = getHandicapStrokesOnHole(handicap, adjusted.strokeIndex)
      const gross = input.status === "WIPED" ? 0 : input.status === "NOT_PLAYED" ? null : input.grossStrokes
      const data = {
        grossStrokes: gross,
        netStrokes: input.status === "WIPED" ? 0 : gross == null ? null : gross - strokes,
        points: input.status === "WIPED" ? 0 : calculateStablefordPoints(gross, adjusted.par, strokes),
        status: input.status, enteredBy: actor.name || actor.email || "Spieler",
      }
      const key = {participantId: participant.id, roundId: round.id, holeId: hole.id}
      scores.push(await db.score.upsert({where: {participantId_roundId_holeId: key}, update: data, create: {...key, ...data}}))
      details.push(JSON.stringify({...key, hole: hole.number, ...data}))
    }
    await db.auditLog.create({data: {
      competitionId: compId, action: "SCORE_UPDATE", details: details.join("\n"),
      userId: actor.id, userName: actor.name || actor.email || "Spieler",
    }})
    return {success: true, scores}
  })
  revalidatePath("/")
  revalidatePath(`/admin/competitions/${compId}`)
  return result
}

export async function clearPlayerRoundScores(roundId: string, participantId: string, enteredByUserId: string, enteredByUserName: string) {
  const actor = await requireAdmin()
  return atomic(async prisma => {
  const checkedParticipant = await prisma.participant.findUniqueOrThrow({where: {id: participantId}})
  const checkedRound = await assertRoundCompetition(roundId, checkedParticipant.competitionId, prisma)

  const enteredByUserId = actor.id
  const enteredByUserName = actor.name || actor.email || "Admin"

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

  })
}

export async function saveManualRoundHandicap(
  participantId: string,
  roundId: string,
  value: number,
  teeId?: string | null
) {
  await requireAdmin()
  return atomic(async prisma => {
  const checkedParticipant = await prisma.participant.findUniqueOrThrow({where: {id: participantId}})
  const checkedRound = await assertRoundCompetition(roundId, checkedParticipant.competitionId, prisma)
  assertPlayingHandicap(value)
  await assertTeeCourse(teeId, checkedRound.courseId, prisma)

  const updateData: Prisma.ManualRoundHandicapUncheckedUpdateInput = { handicapValue: value }
  if (teeId !== undefined) {
    updateData.teeId = teeId
  }

  await prisma.manualRoundHandicap.upsert({
    where: {
      participantId_roundId: {
        participantId,
        roundId
      }
    },
    update: updateData,
    create: {
      participantId,
      roundId,
      handicapValue: value,
      teeId: teeId || null
    }
  })

  const part = await prisma.participant.findUnique({
    where: { id: participantId }
  })
  if (part) {
    revalidatePath(`/admin/competitions/${part.competitionId}`)
    revalidatePath('/')
  }
  return { success: true }

  })
}

export async function saveManualRoundTeamHandicap(
  participantId: string,
  roundId: string,
  value: number | null
) {
  await requireAdmin()
  return atomic(async prisma => {
  const checkedParticipant = await prisma.participant.findUniqueOrThrow({where: {id: participantId}})
  const checkedRound = await assertRoundCompetition(roundId, checkedParticipant.competitionId, prisma)
  assertPlayingHandicap(value)

  await prisma.manualRoundHandicap.upsert({
    where: {
      participantId_roundId: {
        participantId,
        roundId
      }
    },
    update: {
      teamHandicapValue: value
    },
    create: {
      participantId,
      roundId,
      handicapValue: value ?? 0,
      teamHandicapValue: value
    }
  })

  const part = await prisma.participant.findUnique({
    where: { id: participantId }
  })
  if (part) {
    revalidatePath(`/admin/competitions/${part.competitionId}`)
    revalidatePath('/')
  }
  return { success: true }

  })
}

export async function savePlayerRoundTee(
  participantId: string,
  roundId: string,
  teeId: string | null
) {
  await requireAdmin()
  return atomic(async prisma => {
  const checkedParticipant = await prisma.participant.findUniqueOrThrow({where: {id: participantId}})
  const checkedRound = await assertRoundCompetition(roundId, checkedParticipant.competitionId, prisma)
  await assertTeeCourse(teeId, checkedRound.courseId, prisma)

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { user: true }
  })
  if (!participant) return { success: false, error: "Participant not found" }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { course: { include: { tees: true, holes: true } }, tee: true }
  })
  if (!round) return { success: false, error: "Round not found" }

  const tee = teeId 
    ? (round.course.tees.find((t: any) => t.id === teeId) || round.tee || round.course.tees[0])
    : (round.tee || round.course.tees[0])
  if (!tee) return { success: false, error: "Tee not found" }

  const coursePar = round.course.holes.reduce((sum: number, h: any) => sum + h.par, 0)
  const hcp = participant.compHandicap ?? participant.user?.handicap ?? 0
  const calculatedHandicap = calculateCourseHandicap(hcp, tee, coursePar)

  await prisma.manualRoundHandicap.upsert({
    where: {
      participantId_roundId: {
        participantId,
        roundId
      }
    },
    update: {
      teeId: tee.id,
      handicapValue: calculatedHandicap
    },
    create: {
      participantId,
      roundId,
      teeId: tee.id,
      handicapValue: calculatedHandicap
    }
  })

  revalidatePath(`/admin/competitions/${participant.competitionId}`)
  revalidatePath('/')
  return { success: true, handicapValue: calculatedHandicap, teeId: tee.id }

  })
}

export async function recalculateRoundHandicaps(compId: string, roundId: string) {
  await requireAdmin()
  return atomic(async prisma => {
  await assertRoundCompetition(roundId, compId, prisma)
  if (await prisma.score.count({where: {roundId}})) throw new Error("Für gespielte Runden keine Vorgaben neu berechnen.")

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { course: { include: { tees: true, holes: true } }, tee: true }
  })
  if (!round) return { success: false, error: "Round not found" }

  const defaultTee = round.tee ||
                     round.course.tees.find((t: any) => t.name.toLowerCase().includes('yellow')) ||
                     round.course.tees.find((t: any) => t.name.toLowerCase().includes('white')) ||
                     round.course.tees[0]

  if (!defaultTee) return { success: false, error: "Tee not found" }

  const coursePar = round.course.holes.reduce((sum: number, h: any) => sum + h.par, 0)

  const participants = await prisma.participant.findMany({
    where: { competitionId: compId },
    include: { manualRoundHandicaps: true }
  })

  for (const p of participants) {
    if (p.compHandicap === null || p.compHandicap === undefined) continue

    const existingRecord = p.manualRoundHandicaps.find(mr => mr.roundId === round.id)
    const activeTee = (existingRecord?.teeId && round.course.tees.find(t => t.id === existingRecord.teeId)) || defaultTee

    const handicapValue = calculateCourseHandicap(p.compHandicap, activeTee, coursePar)

    await prisma.manualRoundHandicap.upsert({
      where: {
        participantId_roundId: {
          participantId: p.id,
          roundId: round.id
        }
      },
      update: { handicapValue, teeId: activeTee.id },
      create: {
        participantId: p.id,
        roundId: round.id,
        handicapValue,
        teeId: activeTee.id
      }
    })
  }

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }

  })
}

export async function recalculatePlayerHandicaps(compId: string, participantId: string) {
  await requireAdmin()
  return atomic(async prisma => {
  await assertParticipantCompetition(participantId, compId, prisma)

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { manualRoundHandicaps: true }
  })
  if (!participant || participant.compHandicap === null || participant.compHandicap === undefined) {
    return { success: true }
  }

  const rounds = await prisma.round.findMany({
    where: { competitionId: compId },
    include: {
      tee: true,
      course: {
        include: { tees: true, holes: true }
      }
    }
  })

  for (const round of rounds) {
    if (await prisma.score.count({where: {participantId, roundId: round.id}})) continue
    const existingRecord = participant.manualRoundHandicaps.find(mr => mr.roundId === round.id)
    const tee = (existingRecord?.teeId && round.course.tees.find(t => t.id === existingRecord.teeId)) ||
                round.tee ||
                round.course.tees.find((t: any) => t.name.toLowerCase().includes('yellow')) ||
                round.course.tees.find((t: any) => t.name.toLowerCase().includes('white')) ||
                round.course.tees[0]
    if (!tee) continue

    const coursePar = round.course.holes.reduce((sum: number, h: any) => sum + h.par, 0)
    const handicapValue = calculateCourseHandicap(participant.compHandicap, tee, coursePar)

    await prisma.manualRoundHandicap.upsert({
      where: {
        participantId_roundId: {
          participantId: participantId,
          roundId: round.id
        }
      },
      update: { handicapValue, teeId: tee.id },
      create: {
        participantId: participantId,
        roundId: round.id,
        handicapValue,
        teeId: tee.id
      }
    })
  }

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }

  })
}

export async function resetAllScores(compId: string, enteredByUserId: string, enteredByUserName: string) {
  const actor = await requireAdmin()
  return atomic(async prisma => {

  const enteredByUserId = actor.id
  const enteredByUserName = actor.name || actor.email || "Admin"

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

  })
}

export async function resetRoundScores(compId: string, roundId: string, enteredByUserId: string, enteredByUserName: string) {
  const actor = await requireAdmin()
  return atomic(async prisma => {
  await assertRoundCompetition(roundId, compId, prisma)

  const enteredByUserId = actor.id
  const enteredByUserName = actor.name || actor.email || "Admin"

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

  })
}

export async function resetPlayerScores(compId: string, participantId: string, enteredByUserId: string, enteredByUserName: string) {
  const actor = await requireAdmin()
  return atomic(async prisma => {
  await assertParticipantCompetition(participantId, compId, prisma)

  const enteredByUserId = actor.id
  const enteredByUserName = actor.name || actor.email || "Admin"

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

  })
}

export async function resetPlayerRoundScores(compId: string, roundId: string, participantId: string, enteredByUserId: string, enteredByUserName: string) {
  const actor = await requireAdmin()
  return atomic(async prisma => {
  await assertRoundCompetition(roundId, compId, prisma)
  await assertParticipantCompetition(participantId, compId, prisma)

  const enteredByUserId = actor.id
  const enteredByUserName = actor.name || actor.email || "Admin"

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

  })
}
