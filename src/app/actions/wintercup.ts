"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { 
  BlockedSlot, ClConfig, DEFAULT_CL_CONFIG, getClConfig, 
  getQualificationStructure, generateVorrundenPairings 
} from "@/lib/clFormat"

export type { BlockedSlot, ClConfig } from "@/lib/clFormat"

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
    include: { 
      course: { include: { holes: { orderBy: { number: 'asc' } } } },
      competition: true
    }
  })
  if (!round) throw new Error("Round not found")

  const defaultHole = round.course.holes[0]
  if (!defaultHole) throw new Error("Course hole not found")

  const clConfig = getClConfig(round.competition)

  // Calculate Match Points
  // Sort scores descending by netPoints
  const sorted = [...scores].sort((a, b) => b.netPoints - a.netPoints)
  const pointsMap = new Map<string, number>()

  if (clConfig.vorrundenModus === "MATCHPLAY" || sorted.length === 2) {
    // 1v1 Matchplay mode: 1 point for win, 0 for loss, 0.5 for draw
    if (sorted.length === 2) {
      if (sorted[0].netPoints > sorted[1].netPoints) {
        pointsMap.set(sorted[0].participantId, 1)
        pointsMap.set(sorted[1].participantId, 0)
      } else if (sorted[0].netPoints < sorted[1].netPoints) {
        pointsMap.set(sorted[0].participantId, 0)
        pointsMap.set(sorted[1].participantId, 1)
      } else {
        pointsMap.set(sorted[0].participantId, 0.5)
        pointsMap.set(sorted[1].participantId, 0.5)
      }
    } else {
      // Fallback
      sorted.forEach((item, idx) => pointsMap.set(item.participantId, idx === 0 ? 1 : 0))
    }
  } else {
    // 3-Player Vorrunde mode (Wintercup rules: 4 / 2 / 0 with ties)
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
        details: `CL-Format Vorrunde score updated: ${auditDetails.join(" | ")}`,
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
    include: { 
      round: {
        include: { competition: true }
      }
    }
  })
  if (!targetMatch) throw new Error("Partie nicht gefunden.")

  const comp = targetMatch.round.competition
  const clConfig = getClConfig(comp)

  if (!clConfig.hasScheduling) {
    throw new Error("Terminierung ist für diese Competition nicht aktiviert.")
  }

  // Parse ISO components "YYYY-MM-THH:mm..."
  const [datePart, timePartWithZ] = scheduledDateISO.split("T")
  if (!datePart || !timePartWithZ) throw new Error("Ungültiges Datum/Uhrzeit Format.")

  const timePart = timePartWithZ.slice(0, 5) // "HH:MM"
  const [hStr, mStr] = timePart.split(":")
  const startH = parseInt(hStr, 10)
  const startM = parseInt(mStr, 10)

  if (isNaN(startH) || isNaN(startM)) throw new Error("Ungültige Uhrzeit.")

  // 1. Check Date Range using roundPeriods if available
  const activeRoundPeriod = clConfig.roundPeriods?.find(p => p.roundName === targetMatch.round.name)
  if (activeRoundPeriod) {
    if (datePart < activeRoundPeriod.startDate || datePart > activeRoundPeriod.endDate) {
      throw new Error(`Termine für ${targetMatch.round.name} sind nur im Zeitraum ${activeRoundPeriod.startDate} bis ${activeRoundPeriod.endDate} möglich.`)
    }
  } else if (comp.startDate && comp.endDate) {
    const compStartStr = comp.startDate.toISOString().split("T")[0]
    const compEndStr = comp.endDate.toISOString().split("T")[0]
    if (datePart < compStartStr || datePart > compEndStr) {
      throw new Error(`Termine sind nur im Wettbewerbszeitraum (${compStartStr} bis ${compEndStr}) möglich.`)
    }
  }

  // 2. Check Time Range (10:00 bis 21:00 Uhr)
  if (startH < 10 || startH > 21) {
    throw new Error("Uhrzeiten sind nur von 10:00 bis 21:00 Uhr möglich.")
  }

  // 3. Determine Duration from clConfig
  const isVorrunde = targetMatch.type === "GROUP_3" || targetMatch.round.name.startsWith("Vorrunde")
  const durationHours = isVorrunde ? (clConfig.slotDurationHoursVorrunde || 3) : (clConfig.slotDurationHoursPlayoff || 2)
  const durationMinutes = durationHours * 60
  const durationMs = durationMinutes * 60 * 1000

  // Construct standard Date for DB storage
  const reqStart = new Date(`${datePart}T${timePart}:00`)
  if (isNaN(reqStart.getTime())) throw new Error("Ungültiges Datum.")
  const reqEnd = new Date(reqStart.getTime() + durationMs)

  const reqStartMinutes = startH * 60 + startM
  const reqEndMinutes = reqStartMinutes + durationMinutes

  // 4. Check Collisions with other scheduled matches in the competition (only if exclusiveScheduling is enabled)
  if (clConfig.exclusiveScheduling) {
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
      const mIsVorrunde = m.type === "GROUP_3" || m.round.name.startsWith("Vorrunde")
      const mDurationHours = mIsVorrunde ? (clConfig.slotDurationHoursVorrunde || 3) : (clConfig.slotDurationHoursPlayoff || 2)
      const mDurationMs = mDurationHours * 60 * 60 * 1000
      const mEnd = new Date(mStart.getTime() + mDurationMs)

      // Check overlap: (reqStart < mEnd) && (reqEnd > mStart)
      if (reqStart < mEnd && reqEnd > mStart) {
        const pad = (n: number) => String(n).padStart(2, '0')
        const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
        throw new Error(`Terminkollision: In diesem Zeitraum (${formatTime(mStart)} - ${formatTime(mEnd)}) ist bereits eine andere Partie terminiert.`)
      }
    }
  }

  // 5. Check Collisions with Admin Sperrzeiten (Blocked Slots)
  const blockedSlots: BlockedSlot[] = clConfig.blockedSlots || []

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
      details: `Match scheduled: ${datePart} ${timePart} (${durationHours}h duration)`,
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

export async function saveClConfig(compId: string, config: ClConfig) {
  const comp = await prisma.competition.findUnique({ where: { id: compId } })
  if (!comp) throw new Error("Competition nicht gefunden.")

  let currentConfig: Record<string, any> = {}
  if (comp.cssConfig) {
    try {
      currentConfig = JSON.parse(comp.cssConfig)
    } catch (_) {}
  }

  const updatedConfig = { ...currentConfig, ...config }

  await prisma.competition.update({
    where: { id: compId },
    data: { cssConfig: JSON.stringify(updatedConfig) }
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
    roundIdsToDelete = comp.rounds.filter(r => r.name === "Achtelfinale" || r.name === "Viertelfinale" || r.name === "Halbfinale" || r.name === "Finale").map(r => r.id)
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
      details: `CL-Format scores reset for target: ${target}`,
      userId: enteredByUserId,
      userName: enteredByUserName
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath(`/?comp=${comp.uniqueSlug}`)
  revalidatePath(`/`)

  return { success: true }
}

/**
 * Pre-seeds all rounds and matches for a CL-Format competition.
 */
export async function seedClFormatCompetition(compId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const comp = await prisma.competition.findUnique({
      where: { id: compId },
      include: {
        participants: true,
        rounds: {
          include: { matches: true }
        }
      }
    })
    if (!comp) {
      return { success: false, error: "Competition nicht gefunden." }
    }

    const config = getClConfig(comp)
    const participantIds = comp.participants.map(p => p.id)

    if (participantIds.length < 2) {
      return {
        success: false,
        error: "Es müssen mindestens 2 Teilnehmer in der Competition eingetragen sein, um Spieltage und Auslosungen zu generieren."
      }
    }

    // Find a default course
    const defaultCourse = await prisma.course.findFirst({
      include: { tees: true, holes: true }
    })
    if (!defaultCourse) {
      return { success: false, error: "Kein Golfplatz im System gefunden." }
    }
    const defaultTee = defaultCourse.tees[0]

    // Check if any existing rounds have scores
    const roundIds = comp.rounds.map(r => r.id)
    const hasScores = await prisma.score.count({
      where: { roundId: { in: roundIds } }
    })
    if (hasScores > 0) {
      return {
        success: false,
        error: "Es sind bereits Scores in vorhandenen Runden eingetragen. Spieltage können nicht neu generiert werden, ohne zuvor die Scores zurückzusetzen."
      }
    }

    // Clear existing rounds and matches
    await prisma.round.deleteMany({
      where: { competitionId: compId }
    })

  // 1. Pre-seed Vorrunden
  const pairingsByRound = generateVorrundenPairings(participantIds, config.vorrundenCount, config.vorrundenModus)

  for (let r = 0; r < config.vorrundenCount; r++) {
    const rName = `Vorrunde ${r + 1}`
    const period = config.roundPeriods?.find(p => p.roundName === rName)
    const startDate = period?.startDate ? new Date(`${period.startDate}T08:00:00Z`) : null
    const endDate = period?.endDate ? new Date(`${period.endDate}T20:00:00Z`) : null

    const round = await prisma.round.create({
      data: {
        competitionId: compId,
        courseId: defaultCourse.id,
        teeId: defaultTee?.id || null,
        name: rName,
        startDate,
        endDate,
        holesPlayed: Array.from({ length: 18 }, (_, i) => i + 1)
      }
    })

    const matchesForRound = pairingsByRound[r] || []
    for (const group of matchesForRound) {
      const match = await prisma.match.create({
        data: {
          roundId: round.id,
          type: config.vorrundenModus === "GROUP_3" ? "GROUP_3" : "SINGLES",
          allowanceType: config.vorrundenModus === "GROUP_3" ? null : "0%",
          handicapAllowance: 0,
          playUntilEnd: false,
          holeRange: "1-18"
        }
      })

      for (const pId of group) {
        await prisma.matchPlayer.create({
          data: {
            matchId: match.id,
            participantId: pId,
            handicapAllowance: 0
          }
        })
      }
    }
  }

  // 2. Pre-seed Zwischenrunde (if enabled)
  const qual = getQualificationStructure(config)
  if (config.hasZwischenrunde && qual.zwischenrundePairs.length > 0) {
    const period = config.roundPeriods?.find(p => p.roundName === "Zwischenrunde")
    const startDate = period?.startDate ? new Date(`${period.startDate}T08:00:00Z`) : null
    const endDate = period?.endDate ? new Date(`${period.endDate}T20:00:00Z`) : null

    const zwRound = await prisma.round.create({
      data: {
        competitionId: compId,
        courseId: defaultCourse.id,
        teeId: defaultTee?.id || null,
        name: "Zwischenrunde",
        startDate,
        endDate,
        holesPlayed: Array.from({ length: 18 }, (_, i) => i + 1)
      }
    })

    for (let i = 0; i < qual.zwischenrundePairs.length; i++) {
      await prisma.match.create({
        data: {
          roundId: zwRound.id,
          type: "MATCHPLAY",
          allowanceType: null,
          handicapAllowance: 0,
          playUntilEnd: true,
          holeRange: "1-18"
        }
      })
    }
  }

  // 3. Pre-seed Playoff rounds
  let currentStageCount = config.playoffCount
  while (currentStageCount >= 2) {
    let stageName = "Finale"
    if (currentStageCount === 16) stageName = "Achtelfinale"
    else if (currentStageCount === 8) stageName = "Viertelfinale"
    else if (currentStageCount === 4) stageName = "Halbfinale"

    const period = config.roundPeriods?.find(p => p.roundName === stageName)
    const startDate = period?.startDate ? new Date(`${period.startDate}T08:00:00Z`) : null
    const endDate = period?.endDate ? new Date(`${period.endDate}T20:00:00Z`) : null

    const pRound = await prisma.round.create({
      data: {
        competitionId: compId,
        courseId: defaultCourse.id,
        teeId: defaultTee?.id || null,
        name: stageName,
        startDate,
        endDate,
        holesPlayed: Array.from({ length: 18 }, (_, i) => i + 1)
      }
    })

    const matchCount = currentStageCount / 2
    for (let i = 0; i < matchCount; i++) {
      await prisma.match.create({
        data: {
          roundId: pRound.id,
          type: "MATCHPLAY",
          allowanceType: null,
          handicapAllowance: 0,
          playUntilEnd: true,
          holeRange: "1-18"
        }
      })
    }

    currentStageCount = currentStageCount / 2
  }

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath(`/?comp=${comp.uniqueSlug}`)
  revalidatePath(`/`)

  return { success: true }
} catch (err: any) {
  console.error("Error in seedClFormatCompetition:", err)
  return { success: false, error: err.message || "Fehler beim Generieren der Spieltage." }
}
}
