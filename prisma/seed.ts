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

    let holesData = Array.from({ length: 18 }).map((_, i) => ({
      number: i + 1,
      par: 4, 
      strokeIndex: i + 1, 
    }))

    let teesData = [
      { name: 'White', courseRating: 72.0, slope: 130 },
      { name: 'Yellow', courseRating: 70.0, slope: 125 },
      { name: 'Red', courseRating: 73.0, slope: 128 },
    ]

    if (name === 'GC Gut Altentann') {
      holesData = [
        { number: 1, par: 4, strokeIndex: 9 },
        { number: 2, par: 4, strokeIndex: 11 },
        { number: 3, par: 3, strokeIndex: 15 },
        { number: 4, par: 4, strokeIndex: 17 },
        { number: 5, par: 4, strokeIndex: 7 },
        { number: 6, par: 5, strokeIndex: 13 },
        { number: 7, par: 3, strokeIndex: 3 },
        { number: 8, par: 4, strokeIndex: 5 },
        { number: 9, par: 5, strokeIndex: 1 },
        { number: 10, par: 3, strokeIndex: 12 },
        { number: 11, par: 4, strokeIndex: 14 },
        { number: 12, par: 5, strokeIndex: 18 },
        { number: 13, par: 4, strokeIndex: 2 },
        { number: 14, par: 3, strokeIndex: 8 },
        { number: 15, par: 4, strokeIndex: 10 },
        { number: 16, par: 4, strokeIndex: 4 },
        { number: 17, par: 4, strokeIndex: 6 },
        { number: 18, par: 5, strokeIndex: 16 }
      ]
      teesData = [
        { name: 'White', courseRating: 73.0, slope: 138 },
        { name: 'Yellow', courseRating: 70.5, slope: 130 },
        { name: 'Blue', courseRating: 73.2, slope: 131 },
        { name: 'Red', courseRating: 70.5, slope: 127 }
      ]
    }

    const course = await prisma.course.create({
      data: {
        name,
        holes: {
          create: holesData,
        },
        tees: {
          create: teesData,
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
