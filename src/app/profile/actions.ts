"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/access"
import { atomic } from "@/lib/transaction"
import { invitationHash, validateProfileEmail, validateProfilePassword } from "@/lib/invitation-token"
import { prepareProfileImage } from "@/lib/profile-image"
import prisma from "@/lib/prisma"

interface ProfileInput {email:string;password:string;currentPassword:string;image?:string;token?:string}

export async function savePersonalProfile(input: ProfileInput): Promise<{success:boolean;error?:string;reauthenticate?:boolean}> {
  try {
    const email = validateProfileEmail(input.email)
    const tokenHash = input.token ? invitationHash(input.token) : null
    const actor = tokenHash ? null : await requireUser()
    if (tokenHash) {
      const link = await prisma.profileInvitation.findUnique({where:{tokenHash}})
      if (!link || link.usedAt || link.expiresAt <= new Date()) throw new Error("Dieser Einladungslink ist abgelaufen oder bereits verwendet. Bitte melde dich an.")
    }
    if (tokenHash || input.password) validateProfilePassword(input.password)
    const password = input.password ? await bcrypt.hash(input.password,12) : undefined
    const image = await prepareProfileImage(input.image)
    await atomic(async db => {
      const now = new Date()
      const invitation = tokenHash ? await db.profileInvitation.findUnique({where:{tokenHash}}) : null
      if (tokenHash && (!invitation || invitation.usedAt || invitation.expiresAt <= now)) throw new Error("Dieser Einladungslink ist abgelaufen oder bereits verwendet. Bitte melde dich an.")
      const userId = invitation?.userId || actor?.id
      if (!userId) throw new Error("Nicht angemeldet.")
      const user = await db.user.findUniqueOrThrow({where:{id:userId}})
      if (!tokenHash && (password || email !== user.email)) {
        if (!user.password || !await bcrypt.compare(input.currentPassword,user.password)) throw new Error("Bitte dein aktuelles Passwort bestätigen.")
      }
      const duplicate = await db.user.findFirst({where:{email:{equals:email,mode:"insensitive"},id:{not:userId}},select:{id:true}})
      if (duplicate) throw new Error("Diese E-Mail-Adresse ist bereits vergeben.")
      if (tokenHash) {
        // Conditional claim + user update in the same transaction: previews never consume it.
        const claim = await db.profileInvitation.updateMany({where:{tokenHash,usedAt:null,expiresAt:{gt:now}},data:{usedAt:now}})
        if (claim.count !== 1) throw new Error("Dieser Einladungslink wurde bereits verwendet.")
      }
      await db.user.update({where:{id:userId},data:{email,image,password,...(password ? {sessionVersion:{increment:1}} : {})}})
      if (password) await db.profileInvitation.updateMany({where:{userId,usedAt:null},data:{usedAt:now}})
    })
    revalidatePath("/")
    revalidatePath("/profile")
    return {success:true,reauthenticate:!!password}
  } catch (error) {
    return {success:false,error:error instanceof Error && error.name === "Error" ? error.message : "Speichern fehlgeschlagen. Bitte erneut versuchen."}
  }
}
