import prisma from "@/lib/prisma"
import { requireAdminPage } from "@/lib/page-access"
import { InvitationManager } from "./InvitationManager"

export default async function InvitationsPage() {
  await requireAdminPage()
  const competitions=await prisma.competition.findMany({select:{id:true,name:true,_count:{select:{participants:true}}},orderBy:{startDate:"desc"}})
  return <div className="p-6 sm:p-10"><h1 className="text-2xl font-bold">Profileinladungen</h1><InvitationManager competitions={competitions.map(c=>({id:c.id,name:c.name,count:c._count.participants}))} /></div>
}
