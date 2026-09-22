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
    'GC Eugendorf',
    'GC Zillertal-Uderns',
    'GC Achensee',
    'Gut Heckenhof rot/gelb',
    'Gut Heckenhof gelb/grün',
    'Gut Heckenhof grün/rot',
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
    } else if (name === 'GC Eugendorf') {
      holesData = [
        { number: 1, par: 4, strokeIndex: 12 },
        { number: 2, par: 4, strokeIndex: 2 },
        { number: 3, par: 5, strokeIndex: 6 },
        { number: 4, par: 4, strokeIndex: 4 },
        { number: 5, par: 3, strokeIndex: 18 },
        { number: 6, par: 4, strokeIndex: 10 },
        { number: 7, par: 4, strokeIndex: 14 },
        { number: 8, par: 5, strokeIndex: 8 },
        { number: 9, par: 3, strokeIndex: 16 },
        { number: 10, par: 5, strokeIndex: 1 },
        { number: 11, par: 4, strokeIndex: 9 },
        { number: 12, par: 4, strokeIndex: 3 },
        { number: 13, par: 4, strokeIndex: 11 },
        { number: 14, par: 4, strokeIndex: 13 },
        { number: 15, par: 3, strokeIndex: 17 },
        { number: 16, par: 5, strokeIndex: 15 },
        { number: 17, par: 3, strokeIndex: 5 },
        { number: 18, par: 4, strokeIndex: 7 }
      ]
      teesData = [
        { name: 'White', courseRating: 72.9, slope: 137 },
        { name: 'Yellow', courseRating: 70.8, slope: 134 },
        { name: 'Blue', courseRating: 68.6, slope: 126 },
        { name: 'Red', courseRating: 67.1, slope: 123 },
        { name: 'Orange', courseRating: 67.1, slope: 123 }
      ]
    } else if (name === 'GC Zillertal-Uderns') {
      holesData = [
        { number: 1, par: 4, strokeIndex: 5 },
        { number: 2, par: 3, strokeIndex: 11 },
        { number: 3, par: 5, strokeIndex: 3 },
        { number: 4, par: 3, strokeIndex: 15 },
        { number: 5, par: 4, strokeIndex: 7 },
        { number: 6, par: 4, strokeIndex: 13 },
        { number: 7, par: 4, strokeIndex: 17 },
        { number: 8, par: 5, strokeIndex: 9 },
        { number: 9, par: 4, strokeIndex: 1 },
        { number: 10, par: 4, strokeIndex: 10 },
        { number: 11, par: 4, strokeIndex: 8 },
        { number: 12, par: 3, strokeIndex: 16 },
        { number: 13, par: 4, strokeIndex: 14 },
        { number: 14, par: 3, strokeIndex: 18 },
        { number: 15, par: 4, strokeIndex: 2 },
        { number: 16, par: 3, strokeIndex: 12 },
        { number: 17, par: 5, strokeIndex: 4 },
        { number: 18, par: 4, strokeIndex: 6 }
      ]
      teesData = [
        { name: 'White', courseRating: 71.6, slope: 130 },
        { name: 'Yellow', courseRating: 69.7, slope: 130 },
        { name: 'Blue', courseRating: 68.1, slope: 124 },
        { name: 'Red', courseRating: 66.0, slope: 119 },
        { name: 'Orange', courseRating: 69.7, slope: 121 }
      ]
    } else if (name === 'GC Achensee') {
      holesData = [
        { number: 1, par: 4, strokeIndex: 17 },
        { number: 2, par: 4, strokeIndex: 5 },
        { number: 3, par: 3, strokeIndex: 13 },
        { number: 4, par: 5, strokeIndex: 1 },
        { number: 5, par: 4, strokeIndex: 11 },
        { number: 6, par: 3, strokeIndex: 15 },
        { number: 7, par: 4, strokeIndex: 7 },
        { number: 8, par: 5, strokeIndex: 9 },
        { number: 9, par: 4, strokeIndex: 3 },
        { number: 10, par: 5, strokeIndex: 12 },
        { number: 11, par: 3, strokeIndex: 14 },
        { number: 12, par: 4, strokeIndex: 4 },
        { number: 13, par: 3, strokeIndex: 18 },
        { number: 14, par: 5, strokeIndex: 10 },
        { number: 15, par: 4, strokeIndex: 8 },
        { number: 16, par: 4, strokeIndex: 2 },
        { number: 17, par: 4, strokeIndex: 6 },
        { number: 18, par: 3, strokeIndex: 16 }
      ]
      teesData = [
        { name: 'White', courseRating: 73.2, slope: 128 },
        { name: 'Yellow', courseRating: 71.2, slope: 127 },
        { name: 'Blue', courseRating: 74.4, slope: 124 },
        { name: 'Red', courseRating: 72.5, slope: 123 }
      ]
    } else if (name === 'Gut Heckenhof rot/gelb') {
      holesData = [
        { number: 1, par: 4, strokeIndex: 7 },
        { number: 2, par: 3, strokeIndex: 17 },
        { number: 3, par: 5, strokeIndex: 3 },
        { number: 4, par: 4, strokeIndex: 5 },
        { number: 5, par: 3, strokeIndex: 13 },
        { number: 6, par: 5, strokeIndex: 1 },
        { number: 7, par: 3, strokeIndex: 15 },
        { number: 8, par: 4, strokeIndex: 9 },
        { number: 9, par: 4, strokeIndex: 11 },
        { number: 10, par: 4, strokeIndex: 12 },
        { number: 11, par: 4, strokeIndex: 8 },
        { number: 12, par: 4, strokeIndex: 4 },
        { number: 13, par: 5, strokeIndex: 10 },
        { number: 14, par: 3, strokeIndex: 16 },
        { number: 15, par: 4, strokeIndex: 18 },
        { number: 16, par: 4, strokeIndex: 14 },
        { number: 17, par: 5, strokeIndex: 6 },
        { number: 18, par: 4, strokeIndex: 2 }
      ]
      teesData = [
        { name: 'gelb', courseRating: 71.5, slope: 132 }
      ]
    } else if (name === 'Gut Heckenhof gelb/grün') {
      holesData = [
        { number: 1, par: 4, strokeIndex: 9 },
        { number: 2, par: 4, strokeIndex: 11 },
        { number: 3, par: 4, strokeIndex: 7 },
        { number: 4, par: 5, strokeIndex: 5 },
        { number: 5, par: 3, strokeIndex: 15 },
        { number: 6, par: 4, strokeIndex: 17 },
        { number: 7, par: 4, strokeIndex: 13 },
        { number: 8, par: 5, strokeIndex: 3 },
        { number: 9, par: 4, strokeIndex: 1 },
        { number: 10, par: 4, strokeIndex: 4 },
        { number: 11, par: 3, strokeIndex: 18 },
        { number: 12, par: 4, strokeIndex: 16 },
        { number: 13, par: 4, strokeIndex: 8 },
        { number: 14, par: 4, strokeIndex: 12 },
        { number: 15, par: 3, strokeIndex: 14 },
        { number: 16, par: 4, strokeIndex: 2 },
        { number: 17, par: 4, strokeIndex: 10 },
        { number: 18, par: 5, strokeIndex: 6 }
      ]
      teesData = [
        { name: 'gelb', courseRating: 72.1, slope: 131 }
      ]
    } else if (name === 'Gut Heckenhof grün/rot') {
      holesData = [
        { number: 1, par: 4, strokeIndex: 5 },
        { number: 2, par: 3, strokeIndex: 17 },
        { number: 3, par: 4, strokeIndex: 15 },
        { number: 4, par: 4, strokeIndex: 7 },
        { number: 5, par: 4, strokeIndex: 9 },
        { number: 6, par: 3, strokeIndex: 13 },
        { number: 7, par: 4, strokeIndex: 3 },
        { number: 8, par: 4, strokeIndex: 8 },
        { number: 9, par: 5, strokeIndex: 1 },
        { number: 10, par: 4, strokeIndex: 8 },
        { number: 11, par: 3, strokeIndex: 18 },
        { number: 12, par: 5, strokeIndex: 4 },
        { number: 13, par: 4, strokeIndex: 6 },
        { number: 14, par: 3, strokeIndex: 14 },
        { number: 15, par: 5, strokeIndex: 2 },
        { number: 16, par: 3, strokeIndex: 16 },
        { number: 17, par: 4, strokeIndex: 10 },
        { number: 18, par: 4, strokeIndex: 12 }
      ]
      teesData = [
        { name: 'gelb', courseRating: 69.8, slope: 124 }
      ]
    } else if (name === 'T-Club Calvia') {
      holesData = [
        { number: 1, par: 4, strokeIndex: 17 },
        { number: 2, par: 5, strokeIndex: 7 },
        { number: 3, par: 4, strokeIndex: 1 },
        { number: 4, par: 4, strokeIndex: 5 },
        { number: 5, par: 5, strokeIndex: 13 },
        { number: 6, par: 3, strokeIndex: 15 },
        { number: 7, par: 4, strokeIndex: 3 },
        { number: 8, par: 4, strokeIndex: 9 },
        { number: 9, par: 3, strokeIndex: 11 },
        { number: 10, par: 4, strokeIndex: 2 },
        { number: 11, par: 5, strokeIndex: 6 },
        { number: 12, par: 3, strokeIndex: 10 },
        { number: 13, par: 4, strokeIndex: 14 },
        { number: 14, par: 4, strokeIndex: 16 },
        { number: 15, par: 3, strokeIndex: 18 },
        { number: 16, par: 4, strokeIndex: 4 },
        { number: 17, par: 4, strokeIndex: 8 },
        { number: 18, par: 5, strokeIndex: 12 },
      ]
      teesData = [
        { name: 'White', courseRating: 75.2, slope: 135 },
        { name: 'Yellow', courseRating: 73.1, slope: 134 },
        { name: 'Blue (Men)', courseRating: 70.6, slope: 131 },
        { name: 'Blue (Ladies)', courseRating: 76.1, slope: 141 },
        { name: 'Red (Men)', courseRating: 68.3, slope: 127 },
        { name: 'Red (Ladies)', courseRating: 73.7, slope: 134 },
      ]
    } else if (name === 'T-Club Palma') {
      holesData = [
        { number: 1, par: 4, strokeIndex: 7 },
        { number: 2, par: 3, strokeIndex: 12 },
        { number: 3, par: 4, strokeIndex: 3 },
        { number: 4, par: 5, strokeIndex: 9 },
        { number: 5, par: 4, strokeIndex: 1 },
        { number: 6, par: 3, strokeIndex: 17 },
        { number: 7, par: 4, strokeIndex: 13 },
        { number: 8, par: 4, strokeIndex: 6 },
        { number: 9, par: 4, strokeIndex: 14 },
        { number: 10, par: 4, strokeIndex: 10 },
        { number: 11, par: 5, strokeIndex: 11 },
        { number: 12, par: 4, strokeIndex: 5 },
        { number: 13, par: 3, strokeIndex: 18 },
        { number: 14, par: 5, strokeIndex: 16 },
        { number: 15, par: 4, strokeIndex: 2 },
        { number: 16, par: 3, strokeIndex: 8 },
        { number: 17, par: 4, strokeIndex: 15 },
        { number: 18, par: 4, strokeIndex: 4 },
      ]
      teesData = [
        { name: 'White', courseRating: 71.7, slope: 128 },
        { name: 'Yellow', courseRating: 69.1, slope: 127 },
        { name: 'Blue (Ladies)', courseRating: 72.2, slope: 131 },
        { name: 'Red (Ladies)', courseRating: 68.7, slope: 126 },
      ]
    } else if (name === 'Son Gual') {
      holesData = [
        { number: 1, par: 4, strokeIndex: 7 },
        { number: 2, par: 4, strokeIndex: 15 },
        { number: 3, par: 4, strokeIndex: 13 },
        { number: 4, par: 5, strokeIndex: 11 },
        { number: 5, par: 3, strokeIndex: 5 },
        { number: 6, par: 5, strokeIndex: 9 },
        { number: 7, par: 4, strokeIndex: 1 },
        { number: 8, par: 4, strokeIndex: 17 },
        { number: 9, par: 3, strokeIndex: 3 },
        { number: 10, par: 4, strokeIndex: 10 },
        { number: 11, par: 4, strokeIndex: 4 },
        { number: 12, par: 5, strokeIndex: 14 },
        { number: 13, par: 4, strokeIndex: 12 },
        { number: 14, par: 4, strokeIndex: 16 },
        { number: 15, par: 3, strokeIndex: 18 },
        { number: 16, par: 4, strokeIndex: 6 },
        { number: 17, par: 3, strokeIndex: 8 },
        { number: 18, par: 5, strokeIndex: 2 },
      ]
      teesData = [
        { name: 'Black (Men)', courseRating: 75.7, slope: 138 },
        { name: 'White (Men)', courseRating: 73.5, slope: 135 },
        { name: 'Yellow (Men)', courseRating: 72.2, slope: 132 },
        { name: 'Blue (Ladies)', courseRating: 74.6, slope: 134 },
        { name: 'Red (Ladies)', courseRating: 72.1, slope: 127 },
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

  // 3. The Real Rycer Cup 2026 (TRRC26)
  const existingTrrc = await prisma.competition.findUnique({
    where: { uniqueSlug: 'TRRC26' }
  })
  if (!existingTrrc) {
    const palma = await prisma.course.findFirst({ where: { name: 'T-Club Palma' }, include: { tees: true, holes: true } })
    const sonGual = await prisma.course.findFirst({ where: { name: 'Son Gual' }, include: { tees: true, holes: true } })
    const calvia = await prisma.course.findFirst({ where: { name: 'T-Club Calvia' }, include: { tees: true, holes: true } })

    if (palma && sonGual && calvia) {
      const palmaYellow = palma.tees.find(t => t.name.toLowerCase().includes('yellow')) || palma.tees[0]
      const sonGualYellow = sonGual.tees.find(t => t.name.toLowerCase().includes('yellow')) || sonGual.tees[0]
      const calviaYellow = calvia.tees.find(t => t.name.toLowerCase().includes('yellow')) || calvia.tees[0]

      const comp = await prisma.competition.create({
        data: {
          uniqueSlug: 'TRRC26',
          name: 'The Real Rycer Cup - 2026',
          type: 'RYDER_CUP',
          isTeamComp: true,
          showRelToPar: false,
          startDate: new Date('2026-12-19T08:00:00.000Z'),
          endDate: new Date('2026-12-21T18:00:00.000Z'),
          bgImage: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRP_5PoMe0NfOTIWvIbvLl_I24sZrPNxtPtFi3Q1PdsVauPMf0NqqSBr2w&s=10',
          extraLeaderboards: ['MVP', 'DONUT'],
          cssConfig: JSON.stringify({
            primaryColor: '#2563eb',
            logo: '/trrc.jpg',
            ryderCup: true,
          }),
        }
      })

      const teamDiamond = await prisma.team.create({
        data: { competitionId: comp.id, name: 'Team Diamond', color: 'blue' }
      })
      const teamHearts = await prisma.team.create({
        data: { competitionId: comp.id, name: 'Team Hearts', color: 'red' }
      })

      const hcps = [2.4, 5.8, 8.5, 11.2, 14.1, 17.3, 20.0]
      const diamondStars = [4, 2, 1, 3, 0, 1, 0]
      const heartsStars = [3, 2, 0, 2, 1, 1, 0]
      const playerPassword = await bcrypt.hash('golf', 10)

      const diamondPlayers: any[] = []
      const heartsPlayers: any[] = []

      for (let i = 0; i < 7; i++) {
        const pNumD = i + 1
        const starStrD = diamondStars[i] > 0 ? ` ${'⭐'.repeat(diamondStars[i])}` : ''
        const nameD = `Spieler ${pNumD}${starStrD}`
        const userD = await prisma.user.upsert({
          where: { email: `spieler${pNumD}@trrc.com` },
          update: { name: nameD, password: playerPassword, handicap: hcps[i] },
          create: { email: `spieler${pNumD}@trrc.com`, name: nameD, password: playerPassword, role: 'USER', handicap: hcps[i] }
        })

        const dp = await prisma.participant.create({
          data: {
            competitionId: comp.id,
            teamId: teamDiamond.id,
            userId: userD.id,
            dummyName: nameD,
            compHandicap: hcps[i],
          }
        })
        diamondPlayers.push(dp)

        const pNumH = i + 8
        const starStrH = heartsStars[i] > 0 ? ` ${'⭐'.repeat(heartsStars[i])}` : ''
        const nameH = `Spieler ${pNumH}${starStrH}`
        const userH = await prisma.user.upsert({
          where: { email: `spieler${pNumH}@trrc.com` },
          update: { name: nameH, password: playerPassword, handicap: hcps[i] },
          create: { email: `spieler${pNumH}@trrc.com`, name: nameH, password: playerPassword, role: 'USER', handicap: hcps[i] }
        })

        const hp = await prisma.participant.create({
          data: {
            competitionId: comp.id,
            teamId: teamHearts.id,
            userId: userH.id,
            dummyName: nameH,
            compHandicap: hcps[i],
          }
        })
        heartsPlayers.push(hp)
      }

      const getPH = (hcp: number, tee: any, par: number) => {
        return Math.round((hcp * tee.slope) / 113 + (tee.courseRating - par))
      }

      const palmaPar = palma.holes.reduce((s, h) => s + h.par, 0)
      const sonGualPar = sonGual.holes.reduce((s, h) => s + h.par, 0)
      const calviaPar = calvia.holes.reduce((s, h) => s + h.par, 0)

      // Rounds
      const r1 = await prisma.round.create({
        data: {
          competitionId: comp.id,
          courseId: palma.id,
          teeId: palmaYellow.id,
          name: 'Tag 1 VM · Best Ball',
          startDate: new Date('2026-12-19T09:02:00.000Z'),
          holesPlayed: Array.from({ length: 18 }, (_, i) => i + 1),
        }
      })
      const r2 = await prisma.round.create({
        data: {
          competitionId: comp.id,
          courseId: palma.id,
          teeId: palmaYellow.id,
          name: 'Tag 1 NM · Chapman 4er',
          startDate: new Date('2026-12-19T14:22:00.000Z'),
          holesPlayed: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        }
      })
      const r3 = await prisma.round.create({
        data: {
          competitionId: comp.id,
          courseId: sonGual.id,
          teeId: sonGualYellow.id,
          name: 'Tag 2 VM · Best Ball',
          startDate: new Date('2026-12-20T09:02:00.000Z'),
          holesPlayed: Array.from({ length: 18 }, (_, i) => i + 1),
        }
      })
      const r4 = await prisma.round.create({
        data: {
          competitionId: comp.id,
          courseId: sonGual.id,
          teeId: sonGualYellow.id,
          name: 'Tag 2 NM · Chapman 4er',
          startDate: new Date('2026-12-20T14:22:00.000Z'),
          holesPlayed: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        }
      })
      const r5 = await prisma.round.create({
        data: {
          competitionId: comp.id,
          courseId: calvia.id,
          teeId: calviaYellow.id,
          name: 'Final Day Singles',
          startDate: new Date('2026-12-21T11:12:00.000Z'),
          holesPlayed: Array.from({ length: 18 }, (_, i) => i + 1),
        }
      })

      // Helper for VM Fourball
      const seedFourball = async (round: any, tee: any, par: number) => {
        // Singles (0.5 pt)
        const diff = Math.abs(getPH(diamondPlayers[0].compHandicap, tee, par) - getPH(heartsPlayers[0].compHandicap, tee, par))
        await prisma.match.create({
          data: {
            roundId: round.id,
            type: 'SINGLES',
            allowanceType: '75%',
            handicapAllowance: Math.round(diff * 0.75),
            holeRange: '1-18',
            matchPlayers: {
              create: [
                { participantId: diamondPlayers[0].id, handicapAllowance: 0 },
                { participantId: heartsPlayers[0].id, handicapAllowance: 0 }
              ]
            }
          }
        })
        const pairs = [
          [diamondPlayers[1], diamondPlayers[2], heartsPlayers[1], heartsPlayers[2]],
          [diamondPlayers[3], diamondPlayers[4], heartsPlayers[3], heartsPlayers[4]],
          [diamondPlayers[5], diamondPlayers[6], heartsPlayers[5], heartsPlayers[6]],
        ]
        for (const [dp1, dp2, hp1, hp2] of pairs) {
          const phs = [dp1, dp2, hp1, hp2].map(p => getPH(p.compHandicap, tee, par))
          const min = Math.min(...phs)
          await prisma.match.create({
            data: {
              roundId: round.id,
              type: 'TEAM_MATCHPLAY',
              allowanceType: '85%',
              holeRange: '1-18',
              matchPlayers: {
                create: [
                  { participantId: dp1.id, handicapAllowance: Math.round((phs[0] - min) * 0.85) },
                  { participantId: dp2.id, handicapAllowance: Math.round((phs[1] - min) * 0.85) },
                  { participantId: hp1.id, handicapAllowance: Math.round((phs[2] - min) * 0.85) },
                  { participantId: hp2.id, handicapAllowance: Math.round((phs[3] - min) * 0.85) },
                ]
              }
            }
          })
        }
      }

      // Helper for NM Chapman
      const seedChapman = async (round: any, tee: any, par: number) => {
        // Singles over 9 holes (0.5 pt)
        const diff = Math.abs(getPH(diamondPlayers[6].compHandicap, tee, par) - getPH(heartsPlayers[6].compHandicap, tee, par))
        await prisma.match.create({
          data: {
            roundId: round.id,
            type: 'SINGLES',
            allowanceType: '37.5%',
            handicapAllowance: Math.round((diff * 0.75) / 2),
            holeRange: '1-9',
            matchPlayers: {
              create: [
                { participantId: diamondPlayers[6].id, handicapAllowance: 0 },
                { participantId: heartsPlayers[6].id, handicapAllowance: 0 }
              ]
            }
          }
        })
        const pairs = [
          [diamondPlayers[0], diamondPlayers[1], heartsPlayers[0], heartsPlayers[1]],
          [diamondPlayers[2], diamondPlayers[3], heartsPlayers[2], heartsPlayers[3]],
          [diamondPlayers[4], diamondPlayers[5], heartsPlayers[4], heartsPlayers[5]],
        ]
        for (const [dp1, dp2, hp1, hp2] of pairs) {
          const t1_1 = getPH(dp1.compHandicap, tee, par)
          const t1_2 = getPH(dp2.compHandicap, tee, par)
          const t2_1 = getPH(hp1.compHandicap, tee, par)
          const t2_2 = getPH(hp2.compHandicap, tee, par)

          const t1 = Math.round(0.6 * Math.min(t1_1, t1_2) + 0.4 * Math.max(t1_1, t1_2))
          const t2 = Math.round(0.6 * Math.min(t2_1, t2_2) + 0.4 * Math.max(t2_1, t2_2))
          const allowance = Math.round(Math.abs(t1 - t2) / 2)

          await prisma.match.create({
            data: {
              roundId: round.id,
              type: 'CHAPMAN',
              allowanceType: 'Pinehurst-60/40',
              handicapAllowance: allowance,
              holeRange: '1-9',
              matchPlayers: {
                create: [
                  { participantId: dp1.id, handicapAllowance: t1 > t2 ? allowance : 0 },
                  { participantId: dp2.id, handicapAllowance: t1 > t2 ? allowance : 0 },
                  { participantId: hp1.id, handicapAllowance: t2 > t1 ? allowance : 0 },
                  { participantId: hp2.id, handicapAllowance: t2 > t1 ? allowance : 0 },
                ]
              }
            }
          })
        }
      }

      await seedFourball(r1, palmaYellow, palmaPar)
      await seedChapman(r2, palmaYellow, palmaPar)
      await seedFourball(r3, sonGualYellow, sonGualPar)
      await seedChapman(r4, sonGualYellow, sonGualPar)

      // Final Day Singles (highest first, lowest last)
      for (let idx = 6; idx >= 0; idx--) {
        const diff = Math.abs(getPH(diamondPlayers[idx].compHandicap, calviaYellow, calviaPar) - getPH(heartsPlayers[idx].compHandicap, calviaYellow, calviaPar))
        await prisma.match.create({
          data: {
            roundId: r5.id,
            type: 'SINGLES',
            allowanceType: '75%',
            handicapAllowance: Math.round(diff * 0.75),
            holeRange: '1-18',
            matchPlayers: {
              create: [
                { participantId: diamondPlayers[idx].id, handicapAllowance: 0 },
                { participantId: heartsPlayers[idx].id, handicapAllowance: 0 },
              ]
            }
          }
        })
      }
      console.log('Seeded TRRC26 competition, teams, participants, rounds and matches.')
    }
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
