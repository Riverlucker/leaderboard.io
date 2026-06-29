import prisma from "@/lib/prisma"
import Link from "next/link"
import { Plus, Trophy, Calendar, Users, Layers, Flag } from "lucide-react"
import { CompetitionRowActions } from "./CompetitionRowActions"

// Format helper
function formatCompType(type: string) {
  switch (type) {
    case "STROKEPLAY_GROSS":
      return "Strokeplay Gross"
    case "NETTO_STABLEFORD":
      return "Netto Stableford"
    case "MATCHPLAY":
      return "Matchplay (Ryder Cup)"
    default:
      return type
  }
}

export default async function AdminCompetitionsPage() {
  const competitions = await prisma.competition.findMany({
    include: {
      _count: {
        select: {
          rounds: true,
          participants: true,
          teams: true
        }
      }
    },
    orderBy: {
      startDate: 'desc'
    }
  })

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Manage Competitions</h1>
          <p className="text-slate-400 text-sm mt-1">Configure tournaments, add courses, set pairings, and review scorecards.</p>
        </div>
        <Link
          href="/admin/competitions/new"
          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl transition-colors text-sm"
        >
          <Plus size={16} />
          <span>New Competition</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {competitions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
            <Trophy size={48} className="mx-auto mb-4 text-slate-600 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-450 mb-1">No competitions found</h3>
            <p className="text-slate-550 text-sm mb-4">Click "New Competition" to start setting up your first tournament.</p>
            <Link
              href="/admin/competitions/new"
              className="inline-block bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              Get Started
            </Link>
          </div>
        ) : (
          competitions.map(comp => {
            const startStr = comp.startDate ? new Date(comp.startDate).toLocaleDateString() : null
            const endStr = comp.endDate ? new Date(comp.endDate).toLocaleDateString() : null
            const dateRange = startStr && endStr 
              ? `${startStr} - ${endStr}` 
              : startStr || endStr || "No date set"

            return (
              <div 
                key={comp.id} 
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-6 hover:border-slate-750 transition-all"
              >
                <div className="space-y-3 flex-1">
                  <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                    <h2 className="text-xl font-bold text-emerald-400">{comp.name}</h2>
                    <span className="bg-slate-950 text-slate-400 border border-slate-800 text-xs font-mono px-2 py-0.5 rounded">
                      Slug: {comp.uniqueSlug}
                    </span>
                    {comp.isTeamComp && (
                      <span className="bg-cyan-950/60 text-cyan-300 border border-cyan-900/50 text-xs font-semibold px-2 py-0.5 rounded-full">
                        Team Competition
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
                    <div className="flex items-center space-x-2">
                      <Flag size={16} className="text-emerald-500" />
                      <span>{formatCompType(comp.type)}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Calendar size={16} className="text-cyan-500" />
                      <span>{dateRange}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                    <span className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1 rounded-lg border border-slate-850">
                      <Layers size={12} className="text-indigo-400" />
                      <span>{comp._count.rounds} {comp._count.rounds === 1 ? 'Round' : 'Rounds'}</span>
                    </span>

                    {comp.isTeamComp && (
                      <span className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1 rounded-lg border border-slate-850">
                        <Users size={12} className="text-cyan-400" />
                        <span>{comp._count.teams} {comp._count.teams === 1 ? 'Team' : 'Teams'}</span>
                      </span>
                    )}

                    <span className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1 rounded-lg border border-slate-850">
                      <Users size={12} className="text-emerald-400" />
                      <span>{comp._count.participants} {comp._count.participants === 1 ? 'Participant' : 'Participants'}</span>
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center justify-end">
                  <CompetitionRowActions compId={comp.id} compName={comp.name} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
