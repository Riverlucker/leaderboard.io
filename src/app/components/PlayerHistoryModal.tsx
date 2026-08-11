"use client"

import React, { useState, useEffect, useMemo } from "react"
import { X, Filter, Calendar, MapPin, Hash, Award, RefreshCw, ChevronRight } from "lucide-react"
import { getPlayerRoundHistory, PlayerHistoryRound } from "@/app/actions/playerHistory"

interface PlayerHistoryModalProps {
  player: {
    userId?: string | null
    dummyName?: string | null
    name: string
  }
  onClose: () => void
  onOpenScorecard: (round: any, participant: any) => void
}

export function PlayerHistoryModal({ player, onClose, onOpenScorecard }: PlayerHistoryModalProps) {
  const [loading, setLoading] = useState(true)
  const [rounds, setRounds] = useState<PlayerHistoryRound[]>([])
  const [error, setError] = useState<string | null>(null)

  // Filters state
  const [lastXFilter, setLastXFilter] = useState<string>("All")
  const [periodFilter, setPeriodFilter] = useState<string>("All")
  const [courseFilter, setCourseFilter] = useState<string>("All")
  const [holesFilter, setHolesFilter] = useState<string>("All")

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true)
      setError(null)
      const res = await getPlayerRoundHistory({
        userId: player.userId,
        dummyName: player.dummyName
      })
      if (res.success && res.data) {
        setRounds(res.data)
      } else {
        setError(res.error || "Failed to load player history")
      }
      setLoading(false)
    }

    fetchHistory()
  }, [player.userId, player.dummyName])

  // Get list of unique course names for Golf Course filter
  const availableCourses = useMemo(() => {
    const courseSet = new Set<string>()
    rounds.forEach(r => {
      if (r.courseName) courseSet.add(r.courseName)
    })
    return Array.from(courseSet).sort()
  }, [rounds])

  // Filtered rounds logic
  const filteredRounds = useMemo(() => {
    let result = [...rounds]

    // 1. Period Filter
    if (periodFilter !== "All") {
      const now = new Date()
      let cutoff = new Date(0)

      if (periodFilter === "Last month") {
        cutoff = new Date(now.setMonth(now.getMonth() - 1))
      } else if (periodFilter === "Last 3 months") {
        cutoff = new Date(now.setMonth(now.getMonth() - 3))
      } else if (periodFilter === "Last Year") {
        cutoff = new Date(now.setFullYear(now.getFullYear() - 1))
      }

      result = result.filter(r => new Date(r.date) >= cutoff)
    }

    // 2. Golf Course Filter
    if (courseFilter !== "All") {
      result = result.filter(r => r.courseName === courseFilter)
    }

    // 3. Holes Played Filter
    if (holesFilter !== "All") {
      if (holesFilter === "9") {
        result = result.filter(r => r.holesPlayedCount === 9)
      } else if (holesFilter === "9 or more") {
        result = result.filter(r => r.holesPlayedCount >= 9)
      } else if (holesFilter === "18") {
        result = result.filter(r => r.holesPlayedCount === 18)
      } else if (holesFilter === "less than 9") {
        result = result.filter(r => r.holesPlayedCount < 9)
      }
    }

    // 4. Last X Filter
    if (lastXFilter !== "All") {
      const limit = parseInt(lastXFilter, 10)
      if (!isNaN(limit)) {
        result = result.slice(0, limit)
      }
    }

    return result
  }, [rounds, periodFilter, courseFilter, holesFilter, lastXFilter])

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[80] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/80 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
              <span>{player.name}</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                {filteredRounds.length} {filteredRounds.length === 1 ? "Round" : "Rounds"}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Player round overview & historical scores
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-slate-100/70 p-4 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Last X Filter */}
          <div>
            <label className="font-bold text-slate-600 block mb-1 flex items-center space-x-1">
              <Hash size={12} className="text-slate-400" />
              <span>Last X</span>
            </label>
            <select
              value={lastXFilter}
              onChange={e => setLastXFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="All">All</option>
              <option value="50">50</option>
              <option value="20">20</option>
              <option value="10">10</option>
              <option value="5">5</option>
            </select>
          </div>

          {/* Period Filter */}
          <div>
            <label className="font-bold text-slate-600 block mb-1 flex items-center space-x-1">
              <Calendar size={12} className="text-slate-400" />
              <span>Period</span>
            </label>
            <select
              value={periodFilter}
              onChange={e => setPeriodFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="All">All</option>
              <option value="Last month">Last month</option>
              <option value="Last 3 months">Last 3 months</option>
              <option value="Last Year">Last Year</option>
            </select>
          </div>

          {/* Golf Course Filter */}
          <div>
            <label className="font-bold text-slate-600 block mb-1 flex items-center space-x-1">
              <MapPin size={12} className="text-slate-400" />
              <span>Golf Course</span>
            </label>
            <select
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 truncate"
            >
              <option value="All">All</option>
              {availableCourses.map((cName, idx) => (
                <option key={idx} value={cName}>{cName}</option>
              ))}
            </select>
          </div>

          {/* Holes Played Filter */}
          <div>
            <label className="font-bold text-slate-600 block mb-1 flex items-center space-x-1">
              <Filter size={12} className="text-slate-400" />
              <span>Holes Played</span>
            </label>
            <select
              value={holesFilter}
              onChange={e => setHolesFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="All">All</option>
              <option value="9">9</option>
              <option value="9 or more">9 or more</option>
              <option value="18">18</option>
              <option value="less than 9">less than 9</option>
            </select>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {loading ? (
            <div className="py-12 text-center text-slate-500 space-y-3">
              <RefreshCw size={24} className="animate-spin mx-auto text-emerald-600" />
              <p className="text-xs font-semibold">Loading player round history...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-600 bg-red-50 rounded-xl border border-red-200 p-4 text-xs font-semibold">
              {error}
            </div>
          ) : filteredRounds.length === 0 ? (
            <div className="py-12 text-center text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-1">
              <p className="font-bold text-sm text-slate-700">No rounds found</p>
              <p className="text-xs">No played rounds match the selected filter criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm bg-white">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5">Datum</th>
                    <th className="px-3.5 py-2.5">Platz</th>
                    <th className="px-3.5 py-2.5 text-center">Gespielte Löcher</th>
                    <th className="px-3.5 py-2.5 text-center">Bruttopunkte</th>
                    <th className="px-3.5 py-2.5 text-center">Nettopunkte</th>
                    <th className="px-3.5 py-2.5 text-center">Schlagzahl</th>
                    <th className="px-2 py-2.5 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {filteredRounds.map((r, idx) => {
                    const grossColor = r.grossRelToPar < 0 ? "text-emerald-600 font-black" : r.grossRelToPar > 0 ? "text-slate-700 font-extrabold" : "text-slate-800 font-bold"
                    const netColor = r.netRelToPar < 0 ? "text-emerald-600 font-black" : r.netRelToPar > 0 ? "text-slate-700 font-extrabold" : "text-slate-800 font-bold"

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3.5 py-3 font-semibold text-slate-700 whitespace-nowrap">
                          {r.dateFormatted}
                        </td>
                        <td className="px-3.5 py-3 font-bold text-slate-900 max-w-[200px] truncate">
                          {r.courseName}
                        </td>
                        <td className="px-3.5 py-3 text-center font-mono font-medium text-slate-600">
                          {r.holesPlayedText}
                        </td>

                        {/* Interactive Bruttopunkte */}
                        <td className="px-3.5 py-3 text-center">
                          <button
                            onClick={() => onOpenScorecard(r.round, r.participant)}
                            className={`px-2.5 py-1 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors font-mono cursor-pointer ${grossColor}`}
                            title="Click to view detailed scorecard"
                          >
                            {r.grossRelToParFormatted}
                          </button>
                        </td>

                        {/* Interactive Nettopunkte */}
                        <td className="px-3.5 py-3 text-center">
                          <button
                            onClick={() => onOpenScorecard(r.round, r.participant)}
                            className={`px-2.5 py-1 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors font-mono cursor-pointer ${netColor}`}
                            title="Click to view detailed scorecard"
                          >
                            {r.netRelToParFormatted}
                          </button>
                        </td>

                        {/* Interactive Schlagzahl */}
                        <td className="px-3.5 py-3 text-center">
                          <button
                            onClick={() => onOpenScorecard(r.round, r.participant)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors font-mono font-bold text-slate-900 cursor-pointer"
                            title="Click to view detailed scorecard"
                          >
                            {r.totalStrokes}
                            {r.hasWipedHoles && <span className="text-[10px] text-red-500 font-extrabold ml-1" title="Includes wiped hole stroke substitute">*</span>}
                          </button>
                        </td>

                        <td className="px-2 py-3 text-right">
                          <button
                            onClick={() => onOpenScorecard(r.round, r.participant)}
                            className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                            title="View Scorecard"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
