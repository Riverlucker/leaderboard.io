"use server"

import prisma from "@/lib/prisma"
import { atomic } from "@/lib/transaction"
import { requireAdmin, assertRoundCompetition, assertParticipantCompetition, assertTeamCompetition, assertTeeCourse, assertMatchCompetition } from "@/lib/access"
import { assertHandicap, assertHoles, assertPlayingHandicap, holeNumbers } from "@/lib/access-policy"
import { getRyderCupMatchWeight, assertMatchWeight } from "@/lib/cup-scoring"
import { revalidatePath } from "next/cache"
import { calculateCourseHandicap } from "@/lib/scoring"
import { TEAM_COLOR_LIST } from "@/lib/teamColors"

// Generates a short random slug (e.g. comp-3a5f9)
function generateSlug() {
  return "comp-" + Math.random().toString(36).substring(2, 7)
}

export async function createCompetition(data: {
  name: string
  uniqueSlug?: string
  type: string
  isTeamComp: boolean
  startDate?: string | null
  endDate?: string | null
}) {
  await requireAdmin()
  return atomic(async prisma => {


  const nameVal = data.name?.trim()
  if (!nameVal) {
    throw new Error("Competition name is required.")
  }

  const slugVal = data.uniqueSlug?.trim() || generateSlug()
  
  // Verify slug uniqueness
  const existing = await prisma.competition.findUnique({
    where: { uniqueSlug: slugVal }
  })
  if (existing) {
    throw new Error("A competition with this unique slug already exists.")
  }

  const start = data.startDate ? new Date(data.startDate) : null
  const end = data.endDate ? new Date(data.endDate) : null

  const comp = await prisma.competition.create({
    data: {
      name: nameVal,
      uniqueSlug: slugVal,
      type: data.type,
      isTeamComp: data.isTeamComp,
      startDate: start,
      endDate: end
    }
  })

  revalidatePath("/admin/competitions")
  return comp

  })
}

export async function updateCompetitionGeneral(id: string, data: {
  name: string
  uniqueSlug: string
  type: string
  isTeamComp: boolean
  showRelToPar?: boolean
  startDate?: string | null
  endDate?: string | null
  cssConfig?: string | null
  bgImage?: string | null
  extraLeaderboards?: string[]
  hasBadges?: boolean
  badgeType?: string | null
  showProfilePicture?: boolean
}) {
  await requireAdmin()
  return atomic(async prisma => {


  const nameVal = data.name?.trim()
  const slugVal = data.uniqueSlug?.trim()
  if (!nameVal) throw new Error("Name is required.")
  if (!slugVal) throw new Error("Slug is required.")

  const existing = await prisma.competition.findFirst({
    where: {
      uniqueSlug: slugVal,
      id: { not: id }
    }
  })
  if (existing) {
    throw new Error("A competition with this unique slug already exists.")
  }

  const start = data.startDate ? new Date(data.startDate) : null
  const end = data.endDate ? new Date(data.endDate) : null

  const updateData: any = {
    name: nameVal,
    uniqueSlug: slugVal,
    type: data.type,
    isTeamComp: data.isTeamComp,
    startDate: start,
    endDate: end,
    cssConfig: data.cssConfig || null,
    bgImage: data.bgImage || null,
  }

  if (data.showRelToPar !== undefined) {
    updateData.showRelToPar = data.showRelToPar
  }
  if (data.extraLeaderboards !== undefined) {
    updateData.extraLeaderboards = data.extraLeaderboards
  }
  if (data.hasBadges !== undefined) {
    updateData.hasBadges = data.hasBadges
  }
  if (data.badgeType !== undefined) {
    updateData.badgeType = data.badgeType
  }
  if (data.showProfilePicture !== undefined) {
    updateData.showProfilePicture = data.showProfilePicture
  }

  await prisma.competition.update({
    where: { id },
    data: updateData
  })

  revalidatePath("/admin/competitions")
  revalidatePath(`/admin/competitions/${id}`)
  return { success: true }

  })
}

export async function deleteCompetition(id: string) {
  await requireAdmin()
  return atomic(async prisma => {


  await prisma.competition.delete({
    where: { id }
  })

  revalidatePath("/admin/competitions")
  return { success: true }

  })
}

// Rounds management
export async function addRound(compId: string, data: {
  name: string
  courseId: string
  startDate?: string | null
  endDate?: string | null
  holesPlayed?: number[]
  teeId?: string | null
  ninePreset?: string | null
}) {
  await requireAdmin()
  return atomic(async prisma => {
  await assertTeeCourse(data.teeId, data.courseId, prisma)
  assertHoles(data.holesPlayed?.length ? data.holesPlayed : Array.from({length: 18}, (_, i) => i + 1))


  const nameVal = data.name?.trim()
  if (!nameVal) throw new Error("Round name is required.")
  if (!data.courseId) throw new Error("Golf course is required.")

  const start = data.startDate ? new Date(data.startDate) : null
  const end = data.endDate ? new Date(data.endDate) : null
  
  // Default to holes 1 to 18 if none are provided
  const holes = data.holesPlayed && data.holesPlayed.length > 0
    ? data.holesPlayed
    : Array.from({ length: 18 }, (_, i) => i + 1)

  const newRound = await prisma.round.create({
    data: {
      competitionId: compId,
      courseId: data.courseId,
      name: nameVal,
      startDate: start,
      endDate: end,
      holesPlayed: holes,
      teeId: data.teeId,
      ninePreset: data.ninePreset || null
    }
  })

  // Populate handicaps for this round if not already populated for participants
  const participants = await prisma.participant.findMany({
    where: { competitionId: compId }
  })

  const course = await prisma.course.findUnique({
    where: { id: data.courseId },
    include: { tees: true, holes: true }
  })

  if (course && course.tees.length > 0) {
    const tee = data.teeId
      ? course.tees.find((t: any) => t.id === data.teeId)
      : course.tees.find((t: any) => t.name.toLowerCase().includes('yellow')) ||
        course.tees.find((t: any) => t.name.toLowerCase().includes('white')) ||
        course.tees[0]

    if (tee) {
      const coursePar = course.holes.reduce((sum: number, h: any) => sum + h.par, 0)

      for (const p of participants) {
        if (p.compHandicap === null || p.compHandicap === undefined) continue

        const handicapValue = calculateCourseHandicap(p.compHandicap, tee, coursePar)
        await prisma.manualRoundHandicap.create({
          data: {
            participantId: p.id,
            roundId: newRound.id,
            handicapValue
          }
        })
      }
    }
  }

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }

  })
}

export async function deleteRound(roundId: string, compId: string) {
  await requireAdmin()
  return atomic(async prisma => {
  await assertRoundCompetition(roundId, compId, prisma)


  await prisma.round.delete({
    where: { id: roundId }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }

  })
}

export async function updateRoundHoles(
  roundId: string, 
  compId: string, 
  holesPlayed: number[], 
  teeId?: string | null,
  ninePreset?: string | null
) {
  await requireAdmin()
  return atomic(async prisma => {
  const checkedRound = await assertRoundCompetition(roundId, compId, prisma)
  assertHoles(holesPlayed)
  await assertTeeCourse(teeId, checkedRound.courseId, prisma)


  if (!holesPlayed || holesPlayed.length === 0) {
    throw new Error("Please select at least one hole.")
  }

  await prisma.round.update({
    where: { id: roundId },
    data: {
      holesPlayed: holesPlayed,
      teeId: teeId || null,
      ninePreset: ninePreset || null
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }

  })
}

// Teams management
export async function addTeam(compId: string, name: string) {
  await requireAdmin()
  return atomic(async prisma => {


  const nameVal = name?.trim()
  if (!nameVal) throw new Error("Team name is required.")

  const existingTeamsCount = await prisma.team.count({
    where: { competitionId: compId }
  })
  const defaultColor = TEAM_COLOR_LIST[existingTeamsCount % TEAM_COLOR_LIST.length]

  await prisma.team.create({
    data: {
      competitionId: compId,
      name: nameVal,
      color: defaultColor
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }

  })
}

export async function updateTeamColor(teamId: string, compId: string, color: string) {
  await requireAdmin()
  return atomic(async prisma => {
  const team = await prisma.team.findUnique({ where: { id: teamId } }); if (!team || team.competitionId !== compId) throw new Error("Falsche Teamzuordnung.")


  await prisma.team.update({
    where: { id: teamId },
    data: { color }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }

  })
}

export async function deleteTeam(teamId: string, compId: string) {
  await requireAdmin()
  return atomic(async prisma => {
  const team = await prisma.team.findUnique({ where: { id: teamId } }); if (!team || team.competitionId !== compId) throw new Error("Falsche Teamzuordnung.")


  await prisma.team.delete({
    where: { id: teamId }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }

  })
}

// Participants management
export async function addParticipant(compId: string, data: {
  userId?: string | null
  dummyName?: string | null
  compHandicap?: number | null
  teamId?: string | null
  isOutOfCompetition?: boolean
  stars?: number | null
}) {
  await requireAdmin()
  return atomic(async prisma => {
  await assertTeamCompetition(data.teamId, compId)
  assertHandicap(data.compHandicap)


  const dummyVal = data.dummyName?.trim()
  
  if (!data.userId && !dummyVal) {
    throw new Error("Either a registered user must be selected or a dummy player name entered.")
  }

  if (data.userId) {
    const existing = await prisma.participant.findFirst({
      where: {
        competitionId: compId,
        userId: data.userId
      }
    })
    if (existing) {
      throw new Error("This registered user is already a participant in this competition.")
    }
  }

  const createdPart = await prisma.participant.create({
    data: {
      competitionId: compId,
      userId: data.userId || null,
      dummyName: data.userId ? null : dummyVal,
      compHandicap: data.compHandicap,
      teamId: data.teamId || null,
      isOutOfCompetition: data.isOutOfCompetition || false,
      stars: data.stars ?? 0
    }
  })

  if (data.compHandicap != null) {
    const rounds = await prisma.round.findMany({where: {competitionId: compId}, include: {tee: true, course: {include: {tees: true, holes: true}}}})
    for (const round of rounds) {
      const tee = round.tee || round.course.tees.find(t => /yellow|gelb/i.test(t.name)) || round.course.tees[0]
      if (!tee) continue
      await prisma.manualRoundHandicap.create({data: {participantId: createdPart.id, roundId: round.id, teeId: tee.id, handicapValue: calculateCourseHandicap(data.compHandicap, tee, round.course.holes.reduce((sum, h) => sum + h.par, 0))}})
    }
  }
  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }

  })
}

export async function updateParticipant(partId: string, compId: string, data: {
  compHandicap?: number | null
  teamId?: string | null
  isOutOfCompetition?: boolean
  stars?: number | null
}) {
  await requireAdmin()
  return atomic(async prisma => {
  await assertParticipantCompetition(partId, compId, prisma)
  await assertTeamCompetition(data.teamId, compId)
  assertHandicap(data.compHandicap)


  const updateData: any = {
    compHandicap: data.compHandicap,
    teamId: data.teamId || null
  }
  if (data.isOutOfCompetition !== undefined) {
    updateData.isOutOfCompetition = data.isOutOfCompetition
  }
  if (data.stars !== undefined && data.stars !== null) {
    updateData.stars = Math.max(0, Math.min(5, data.stars))
  }

  await prisma.participant.update({
    where: { id: partId },
    data: updateData
  })

  // Auto-recalculate playing handicaps for all rounds if compHandicap changed
  if (data.compHandicap !== undefined && data.compHandicap !== null) {
    const rounds = await prisma.round.findMany({
      where: { competitionId: compId },
      include: {
        course: {
          include: { tees: true, holes: true }
        },
        tee: true
      }
    })

    for (const round of rounds) {
      if (await prisma.score.count({ where: {participantId: partId, roundId: round.id} })) continue
      if (!round.course) continue
      const tee = round.tee ||
                  round.course.tees.find((t: any) => t.name.toLowerCase().includes('yellow')) ||
                  round.course.tees.find((t: any) => t.name.toLowerCase().includes('white')) ||
                  round.course.tees[0]
      if (!tee) continue

      const coursePar = round.course.holes.reduce((sum: number, h: any) => sum + h.par, 0)
      const handicapValue = calculateCourseHandicap(data.compHandicap, tee, coursePar)

      await prisma.manualRoundHandicap.upsert({
        where: {
          participantId_roundId: {
            participantId: partId,
            roundId: round.id
          }
        },
        update: { handicapValue },
        create: {
          participantId: partId,
          roundId: round.id,
          handicapValue
        }
      })
    }
  }

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }

  })
}

export async function updateParticipantStars(partId: string, compId: string, stars: number) {
  await requireAdmin()
  return atomic(async prisma => {
  await assertParticipantCompetition(partId, compId, prisma)


  await prisma.participant.update({
    where: { id: partId },
    data: { stars: Math.max(0, Math.min(5, stars)) }
  })
  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }

  })
}

export async function deleteParticipant(partId: string, compId: string) {
  await requireAdmin()
  return atomic(async prisma => {
  await assertParticipantCompetition(partId, compId, prisma)


  await prisma.participant.delete({
    where: { id: partId }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }

  })
}

// Helper to determine round playing handicap for a participant
async function getRoundPlayingHandicap(partId: string, roundId: string): Promise<number> {
  const participant = await prisma.participant.findUnique({
    where: { id: partId }
  })
  if (!participant) return 0

  const manualRecord = await prisma.manualRoundHandicap.findUnique({
    where: {
      participantId_roundId: {
        participantId: partId,
        roundId
      }
    }
  })
  if (manualRecord) {
    return manualRecord.handicapValue
  }

  if (participant.compHandicap === null || participant.compHandicap === undefined) {
    return 0
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      course: {
        include: { tees: true, holes: true }
      },
      tee: true
    }
  })
  if (!round || !round.course) return 0

  const tee = round.tee ||
              round.course.tees.find(t => t.name.toLowerCase().includes('yellow')) ||
              round.course.tees.find(t => t.name.toLowerCase().includes('white')) ||
              round.course.tees[0]
  if (!tee) return 0

  const coursePar = round.course.holes.reduce((sum, h) => sum + h.par, 0)
  return calculateCourseHandicap(participant.compHandicap, tee, coursePar)
}

// Pairings/Matches management
export async function addMatch(roundId: string, compId: string, data: {
  type: string
  participantIds: string[]
  allowanceType?: string | null
  playUntilEnd?: boolean | null
  holeRange?: string | null
}) {
  await requireAdmin()
  return atomic(async prisma => {
  const checkedRound = await assertRoundCompetition(roundId, compId, prisma)
  if (new Set(data.participantIds).size !== data.participantIds.length) throw new Error("Doppelte Teilnehmer.")
  for (const id of data.participantIds) await assertParticipantCompetition(id, compId, prisma)
  holeNumbers(data.holeRange, checkedRound.holesPlayed)


  if (!data.type) throw new Error("Match type is required.")
  if (!data.participantIds || data.participantIds.length === 0) {
    throw new Error("At least one participant must be assigned to the match.")
  }

  let computedAllowance: number | null = null

  if (data.type === "SINGLES" && data.participantIds.length === 2) {
    const allowanceType = data.allowanceType || "75%"
    const hcpA = await getRoundPlayingHandicap(data.participantIds[0], roundId)
    const hcpB = await getRoundPlayingHandicap(data.participantIds[1], roundId)
    const diff = Math.abs(hcpA - hcpB)

    const num = parseFloat(allowanceType.replace('%', '').trim())
    const percentage = !isNaN(num) ? num / 100 : 0.75

    computedAllowance = Math.round(diff * percentage)
  }

  const match = await prisma.match.create({
    data: {
      roundId,
      type: data.type,
      weight: getRyderCupMatchWeight({type: data.type, holeRange: data.holeRange || "1-18"}, checkedRound),
      allowanceType: (data.type === "SINGLES" || data.type === "TEAM_MATCHPLAY") ? (data.allowanceType || "75%") : null,
      handicapAllowance: computedAllowance,
      playUntilEnd: (data.type === "SINGLES" || data.type === "TEAM_MATCHPLAY") ? (data.playUntilEnd || false) : false,
      holeRange: (data.type === "SINGLES" || data.type === "TEAM_MATCHPLAY") ? (data.holeRange || "1-18") : null
    }
  })

  // Create match players
  for (const partId of data.participantIds) {
    await prisma.matchPlayer.create({
      data: {
        matchId: match.id,
        participantId: partId
      }
    })
  }

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }

  })
}

export async function updateMatchAllowance(matchId: string, compId: string, handicapAllowance: number | null) {
  await requireAdmin()
  return atomic(async prisma => {
  const checkedMatch = await assertMatchCompetition(matchId, compId, prisma)
  assertPlayingHandicap(handicapAllowance)


  await prisma.match.update({
    where: { id: matchId },
    data: {
      handicapAllowance
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }

  })
}

export async function updateMatchPlayerAllowance(matchPlayerId: string, compId: string, handicapAllowance: number | null) {
  await requireAdmin()
  return atomic(async prisma => {
  const mp = await prisma.matchPlayer.findUnique({where: {id: matchPlayerId}, include: {match: {include: {round: true}}}}); if (!mp || mp.match.round.competitionId !== compId) throw new Error("Falsche Partiezuordnung.")
  assertPlayingHandicap(handicapAllowance)


  await prisma.matchPlayer.update({
    where: { id: matchPlayerId },
    data: {
      handicapAllowance
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }

  })
}

export async function updateMatchPlayUntilEnd(matchId: string, compId: string, playUntilEnd: boolean) {
  await requireAdmin()
  return atomic(async prisma => {
  const checkedMatch = await assertMatchCompetition(matchId, compId, prisma)


  await prisma.match.update({
    where: { id: matchId },
    data: {
      playUntilEnd
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }

  })
}

export async function updateMatchHoleRange(matchId: string, compId: string, holeRange: string | null) {
  await requireAdmin()
  return atomic(async prisma => {
  const checkedMatch = await assertMatchCompetition(matchId, compId, prisma)
  holeNumbers(holeRange, checkedMatch.round.holesPlayed)


  await prisma.match.update({
    where: { id: matchId },
    data: {
      holeRange
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }

  })
}

export async function deleteMatch(matchId: string, compId: string) {
  await requireAdmin()
  return atomic(async prisma => {
  const checkedMatch = await assertMatchCompetition(matchId, compId, prisma)


  await prisma.match.delete({
    where: { id: matchId }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }

  })
}

export async function updateMatchWeight(matchId: string, compId: string, weight: number) {
  await requireAdmin()
  assertMatchWeight(weight)
  await atomic(async db => {
    await assertMatchCompetition(matchId, compId, db)
    await db.match.update({where: {id: matchId}, data: {weight}})
  })
  revalidatePath("/")
  revalidatePath(`/admin/competitions/${compId}`)
  return {success: true}
}

export async function createQuickSingleRound(data: {
  courseId: string
  date: string
  teeId?: string
  type?: string
  selectedUserIds: string[]
  customPlayers: Array<{ name: string; handicap?: number }>
}) {
  await requireAdmin()
  return atomic(async prisma => {
  await assertTeeCourse(data.teeId, data.courseId, prisma)


  const course = await prisma.course.findUnique({
    where: { id: data.courseId },
    include: { tees: true }
  })
  if (!course) throw new Error("Course not found.")

  const roundDate = data.date ? new Date(data.date) : new Date()
  
  const day = String(roundDate.getDate()).padStart(2, '0')
  const month = String(roundDate.getMonth() + 1).padStart(2, '0')
  const year = String(roundDate.getFullYear()).slice(-2)
  const dateStr = `${day}.${month}.${year}`

  const cleanCourseName = course.name.replace(/^(GC\s+|Golfclub\s+)/i, "").trim()
  const compName = `${cleanCourseName}, ${dateStr}`

  const baseSlug = cleanCourseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + dateStr.replace(/\./g, "-")
  let uniqueSlug = baseSlug
  let counter = 1
  while (await prisma.competition.findUnique({ where: { uniqueSlug } })) {
    uniqueSlug = `${baseSlug}-${counter++}`
  }

  const defaultPhoto = "https://www.golfinfo.at/media/system/animation/154-0479-lr-golfclub-millstaetterseegert-perauer.jpg"

  let chosenTeeId = data.teeId
  if (!chosenTeeId) {
    const yellowTee = course.tees.find(t => t.name.toLowerCase().includes("yellow") || t.name.toLowerCase().includes("gelb"))
    chosenTeeId = yellowTee?.id || course.tees[0]?.id || undefined
  }

  const selectedUsers = await prisma.user.findMany({
    where: { id: { in: data.selectedUserIds } }
  })

  const participantsData: any[] = []
  for (const user of selectedUsers) {
    participantsData.push({
      userId: user.id,
      compHandicap: user.handicap !== null && user.handicap !== undefined ? user.handicap : null
    })
  }

  for (const cp of data.customPlayers) {
    const cleanName = cp.name.trim()
    if (cleanName) {
      participantsData.push({
        dummyName: cleanName,
        compHandicap: cp.handicap !== undefined && cp.handicap !== null && !isNaN(cp.handicap) ? cp.handicap : null
      })
    }
  }

  const comp = await prisma.competition.create({
    data: {
      name: compName,
      uniqueSlug,
      type: data.type || "NETTO_STABLEFORD",
      isTeamComp: false,
      showRelToPar: true,
      bgImage: defaultPhoto,
      startDate: roundDate,
      endDate: roundDate,
      rounds: {
        create: [
          {
            name: "Round 1",
            courseId: course.id,
            teeId: chosenTeeId,
            startDate: roundDate,
            endDate: roundDate,
            holesPlayed: Array.from({ length: 18 }, (_, i) => i + 1)
          }
        ]
      },
      participants: {
        create: participantsData
      }
    }
  })

  revalidatePath("/admin/competitions")
  revalidatePath("/")
  const created = await prisma.competition.findUniqueOrThrow({where: {id: comp.id}, include: {participants: true, rounds: {include: {tee: true, course: {include: {holes: true, tees: true}}}}}})
  for (const round of created.rounds) {
    const tee = round.tee || round.course.tees[0]
    if (!tee) continue
    for (const participant of created.participants) {
      if (participant.compHandicap == null) continue
      await prisma.manualRoundHandicap.create({data: {participantId: participant.id, roundId: round.id, teeId: tee.id, handicapValue: calculateCourseHandicap(participant.compHandicap, tee, round.course.holes.reduce((sum, h) => sum + h.par, 0))}})
    }
  }
  return { competitionId: comp.id, uniqueSlug: comp.uniqueSlug }

  })
}
