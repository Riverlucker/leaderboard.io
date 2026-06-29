"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createCompetition } from "../actions"
import Link from "next/link"
import { ArrowLeft, Trophy } from "lucide-react"

export default function NewCompetitionPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [uniqueSlug, setUniqueSlug] = useState("")
  const [type, setType] = useState("STROKEPLAY_GROSS")
  const [isTeamComp, setIsTeamComp] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const comp = await createCompetition({
        name,
        uniqueSlug: uniqueSlug || undefined,
        type,
        isTeamComp,
        startDate: startDate || null,
        endDate: endDate || null
      })

      // Redirect directly to the newly created competition's detail/configuration page
      router.push(`/admin/competitions/${comp.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred while creating the competition.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link 
          href="/admin/competitions" 
          className="inline-flex items-center space-x-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Competitions</span>
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Create New Competition</h1>

      {error && (
        <div className="bg-red-950/65 border border-red-800 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-400 mb-2">Competition Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Summer Cup 2026"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Format / Scoring Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="STROKEPLAY_GROSS">Strokeplay Gross (Strokes count)</option>
              <option value="NETTO_STABLEFORD">Netto Stableford (Points based on HC)</option>
              <option value="MATCHPLAY">Matchplay (Ryder Cup style)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Unique Slug (For Links)</label>
            <input
              type="text"
              value={uniqueSlug}
              onChange={(e) => setUniqueSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
              placeholder="e.g. summer-2026 (optional)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-250 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Leave empty to auto-generate a random code.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center space-x-3">
          <input
            type="checkbox"
            id="isTeamComp"
            checked={isTeamComp}
            onChange={(e) => setIsTeamComp(e.target.checked)}
            className="w-4 h-4 text-emerald-500 border-slate-700 rounded focus:ring-emerald-500 focus:ring-offset-slate-950 bg-slate-900"
          />
          <label htmlFor="isTeamComp" className="text-sm font-medium text-slate-350 select-none cursor-pointer">
            This is a <strong>Team Competition</strong> (players will be grouped in teams)
          </label>
        </div>

        <div className="border-t border-slate-800 pt-6 flex justify-end space-x-4">
          <Link
            href="/admin/competitions"
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700 font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trophy size={16} />
            <span>{isSubmitting ? "Creating..." : "Create & Configure"}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
