import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { invitationHash } from "@/lib/invitation-token"
import { ProfileForm } from "./ProfileForm"

export const metadata: Metadata = {title:"Dein Profil · Leaderboard.sc",robots:{index:false,follow:false},referrer:"no-referrer"}

export default async function ProfilePage({searchParams}:{searchParams:Promise<{player?:string}>}) {
  const session = await auth()
  const {player} = await searchParams
  if (player) {
    let hash: string | null = null
    try { hash = invitationHash(player) } catch {hash=null}
    const invitation = hash ? await prisma.profileInvitation.findUnique({where:{tokenHash:hash},include:{user:{select:{name:true,email:true,image:true}}}}) : null
    if (invitation && !invitation.usedAt && invitation.expiresAt > new Date()) {
      return <ProfileForm invitation token={player} name={invitation.user.name || "Spieler"} email={invitation.user.email || ""} image={invitation.user.image} />
    }
    // Used, expired and unknown links disclose no player identity.
    redirect(session?.user ? "/profile" : "/login?callbackUrl=%2Fprofile")
  }
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fprofile")
  const user = await prisma.user.findUnique({where:{id:session.user.id},select:{name:true,email:true,image:true}})
  if (!user) redirect("/login?callbackUrl=%2Fprofile")
  return <ProfileForm name={user.name || "Spieler"} email={user.email || ""} image={user.image} />
}
