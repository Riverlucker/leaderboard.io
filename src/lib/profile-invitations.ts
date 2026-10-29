import "server-only"
import type { Prisma } from "@prisma/client"
import { newInvitationToken, invitationHash, invitationExpiry } from "./invitation-token"

/** Caller is an authenticated admin action or the explicitly invoked operator CLI. */
export async function issueProfileInvitations(db: Prisma.TransactionClient, userIds: string[], now = new Date()) {
  const invitations: {userId:string;name:string;token:string;expiresAt:Date}[] = []
  for (const userId of new Set(userIds)) {
    const user = await db.user.findUniqueOrThrow({where:{id:userId},select:{id:true,name:true}})
    const token = newInvitationToken(), expiresAt = invitationExpiry(now)
    // Reissuing invalidates old unused links, never changes the password itself.
    await db.profileInvitation.deleteMany({where:{userId,usedAt:null}})
    await db.profileInvitation.create({data:{tokenHash:invitationHash(token),userId,expiresAt}})
    invitations.push({userId,name:user.name || "Spieler",token,expiresAt})
  }
  return invitations
}
