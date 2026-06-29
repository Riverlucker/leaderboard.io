"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateUser } from "../actions"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"

export function EditUserClient({ user }: { user: any }) {
  const router = useRouter()
  const [name, setName] = useState(user.name || "")
  const [email, setEmail] = useState(user.email || "")
  const [password, setPassword] = useState("")
  const [handicap, setHandicap] = useState(user.handicap !== null && user.handicap !== undefined ? String(user.handicap) : "")
  const [homeCourse, setHomeCourse] = useState(user.homeCourse || "")
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || "")
  const [role, setRole] = useState<"USER" | "ADMIN" | "SUPER_ADMIN">(user.role)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const hcVal = handicap.trim() !== "" ? parseFloat(handicap) : null
      if (hcVal !== null && isNaN(hcVal)) {
        throw new Error("Handicap must be a valid number.")
      }

      await updateUser(user.id, {
        name: name || undefined,
        email: email || undefined,
        password: password || undefined,
        handicap: hcVal,
        homeCourse: homeCourse || undefined,
        phoneNumber: phoneNumber || undefined,
        role
      })

      router.push("/admin/users")
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred while updating the user.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link 
          href="/admin/users" 
          className="inline-flex items-center space-x-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Users</span>
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Edit User / Player</h1>

      {error && (
        <div className="bg-red-950/65 border border-red-800 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Name / Nickname</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="USER">USER (Standard Player)</option>
              <option value="ADMIN">ADMIN (Tournament Organizer)</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN (Site Admin)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Email Address (Optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Password (Optional)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty to keep unchanged"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Golf Handicap (Optional)</label>
            <input
              type="number"
              step="0.1"
              value={handicap}
              onChange={(e) => setHandicap(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Home Course (Optional)</label>
            <input
              type="text"
              value={homeCourse}
              onChange={(e) => setHomeCourse(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-400 mb-2">Phone Number (Optional)</label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 flex justify-end space-x-4">
          <Link
            href="/admin/users"
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700 font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
