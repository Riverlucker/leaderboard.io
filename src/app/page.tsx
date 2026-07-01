import { auth } from "@/auth"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { CompetitionClientView } from "./CompetitionClientView"

interface HomeProps {
  searchParams: Promise<{ comp?: string }>
}

export default async function Home({ searchParams }: HomeProps) {
  const session = await auth()
  const resolvedSearchParams = await searchParams
  const compSlug = resolvedSearchParams.comp

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
          orderBy: { name: 'asc' } // sort alphabetically/chronologically
        },
        teams: {
          orderBy: { name: 'asc' }
        },
        participants: {
          include: {
            user: true,
            team: true,
            manualHandicaps: true,
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
          competition={competition} 
          session={session} 
          courses={courses}
          users={users}
        />
      )
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 to-cyan-600 drop-shadow-sm pb-2">
          leaderboard.io
        </h1>
        <p className="text-lg text-slate-400">
          The ultimate platform for hosting and scoring dynamic golf competitions.
        </p>
        
        {session ? (
          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl text-left space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-emerald-400 mb-1">Welcome back!</h2>
              <p className="text-slate-300 font-medium">{session.user.name || session.user.email}</p>
              <p className="text-sm text-slate-500 mt-2">Access Level: {session.user.role}</p>
            </div>
            {(session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') && (
              <Link href="/admin" className="block w-full py-2.5 px-4 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold rounded-xl transition-colors duration-200 text-center">
                Admin Panel
              </Link>
            )}
          </div>
        ) : (
          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-200">Spectator or Player?</h2>
            <p className="text-slate-400 text-sm">
              Log in to manage competitions, enter live scores on the course, or view private leaderboards.
            </p>
            <Link href="/login" className="block w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-colors duration-200 text-center">
              Sign In
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
