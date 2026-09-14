"use client"

import React, { useState } from "react"
import { X, Trophy, Save, Loader2, CheckCircle2, Trash2 } from "lucide-react"
import { saveWintercupVorrundeScore, saveWintercupPlayoffScore, deleteWintercupMatchScore } from "@/app/actions/wintercup"

interface WintercupScoreModalProps {
  match: any
  round: any
  competition: any
  session: any
  onClose: () => void
  onSuccess: () => void
}

const MATCHPLAY_RESULTS = [
  "1 up", "2 up",
  "2&1", "3&1", "3&2", "4&2", "4&3", "5&3", "5&4", "6&4", "6&5", "7&5", "7&6", "8&6", "8&7", "9&7", "9&8",
  "1ext", "2ext", "3ext", "4ext", "5ext"
]

export function WintercupScoreModal({
  match,
  round,
  competition,
  session,
  onClose,
  onSuccess
}: WintercupScoreModalProps) {
  const isVorrunde = match.type === "GROUP_3" || round.name.startsWith("Vorrunde")
  
  // Extract players
  const participants = competition.participants || []
  const matchPlayerIds = (match.matchPlayers || []).map((mp: any) => mp.participantId)
  const matchPlayers = matchPlayerIds.map((id: string) => participants.find((p: any) => p.id === id)).filter(Boolean)

  const hasExistingScore = matchPlayers.some((p: any) => p.scores?.some((s: any) => s.roundId === round.id && (s.netStrokes !== null || s.grossStrokes !== null))) || Boolean(match.allowanceType)

  // Vorrunde Score State
  const initialVorrundeScores: Record<string, { netPoints: string; grossPoints: string; netTouched: boolean; grossTouched: boolean }> = {}
  matchPlayers.forEach((p: any) => {
    const existingScore = p.scores?.find((s: any) => s.roundId === round.id)
    initialVorrundeScores[p.id] = {
      netPoints: existingScore?.netStrokes !== null && existingScore?.netStrokes !== undefined ? String(existingScore.netStrokes) : "",
      grossPoints: existingScore?.grossStrokes !== null && existingScore?.grossStrokes !== undefined ? String(existingScore.grossStrokes) : "",
      netTouched: existingScore?.netStrokes !== null && existingScore?.netStrokes !== undefined,
      grossTouched: existingScore?.grossStrokes !== null && existingScore?.grossStrokes !== undefined
    }
  })

  const [vorrundeScores, setVorrundeScores] = useState(initialVorrundeScores)

  // Playoff Score State
  const [winnerId, setWinnerId] = useState<string>(match.allowanceType || "")
  const [resultText, setResultText] = useState<string>(match.playUntilEnd ? "2&1" : "2&1")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleDeleteScore = async () => {
    if (!window.confirm("Möchtest du das Ergebnis für dieses Match wirklich löschen?")) return

    setIsSubmitting(true)
    setError("")

    try {
      const userName = session?.user?.name || session?.user?.email || "Admin"
      const userId = session?.user?.id || "admin"

      await deleteWintercupMatchScore({
        matchId: match.id,
        roundId: round.id,
        compId: competition.id,
        enteredByUserId: userId,
        enteredByUserName: userName
      })

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || "Fehler beim Löschen des Ergebnisses.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Auto-fill logic for Gross / Net score entry
  const handleGrossChange = (pId: string, hcp: number, val: string) => {
    const current = vorrundeScores[pId] || { netPoints: "", grossPoints: "", netTouched: false, grossTouched: false }
    const grossNum = parseFloat(val)

    let autoNet = current.netPoints
    if (!isNaN(grossNum) && !current.netTouched) {
      autoNet = String(Math.round(grossNum + hcp))
    }

    setVorrundeScores({
      ...vorrundeScores,
      [pId]: {
        ...current,
        grossPoints: val,
        grossTouched: true,
        netPoints: autoNet
      }
    })
  }

  const handleNetChange = (pId: string, hcp: number, val: string) => {
    const current = vorrundeScores[pId] || { netPoints: "", grossPoints: "", netTouched: false, grossTouched: false }
    const netNum = parseFloat(val)

    let autoGross = current.grossPoints
    if (!isNaN(netNum) && !current.grossTouched) {
      autoGross = String(Math.max(0, Math.round(netNum - hcp)))
    }

    setVorrundeScores({
      ...vorrundeScores,
      [pId]: {
        ...current,
        netPoints: val,
        netTouched: true,
        grossPoints: autoGross
      }
    })
  }

  const handleVorrundeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const scoresPayload = matchPlayers.map((p: any) => {
        const item = vorrundeScores[p.id] || { netPoints: "0", grossPoints: "0" }
        return {
          participantId: p.id,
          netPoints: parseInt(item.netPoints || "0", 10),
          grossPoints: parseInt(item.grossPoints || "0", 10)
        }
      })

      const userName = session?.user?.name || session?.user?.email || "Admin"
      const userId = session?.user?.id || "admin"

      await saveWintercupVorrundeScore({
        matchId: match.id,
        roundId: round.id,
        compId: competition.id,
        scores: scoresPayload,
        enteredByUserId: userId,
        enteredByUserName: userName
      })

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || "Fehler beim Speichern der Ergebnisse.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePlayoffSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!winnerId) {
      setError("Bitte wähle den Sieger des Matchplays aus.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const userName = session?.user?.name || session?.user?.email || "Admin"
      const userId = session?.user?.id || "admin"

      await saveWintercupPlayoffScore({
        matchId: match.id,
        compId: competition.id,
        winnerParticipantId: winnerId,
        player1Id: matchPlayers[0]?.id || "",
        player2Id: matchPlayers[1]?.id || "",
        resultText: resultText,
        enteredByUserId: userId,
        enteredByUserName: userName
      })

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || "Fehler beim Speichern des Matchplay-Ergebnisses.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 font-sans">
      <div className="bg-white border border-slate-250 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-4">
          <div>
            <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-600">
              {round.name} • {round.course?.name || "Golfsimulator"}
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-0.5">
              Ergebnis-Eingabe
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2.5 rounded-xl font-bold">
            {error}
          </div>
        )}

        {isVorrunde ? (
          /* Vorrunde 3-Player Form */
          <form onSubmit={handleVorrundeSubmit} className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 font-medium">
              Matchpunkte: <strong>4 Pkt</strong> für Platz 1, <strong>2 Pkt</strong> für Platz 2, <strong>0 Pkt</strong> für Platz 3. 
              (Punkte werden bei Gleichstand geteilt).
            </div>

            <div className="space-y-4">
              {matchPlayers.map((p: any, idx: number) => {
                const name = p.dummyName || p.user?.name || `Player ${idx + 1}`
                const hcp = p.compHandicap !== null && p.compHandicap !== undefined ? p.compHandicap : (idx + 1)
                const currentData = vorrundeScores[p.id] || { netPoints: "", grossPoints: "" }

                return (
                  <div key={p.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 shadow-sm">
                    <div className="font-extrabold text-slate-900 text-sm flex items-center justify-between">
                      <span>{name}</span>
                      <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">
                        Hcap: {hcp}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">
                          Brutto-Punkte (BP)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={currentData.grossPoints}
                          onChange={(e) => handleGrossChange(p.id, hcp, e.target.value)}
                          placeholder="z.B. 24"
                          required
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">
                          Netto-Punkte (NP)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={currentData.netPoints}
                          onChange={(e) => handleNetChange(p.id, hcp, e.target.value)}
                          placeholder="z.B. 36"
                          required
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
              <div>
                {hasExistingScore && (
                  <button
                    type="button"
                    onClick={handleDeleteScore}
                    disabled={isSubmitting}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Scores löschen</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors border border-slate-300"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{isSubmitting ? "Speichern..." : "Ergebnis Speichern"}</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Playoff Matchplay Form */
          <form onSubmit={handlePlayoffSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-600 mb-2">
                  Matchplay Sieger wählen
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {matchPlayers.map((p: any) => {
                    const isSelected = winnerId === p.id
                    const name = p.dummyName || p.user?.name || "Spieler"
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setWinnerId(p.id)}
                        className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500 font-black"
                            : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        <span className="text-xs font-bold uppercase text-slate-500 mb-1">Sieger</span>
                        <span className="font-extrabold text-sm">{name}</span>
                        {isSelected && <CheckCircle2 size={18} className="mt-2 text-emerald-600" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-600 mb-2">
                  Matchplay Ergebnis
                </label>
                <select
                  value={resultText}
                  onChange={(e) => setResultText(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-extrabold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                >
                  {MATCHPLAY_RESULTS.map((res) => (
                    <option key={res} value={res}>
                      {res}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
              <div>
                {hasExistingScore && (
                  <button
                    type="button"
                    onClick={handleDeleteScore}
                    disabled={isSubmitting}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Scores löschen</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors border border-slate-300"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                  <span>{isSubmitting ? "Speichern..." : "Matchplay Ergebnis eintragen"}</span>
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
