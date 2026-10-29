import "server-only"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { isAdmin, holeNumbers } from "./access-policy"

export async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Nicht angemeldet.")
  // Never trust the role embedded in an old JWT.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true },
  })
  if (!user) throw new Error("Nicht angemeldet.")
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (!isAdmin(user.role)) throw new Error("Nur Administratoren dürfen diese Änderung durchführen.")
  return user
}

export async function assertRoundCompetition(roundId: string, competitionId: string, db: Prisma.TransactionClient = prisma) {
  const round = await db.round.findUnique({ where: { id: roundId } })
  if (!round || round.competitionId !== competitionId) throw new Error("Runde gehört nicht zum Wettbewerb.")
  return round
}

export async function assertParticipantCompetition(participantId: string, competitionId: string, db: Prisma.TransactionClient = prisma) {
  const participant = await db.participant.findUnique({ where: { id: participantId } })
  if (!participant || participant.competitionId !== competitionId) throw new Error("Spieler gehört nicht zum Wettbewerb.")
  return participant
}

export async function assertTeamCompetition(teamId: string | null | undefined, competitionId: string) {
  if (!teamId) return
  const team = await prisma.team.findUnique({ where: { id: teamId } })
  if (!team || team.competitionId !== competitionId) throw new Error("Team gehört nicht zum Wettbewerb.")
}

export async function assertTeeCourse(teeId: string | null | undefined, courseId: string, db: Prisma.TransactionClient = prisma) {
  if (!teeId) return
  const tee = await db.tee.findUnique({ where: { id: teeId } })
  if (!tee || tee.courseId !== courseId) throw new Error("Abschlag gehört nicht zum Golfplatz.")
}

export async function assertMatchCompetition(matchId: string, competitionId: string, db: Prisma.TransactionClient = prisma) {
  const match = await db.match.findUnique({ where: { id: matchId }, include: { round: true, matchPlayers: true } })
  if (!match || match.round.competitionId !== competitionId) throw new Error("Partie gehört nicht zum Wettbewerb.")
  return match
}

export async function requireMatchScorer(matchId: string, competitionId: string) {
  const actor = await requireUser()
  const match = await assertMatchCompetition(matchId, competitionId)
  if (!isAdmin(actor.role)) {
    const member = await prisma.participant.findFirst({
      where: { userId: actor.id, competitionId, matchPlayers: { some: { matchId } } },
    })
    if (!member) throw new Error("Nur Teilnehmer dieser Partie dürfen sie bearbeiten.")
  }
  return { actor, match }
}

export async function assertScoreAccess(
  actor: Awaited<ReturnType<typeof requireUser>>, participantId: string, roundId: string,
  competitionId: string, holeNumber?: number, db: Prisma.TransactionClient = prisma,
  cache?: Map<string, Set<number>>,
) {
  const key = `${competitionId}:${roundId}:${participantId}`
  const cached = cache?.get(key)
  if (cached) {
    if (holeNumber !== undefined && !cached.has(holeNumber)) throw new Error("Loch gehört nicht zum eigenen Flight.")
    return
  }
  const round = await assertRoundCompetition(roundId, competitionId, db)
  const participant = await assertParticipantCompetition(participantId, competitionId, db)
  if (holeNumber !== undefined && !round.holesPlayed.includes(holeNumber)) throw new Error("Loch ist in dieser Runde nicht vorgesehen.")
  if (isAdmin(actor.role)) { cache?.set(key, new Set(round.holesPlayed)); return }
  const own = await db.participant.findFirst({ where: { competitionId, userId: actor.id } })
  if (!own) throw new Error("Keine Teilnahme an diesem Wettbewerb.")
  const matches = await db.match.findMany({
    where: { roundId, matchPlayers: { some: { participantId: own.id } } },
    include: { matchPlayers: true },
  })
  // Without pairings a player may only record their own score.
  if (!matches.length && participant.id === own.id) { cache?.set(key, new Set(round.holesPlayed)); return }
  const allowed = new Set(matches.filter(m => m.matchPlayers.some(p => p.participantId === participantId))
    .flatMap(m => holeNumbers(m.holeRange, round.holesPlayed)).filter(h => round.holesPlayed.includes(h)))
  if (!allowed.size || (holeNumber !== undefined && !allowed.has(holeNumber))) {
    throw new Error("Scores dürfen nur für das eigene Flight erfasst werden.")
  }
  cache?.set(key, allowed)
}
