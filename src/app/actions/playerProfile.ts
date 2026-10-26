"use server"

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export interface UserProfileData {
  id: string
  name: string | null
  email: string | null
  image: string | null
  handicap: number | null
  homeCourse: string | null
  role: string
  activeCompetitions: {
    id: string
    name: string
    uniqueSlug: string
    type: string
    startDate: string | null
    endDate: string | null
    teamName: string | null
    teamColor: string | null
    compHandicap: number | null
    hasBadges?: boolean
    badgeType?: string | null
    stars: number | null
  }[]
  pendingHandicapRequest?: {
    id: string
    requestedHandicap: number
    currentHandicap: number | null
    reason: string | null
    createdAt: string
  } | null
}

export async function getPlayerProfile(input: {
  userId?: string | null
  dummyName?: string | null
  competitionId?: string | null
}): Promise<{ success: boolean; data?: UserProfileData; canEdit?: boolean; isSuperAdmin?: boolean; error?: string }> {
  try {
    const session = await auth()
    const { userId, dummyName, competitionId } = input

    let targetUser: any = null

    if (userId) {
      targetUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          participants: {
            include: {
              competition: true,
              team: true
            }
          },
          handicapRequests: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      })
    }

    // Determine permissions
    const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
    const isOwnProfile = !!(session?.user?.id && targetUser && session.user.id === targetUser.id)
    const canEdit = isSuperAdmin || isOwnProfile

    if (!targetUser) {
      // Dummy user or unregistered
      const name = dummyName || "Gastspieler"
      // Check if dummy player has any participants
      const participants = await prisma.participant.findMany({
        where: { dummyName: name, userId: null },
        include: { competition: true, team: true }
      })

      const now = new Date()
      const activeCompetitions = participants
        .filter(p => !p.competition.endDate || new Date(p.competition.endDate) >= now)
        .map(p => ({
          id: p.competition.id,
          name: p.competition.name,
          uniqueSlug: p.competition.uniqueSlug,
          type: p.competition.type,
          startDate: p.competition.startDate ? p.competition.startDate.toISOString() : null,
          endDate: p.competition.endDate ? p.competition.endDate.toISOString() : null,
          teamName: p.team?.name || null,
          teamColor: p.team?.color || null,
          compHandicap: p.compHandicap,
          hasBadges: Boolean(p.competition.hasBadges),
          badgeType: p.competition.badgeType || null,
          stars: p.competition.hasBadges ? (p.stars ?? 0) : null
        }))

      return {
        success: true,
        canEdit: isSuperAdmin,
        isSuperAdmin,
        data: {
          id: "dummy",
          name,
          email: null,
          image: null,
          handicap: participants[0]?.compHandicap ?? null,
          homeCourse: null,
          role: "USER",
          activeCompetitions,
          pendingHandicapRequest: null
        }
      }
    }

    const now = new Date()
    const activeCompetitions = targetUser.participants
      .filter((p: any) => !p.competition.endDate || new Date(p.competition.endDate) >= now)
      .map((p: any) => ({
        id: p.competition.id,
        name: p.competition.name,
        uniqueSlug: p.competition.uniqueSlug,
        type: p.competition.type,
        startDate: p.competition.startDate ? p.competition.startDate.toISOString() : null,
        endDate: p.competition.endDate ? p.competition.endDate.toISOString() : null,
        teamName: p.team?.name || null,
        teamColor: p.team?.color || null,
        compHandicap: p.compHandicap,
        hasBadges: Boolean(p.competition.hasBadges),
        badgeType: p.competition.badgeType || null,
        stars: p.competition.hasBadges ? (p.stars ?? 0) : null
      }))

    const pendingReq = targetUser.handicapRequests && targetUser.handicapRequests.length > 0
      ? {
          id: targetUser.handicapRequests[0].id,
          requestedHandicap: targetUser.handicapRequests[0].requestedHandicap,
          currentHandicap: targetUser.handicapRequests[0].currentHandicap,
          reason: targetUser.handicapRequests[0].reason,
          createdAt: targetUser.handicapRequests[0].createdAt.toISOString()
        }
      : null

    return {
      success: true,
      canEdit,
      isSuperAdmin,
      data: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        image: targetUser.image,
        handicap: targetUser.handicap,
        homeCourse: targetUser.homeCourse,
        role: targetUser.role,
        activeCompetitions,
        pendingHandicapRequest: pendingReq
      }
    }
  } catch (err: any) {
    console.error("Error in getPlayerProfile:", err)
    return { success: false, error: err?.message || "Failed to load player profile" }
  }
}

export async function updateUserProfile(data: {
  userId: string
  email?: string
  image?: string | null
  name?: string // Only Superadmin can update name
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Nicht autorisiert. Bitte einloggen." }
    }

    const isSuperAdmin = session.user.role === "SUPER_ADMIN"
    const isSelf = session.user.id === data.userId

    if (!isSelf && !isSuperAdmin) {
      return { success: false, error: "Keine Berechtigung zum Ändern dieses Profils." }
    }

    const updateFields: any = {}

    // Name is never editable by normal users, only by Superadmin
    if (data.name && isSuperAdmin) {
      updateFields.name = data.name.trim()
    }

    if (data.email !== undefined) {
      const emailTrimmed = data.email?.trim().toLowerCase() || null
      if (emailTrimmed) {
        // Check uniqueness if changing
        const existing = await prisma.user.findFirst({
          where: {
            email: emailTrimmed,
            id: { not: data.userId }
          }
        })
        if (existing) {
          return { success: false, error: "Diese E-Mail-Adresse wird bereits verwendet." }
        }
      }
      updateFields.email = emailTrimmed
    }

    if (data.image !== undefined) {
      updateFields.image = data.image
    }

    await prisma.user.update({
      where: { id: data.userId },
      data: updateFields
    })

    revalidatePath("/")
    return { success: true }
  } catch (err: any) {
    console.error("Error in updateUserProfile:", err)
    return { success: false, error: err?.message || "Fehler beim Aktualisieren des Profils." }
  }
}

export async function submitHandicapRequest(data: {
  userId: string
  requestedHandicap: number
  reason?: string
  competitionId?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Nicht autorisiert. Bitte einloggen." }
    }

    const isSuperAdmin = session.user.role === "SUPER_ADMIN"
    const isSelf = session.user.id === data.userId

    if (!isSelf && !isSuperAdmin) {
      return { success: false, error: "Keine Berechtigung zum Beantragen einer Handicap-Änderung für diesen Nutzer." }
    }

    const user = await prisma.user.findUnique({
      where: { id: data.userId }
    })

    if (!user) {
      return { success: false, error: "Nutzer nicht gefunden." }
    }

    // Check if there is already a pending request
    const existingPending = await prisma.handicapRequest.findFirst({
      where: {
        userId: data.userId,
        status: "PENDING"
      }
    })

    if (existingPending) {
      return { success: false, error: "Es liegt bereits ein offener Handicap-Antrag vor. Bitte warte auf die Genehmigung durch die Spielleitung." }
    }

    await prisma.handicapRequest.create({
      data: {
        userId: data.userId,
        requestedHandicap: data.requestedHandicap,
        currentHandicap: user.handicap,
        reason: data.reason?.trim() || null,
        competitionId: data.competitionId || null,
        status: "PENDING"
      }
    })

    revalidatePath("/")
    return { success: true }
  } catch (err: any) {
    console.error("Error in submitHandicapRequest:", err)
    return { success: false, error: err?.message || "Fehler beim Einreichen des Handicap-Antrags." }
  }
}

export async function reviewHandicapRequest(data: {
  requestId: string
  action: "APPROVE" | "REJECT"
  adminNote?: string
  applyToFutureCompetitions?: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN"
    if (!isAdmin) {
      return { success: false, error: "Nur Administratoren können Handicap-Anträge bearbeiten." }
    }

    const req = await prisma.handicapRequest.findUnique({
      where: { id: data.requestId },
      include: { user: true }
    })

    if (!req) {
      return { success: false, error: "Antrag nicht gefunden." }
    }

    if (data.action === "APPROVE") {
      // 1. Update User's master handicap
      await prisma.user.update({
        where: { id: req.userId },
        data: { handicap: req.requestedHandicap }
      })

      // 2. IMPORTANT: A handicap change NEVER retroactively changes past scores or completed rounds!
      // Only updates participant compHandicap for active/future competitions
      if (data.applyToFutureCompetitions !== false) {
        const now = new Date()
        const futureParticipants = await prisma.participant.findMany({
          where: {
            userId: req.userId,
            competition: {
              OR: [
                { endDate: null },
                { endDate: { gte: now } }
              ]
            }
          }
        })

        for (const p of futureParticipants) {
          await prisma.participant.update({
            where: { id: p.id },
            data: { compHandicap: req.requestedHandicap }
          })
        }
      }

      await prisma.handicapRequest.update({
        where: { id: req.id },
        data: {
          status: "APPROVED",
          adminNote: data.adminNote || null,
          reviewedBy: session?.user?.name || session?.user?.email || "Admin"
        }
      })
    } else {
      await prisma.handicapRequest.update({
        where: { id: req.id },
        data: {
          status: "REJECTED",
          adminNote: data.adminNote || null,
          reviewedBy: session?.user?.name || session?.user?.email || "Admin"
        }
      })
    }

    revalidatePath("/")
    revalidatePath("/admin")
    return { success: true }
  } catch (err: any) {
    console.error("Error in reviewHandicapRequest:", err)
    return { success: false, error: err?.message || "Fehler beim Bearbeiten des Antrags." }
  }
}

export async function getPendingHandicapRequestsForCompetition(competitionId?: string) {
  try {
    const session = await auth()
    const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN"
    if (!isAdmin) return { success: false, error: "Nicht berechtigt", data: [] }

    let requests: any[] = []

    if (competitionId) {
      // Find all participants of this competition
      const participants = await prisma.participant.findMany({
        where: { competitionId, userId: { not: null } },
        select: { userId: true }
      })
      const userIds = participants.map(p => p.userId!).filter(Boolean)

      requests = await prisma.handicapRequest.findMany({
        where: {
          userId: { in: userIds },
          status: "PENDING"
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, handicap: true, image: true }
          },
          competition: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: "desc" }
      })
    } else {
      requests = await prisma.handicapRequest.findMany({
        where: { status: "PENDING" },
        include: {
          user: {
            select: { id: true, name: true, email: true, handicap: true, image: true }
          },
          competition: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: "desc" }
      })
    }

    return {
      success: true,
      data: requests.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.user?.name || "Unbekannt",
        userEmail: r.user?.email,
        userImage: r.user?.image,
        currentHandicap: r.currentHandicap ?? r.user?.handicap,
        requestedHandicap: r.requestedHandicap,
        reason: r.reason,
        competitionName: r.competition?.name || null,
        createdAt: r.createdAt.toISOString()
      }))
    }
  } catch (err: any) {
    console.error("Error in getPendingHandicapRequestsForCompetition:", err)
    return { success: false, error: err?.message, data: [] }
  }
}
