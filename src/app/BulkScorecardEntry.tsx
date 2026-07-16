"use client"

import { useState, useEffect, useRef } from "react"
import { saveBatchScores } from "@/app/actions/scores"
import { Loader2 } from "lucide-react"
import { calculateCourseHandicap, getHandicapStrokesOnHole, getRoundHoleInfo } from "@/lib/scoring"
import { getTeamColorConfig } from "@/lib/teamColors"
import { getPlayerCalculatedAllowance } from "./CompetitionClientView"

interface BulkScorecardEntryProps {
  round: any
  selectedParticipants: any[]
  session: any
  onScoreSaved: () => void
  initialFocusId?: string
  onToggleMode: (mode: 'LIVE' | 'BULK') => void
  holesToPlay?: number[]
  isTeamComp?: boolean
  competition?: any
}

export function BulkScorecardEntry({
  round,
  selectedParticipants,
  session,
  onScoreSaved,
  initialFocusId,
  onToggleMode,
  holesToPlay,
  isTeamComp = false,
  competition
}: BulkScorecardEntryProps) {
  const activeHoles = holesToPlay && holesToPlay.length > 0
    ? holesToPlay
    : (round.holesPlayed && round.holesPlayed.length > 0
        ? round.holesPlayed.sort((a: number, b: number) => a - b)
        : Array.from({ length: 18 }, (_, i) => i + 1))

  const course = round.course
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({})
  const [localScores, setLocalScores] = useState<Record<string, string>>({}) // key: "partId-holeId", value: string (1-9, /, -)

  // Debounce and queue refs
  const pendingChangesRef = useRef<Record<string, { partId: string; holeId: string; value: string }>>({})
  const saveTimeoutRef = useRef<any>(null)
  const dirtyKeysRef = useRef<Record<string, boolean>>({})

  // Focus effect when switched from Live
  useEffect(() => {
    if (initialFocusId) {
      setTimeout(() => {
        const el = document.getElementById(initialFocusId)
        if (el) {
          el.focus()
          // @ts-ignore
          el.select()
        }
      }, 50)
    }
  }, [initialFocusId])

  // Sync localScores from props when participants or round updates, without overwriting actively edited/unsaved cells
  useEffect(() => {
    setLocalScores(prev => {
      const scoresMap = { ...prev }
      for (const p of selectedParticipants) {
        for (const hole of course.holes) {
          const cellKey = `${p.id}-${hole.id}`
          if (dirtyKeysRef.current[cellKey]) {
            continue
          }
          const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
          if (score) {
            if (score.status === 'WIPED') {
              scoresMap[cellKey] = '/'
            } else if (score.status === 'NOT_PLAYED') {
              scoresMap[cellKey] = '-'
            } else if (score.grossStrokes !== null && score.grossStrokes !== undefined) {
              scoresMap[cellKey] = String(score.grossStrokes)
            } else {
              scoresMap[cellKey] = ''
            }
          } else {
            scoresMap[cellKey] = ''
          }
        }
      }
      return scoresMap
    })
  }, [selectedParticipants, round.id, course.holes])

  // Perform the batch save
  const performBatchSave = async () => {
    const queue = pendingChangesRef.current
    if (Object.keys(queue).length === 0) return

    const batchToSave = { ...queue }
    pendingChangesRef.current = {}

    // Show indicator on saving cells
    setSavingCells(prev => {
      const next = { ...prev }
      for (const key of Object.keys(batchToSave)) {
        next[key] = true
      }
      return next
    })

    try {
      const updates = Object.values(batchToSave).map(item => {
        let grossStrokes: number | null = null
        let status: string | null = null
        if (item.value === '/') {
          status = 'WIPED'
        } else if (item.value === '-' || item.value === '') {
          status = 'NOT_PLAYED'
        } else {
          grossStrokes = parseInt(item.value)
        }
        return {
          participantId: item.partId,
          roundId: round.id,
          holeId: item.holeId,
          grossStrokes,
          status
        }
      })

      await saveBatchScores(
        round.competitionId,
        updates,
        session.user.id,
        session.user.name || session.user.email
      )

      // Clear from dirty list after successful save
      for (const key of Object.keys(batchToSave)) {
        delete dirtyKeysRef.current[key]
      }

      onScoreSaved()
    } catch (err) {
      console.error("Failed to save batch scores:", err)
      // Restore to queue to try again
      pendingChangesRef.current = { ...batchToSave, ...pendingChangesRef.current }
    } finally {
      setSavingCells(prev => {
        const next = { ...prev }
        for (const key of Object.keys(batchToSave)) {
          next[key] = false
        }
        return next
      })
    }
  }

  // Force save on unmount if any pending changes exist
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      const queue = pendingChangesRef.current
      if (Object.keys(queue).length > 0) {
        const updates = Object.values(queue).map(item => {
          let grossStrokes: number | null = null
          let status: string | null = null
          if (item.value === '/') {
            status = 'WIPED'
          } else if (item.value === '-' || item.value === '') {
            status = 'NOT_PLAYED'
          } else {
            grossStrokes = parseInt(item.value)
          }
          return {
            participantId: item.partId,
            roundId: round.id,
            holeId: item.holeId,
            grossStrokes,
            status
          }
        })
        saveBatchScores(
          round.competitionId,
          updates,
          session.user.id,
          session.user.name || session.user.email
        ).catch(console.error)
      }
    }
  }, [round.id, round.competitionId, session.user.id, session.user.name, session.user.email])

  // Handle score change and auto-focus jump
  const handleInputChange = (
    pIndex: number,
    partId: string,
    holeId: string,
    holeNum: number,
    value: string
  ) => {
    const cleanVal = value.trim()
    if (cleanVal !== "" && !/^[1-9/\-]$/.test(cleanVal)) {
      return
    }

    // Check eagle limit: no scores with strokes < par - 2
    if (cleanVal !== "" && cleanVal !== "/" && cleanVal !== "-") {
      const strokesVal = parseInt(cleanVal)
      if (!isNaN(strokesVal)) {
        const hole = course.holes.find((h: any) => h.id === holeId)
        if (hole && strokesVal < hole.par - 2) {
          return
        }
      }
    }

    const cellKey = `${partId}-${holeId}`
    setLocalScores(prev => ({ ...prev, [cellKey]: cleanVal }))
    
    // Mark key as dirty and add to queue
    dirtyKeysRef.current[cellKey] = true
    pendingChangesRef.current[cellKey] = { partId, holeId, value: cleanVal }

    // Reset debounce timer
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      performBatchSave()
    }, 2000)

    // Auto-focus next cell immediately
    if (cleanVal !== "") {
      const currentHoleIndex = activeHoles.indexOf(holeNum)
      if (currentHoleIndex !== -1 && currentHoleIndex < activeHoles.length - 1) {
        const nextHoleNum = activeHoles[currentHoleIndex + 1]
        const nextInput = document.getElementById(`input-${pIndex}-${nextHoleNum}`)
        nextInput?.focus()
        // @ts-ignore
        nextInput?.select()
      } else if (pIndex < selectedParticipants.length - 1) {
        const nextPlayerFirstHoleNum = activeHoles[0]
        const nextInput = document.getElementById(`input-${pIndex + 1}-${nextPlayerFirstHoleNum}`)
        nextInput?.focus()
        // @ts-ignore
        nextInput?.select()
      }
    }
  }

  return (
    <div className="bg-white/65 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-850">Bulk Scorecard Entry</h3>
          <p className="text-xs text-slate-550 mt-1">
            Course: <span className="font-semibold text-emerald-600">{course.name}</span> | Round: {round.name}
          </p>
        </div>
        <div className="text-xs text-slate-655 font-mono bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200/60 max-w-fit">
          Tip: Enter <span className="text-emerald-655 font-bold">1-9</span>, <span className="text-cyan-600 font-bold" title="wiped, no score">/</span> (wipe), or <span className="text-red-500 font-bold" title="hole not played">-</span> (not played)
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 scrollbar-thin w-full">
        <table className="w-full text-xs text-left border-collapse table-auto">
          <thead className="bg-slate-100/40 text-slate-600 uppercase tracking-wider text-[10px]">
            {/* Row 1: Hole */}
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2 font-black text-slate-655 min-w-[155px] text-xs">Hole</th>
              <th className="px-4 py-2 text-center border-r border-slate-200 w-16 font-bold text-slate-400"></th>
              {activeHoles.map((holeNum: number) => (
                <th key={`head-hole-${holeNum}`} className="px-2 py-2 text-center border-r border-slate-200/80 font-black text-slate-700 min-w-[48px] w-[5%] text-xs">
                  {holeNum}
                </th>
              ))}
            </tr>
            {/* Row 2: Par */}
            <tr className="border-b border-slate-200 text-slate-500 bg-white/20">
              <td className="px-4 py-1.5 font-bold text-slate-500">Par</td>
              <td className="px-4 py-1.5 border-r border-slate-200"></td>
              {activeHoles.map((holeNum: number) => {
                const hole = course.holes.find((h: any) => h.number === holeNum)
                return (
                  <td key={`head-par-${holeNum}`} className="px-2 py-1.5 text-center border-r border-slate-200/80 font-mono font-bold">
                    {hole?.par}
                  </td>
                )
              })}
            </tr>
            {/* Row 3: Index */}
            <tr className="border-b border-slate-200 text-slate-500 bg-white/20">
              <td className="px-4 py-1.5 font-bold text-slate-500">Index</td>
              <td className="px-4 py-1.5 border-r border-slate-200"></td>
              {activeHoles.map((holeNum: number) => {
                const hole = course.holes.find((h: any) => h.number === holeNum)
                return (
                  <td key={`head-idx-${holeNum}`} className="px-2 py-1.5 text-center border-r border-slate-200/80 font-mono">
                    {hole?.strokeIndex}
                  </td>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-250 bg-white/20 text-slate-800">
            {selectedParticipants.flatMap((p, pIndex) => {
              const playerName = p.userId ? (p.user?.name || p.user?.email) : p.dummyName

              // Calculate player course handicap
              const tee = round.tee || 
                          course.tees.find((t: any) => t.name.toLowerCase().includes('yellow')) ||
                          course.tees.find((t: any) => t.name.toLowerCase().includes('white')) ||
                          course.tees[0]

              const manualHcp = p.manualRoundHandicaps?.find((mr: any) => mr.roundId === round.id)
              const coursePar = course.holes.reduce((sum: number, h: any) => sum + h.par, 0)
              
              let courseHandicap = 0
              if (manualHcp !== undefined && manualHcp !== null) {
                courseHandicap = manualHcp.handicapValue
              } else if (tee && p.compHandicap !== null && p.compHandicap !== undefined) {
                courseHandicap = calculateCourseHandicap(p.compHandicap, tee, coursePar)
              }

              // Find player's matchplay match to calculate matchplay allowance
              let matchplayAllowance: number | null = null
              const playerMatch = round.matches?.find((m: any) =>
                m.matchPlayers.some((mp: any) => mp.participantId === p.id)
              )
              if (playerMatch) {
                const mp = playerMatch.matchPlayers.find((x: any) => x.participantId === p.id)
                if (mp) {
                  matchplayAllowance = getPlayerCalculatedAllowance(mp, playerMatch, round, competition?.participants || [])
                }
              }

              const displayHandicap = matchplayAllowance !== null ? matchplayAllowance : courseHandicap

              const teamIdx = competition?.teams?.findIndex((t: any) => t.id === p.teamId) ?? -1
              const teamConfig = (isTeamComp && p.team) ? getTeamColorConfig(p.team.color, teamIdx === -1 ? pIndex : teamIdx) : null

              return [
                /* Sub-row 1: Shots received */
                <tr key={`shots-row-${p.id}`} className={`${teamConfig ? 'bg-white/5' : 'bg-white/10'} text-slate-700 hover:bg-white/20`}>
                  <td className={`px-4 py-2 font-black border-b border-slate-100/60 border-r border-slate-200/40 ${teamConfig ? `${teamConfig.bg} ${teamConfig.text} border-l-4 ${teamConfig.border}` : 'bg-white/10 text-slate-805'}`} rowSpan={2}>
                    <div className="truncate max-w-[145px] text-sm font-black">{playerName}</div>
                    <div className={`text-[10px] font-mono mt-0.5 font-normal ${teamConfig ? teamConfig.textLight : 'text-slate-500'}`}>
                      HC {p.compHandicap !== null ? p.compHandicap.toFixed(1) : "-"} ({displayHandicap})
                    </div>
                  </td>
                  <td className={`px-4 py-2 text-center border-r border-slate-200 text-xs font-mono font-bold border-b border-slate-100/60 ${teamConfig ? `${teamConfig.bg} ${teamConfig.textLight}` : 'bg-white/20 text-cyan-605'}`}>
                    Shots
                  </td>
                  {activeHoles.map((holeNum: number) => {
                    const hole = course.holes.find((h: any) => h.number === holeNum)
                    const adjusted = getRoundHoleInfo(round, holeNum)
                    const holeStrokeIndex = adjusted ? adjusted.strokeIndex : (hole?.strokeIndex || 1)
                    const hcpStrokes = getHandicapStrokesOnHole(displayHandicap, holeStrokeIndex)
                    const shotsMarkup = hcpStrokes === 1 ? "|" : hcpStrokes >= 2 ? "||" : ""
                    return (
                      <td key={`shots-${p.id}-${holeNum}`} className={`p-1 text-center border-r border-slate-200/80 border-b border-slate-100/60 text-xs font-mono font-black ${teamConfig ? `${teamConfig.bg} ${teamConfig.textLight}` : 'bg-white/10 text-cyan-650'}`}>
                        {shotsMarkup}
                      </td>
                    )
                  })}
                </tr>,

                /* Sub-row 2: Strokes Input */
                <tr key={`strokes-row-${p.id}`} className={`${teamConfig ? 'bg-white/5' : 'bg-white/10'} hover:bg-white/20`}>
                  <td className={`px-4 py-3.5 text-center border-r border-slate-200 text-xs font-mono font-bold ${teamConfig ? `${teamConfig.bg} ${teamConfig.textLight}` : 'bg-white/10 text-slate-400'}`}>
                    Strokes
                  </td>
                  {activeHoles.map((holeNum: number) => {
                    const hole = course.holes.find((h: any) => h.number === holeNum)
                    const cellKey = `${p.id}-${hole.id}`
                    const isSaving = savingCells[cellKey]
                    const val = localScores[cellKey] || ""

                    const adjusted = getRoundHoleInfo(round, holeNum)
                    const holePar = adjusted ? adjusted.par : (hole?.par || 4)

                    let diff = 0
                    let isWiped = false
                    let hasScore = false

                    if (val !== "" && val !== "-") {
                      if (val === '/') {
                        isWiped = true
                        hasScore = true
                      } else {
                        const scoreInt = parseInt(val)
                        if (!isNaN(scoreInt)) {
                          diff = scoreInt - holePar
                          hasScore = true
                        }
                      }
                    }

                    let markerMarkup = null
                    if (hasScore) {
                      if (isWiped) {
                        markerMarkup = (
                          <div className="absolute inset-1 border border-dashed border-red-500 bg-red-50/30 rounded pointer-events-none" />
                        )
                      } else {
                        if (diff === -1) {
                          markerMarkup = (
                            <div className="absolute inset-1 border border-emerald-500 rounded-full pointer-events-none" />
                          )
                        } else if (diff <= -2) {
                          markerMarkup = (
                            <div className="absolute inset-0.5 border-2 border-double border-emerald-500 rounded-full pointer-events-none" />
                          )
                        } else if (diff === 1) {
                          markerMarkup = (
                            <div className="absolute inset-1 border border-red-400 pointer-events-none rounded-none" />
                          )
                        } else if (diff === 2) {
                          markerMarkup = (
                            <div className="absolute inset-0.5 border-2 border-double border-red-500 pointer-events-none rounded-none" />
                          )
                        } else if (diff >= 3) {
                          markerMarkup = (
                            <div className="absolute inset-0.5 border border-dashed border-red-700 bg-red-50/30 pointer-events-none rounded-none" />
                          )
                        }
                      }
                    }

                    // Tooltips
                    let titleTooltip = ""
                    if (val === '-') titleTooltip = "hole not played"
                    if (val === '/') titleTooltip = "wiped, no score"

                    return (
                      <td key={`strokes-${p.id}-${holeNum}`} className={`p-1 border-r border-slate-200/80 text-center relative ${teamConfig ? teamConfig.bg : 'bg-white/25'}`}>
                        <div className="w-10 h-10 mx-auto relative flex items-center justify-center">
                          {markerMarkup}

                          <input
                            id={`input-${pIndex}-${holeNum}`}
                            type="text"
                            value={val}
                            maxLength={1}
                            title={titleTooltip}
                            onChange={e => handleInputChange(pIndex, p.id, hole.id, holeNum, e.target.value)}
                            onClick={e => {
                              // @ts-ignore
                              e.target.select()
                            }}
                            className={`w-full h-full text-center bg-transparent border-0 focus:outline-none focus:ring-0 focus:border-0 font-black text-base relative z-10 uppercase ${
                              teamConfig ? teamConfig.text : 'text-slate-800'
                            } ${isWiped ? 'text-red-650 font-black' : ''}`}
                          />
                          {isSaving && (
                            <div className="absolute right-0 bottom-0 text-slate-400 z-25">
                              <Loader2 size={8} className="animate-spin text-emerald-500" />
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
