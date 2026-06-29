import prisma from "@/lib/prisma"
import Link from "next/link"
import { Plus, User } from "lucide-react"
import { UserRowActions } from "./UserRowActions"

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  })

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Manage Users & Players</h1>
          <p className="text-slate-400 text-sm mt-1">Add, edit, or remove players and administrators.</p>
        </div>
        <Link
          href="/admin/users/new"
          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl transition-colors text-sm"
        >
          <Plus size={16} />
          <span>Add User</span>
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4 text-center">Handicap</th>
                <th className="px-6 py-4">Home Course</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    No users found. Click "Add User" to create one.
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400">
                          <User size={16} />
                        </div>
                        <span>{u.name || "N/A"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">{u.email || "N/A"}</td>
                    <td className="px-6 py-4 text-center font-bold text-cyan-400">
                      {u.handicap !== null && u.handicap !== undefined ? u.handicap.toFixed(1) : "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{u.homeCourse || "N/A"}</td>
                    <td className="px-6 py-4 text-slate-450 text-xs font-mono">{u.phoneNumber || "N/A"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        u.role === 'SUPER_ADMIN' 
                          ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50' 
                          : u.role === 'ADMIN'
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                            : 'bg-slate-800 text-slate-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <UserRowActions userId={u.id} userName={u.name || u.email || "Unnamed User"} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
