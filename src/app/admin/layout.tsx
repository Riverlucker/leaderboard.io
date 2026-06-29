import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Home, Trophy, Map, Users } from "lucide-react"
import { SignOutButton } from "./SignOutButton"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col">
        <div className="p-6">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 to-cyan-600">
            leaderboard
          </h2>
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Admin Panel</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link href="/admin" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-colors">
            <Home size={20} />
            <span className="font-medium">Dashboard</span>
          </Link>
          <Link href="/admin/competitions" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-colors">
            <Trophy size={20} />
            <span className="font-medium">Competitions</span>
          </Link>
          <Link href="/admin/courses" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-colors">
            <Map size={20} />
            <span className="font-medium">Courses</span>
          </Link>
          <Link href="/admin/users" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-colors">
            <Users size={20} />
            <span className="font-medium">Players & Users</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="mb-4 px-2">
            <p className="text-sm font-semibold truncate">{session.user.name || session.user.email}</p>
            <p className="text-xs text-slate-500">{session.user.role}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
