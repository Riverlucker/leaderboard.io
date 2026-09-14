import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const round = await prisma.round.findFirst({
    where: {
      name: { contains: 'Achensee' },
      competition: {
        name: { contains: 'Tom v Enzo' }
      }
    }
  })

  if (!round) {
    console.log("Round GC Achensee not found")
    return
  }

  console.log("Updating Round:", round.id, round.name, "Current startDate:", round.startDate)
  
  // Set date to 2026-09-11
  const updatedDate = new Date('2026-09-11T12:00:00.000Z')
  await prisma.round.update({
    where: { id: round.id },
    data: { startDate: updatedDate }
  })

  console.log("Updated Round startDate to:", updatedDate)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
