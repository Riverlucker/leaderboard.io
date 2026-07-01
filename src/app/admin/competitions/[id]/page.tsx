import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { EditCompetitionClient } from "./EditCompetitionClient"

interface EditCompetitionPageProps {
  params: Promise<{ id: string }>
}

export default async function EditCompetitionPage({ params }: EditCompetitionPageProps) {
  const resolvedParams = await params

  const competition = await prisma.competition.findUnique({
    where: { id: resolvedParams.id },
    include: {
      rounds: {
        include: {
          course: {
            include: {
              tees: true,
              holes: true
            }
          },
          matches: {
            include: {
              matchPlayers: {
                include: {
                  participant: true
                }
              }
            }
          }
        },
        orderBy: { name: 'asc' }
      },
      teams: {
        orderBy: { name: 'asc' }
      },
      participants: {
        include: {
          user: true,
          team: true
        },
        orderBy: [
          { dummyName: 'asc' },
          { user: { name: 'asc' } }
        ]
      }
    }
  })

  if (!competition) {
    notFound()
  }

  // Fetch available courses (for round associations)
  const courses = await prisma.course.findMany({
    orderBy: { name: 'asc' }
  })

  // Fetch registered users (for linking participants)
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  })

  return (
    <div className="p-8">
      <EditCompetitionClient
        competition={competition}
        courses={courses}
        users={users}
      />
    </div>
  )
}
