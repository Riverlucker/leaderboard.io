"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { calculateCourseHandicap } from "@/lib/scoring"

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
  const nameVal = data.name?.trim()
  if (!nameVal) {
    throw new Error("Competition name is required.")
  }

  let slugVal = data.uniqueSlug?.trim() || generateSlug()
  
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
}) {
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

  await prisma.competition.update({
    where: { id },
    data: updateData
  })

  revalidatePath("/admin/competitions")
  revalidatePath(`/admin/competitions/${id}`)
  return { success: true }
}

export async function deleteCompetition(id: string) {
  await prisma.competition.delete({
    where: { id }
  })

  revalidatePath("/admin/competitions")
  return { success: true }
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
}

export async function deleteRound(roundId: string, compId: string) {
  await prisma.round.delete({
    where: { id: roundId }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}

export async function updateRoundHoles(
  roundId: string, 
  compId: string, 
  holesPlayed: number[], 
  teeId?: string | null,
  ninePreset?: string | null
) {
  if (!holesPlayed || holesPlayed.length === 0) {
    throw new Error("Please select at least one hole.")
  }

  await prisma.round.update({
    where: { id: roundId },
    data: {
      holesPlayed: holesPlayed.sort((a, b) => a - b),
      teeId: teeId || null,
      ninePreset: ninePreset || null
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}

// Teams management
export async function addTeam(compId: string, name: string) {
  const nameVal = name?.trim()
  if (!nameVal) throw new Error("Team name is required.")

  await prisma.team.create({
    data: {
      competitionId: compId,
      name: nameVal
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}

export async function deleteTeam(teamId: string, compId: string) {
  await prisma.team.delete({
    where: { id: teamId }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}

// Participants management
export async function addParticipant(compId: string, data: {
  userId?: string | null
  dummyName?: string | null
  compHandicap?: number | null
  teamId?: string | null
}) {
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
      teamId: data.teamId || null
    }
  })

  // Initialize course handicaps right away
  if (data.compHandicap !== null && data.compHandicap !== undefined) {
    const rounds = await prisma.round.findMany({
      where: { competitionId: compId },
      include: {
        course: {
          include: { tees: true, holes: true }
        }
      }
    })

    const uniqueCoursesMap = new Map<string, any>()
    for (const round of rounds) {
      if (round.course && !uniqueCoursesMap.has(round.course.id)) {
        uniqueCoursesMap.set(round.course.id, round.course)
      }
    }

    for (const course of uniqueCoursesMap.values()) {
      const tee = course.tees.find((t: any) => t.name.toLowerCase().includes('yellow')) ||
                  course.tees.find((t: any) => t.name.toLowerCase().includes('white')) ||
                  course.tees[0]
      if (!tee) continue

      const coursePar = course.holes.reduce((sum: number, h: any) => sum + h.par, 0)
      const handicapValue = calculateCourseHandicap(data.compHandicap, tee, coursePar)

      await prisma.manualCourseHandicap.create({
        data: {
          participantId: createdPart.id,
          courseId: course.id,
          handicapValue
        }
      })
    }
  }

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }
}

export async function updateParticipant(partId: string, compId: string, data: {
  compHandicap?: number | null
  teamId?: string | null
}) {
  await prisma.participant.update({
    where: { id: partId },
    data: {
      compHandicap: data.compHandicap,
      teamId: data.teamId || null
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }
}

export async function deleteParticipant(partId: string, compId: string) {
  await prisma.participant.delete({
    where: { id: partId }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
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
}) {
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

    let percentage = 0.75
    if (allowanceType === "50%") percentage = 0.50
    if (allowanceType === "100%") percentage = 1.00
    if (allowanceType === "0%") percentage = 0.00

    computedAllowance = Math.round(diff * percentage)
  }

  const match = await prisma.match.create({
    data: {
      roundId,
      type: data.type,
      allowanceType: data.type === "SINGLES" ? (data.allowanceType || "75%") : null,
      handicapAllowance: computedAllowance
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
}

export async function updateMatchAllowance(matchId: string, compId: string, handicapAllowance: number | null) {
  await prisma.match.update({
    where: { id: matchId },
    data: {
      handicapAllowance
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  revalidatePath('/')
  return { success: true }
}

export async function deleteMatch(matchId: string, compId: string) {
  await prisma.match.delete({
    where: { id: matchId }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}
