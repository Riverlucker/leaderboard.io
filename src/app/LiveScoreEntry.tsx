"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { saveBatchScores } from "@/app/actions/scores"
import { ArrowLeft, ArrowRight, Loader2, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, Save } from "lucide-react"
import { calculateCourseHandicap, getRoundHoleInfo, getHandicapStrokesOnHole } from "@/lib/scoring"
import { getTeamColorConfig } from "@/lib/teamColors"
import { getPlayerCalculatedAllowance } from "./CompetitionClientView"

interface PendingScoreItem {
  participantId: string
  roundId: string
  holeId: string
  holeNumber: number
  grossStrokes: number | null
  status: string | null
  value: string
  timestamp: number
  playerName: string
}

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
  if (val === '-') return 'nicht gespielt'
  if (val === '/') return 'gestrichen (0 Pkt)'
  const num = parseInt(val, 10)
  if (isNaN(num)) return val
  const diff = num - par
  if (diff <= -3) return 'Albatross'
  if (diff === -2) return 'Eagle'
  if (diff === -1) return 'Birdie'
  if (diff === 0) return 'Par'
  if (diff === 1) return 'Bogey'
  if (diff === 2) return 'Double Bogey'
  if (diff >= 3) return `+${diff} Schläge`
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

  // Local scores structure: holeId -> partId -> scoreValue (e.g. "4", "/", "-")
  const [scoresByHole, setScoresByHole] = useState<Record<string, Record<string, string>>>({})
  
  // Offline & Synchronization State
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false)
  const [offlineQueue, setOfflineQueue] = useState<PendingScoreItem[]>([])
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Gesture state for touch swipe score preview & commit
  const [draggingPartId, setDraggingPartId] = useState<string | null>(null)
  const [previewVal, setPreviewVal] = useState<string | null>(null)
  const activeHoleIdRef = useRef<string | null>(null)

  const saveTimeoutRef = useRef<any>(null)

  const queueStorageKey = `leaderboard_queue_${round.id}`
  const cacheStorageKey = `leaderboard_cache_${round.id}`

  // 1. Initialize & merge scores from props + localStorage cache & queue
  useEffect(() => {
    // Build map from server props
    const serverMap: Record<string, Record<string, string>> = {}
    for (const h of course.holes) {
      serverMap[h.id] = {}
      for (const p of selectedParticipants) {
        const score = p.scores?.find((s: any) => s.roundId === round.id && s.holeId === h.id)
        if (score) {
          if (score.status === 'WIPED') {
            serverMap[h.id][p.id] = '/'
          } else if (score.status === 'NOT_PLAYED') {
            serverMap[h.id][p.id] = '-'
          } else if (score.grossStrokes !== null && score.grossStrokes !== undefined) {
            serverMap[h.id][p.id] = String(score.grossStrokes)
          } else {
            serverMap[h.id][p.id] = ''
          }
        } else {
          serverMap[h.id][p.id] = ''
        }
      }
    }

    // Load local cache if available
    let localCache: Record<string, Record<string, string>> = {}
    try {
      const storedCache = localStorage.getItem(cacheStorageKey)
      if (storedCache) {
        localCache = JSON.parse(storedCache)
      }
    } catch (e) {
      console.error("Failed to parse local scores cache", e)
    }

    // Load local queue if available
    let localQueue: PendingScoreItem[] = []
    try {
      const storedQueue = localStorage.getItem(queueStorageKey)
      if (storedQueue) {
        localQueue = JSON.parse(storedQueue)
      }
    } catch (e) {
      console.error("Failed to parse offline queue", e)
    }

    setOfflineQueue(localQueue)

    // Merge: local cache / queue overwrites server data if newer
    const mergedMap = { ...serverMap }
    for (const holeId of Object.keys(localCache)) {
      if (!mergedMap[holeId]) mergedMap[holeId] = {}
      for (const partId of Object.keys(localCache[holeId])) {
        if (localCache[holeId][partId] !== undefined) {
          mergedMap[holeId][partId] = localCache[holeId][partId]
        }
      }
    }

    // Also apply any queued items in chronological order
    for (const item of localQueue) {
      if (!mergedMap[item.holeId]) mergedMap[item.holeId] = {}
      mergedMap[item.holeId][item.participantId] = item.value
    }

    setScoresByHole(mergedMap)
  }, [selectedParticipants, round.id, course.holes])

  // 2. Listen to browser online/offline network status events
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatusMsg({ text: "Internetverbindung wiederhergestellt.", type: "info" })
    }
    const handleOffline = () => {
      setIsOfflineMode(true)
      setSyncStatusMsg({ text: "Kein Netz. Automatischer Wechsel in Offline-Modus.", type: "info" })
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOfflineMode(true)
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Sync initial hole index from parent props
  useEffect(() => {
    if (initialHoleIndex !== undefined && initialHoleIndex >= 0 && initialHoleIndex < activeHoles.length) {
      setCurrentHoleIndex(initialHoleIndex)
    }
  }, [initialHoleIndex, activeHoles.length])

  // Save offline queue to localStorage whenever it changes
  const updateOfflineQueue = useCallback((newQueue: PendingScoreItem[]) => {
    setOfflineQueue(newQueue)
    try {
      localStorage.setItem(queueStorageKey, JSON.stringify(newQueue))
    } catch (e) {
      console.error("Failed to save offline queue to localStorage", e)
    }
  }, [queueStorageKey])

  // Save scoresByHole cache to localStorage whenever scores update
  const updateLocalCache = useCallback((newScoresMap: Record<string, Record<string, string>>) => {
    setScoresByHole(newScoresMap)
    try {
      localStorage.setItem(cacheStorageKey, JSON.stringify(newScoresMap))
    } catch (e) {
      console.error("Failed to save local scores cache to localStorage", e)
    }
  }, [cacheStorageKey])

  // 3. Batch synchronization function (flushes pending queue to server)
  const performBatchSave = async (queueToFlush?: PendingScoreItem[]) => {
    const queue = queueToFlush || offlineQueue
    if (queue.length === 0) return

    setIsSyncing(true)

    // Deduplicate items: keep latest entry per (participantId + holeId)
    const latestItemsMap: Record<string, PendingScoreItem> = {}
    for (const item of queue) {
      const key = `${item.participantId}-${item.holeId}`
      if (!latestItemsMap[key] || item.timestamp >= latestItemsMap[key].timestamp) {
        latestItemsMap[key] = item
      }
    }

    const updates = Object.values(latestItemsMap).map(item => ({
      participantId: item.participantId,
      roundId: round.id,
      holeId: item.holeId,
      grossStrokes: item.grossStrokes,
      status: item.status
    }))

    try {
      await saveBatchScores(
        round.competitionId,
        updates,
        session.user.id,
        session.user.name || session.user.email
      )

      // Remove successfully flushed items from queue
      const flushedKeys = new Set(Object.keys(latestItemsMap))
      const remainingQueue = offlineQueue.filter(item => !flushedKeys.has(`${item.participantId}-${item.holeId}`))
      updateOfflineQueue(remainingQueue)

      setSyncStatusMsg({
        text: `Erfolgreich ${updates.length} Score(s) synchronisiert!`,
        type: "success"
      })

      // Safely notify parent component without crashing if offline revalidate fails
      try {
        onScoreSaved()
      } catch (err) {
        console.warn("Parent revalidation deferred:", err)
      }
    } catch (err: any) {
      console.error("Sync error:", err)
      setIsOfflineMode(true)
      setSyncStatusMsg({
        text: "Übertragung fehlgeschlagen (schlechte Verbindung). Scores bleiben lokal gesichert!",
        type: "error"
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const lastClickTimeRef = useRef<{ key: string; time: number }>({ key: '', time: 0 })

  // 4. Handle score entry click on any hole
  const handleScoreClick = (partId: string, holeId: string, value: string) => {
    // Prevent double-invocation within 350ms (e.g. pointerup + synthetic click on PC/mobile)
    const clickKey = `${partId}-${holeId}-${value}`
    const now = Date.now()
    if (lastClickTimeRef.current.key === clickKey && now - lastClickTimeRef.current.time < 350) {
      return
    }
    lastClickTimeRef.current = { key: clickKey, time: now }

    const currentHoleScores = scoresByHole[holeId] || {}
    const currentVal = currentHoleScores[partId] || ""
    const targetValue = currentVal === value ? "" : value

    // 1. Update hole-specific score state & local cache
    const updatedHoleScores = { ...currentHoleScores, [partId]: targetValue }
    const updatedScoresMap = { ...scoresByHole, [holeId]: updatedHoleScores }
    updateLocalCache(updatedScoresMap)

    // 2. Prepare pending score queue item
    let grossStrokes: number | null = null
    let status: string | null = null
    if (targetValue === '/') {
      status = 'WIPED'
    } else if (targetValue === '-' || targetValue === '') {
      status = 'NOT_PLAYED'
    } else {
      grossStrokes = parseInt(targetValue, 10)
    }

    const p = selectedParticipants.find(x => x.id === partId)
    const playerName = p ? (p.userId ? (p.user?.name || p.user?.email) : p.dummyName) : partId

    const newItem: PendingScoreItem = {
      participantId: partId,
      roundId: round.id,
      holeId,
      holeNumber: currentHoleNum,
      grossStrokes,
      status,
      value: targetValue,
      timestamp: Date.now(),
      playerName
    }

    // Append item to queue (replacing existing queued item for same partId+holeId)
    const filteredQueue = offlineQueue.filter(q => !(q.participantId === partId && q.holeId === holeId))
    const nextQueue = [...filteredQueue, newItem]
    updateOfflineQueue(nextQueue)

    // 3. If online and not in manual offline mode, trigger background debounced save (2 sec)
    if (!isOfflineMode && typeof navigator !== "undefined" && navigator.onLine) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        performBatchSave(nextQueue)
      }, 2000)
    }
  }

  // Touch Swipe Gesture Handlers
  const handleGestureStart = (partId: string, holeId: string, e: React.PointerEvent | React.TouchEvent) => {
    // On desktop PC with mouse: do not intercept with swipe drag, standard button onClick handles it cleanly
    if ('pointerType' in e && e.pointerType === 'mouse') {
      return
    }

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

  // Navigation handlers
  const handlePrevHole = () => {
    if (currentHoleIndex > 0) {
      const nextIndex = currentHoleIndex - 1
      setCurrentHoleIndex(nextIndex)
      onHoleChange(nextIndex)
    }
  }

  const handleNextHole = () => {
    if (currentHoleIndex < activeHoles.length - 1) {
      const nextIndex = currentHoleIndex + 1
      setCurrentHoleIndex(nextIndex)
      onHoleChange(nextIndex)
    }
  }

  // Toggle offline mode handler
  const handleToggleOfflineMode = () => {
    const nextMode = !isOfflineMode
    setIsOfflineMode(nextMode)
    if (!nextMode && offlineQueue.length > 0) {
      performBatchSave()
    } else {
      setSyncStatusMsg({
        text: nextMode ? "Offline-Modus aktiviert. Scores werden lokal gespeichert." : "Online-Modus aktiviert.",
        type: "info"
      })
    }
  }

  if (!currentHole) {
    return <div className="text-center text-slate-400 p-8">Loch nicht gefunden</div>
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

  const currentHoleScoresMap = scoresByHole[currentHole.id] || {}

  return (
    <div className="bg-white/65 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm space-y-5 w-full">
      
      {/* Network & Offline Status Banner */}
      <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs font-semibold transition-all ${
        isOfflineMode 
          ? "bg-amber-500/10 border-amber-500/30 text-amber-900" 
          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-900"
      }`}>
        <div className="flex items-center gap-2">
          {isOfflineMode ? (
            <WifiOff size={16} className="text-amber-600 animate-pulse flex-shrink-0" />
          ) : (
            <Wifi size={16} className="text-emerald-600 flex-shrink-0" />
          )}

          <div>
            <div className="font-extrabold flex items-center gap-1.5">
              <span>{isOfflineMode ? "Offline-Modus aktiv" : "Online (Live-Sync)"}</span>
              {offlineQueue.length > 0 && (
                <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px] font-mono font-black">
                  {offlineQueue.length} ausstehend
                </span>
              )}
            </div>
            <div className="text-[11px] opacity-80">
              {isOfflineMode 
                ? "Scores werden sicher im Handyspeicher abgelegt." 
                : "Scores werden automatisch mit dem Server synchronisiert."}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {offlineQueue.length > 0 && (
            <button
              type="button"
              onClick={() => performBatchSave()}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isSyncing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              <span>Scores übertragen ({offlineQueue.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleOfflineMode}
            className={`px-3 py-1.5 rounded-lg border font-extrabold transition-all text-xs flex items-center gap-1 ${
              isOfflineMode
                ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                : "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300"
            }`}
          >
            {isOfflineMode ? "Online schalten" : "Offline-Modus"}
          </button>
        </div>
      </div>

      {/* Sync Status Toast Message */}
      {syncStatusMsg && (
        <div className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 border ${
          syncStatusMsg.type === 'success'
            ? "bg-emerald-100 text-emerald-900 border-emerald-300"
            : syncStatusMsg.type === 'error'
              ? "bg-rose-100 text-rose-900 border-rose-300"
              : "bg-slate-100 text-slate-800 border-slate-300"
        }`}>
          <div className="flex items-center gap-2">
            {syncStatusMsg.type === 'success' && <CheckCircle2 size={15} className="text-emerald-600" />}
            {syncStatusMsg.type === 'error' && <AlertCircle size={15} className="text-rose-600" />}
            <span>{syncStatusMsg.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setSyncStatusMsg(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

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
          <div className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Loch {currentHoleNum} von {activeHoles.length}</div>
          <h3 className="text-2xl font-extrabold text-slate-850 flex items-center justify-center gap-3 mt-1">
            <span>Par {par}</span>
            <span className="text-xs font-mono font-normal text-slate-655 bg-white/40 border border-slate-200/60 px-2 py-0.5 rounded uppercase shadow-sm">
              Hcp {strokeIndex}
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

      {/* Players Scoring Rows - Isolated state per hole */}
      <div className="space-y-4">
        {selectedParticipants.map((p, pIdx) => {
          const playerName = p.userId ? (p.user?.name || p.user?.email) : p.dummyName
          const activeVal = currentHoleScoresMap[p.id] || ""
          
          const isQueued = offlineQueue.some(q => q.participantId === p.id && q.holeId === currentHole.id)

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

          const isDraggingThisPlayer = draggingPartId === p.id
          const currentHighlightedVal = isDraggingThisPlayer && previewVal ? previewVal : activeVal

          return (
            <div key={p.id} className={`backdrop-blur-sm border p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-sm transition-all relative ${
              teamConfig 
                ? `${teamConfig.bg} ${teamConfig.text} border-slate-200/60 border-l-4 ${teamConfig.border}` 
                : "bg-white/50 border-slate-200/80 text-slate-800"
            }`}>
              
              {/* Top Row: Player Info & Stepper */}
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
                        title={`${strokesOnCurrentHole} Vorgabestriche auf diesem Loch`}
                      >
                        {Array.from({ length: strokesOnCurrentHole }).map(() => "•").join("")}
                      </span>
                    )}
                    {isQueued && (
                      <div className="flex items-center space-x-1 text-[10px] text-amber-600 font-bold ml-1">
                        <Save size={11} />
                        <span>Lokal gesichert</span>
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
                    title="Score verringern"
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
                    title="Freier Score (z. B. 10..20)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const currentNum = parseInt(activeVal) || par
                      const nextVal = Math.min(25, currentNum + 1)
                      handleScoreClick(p.id, currentHole.id, String(nextVal))
                    }}
                    className="w-7 h-8 bg-white/60 border border-slate-300 text-slate-700 font-extrabold rounded-r-lg hover:bg-white text-xs flex items-center justify-center cursor-pointer select-none"
                    title="Score erhöhen"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Bottom Row: Full-Width 8-Column Grid Selector */}
              <div className="relative w-full">
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

      {/* Footer Navigation */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
        <button
          onClick={handlePrevHole}
          disabled={currentHoleIndex === 0}
          className="flex items-center space-x-2 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-300 rounded-xl transition-all shadow-sm disabled:opacity-40"
        >
          <ArrowLeft size={16} />
          <span>Vorheriges Loch</span>
        </button>

        <button
          onClick={handleNextHole}
          disabled={currentHoleIndex === activeHoles.length - 1}
          className="flex items-center space-x-2 py-3 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow disabled:opacity-40"
        >
          <span>Nächstes Loch</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
