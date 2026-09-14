"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

interface PlayerVorrundeScoreInput {
  participantId: string
  netPoints: number // Netto Stableford Points (NP)
  grossPoints: number // Brutto Stableford Points (BP)
}

interface SaveWintercupVorrundeScoreInput {
  matchId: string
  roundId: string
  compId: string
  scores: PlayerVorrundeScoreInput[]
  enteredByUserId: string
  enteredByUserName: string
}

export async function saveWintercupVorrundeScore(input: SaveWintercupVorrundeScoreInput) {
  const { matchId, roundId, compId, scores, enteredByUserId, enteredByUserName } = input

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { course: { include: { holes: { orderBy: { number: 'asc' } } } } }
  })
  if (!round) throw new Error("Round not found")

  const defaultHole = round.course.holes[0]
  if (!defaultHole) throw new Error("Course hole not found")

  // Calculate Match Points (4 / 2 / 0 with ties)
  // Sort scores descending by netPoints
  const sorted = [...scores].sort((a, b) => b.netPoints - a.netPoints)
  
  const pointsMap = new Map<string, number>()

  if (sorted.length === 3) {
    const s0 = sorted[0].netPoints
    const s1 = sorted[1].netPoints
    const s2 = sorted[2].netPoints

    if (s0 > s1 && s1 > s2) {
      pointsMap.set(sorted[0].participantId, 4)
      pointsMap.set(sorted[1].participantId, 2)
      pointsMap.set(sorted[2].participantId, 0)
    } else if (s0 === s1 && s1 > s2) {
      pointsMap.set(sorted[0].participantId, 3)
      pointsMap.set(sorted[1].participantId, 3)
      pointsMap.set(sorted[2].participantId, 0)
    } else if (s0 > s1 && s1 === s2) {
      pointsMap.set(sorted[0].participantId, 4)
      pointsMap.set(sorted[1].participantId, 1)
      pointsMap.set(sorted[2].participantId, 1)
    } else {
      pointsMap.set(sorted[0].participantId, 2)
      pointsMap.set(sorted[1].participantId, 2)
      pointsMap.set(sorted[2].participantId, 2)
    }
  } else if (sorted.length === 2) {
    if (sorted[0].netPoints > sorted[1].netPoints) {
      pointsMap.set(sorted[0].participantId, 4)
      pointsMap.set(sorted[1].participantId, 0)
    } else {
      pointsMap.set(sorted[0].participantId, 2)
      pointsMap.set(sorted[1].participantId, 2)
    }
  }

  // Save scores in DB
  const auditDetails: string[] = []

  for (const item of scores) {
    const p = await prisma.participant.findUnique({
      where: { id: item.participantId },
      include: { user: true }
    })
    const playerName = p?.userId ? (p.user?.name || p.user?.email) : p?.dummyName

    const matchPts = pointsMap.get(item.participantId) ?? 0

    const existing = await prisma.score.findFirst({
      where: {
        participantId: item.participantId,
        roundId,
        holeId: defaultHole.id
      }
    })

    if (existing) {
      await prisma.score.update({
        where: { id: existing.id },
        data: {
          grossStrokes: item.grossPoints,
          netStrokes: item.netPoints,
          points: matchPts,
          status: null,
          enteredBy: enteredByUserName
        }
      })
    } else {
      await prisma.score.create({
        data: {
          participantId: item.participantId,
          roundId,
          holeId: defaultHole.id,
          grossStrokes: item.grossPoints,
          netStrokes: item.netPoints,
          points: matchPts,
          status: null,
          enteredBy: enteredByUserName
        }
      })
    }

    auditDetails.push(`${playerName}: Netto ${item.netPoints}, Brutto ${item.grossPoints} -> ${matchPts} Pts`)
  }

  const comp = await prisma.competition.findUnique({ where: { id: compId } })
  if (comp) {
    await prisma.auditLog.create({
      data: {
        competitionId: compId,
        action: "SCORE_UPDATE",
        details: `Mattsee Wintercup match score updated: ${auditDetails.join(" | ")}`,
        userId: enteredByUserId,
        userName: enteredByUserName
      }
    })
    revalidatePath(`/admin/competitions/${compId}`)
    revalidatePath(`/?comp=${comp.uniqueSlug}`)
    revalidatePath(`/`)
  }

  return { success: true }
}

interface SaveWintercupPlayoffScoreInput {
  matchId: string
  compId: string
  winnerParticipantId: string | null
  player1Id: string
  player2Id: string
  resultText: string
  enteredByUserId: string
  enteredByUserName: string
}

export async function saveWintercupPlayoffScore(input: SaveWintercupPlayoffScoreInput) {
  const { matchId, compId, winnerParticipantId, player1Id, player2Id, resultText, enteredByUserId, enteredByUserName } = input

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { matchPlayers: true }
  })
  if (!match) throw new Error("Match not found")

  await prisma.match.update({
    where: { id: matchId },
    data: {
      allowanceType: winnerParticipantId,
      playUntilEnd: true,
    }
  })

  const existingParticipantIds = match.matchPlayers.map(mp => mp.participantId)

  if (player1Id && !existingParticipantIds.includes(player1Id)) {
    await prisma.matchPlayer.create({
      data: { matchId, participantId: player1Id }
    })
  }

  if (player2Id && !existingParticipantIds.includes(player2Id)) {
    await prisma.matchPlayer.create({
      data: { matchId, participantId: player2Id }
    })
  }

  const comp = await prisma.competition.findUnique({ where: { id: compId } })
  if (comp) {
    await prisma.auditLog.create({
      data: {
        competitionId: compId,
        action: "SCORE_UPDATE",
        details: `Playoff Match result saved: Winner ${winnerParticipantId}, Score: ${resultText}`,
        userId: enteredByUserId,
        userName: enteredByUserName
      }
    })
    revalidatePath(`/admin/competitions/${compId}`)
    revalidatePath(`/?comp=${comp.uniqueSlug}`)
    revalidatePath(`/`)
  }

  return { success: true }
}

export interface BlockedSlot {
  id: string
  date: string // YYYY-MM-DD
  startTime?: string // HH:MM
  endTime?: string // HH:MM
  isFullDay: boolean
  reason?: string
}

interface ScheduleMatchInput {
  matchId: string
  compId: string
  scheduledDateISO: string
  enteredByUserId: string
  enteredByUserName: string
}

export async function saveWintercupMatchSchedule(input: ScheduleMatchInput) {
  const { matchId, compId, scheduledDateISO, enteredByUserId, enteredByUserName } = input

  const targetMatch = await prisma.match.findUnique({
    where: { id: matchId },
    include: { round: true }
  })
  if (!targetMatch) throw new Error("Partie nicht gefunden.")

  // Parse ISO components "YYYY-MM-THH:mm..."
  const [datePart, timePartWithZ] = scheduledDateISO.split("T")
  if (!datePart || !timePartWithZ) throw new Error("Ungültiges Datum/Uhrzeit Format.")

  const timePart = timePartWithZ.slice(0, 5) // "HH:MM"
  const [hStr, mStr] = timePart.split(":")
  const startH = parseInt(hStr, 10)
  const startM = parseInt(mStr, 10)

  if (isNaN(startH) || isNaN(startM)) throw new Error("Ungültige Uhrzeit.")

  // 1. Check Date Range (03. Januar 2027 bis 15. März 2027)
  if (datePart < "2027-01-03" || datePart > "2027-03-15") {
    throw new Error("Termine sind nur zwischen 03. Januar und 15. März 2027 möglich.")
  }

  // 2. Check Time Range (10:00 bis 21:00 Uhr)
  if (startH < 10 || startH > 21) {
    throw new Error("Uhrzeiten sind nur von 10:00 bis 21:00 Uhr möglich.")
  }

  // 3. Determine Duration (3-player Vorrunde = 3h / 180m, Playoff 1v1 = 2h / 120m)
  const is3PlayerMatch = targetMatch.type === "GROUP_3" || targetMatch.round.name.startsWith("Vorrunde")
  const durationMinutes = is3PlayerMatch ? 180 : 120
  const durationMs = durationMinutes * 60 * 1000

  // Construct standard Date for DB storage
  const reqStart = new Date(`${datePart}T${timePart}:00`)
  if (isNaN(reqStart.getTime())) throw new Error("Ungültiges Datum.")
  const reqEnd = new Date(reqStart.getTime() + durationMs)

  const reqStartMinutes = startH * 60 + startM
  const reqEndMinutes = reqStartMinutes + durationMinutes

  // 4. Check Collisions with other scheduled matches in the competition
  const allCompMatches = await prisma.match.findMany({
    where: {
      round: { competitionId: compId },
      id: { not: matchId },
      scheduledDate: { not: null }
    },
    include: { round: true }
  })

  for (const m of allCompMatches) {
    if (!m.scheduledDate) continue
    const mStart = new Date(m.scheduledDate)
    const mDurationMs = (m.type === "GROUP_3" || m.round.name.startsWith("Vorrunde") ? 3 : 2) * 60 * 60 * 1000
    const mEnd = new Date(mStart.getTime() + mDurationMs)

    // Check overlap: (reqStart < mEnd) && (reqEnd > mStart)
    if (reqStart < mEnd && reqEnd > mStart) {
      const pad = (n: number) => String(n).padStart(2, '0')
      const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
      throw new Error(`Terminkollision: In diesem Zeitraum (${formatTime(mStart)} - ${formatTime(mEnd)}) ist bereits eine andere Partie terminiert.`)
    }
  }

  // 5. Check Collisions with Admin Sperrzeiten (Blocked Slots)
  const comp = await prisma.competition.findUnique({ where: { id: compId } })
  if (!comp) throw new Error("Competition nicht gefunden.")

  let blockedSlots: BlockedSlot[] = []
  if (comp.cssConfig) {
    try {
      const parsed = JSON.parse(comp.cssConfig)
      if (Array.isArray(parsed.blockedSlots)) {
        blockedSlots = parsed.blockedSlots
      }
    } catch (_) {}
  }

  for (const slot of blockedSlots) {
    if (slot.date === datePart) {
      if (slot.isFullDay) {
        throw new Error(`Terminkollision: Der gesamte Tag (${datePart}) ist vom Admin gesperrt${slot.reason ? `: ${slot.reason}` : ""}.`)
      }

      if (slot.startTime && slot.endTime) {
        const [sH, sM] = slot.startTime.split(":").map(Number)
        const [eH, eM] = slot.endTime.split(":").map(Number)

        const slotStartMinutes = sH * 60 + sM
        const slotEndMinutes = eH * 60 + eM

        if (reqStartMinutes < slotEndMinutes && reqEndMinutes > slotStartMinutes) {
          throw new Error(`Terminkollision: Dieser Zeitraum (${slot.startTime} - ${slot.endTime}) ist vom Admin gesperrt${slot.reason ? `: ${slot.reason}` : ""}.`)
        }
      }
    }
  }

  // Save Schedule
  await prisma.match.update({
    where: { id: matchId },
    data: { scheduledDate: reqStart }
  })

  await prisma.auditLog.create({
    data: {
      competitionId: compId,
      action: "MATCH_SCHEDULE",
      details: `Match scheduled: ${datePart} ${timePart} (${is3PlayerMatch ? '3h' : '2h'} duration)`,
      userId: enteredByUserId,
      userName: enteredByUserName
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath(`/?comp=${comp.uniqueSlug}`)
  revalidatePath(`/`)

  return { success: true }
}

export async function saveWintercupBlockedSlots(compId: string, blockedSlots: BlockedSlot[]) {
  const comp = await prisma.competition.findUnique({ where: { id: compId } })
  if (!comp) throw new Error("Competition nicht gefunden.")

  let parsedConfig: Record<string, any> = {}
  if (comp.cssConfig) {
    try {
      parsedConfig = JSON.parse(comp.cssConfig)
    } catch (_) {}
  }

  parsedConfig.blockedSlots = blockedSlots

  await prisma.competition.update({
    where: { id: compId },
    data: { cssConfig: JSON.stringify(parsedConfig) }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath(`/?comp=${comp.uniqueSlug}`)
  revalidatePath(`/`)

  return { success: true }
}

interface DeleteMatchScoreInput {
  matchId: string
  roundId: string
  compId: string
  enteredByUserId: string
  enteredByUserName: string
}

export async function deleteWintercupMatchScore(input: DeleteMatchScoreInput) {
  const { matchId, roundId, compId, enteredByUserId, enteredByUserName } = input

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { matchPlayers: true }
  })
  if (!match) throw new Error("Partie nicht gefunden.")

  // 1. Reset matchplay winner if set
  if (match.allowanceType || match.playUntilEnd) {
    await prisma.match.update({
      where: { id: matchId },
      data: {
        allowanceType: null,
        playUntilEnd: false
      }
    })
  }

  // 2. Delete score records for participants in this match for this round
  const participantIds = match.matchPlayers.map(mp => mp.participantId)
  if (participantIds.length > 0) {
    await prisma.score.deleteMany({
      where: {
        roundId,
        participantId: { in: participantIds }
      }
    })
  }

  const comp = await prisma.competition.findUnique({ where: { id: compId } })
  if (comp) {
    await prisma.auditLog.create({
      data: {
        competitionId: compId,
        action: "SCORE_DELETE",
        details: `Match scores deleted for match ${matchId} in round ${roundId}`,
        userId: enteredByUserId,
        userName: enteredByUserName
      }
    })
    revalidatePath(`/admin/competitions/${compId}`)
    revalidatePath(`/?comp=${comp.uniqueSlug}`)
    revalidatePath(`/`)
  }

  return { success: true }
}

export async function resetWintercupScores(
  compId: string,
  target: 'ALL' | 'R1' | 'R2' | 'R3' | 'ZW' | 'PLAYOFFS',
  enteredByUserId: string,
  enteredByUserName: string
) {
  const comp = await prisma.competition.findUnique({
    where: { id: compId },
    include: { rounds: true }
  })
  if (!comp) throw new Error("Competition nicht gefunden.")

  let roundIdsToDelete: string[] = []

  if (target === 'ALL') {
    roundIdsToDelete = comp.rounds.map(r => r.id)
  } else if (target === 'R1') {
    roundIdsToDelete = comp.rounds.filter(r => r.name === "Vorrunde 1").map(r => r.id)
  } else if (target === 'R2') {
    roundIdsToDelete = comp.rounds.filter(r => r.name === "Vorrunde 2").map(r => r.id)
  } else if (target === 'R3') {
    roundIdsToDelete = comp.rounds.filter(r => r.name === "Vorrunde 3").map(r => r.id)
  } else if (target === 'ZW') {
    roundIdsToDelete = comp.rounds.filter(r => r.name === "Zwischenrunde").map(r => r.id)
  } else if (target === 'PLAYOFFS') {
    roundIdsToDelete = comp.rounds.filter(r => r.name === "Viertelfinale" || r.name === "Halbfinale" || r.name === "Finale").map(r => r.id)
  }

  if (roundIdsToDelete.length > 0) {
    // Delete score records
    await prisma.score.deleteMany({
      where: { roundId: { in: roundIdsToDelete } }
    })

    // Reset Match matchplay winners
    await prisma.match.updateMany({
      where: { roundId: { in: roundIdsToDelete } },
      data: {
        allowanceType: null,
        playUntilEnd: false
      }
    })
  }

  await prisma.auditLog.create({
    data: {
      competitionId: compId,
      action: "SCORE_RESET",
      details: `Wintercup scores reset for target: ${target}`,
      userId: enteredByUserId,
      userName: enteredByUserName
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath(`/?comp=${comp.uniqueSlug}`)
  revalidatePath(`/`)

  return { success: true }
}
