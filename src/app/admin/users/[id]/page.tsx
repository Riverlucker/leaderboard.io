import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { EditUserClient } from "./EditUserClient"

interface EditUserPageProps {
  params: Promise<{ id: string }>
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  const resolvedParams = await params
  
  const user = await prisma.user.findUnique({
    where: { id: resolvedParams.id }
  })

  if (!user) {
    notFound()
  }

  return (
    <div className="p-8">
      <EditUserClient user={user} />
    </div>
  )
}
