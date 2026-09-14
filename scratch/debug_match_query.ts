import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const match = await prisma.match.findFirst({
    where: {
      type: 'TEAM_MATCHPLAY',
      round: {
        competition: {
          name: { contains: 'Zillertal' }
        }
      }
    },
    include: {
      matchPlayers: {
        include: {
          participant: {
            include: {
              user: true,
              team: true
            }
          }
        }
      }
    }
  })

  console.log("Match ID:", match?.id)
  console.log("MatchPlayers returned from Prisma:")
  match?.matchPlayers.forEach((mp, i) => {
    console.log(`Index ${i}: id=${mp.id}, participantId=${mp.participantId}, name=${mp.participant.userId ? mp.participant.user?.name : mp.participant.dummyName}, teamId=${mp.participant.teamId}`)
  })
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
