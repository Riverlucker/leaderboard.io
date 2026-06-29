"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

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
  startDate?: string | null
  endDate?: string | null
  cssConfig?: string | null
  bgImage?: string | null
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

  await prisma.competition.update({
    where: { id },
    data: {
      name: nameVal,
      uniqueSlug: slugVal,
      type: data.type,
      isTeamComp: data.isTeamComp,
      startDate: start,
      endDate: end,
      cssConfig: data.cssConfig || null,
      bgImage: data.bgImage || null
    }
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
}) {
  const nameVal = data.name?.trim()
  if (!nameVal) throw new Error("Round name is required.")
  if (!data.courseId) throw new Error("Golf course is required.")

  const start = data.startDate ? new Date(data.startDate) : null
  const end = data.endDate ? new Date(data.endDate) : null

  await prisma.round.create({
    data: {
      competitionId: compId,
      courseId: data.courseId,
      name: nameVal,
      startDate: start,
      endDate: end
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}

export async function deleteRound(roundId: string, compId: string) {
  await prisma.round.delete({
    where: { id: roundId }
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

  await prisma.participant.create({
    data: {
      competitionId: compId,
      userId: data.userId || null,
      dummyName: data.userId ? null : dummyVal,
      compHandicap: data.compHandicap,
      teamId: data.teamId || null
    }
  })

  revalidatePath(`/admin/competitions/${compId}`)
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
  return { success: true }
}

export async function deleteParticipant(partId: string, compId: string) {
  await prisma.participant.delete({
    where: { id: partId }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}

// Pairings/Matches management
export async function addMatch(roundId: string, compId: string, data: {
  type: string
  participantIds: string[]
}) {
  if (!data.type) throw new Error("Match type is required.")
  if (!data.participantIds || data.participantIds.length === 0) {
    throw new Error("At least one participant must be assigned to the match.")
  }

  const match = await prisma.match.create({
    data: {
      roundId,
      type: data.type
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
  return { success: true }
}

export async function deleteMatch(matchId: string, compId: string) {
  await prisma.match.delete({
    where: { id: matchId }
  })

  revalidatePath(`/admin/competitions/${compId}`)
  return { success: true }
}
