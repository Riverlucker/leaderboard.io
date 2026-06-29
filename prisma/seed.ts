import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // 1. Create a Super Admin User
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@leaderboard.io' },
    update: {},
    create: {
      email: 'admin@leaderboard.io',
      name: 'Super Admin',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  })
  console.log(`Super Admin created: ${superAdmin.email}`)

  // 2. Courses
  const courseNames = [
    'GC Gut Altentann',
    'GC Zillertal-Uderns',
    'Son Gual',
    'T-Club Calvia',
    'T-Club Palma',
    'Simulator',
  ]

  for (const name of courseNames) {
    const existing = await prisma.course.findFirst({ where: { name } })
    if (existing) {
        console.log(`Course ${name} already exists. Skipping.`)
        continue;
    }
    const course = await prisma.course.create({
      data: {
        name,
        // Generate standard 18 holes for each
        holes: {
          create: Array.from({ length: 18 }).map((_, i) => ({
            number: i + 1,
            par: 4, 
            strokeIndex: i + 1, 
          })),
        },
        tees: {
          create: [
            { name: 'White', courseRating: 72.0, slope: 130 },
            { name: 'Yellow', courseRating: 70.0, slope: 125 },
            { name: 'Red', courseRating: 73.0, slope: 128 },
          ]
        }
      }
    })
    console.log(`Created course: ${course.name}`)
  }

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
