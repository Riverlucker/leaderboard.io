"use client"

import { useState, useEffect, useRef } from "react"
import { saveBatchScores } from "@/app/actions/scores"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { calculateCourseHandicap, getRoundHoleInfo, getHandicapStrokesOnHole } from "@/lib/scoring"
import { getTeamColorConfig } from "@/lib/teamColors"
import { getPlayerCalculatedAllowance } from "./CompetitionClientView"

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

function getScoreLabel(val: string, par: number): string {
  if (val === '-') return 'not played'
  if (val === '/') return 'wiped (0 pts)'
  const num = parseInt(val, 10)
  if (isNaN(num)) return val
  const diff = num - par
  if (diff <= -3) return 'Albatross'
  if (diff === -2) return 'Eagle'
  if (diff === -1) return 'Birdie'
  if (diff === 0) return 'Par'
  if (diff === 1) return 'Bogey'
  if (diff === 2) return 'Double Bogey'
  if (diff >= 3) return `+${diff} Strokes`
  return String(num)
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

  // Gesture state for touch swipe score preview & commit
  const [draggingPartId, setDraggingPartId] = useState<string | null>(null)
  const [previewVal, setPreviewVal] = useState<string | null>(null)
  const activeHoleIdRef = useRef<string | null>(null)

  const handleGestureStart = (partId: string, holeId: string, e: React.PointerEvent | React.TouchEvent) => {
    setDraggingPartId(partId)
    activeHoleIdRef.current = holeId
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0]?.clientX : (e as React.PointerEvent).clientX
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0]?.clientY : (e as React.PointerEvent).clientY
    if (clientX !== undefined && clientY !== undefined) {
      const el = document.elementFromPoint(clientX, clientY)
      const scoreBtn = el?.closest('[data-score-val]')
      const val = scoreBtn?.getAttribute('data-score-val')
      if (val) setPreviewVal(val)
    }
  }

  const handleGestureMove = (e: React.PointerEvent | React.TouchEvent) => {
    if (!draggingPartId) return
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0]?.clientX : (e as React.PointerEvent).clientX
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0]?.clientY : (e as React.PointerEvent).clientY
    if (clientX === undefined || clientY === undefined) return

    const el = document.elementFromPoint(clientX, clientY)
    const scoreBtn = el?.closest('[data-score-val]')
    const val = scoreBtn?.getAttribute('data-score-val')
    if (val && val !== previewVal) {
      setPreviewVal(val)
    }
  }

  const handleGestureEnd = () => {
    if (draggingPartId && previewVal && activeHoleIdRef.current) {
      handleScoreClick(draggingPartId, activeHoleIdRef.current, previewVal)
    }
    setDraggingPartId(null)
    setPreviewVal(null)
    activeHoleIdRef.current = null
  }

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

  const isStrokeplay = (competition?.type || round?.competition?.type || '') === 'STROKEPLAY_GROSS' ||
                       (competition?.type || round?.competition?.type || '').includes('STROKEPLAY')

  const columns: Array<{ type: 'score' | 'action'; val: string }> = isStrokeplay ? [
    { type: 'action', val: '-' },
    { type: 'score', val: String(par - 2) },
    { type: 'score', val: String(par - 1) },
    { type: 'score', val: String(par) },
    { type: 'score', val: String(par + 1) },
    { type: 'score', val: String(par + 2) },
    { type: 'score', val: String(par + 3) },
    { type: 'score', val: String(par + 4) }
  ] : [
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

      {/* Players Scoring Rows - Vertical stack for 100% full-width number row on mobile */}
      <div className="space-y-4">
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
          const strokesOnCurrentHole = getHandicapStrokesOnHole(displayHandicap, strokeIndex)

          const teamIdx = competition?.teams?.findIndex((t: any) => t.id === p.teamId) ?? -1
          const teamConfig = (isTeamComp && p.team) ? getTeamColorConfig(p.team.color, teamIdx === -1 ? pIdx : teamIdx) : null

          // Determine current highlighted preview during touch swipe
          const isDraggingThisPlayer = draggingPartId === p.id
          const currentHighlightedVal = isDraggingThisPlayer && previewVal ? previewVal : activeVal

          return (
            <div key={p.id} className={`backdrop-blur-sm border p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-sm transition-all relative ${
              teamConfig 
                ? `${teamConfig.bg} ${teamConfig.text} border-slate-200/60 border-l-4 ${teamConfig.border}` 
                : "bg-white/50 border-slate-200/80 text-slate-800"
            }`}>
              
              {/* Top Row: Player Info (Name, Handicap, Strokes, Saving) & Custom Input Stepper */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/40 pb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-black text-base truncate leading-tight ${teamConfig ? teamConfig.text : 'text-slate-900'}`}>
                      {playerName}
                    </h4>
                    {p.isOutOfCompetition && (
                      <span className="inline-block bg-purple-100 text-purple-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-purple-300">
                        a.K.
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className={`text-xs font-mono font-bold ${teamConfig ? teamConfig.textLight : 'text-slate-500'}`}>
                      HC {p.compHandicap !== null ? p.compHandicap.toFixed(1) : "-"} ({displayHandicap})
                    </span>
                    {strokesOnCurrentHole > 0 && (
                      <span 
                        className="inline-flex items-center justify-center bg-cyan-100 text-cyan-800 font-extrabold text-[9px] px-1.5 py-0.2 rounded border border-cyan-300 font-mono"
                        title={`${strokesOnCurrentHole} strokes received on this hole`}
                      >
                        {Array.from({ length: strokesOnCurrentHole }).map(() => "•").join("")}
                      </span>
                    )}
                    {isSaving && (
                      <div className="flex items-center space-x-1 text-[10px] text-emerald-600 font-bold ml-1">
                        <Loader2 size={11} className="animate-spin" />
                        <span>Saving...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Score Stepper Input */}
                <div className="flex-shrink-0 flex items-center space-x-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const currentNum = parseInt(activeVal) || par
                      const nextVal = Math.max(1, currentNum - 1)
                      handleScoreClick(p.id, currentHole.id, String(nextVal))
                    }}
                    className="w-7 h-8 bg-white/60 border border-slate-300 text-slate-700 font-extrabold rounded-l-lg hover:bg-white text-xs flex items-center justify-center cursor-pointer select-none"
                    title="Decrease score"
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="#"
                    value={activeVal || ""}
                    onChange={(e) => {
                      const val = e.target.value.trim()
                      if (val === "" || (/^\d+$/.test(val) && parseInt(val) <= 25)) {
                        handleScoreClick(p.id, currentHole.id, val)
                      }
                    }}
                    className={`w-9 h-8 text-center font-black text-xs bg-white border-y border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      activeVal && !columns.some(c => c.val === activeVal)
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-extrabold"
                        : "text-slate-800"
                    }`}
                    title="Custom score (e.g. 10..20)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const currentNum = parseInt(activeVal) || par
                      const nextVal = Math.min(25, currentNum + 1)
                      handleScoreClick(p.id, currentHole.id, String(nextVal))
                    }}
                    className="w-7 h-8 bg-white/60 border border-slate-300 text-slate-700 font-extrabold rounded-r-lg hover:bg-white text-xs flex items-center justify-center cursor-pointer select-none"
                    title="Increase score"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Bottom Row: Full-Width 8-Column Grid Selector with Touch Swipe Support */}
              <div className="relative w-full">
                {/* Enlarged Floating Preview Badge during Swipe/Drag Gesture */}
                {isDraggingThisPlayer && previewVal && (
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white px-5 py-2 rounded-2xl shadow-2xl flex items-center gap-3 z-40 border border-slate-700 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
                    <span className="text-3xl font-black text-emerald-400 leading-none">{previewVal}</span>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                      {getScoreLabel(previewVal, par)}
                    </span>
                  </div>
                )}

                <div
                  onPointerDown={(e) => handleGestureStart(p.id, currentHole.id, e)}
                  onPointerMove={handleGestureMove}
                  onPointerUp={handleGestureEnd}
                  onPointerCancel={handleGestureEnd}
                  onTouchStart={(e) => handleGestureStart(p.id, currentHole.id, e)}
                  onTouchMove={handleGestureMove}
                  onTouchEnd={handleGestureEnd}
                  onTouchCancel={handleGestureEnd}
                  className="grid grid-cols-8 gap-1.5 w-full touch-none select-none"
                >
                  {columns.map((col, colIdx) => {
                    const opt = col.val
                    const isSelected = activeVal === opt
                    const isPreviewed = currentHighlightedVal === opt

                    let btnStyle = "border-slate-200/80 bg-white/40 text-slate-600 hover:bg-white/80 text-sm font-bold"
                    let btnStyleOverride: React.CSSProperties = {}

                    if (isPreviewed || isSelected) {
                      if (teamConfig) {
                        btnStyle = "text-white opacity-100 font-black text-xl shadow-md ring-2"
                        btnStyleOverride = {
                          backgroundColor: `hsl(${teamConfig.hue}, 85%, 22%)`,
                          borderColor: `hsl(${teamConfig.hue}, 85%, 15%)`,
                          boxShadow: `0 0 0 2px hsla(${teamConfig.hue}, 85%, 22%, 0.25)`
                        }
                      } else {
                        btnStyle = "bg-emerald-500 text-white border-emerald-500 opacity-100 font-black text-xl shadow-md ring-2 ring-emerald-500/30 scale-105 z-10"
                      }
                    }

                    let markerElement = null
                    if (isSelected || isPreviewed) {
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

                    return (
                      <button
                        key={`${opt}-${colIdx}`}
                        type="button"
                        data-score-val={opt}
                        onClick={() => handleScoreClick(p.id, currentHole.id, opt)}
                        style={btnStyleOverride}
                        className={`relative w-full aspect-square flex items-center justify-center rounded-xl border transition-all ${btnStyle}`}
                      >
                        <span className="pointer-events-none">{opt}</span>
                        {markerElement}
                      </button>
                    )
                  })}
                </div>
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
