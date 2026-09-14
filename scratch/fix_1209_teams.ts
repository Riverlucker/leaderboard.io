import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const comp = await prisma.competition.findFirst({
    where: {
      name: { contains: 'Zillertal' },
      startDate: { gte: new Date('2026-09-01') }
    },
    include: {
      teams: true,
      participants: {
        include: {
          user: true
        }
      },
      rounds: {
        include: {
          matches: {
            include: {
              matchPlayers: true
            }
          }
        }
      }
    }
  })

  if (!comp) {
    console.log("Competition not found")
    return
  }

  console.log("Comp ID:", comp.id)
  console.log("Teams in comp:", comp.teams)

  // Find participants
  const thomasPart = comp.participants.find(p => p.userId === 'cmshn7fnn0000az3sxptibm51' || p.dummyName?.includes('Tom') || p.dummyName?.includes('Canek'))
  const christophPart = comp.participants.find(p => p.userId === 'cmtxzrnw70000jp04d7c0q1h9' || p.user?.name?.includes('Christoph'))
  const enzoPart = comp.participants.find(p => p.userId === 'cmshn8gl50000az3sk8z92y1p' || p.user?.name?.includes('Enzo'))
  const markusPart = comp.participants.find(p => p.userId === 'cmty0305s000xjm042o0w9s49' || p.user?.name?.includes('Markus'))

  console.log("Thomas part:", thomasPart?.id, thomasPart?.user?.name || thomasPart?.dummyName)
  console.log("Christoph part:", christophPart?.id, christophPart?.user?.name)
  console.log("Enzo part:", enzoPart?.id, enzoPart?.user?.name)
  console.log("Markus part:", markusPart?.id, markusPart?.user?.name)

  if (!thomasPart || !christophPart || !enzoPart || !markusPart) {
    console.log("Could not find all 4 participants")
    return
  }

  // Desired order for TEAM_MATCHPLAY:
  // Team 1: Thomas (index 0), Christoph (index 1)
  // Team 2: Enzo (index 2), Markus (index 3)
  const desiredParticipantIds = [
    thomasPart.id,
    christophPart.id,
    enzoPart.id,
    markusPart.id
  ]

  for (const round of comp.rounds) {
    for (const match of round.matches) {
      if (match.type === 'TEAM_MATCHPLAY') {
        console.log("Reordering match players for match:", match.id)
        // Delete current match players and recreate in exact desired order
        await prisma.matchPlayer.deleteMany({
          where: { matchId: match.id }
        })

        for (const partId of desiredParticipantIds) {
          await prisma.matchPlayer.create({
            data: {
              matchId: match.id,
              participantId: partId
            }
          })
        }
        console.log("Recreated match players successfully!")
      }
    }
  }

  // If there are competition teams, update participant teamIds
  if (comp.teams.length >= 2) {
    const team1 = comp.teams[0]
    const team2 = comp.teams[1]
    console.log(`Setting ${thomasPart.user?.name} & ${christophPart.user?.name} to Team 1 (${team1.name})`)
    console.log(`Setting ${enzoPart.user?.name} & ${markusPart.user?.name} to Team 2 (${team2.name})`)

    await prisma.participant.update({ where: { id: thomasPart.id }, data: { teamId: team1.id } })
    await prisma.participant.update({ where: { id: christophPart.id }, data: { teamId: team1.id } })
    await prisma.participant.update({ where: { id: enzoPart.id }, data: { teamId: team2.id } })
    await prisma.participant.update({ where: { id: markusPart.id }, data: { teamId: team2.id } })
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
