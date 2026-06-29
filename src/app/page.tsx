import { auth } from "@/auth"
import Link from "next/link"

export default async function Home() {
  const session = await auth()

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
          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl text-left">
            <h2 className="text-2xl font-bold text-emerald-400 mb-1">Welcome back!</h2>
            <p className="text-slate-300 font-medium">{session.user.name || session.user.email}</p>
            <p className="text-sm text-slate-500 mt-2">Access Level: {session.user.role}</p>
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
