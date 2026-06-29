"use client"

import { deleteCompetition } from "./actions"
import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export function CompetitionRowActions({ compId, compName }: { compId: string, compName: string }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete competition "${compName}"? This will delete all its rounds, teams, participants, matches, and scores.`)) {
      setIsDeleting(true)
      try {
        await deleteCompetition(compId)
        router.refresh()
      } catch (e) {
        console.error(e)
        alert("Failed to delete competition.")
      } finally {
        setIsDeleting(false)
      }
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <Link
        href={`/admin/competitions/${compId}`}
        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors border border-slate-700 font-medium text-sm flex items-center space-x-1"
        title="Edit / Configure Competition"
      >
        <Pencil size={14} />
        <span>Configure</span>
      </Link>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="p-1.5 bg-slate-800 hover:bg-red-955/40 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
        title="Delete Competition"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
