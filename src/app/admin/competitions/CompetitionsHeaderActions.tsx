"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, Zap } from "lucide-react"
import { QuickSingleRoundModal } from "./QuickSingleRoundModal"

interface CompetitionsHeaderActionsProps {
  courses: Array<{
    id: string
    name: string
    tees: Array<{ id: string; name: string }>
  }>
  users: Array<{
    id: string
    name: string | null
    email: string | null
    handicap: number | null
  }>
}

export function CompetitionsHeaderActions({
  courses,
  users
}: CompetitionsHeaderActionsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black px-4 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 text-sm cursor-pointer"
        >
          <Zap size={18} className="fill-slate-950" />
          <span>⚡ Einzelrunde</span>
        </button>

        <Link
          href="/admin/competitions/new"
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors text-sm"
        >
          <Plus size={16} />
          <span>Turnier / Competition</span>
        </Link>
      </div>

      <QuickSingleRoundModal
        courses={courses}
        users={users}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
