"use client"

import { useState, useEffect, useRef } from "react"
import { saveBatchScores } from "@/app/actions/scores"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { calculateCourseHandicap, getRoundHoleInfo } from "@/lib/scoring"
import { getTeamColorConfig } from "@/lib/teamColors"

interface LiveScoreEntryProps {
  round: any
  selectedParticipants: any[]
  session: any
  onScoreSaved: () => void
  initialHoleIndex?: number
  onToggleMode: (mode: 'LIVE' | 'BULK') => void
  onHoleChange: (index: number) => void
  holesToPlay?: number[]
  isTeamComp?: boolean
  competition?: any
}

export function LiveScoreEntry({
  round,
  selectedParticipants,
  session,
  onScoreSaved,
  initialHoleIndex,
  onToggleMode,
  onHoleChange,
  holesToPlay,
  isTeamComp = false,
  competition
}: LiveScoreEntryProps) {
  const activeHoles = holesToPlay && holesToPlay.length > 0
    ? holesToPlay
    : (round.holesPlayed && round.holesPlayed.length > 0
        ? round.holesPlayed.sort((a: number, b: number) => a - b)
        : Array.from({ length: 18 }, (_, i) => i + 1))

  const course = round.course
  const [currentHoleIndex, setCurrentHoleIndex] = useState(initialHoleIndex || 0)
  const currentHoleNum = activeHoles[currentHoleIndex]
  const currentHole = course.holes.find((h: any) => h.number === currentHoleNum)
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({})
  const [localScores, setLocalScores] = useState<Record<string, string>>({}) // key: partId -> string

  // Debounce and queue refs
  const pendingChangesRef = useRef<Record<string, { partId: string; holeId: string; value: string }>>({})
  const saveTimeoutRef = useRef<any>(null)
  const dirtyKeysRef = useRef<Record<string, boolean>>({})

  // Helper to extract scores for a specific hole from participants, merging pending changes and preserving dirty values
  const getScoresForHole = (holeId: string, currentLocal: Record<string, string>) => {
    const scoresMap: Record<string, string> = {}
    for (const p of selectedParticipants) {
      const cellKey = `${p.id}-${holeId}`
      if (dirtyKeysRef.current[cellKey]) {
        scoresMap[p.id] = currentLocal[p.id] || ''
        continue
      }

      const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === holeId)
      if (score) {
        if (score.status === 'WIPED') {
          scoresMap[p.id] = '/'
        } else if (score.status === 'NOT_PLAYED') {
          scoresMap[p.id] = '-'
        } else if (score.grossStrokes !== null && score.grossStrokes !== undefined) {
          scoresMap[p.id] = String(score.grossStrokes)
        } else {
          scoresMap[p.id] = ''
        }
      } else {
        scoresMap[p.id] = ''
      }
    }
    return scoresMap
  }

  // Handle external hole index update when toggling from bulk
  useEffect(() => {
    if (initialHoleIndex !== undefined && initialHoleIndex >= 0 && initialHoleIndex < activeHoles.length) {
      setCurrentHoleIndex(initialHoleIndex)
      const targetHoleNum = activeHoles[initialHoleIndex]
      const targetHole = course.holes.find((h: any) => h.number === targetHoleNum)
      if (targetHole) {
        setLocalScores(prev => getScoresForHole(targetHole.id, prev))
      }
    }
  }, [initialHoleIndex, activeHoles.length])

  // Sync local scores whenever current hole changes or props change, preserving dirty states
  useEffect(() => {
    if (!currentHole) return
    setLocalScores(prev => getScoresForHole(currentHole.id, prev))
  }, [selectedParticipants, round.id, currentHole?.id])

  // Navigation handlers
  const handlePrevHole = () => {
    if (currentHoleIndex > 0) {
      const nextIndex = currentHoleIndex - 1
      setCurrentHoleIndex(nextIndex)
      onHoleChange(nextIndex)
      const nextHoleNum = activeHoles[nextIndex]
      const nextHole = course.holes.find((h: any) => h.number === nextHoleNum)
      if (nextHole) {
        setLocalScores(prev => getScoresForHole(nextHole.id, prev))
      }
    }
  }

  const handleNextHole = () => {
    if (currentHoleIndex < activeHoles.length - 1) {
      const nextIndex = currentHoleIndex + 1
      setCurrentHoleIndex(nextIndex)
      onHoleChange(nextIndex)
      const nextHoleNum = activeHoles[nextIndex]
      const nextHole = course.holes.find((h: any) => h.number === nextHoleNum)
      if (nextHole) {
        setLocalScores(prev => getScoresForHole(nextHole.id, prev))
      }
    }
  }

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

  const handleScoreClick = (partId: string, holeId: string, value: string) => {
    // If clicked the already selected button, deselect it (revert to '')
    const currentVal = localScores[partId] || ""
    const targetValue = currentVal === value ? "" : value

    // Instant local state update
    setLocalScores(prev => ({ ...prev, [partId]: targetValue }))

    const cellKey = `${partId}-${holeId}`
    
    // Mark key as dirty and add to queue
    dirtyKeysRef.current[cellKey] = true
    pendingChangesRef.current[cellKey] = { partId, holeId, value: targetValue }

    // Reset debounce timer (2 seconds)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      performBatchSave()
    }, 2000)
  }

  if (!currentHole) {
    return <div className="text-center text-slate-400 p-8">Hole not found</div>
  }

  const adjustedHole = getRoundHoleInfo(round, currentHoleNum)
  const par = adjustedHole ? adjustedHole.par : currentHole.par
  const strokeIndex = adjustedHole ? adjustedHole.strokeIndex : currentHole.strokeIndex

  // Generate score options dynamically to be 100% symmetric around Par
  // No scores below Eagle (par - 2).
  const columns: Array<{ type: 'score' | 'action'; val: string }> = [
    { type: 'action', val: '-' },
    { type: 'score', val: String(par - 2) },
    { type: 'score', val: String(par - 1) },
    { type: 'score', val: String(par) },
    { type: 'score', val: String(par + 1) },
    { type: 'score', val: String(par + 2) },
    { type: 'score', val: String(par + 3) },
    { type: 'action', val: '/' }
  ]

  return (
    <div className="bg-white/65 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 w-full">
      {/* Hole Navigation Header */}
      <div className="flex justify-between items-center bg-white/40 backdrop-blur-sm p-4 rounded-xl border border-slate-200/60">
        <button
          onClick={handlePrevHole}
          disabled={currentHoleIndex === 0}
          className="p-2 bg-white/40 border border-slate-200/60 hover:bg-white/80 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors rounded-lg shadow-sm"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="text-center">
          <div className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Hole {currentHoleNum} of {activeHoles.length}</div>
          <h3 className="text-2xl font-extrabold text-slate-850 flex items-center justify-center gap-3 mt-1">
            <span>Par {par}</span>
            <span className="text-xs font-mono font-normal text-slate-655 bg-white/40 border border-slate-200/60 px-2 py-0.5 rounded uppercase shadow-sm">
              Idx {strokeIndex}
            </span>
          </h3>
        </div>

        <button
          onClick={handleNextHole}
          disabled={currentHoleIndex === activeHoles.length - 1}
          className="p-2 bg-white/40 border border-slate-200/60 hover:bg-white/80 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors rounded-lg shadow-sm"
        >
          <ArrowRight size={20} />
        </button>
      </div>

      {/* Players Scoring Rows - Tighter vertical/horizontal stack */}
      <div className="space-y-3">
        {selectedParticipants.map((p, pIdx) => {
          const playerName = p.userId ? (p.user?.name || p.user?.email) : p.dummyName
          const activeVal = localScores[p.id] || ""
          const cellKey = `${p.id}-${currentHole.id}`
          const isSaving = savingCells[cellKey]

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

          const teamIdx = competition?.teams?.findIndex((t: any) => t.id === p.teamId) ?? -1
          const teamConfig = (isTeamComp && p.team) ? getTeamColorConfig(p.team.color, teamIdx === -1 ? pIdx : teamIdx) : null

          return (
            <div key={p.id} className={`backdrop-blur-sm border p-3 rounded-xl flex items-center justify-center gap-4 md:gap-8 shadow-sm ${
              teamConfig 
                ? `${teamConfig.bg} ${teamConfig.text} border-slate-200/60 border-l-4 ${teamConfig.border}` 
                : "bg-white/40 border-slate-200/60 text-slate-800"
            }`}>
              
              {/* Left Column: Player Info */}
              <div className="w-24 md:w-36 flex-shrink-0">
                <h4 className={`font-extrabold text-sm truncate leading-tight ${teamConfig ? teamConfig.text : 'text-slate-850'}`}>
                  {playerName}
                </h4>
                <div className={`text-[10px] font-mono mt-0.5 ${teamConfig ? teamConfig.textLight : 'text-slate-500'}`}>
                  HC {p.compHandicap !== null ? p.compHandicap.toFixed(1) : "-"} ({courseHandicap})
                </div>
                {isSaving && (
                  <div className="flex items-center space-x-1 text-[9px] text-emerald-600 font-bold mt-0.5">
                    <Loader2 size={10} className="animate-spin" />
                    <span>Saving...</span>
                  </div>
                )}
              </div>

              {/* Right Column: Symmetric Grid Buttons Selector */}
              <div className="flex-1 grid grid-cols-8 gap-1 max-w-md">
                {columns.map((col, colIdx) => {
                  const opt = col.val
                  const isActive = activeVal === opt
                  
                  let btnStyle = "border-slate-200/60 bg-white/30 text-slate-550 opacity-80 hover:bg-white/60 text-sm"
                  if (isActive) {
                    btnStyle = "bg-emerald-500 text-white border-emerald-500 opacity-100 font-black text-xl shadow-md ring-2 ring-emerald-500/20"
                  }

                  let markerElement = null
                  if (isActive) {
                    if (opt === '/') {
                      markerElement = (
                        <div className="absolute inset-0.5 border-2 border-dashed border-white rounded-none pointer-events-none" />
                      )
                    } else if (opt !== '-') {
                      const strokesVal = parseInt(opt)
                      const diff = strokesVal - par

                      if (diff === -1) {
                        markerElement = (
                          <div className="absolute inset-0.5 border-2 border-white rounded-full pointer-events-none" />
                        )
                      } else if (diff <= -2) {
                        markerElement = (
                          <div className="absolute inset-0 border-4 border-double border-white rounded-full pointer-events-none" />
                        )
                      } else if (diff === 1) {
                        markerElement = (
                          <div className="absolute inset-0.5 border-2 border-white rounded-none pointer-events-none" />
                        )
                      } else if (diff === 2) {
                        markerElement = (
                          <div className="absolute inset-0 border-4 border-double border-white rounded-none pointer-events-none" />
                        )
                      } else if (diff >= 3) {
                        markerElement = (
                          <div className="absolute inset-0.5 border-2 border-dashed border-red-200 bg-red-800/10 rounded-none pointer-events-none" />
                        )
                      }
                    }
                  }

                  // Tooltips
                  let tooltip = ""
                  if (opt === '-') tooltip = "hole not played"
                  if (opt === '/') tooltip = "wiped, no score"

                  return (
                    <button
                      key={`${opt}-${colIdx}`}
                      onClick={() => handleScoreClick(p.id, currentHole.id, opt)}
                      title={tooltip}
                      className={`relative w-full aspect-square flex items-center justify-center rounded-lg border transition-all ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {markerElement}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Advance Button */}
      <div className="pt-4 border-t border-slate-200 flex justify-end">
        <button
          onClick={handleNextHole}
          disabled={currentHoleIndex === activeHoles.length - 1}
          className="flex items-center space-x-2 py-3 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow disabled:opacity-40"
        >
          <span>Next Hole</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
