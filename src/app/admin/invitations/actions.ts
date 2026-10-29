"use server"

import { requireAdmin } from "@/lib/access"
import { canManageUser } from "@/lib/access-policy"
import { atomic } from "@/lib/transaction"
import { issueProfileInvitations } from "@/lib/profile-invitations"
import { invitationMessage } from "@/lib/invitation-message"

export async function createCompetitionInvitations(competitionId:string) {
  const actor=await requireAdmin()
  return atomic(async db=>{
    const competition=await db.competition.findUniqueOrThrow({where:{id:competitionId},include:{participants:{include:{user:{select:{id:true,role:true}}}}}})
    if (!competition.participants.length) throw new Error("Dieser Wettbewerb hat noch keine Teilnehmer.")
    if (competition.participants.some(p=>!p.user)) throw new Error("Bitte zuerst alle Gastspieler mit einem Benutzerkonto verknüpfen.")
    for (const p of competition.participants) {
      if (p.user && p.user.id!==actor.id && !canManageUser(actor.role,p.user.role)) throw new Error("Nur Superadmins können Einladungen für andere Administratoren erzeugen.")
    }
    const invitations=await issueProfileInvitations(db,competition.participants.map(p=>p.userId!))
    return invitations.map(i=>{
      const url=`https://leaderboard.sc/profile/?player=${i.token}`
      return {name:i.name,url,expiresAt:i.expiresAt.toISOString(),message:invitationMessage(i.name,url,competition.name,competition.uniqueSlug)}
    })
  })
}
