import { auth } from "@/auth"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { CompetitionClientView } from "./CompetitionClientView"
import { calculateCourseHandicap } from "@/lib/scoring"
import { cookies } from "next/headers"

interface HomeProps {
  searchParams: Promise<{ comp?: string }>
}

export default async function Home({ searchParams }: HomeProps) {
  const session = await auth()
  const resolvedSearchParams = await searchParams
  const compSlug = resolvedSearchParams.comp

  // Load the last competition from cookie if available
  const cookieStore = await cookies()
  const lastCompSlug = cookieStore.get("last-comp-slug")?.value
  let lastCompetition = null
  if (lastCompSlug) {
    lastCompetition = await prisma.competition.findUnique({
      where: { uniqueSlug: lastCompSlug }
    })
  }

  // Load all competitions to list on the landing page
  const competitions = await prisma.competition.findMany({
    orderBy: { startDate: 'desc' }
  })

  if (compSlug) {
    const competition = await prisma.competition.findUnique({
      where: { uniqueSlug: compSlug },
      include: {
        auditLogs: {
          orderBy: { createdAt: 'desc' }
        },
        rounds: {
          include: {
            tee: true,
            course: {
              include: {
                tees: true,
                holes: {
                  orderBy: { number: 'asc' }
                }
              }
            },
            matches: {
              include: {
                matchPlayers: true
              }
            }
          },
          orderBy: { startDate: 'asc' }
        },
        teams: {
          orderBy: { name: 'asc' }
        },
        participants: {
          include: {
            user: true,
            team: true,
            manualRoundHandicaps: true,
            scores: {
              include: {
                hole: true
              }
            }
          },
          orderBy: [
            { dummyName: 'asc' },
            { user: { name: 'asc' } }
          ]
        }
      }
    })

    if (competition) {
      // Check if any participant is missing manual handicaps for any round
      let missingFound = false
      for (const p of competition.participants) {
        if (p.compHandicap === null || p.compHandicap === undefined) continue

        for (const round of competition.rounds) {
          const hasRecord = p.manualRoundHandicaps.some((mr: any) => mr.roundId === round.id)
          if (!hasRecord) {
            missingFound = true
            const tee = round.tee ||
                        round.course.tees.find((t: any) => t.name.toLowerCase().includes('yellow')) ||
                        round.course.tees.find((t: any) => t.name.toLowerCase().includes('white')) ||
                        round.course.tees[0]
            if (tee) {
              const coursePar = round.course.holes.reduce((sum: number, h: any) => sum + h.par, 0)
              const handicapValue = calculateCourseHandicap(p.compHandicap, tee, coursePar)

              await prisma.manualRoundHandicap.create({
                data: {
                  participantId: p.id,
                  roundId: round.id,
                  handicapValue
                }
              })
            }
          }
        }
      }

      // If we created any missing records, refetch the competition to include them
      let finalCompetition = competition
      if (missingFound) {
        finalCompetition = (await prisma.competition.findUnique({
          where: { uniqueSlug: compSlug },
          include: {
            auditLogs: {
              orderBy: { createdAt: 'desc' }
            },
            rounds: {
              include: {
                tee: true,
                course: {
                  include: {
                    tees: true,
                    holes: {
                      orderBy: { number: 'asc' }
                    }
                  }
                },
                matches: {
                  include: {
                    matchPlayers: true
                  }
                }
              },
              orderBy: { startDate: 'asc' }
            },
            teams: {
              orderBy: { name: 'asc' }
            },
            participants: {
              include: {
                user: true,
                team: true,
                manualRoundHandicaps: true,
                scores: {
                  include: {
                    hole: true
                  }
                }
              },
              orderBy: [
                { dummyName: 'asc' },
                { user: { name: 'asc' } }
              ]
            }
          }
        })) || competition
      }

      let courses: any[] = []
      let users: any[] = []
      
      if (session && (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN')) {
        courses = await prisma.course.findMany({
          include: { 
            tees: true,
            holes: {
              orderBy: { number: 'asc' }
            }
          },
          orderBy: { name: 'asc' }
        })
        users = await prisma.user.findMany({
          orderBy: { name: 'asc' }
        })
      }

      return (
        <CompetitionClientView 
          competition={finalCompetition} 
          session={session} 
          courses={courses}
          users={users}
        />
      )
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-8 text-center">
        <h1 className="text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 to-cyan-600 drop-shadow-sm pb-2">
          leaderboard.io
        </h1>
        <p className="text-lg text-slate-400 max-w-md mx-auto">
          The ultimate platform for hosting and scoring dynamic golf competitions.
        </p>

        {lastCompetition && (
          <div className="p-6 bg-emerald-950/30 border border-emerald-800/50 rounded-2xl shadow-xl text-center space-y-3">
            <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-400">Active Session</span>
            <h3 className="text-xl font-bold text-slate-100">{lastCompetition.name}</h3>
            <Link
              href={`/?comp=${lastCompetition.uniqueSlug}`}
              className="inline-block py-2.5 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition-all shadow-md transform hover:scale-[1.02]"
            >
              Resume Competition
            </Link>
          </div>
        )}

        <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl text-left space-y-6">
          {session ? (
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <p className="text-xs text-slate-500">Logged in as</p>
                <p className="text-sm font-bold text-slate-200">{session.user.name || session.user.email}</p>
              </div>
              {(session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') && (
                <Link href="/admin" className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg border border-slate-700 transition-colors">
                  Admin Panel
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <span className="text-sm text-slate-400 font-medium">Scoring or Admin access?</span>
              <Link href="/login" className="py-1.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors">
                Sign In
              </Link>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Select Competition</h3>
            {competitions.length === 0 ? (
              <p className="text-xs text-slate-500">No competitions found.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                {competitions.map((c: any) => {
                  const isLast = lastCompetition?.id === c.id
                  return (
                    <Link
                      key={c.id}
                      href={`/?comp=${c.uniqueSlug}`}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        isLast
                          ? 'bg-emerald-950/20 border-emerald-700 text-slate-100'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 text-slate-300'
                      }`}
                    >
                      <div className="truncate pr-4">
                        <span className="font-extrabold text-sm block truncate">{c.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {c.startDate ? new Date(c.startDate).toLocaleDateString() : "No Date"}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-emerald-500 flex-shrink-0">View →</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
