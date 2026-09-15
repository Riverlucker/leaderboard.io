"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Shield, Lock, Trash2, Plus, Settings, AlertCircle, CheckCircle, Clock, 
  ShieldAlert, Sliders, Calendar, PlayCircle, Eye, EyeOff 
} from "lucide-react"
import { 
  saveWintercupBlockedSlots, resetWintercupScores, BlockedSlot,
  saveClConfig, seedClFormatCompetition 
} from "@/app/actions/wintercup"
import { getClConfig, ClConfig, getQualificationStructure, ClRoundPeriod } from "@/lib/clFormat"

interface WintercupAdminViewProps {
  competition: any
  session?: any
}

export function WintercupAdminView({ competition, session }: WintercupAdminViewProps) {
  const router = useRouter()
  const clConfig = getClConfig(competition)

  // Sub tabs: config | blockedSlots | danger
  const [adminTab, setAdminTab] = useState<'config' | 'blockedSlots' | 'danger'>('config')

  // Config Form State
  const [vorrundenModus, setVorrundenModus] = useState<"GROUP_3" | "MATCHPLAY">(clConfig.vorrundenModus)
  const [playoffCount, setPlayoffCount] = useState<2 | 4 | 8 | 16>(clConfig.playoffCount)
  const [hasZwischenrunde, setHasZwischenrunde] = useState<boolean>(clConfig.hasZwischenrunde)
  const [vorrundenCount, setVorrundenCount] = useState<number>(clConfig.vorrundenCount)
  const [ignoreCourseHandicap, setIgnoreCourseHandicap] = useState<boolean>(clConfig.ignoreCourseHandicap)
  const [reducedScoreEntry, setReducedScoreEntry] = useState<boolean>(clConfig.reducedScoreEntry)
  const [showAllRounds, setShowAllRounds] = useState<boolean>(clConfig.showAllRounds)
  const [hasScheduling, setHasScheduling] = useState<boolean>(clConfig.hasScheduling)
  const [exclusiveScheduling, setExclusiveScheduling] = useState<boolean>(clConfig.exclusiveScheduling)
  const [slotDurationHoursVorrunde, setSlotDurationHoursVorrunde] = useState<number>(clConfig.slotDurationHoursVorrunde)
  const [slotDurationHoursPlayoff, setSlotDurationHoursPlayoff] = useState<number>(clConfig.slotDurationHoursPlayoff)
  const [manageBlockedSlots, setManageBlockedSlots] = useState<boolean>(clConfig.manageBlockedSlots)
  const [roundPeriods, setRoundPeriods] = useState<ClRoundPeriod[]>(clConfig.roundPeriods || [])

  // Blocked Slots State
  const [slots, setSlots] = useState<BlockedSlot[]>(clConfig.blockedSlots || [])
  const [dateStr, setDateStr] = useState("2027-01-10")
  const [isFullDay, setIsFullDay] = useState(false)
  const [startTime, setStartTime] = useState("10:00")
  const [endTime, setEndTime] = useState("14:00")
  const [reason, setReason] = useState("")

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  // Live calculation of qualification structure
  const qual = getQualificationStructure({
    ...clConfig,
    playoffCount,
    hasZwischenrunde
  })

  // Save CL Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError("")
    setSuccessMsg("")

    try {
      const updatedConfig: ClConfig = {
        ...clConfig,
        vorrundenModus,
        playoffCount,
        hasZwischenrunde,
        vorrundenCount,
        ignoreCourseHandicap,
        reducedScoreEntry,
        showAllRounds,
        hasScheduling,
        exclusiveScheduling,
        slotDurationHoursVorrunde,
        slotDurationHoursPlayoff,
        manageBlockedSlots,
        roundPeriods,
        blockedSlots: slots
      }

      await saveClConfig(competition.id, updatedConfig)
      setSuccessMsg("CL-Format Konfiguration erfolgreich gespeichert.")
      setTimeout(() => setSuccessMsg(""), 3000)
    } catch (err: any) {
      setError(err.message || "Fehler beim Speichern der Konfiguration.")
    } finally {
      setIsSaving(false)
    }
  }

  // Pre-seed schedule
  const handlePreSeed = async () => {
    const participantCount = (competition.participants || []).length
    if (participantCount < 2) {
      setError("Es müssen mindestens 2 Teilnehmer in der Competition eingetragen sein (im Tab 'Teilnehmer' der Competition-Verwaltung), bevor Spieltage und Paarungen generiert werden können.")
      return
    }

    if (!window.confirm("Möchtest du wirklich alle Spieltage neu generieren? Vorhandene Runden ohne Scores werden dabei ersetzt.")) {
      return
    }

    setIsSaving(true)
    setError("")
    setSuccessMsg("")

    try {
      const res = await seedClFormatCompetition(competition.id)
      if (!res.success) {
        setError(res.error || "Fehler beim Generieren der Spieltage.")
        return
      }
      setSuccessMsg("Auslosung & Spieltage wurden erfolgreich pre-geseeded.")
      setTimeout(() => {
        setSuccessMsg("")
        router.refresh()
      }, 1500)
    } catch (err: any) {
      setError(err.message || "Fehler beim Generieren der Spieltage.")
    } finally {
      setIsSaving(false)
    }
  }

  // Blocked slots handlers
  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccessMsg("")

    if (!dateStr) {
      setError("Bitte wähle ein Datum aus.")
      return
    }

    if (!isFullDay && startTime >= endTime) {
      setError("Die Endzeit muss nach der Startzeit liegen.")
      return
    }

    const newSlot: BlockedSlot = {
      id: "slot_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      date: dateStr,
      isFullDay,
      startTime: isFullDay ? undefined : startTime,
      endTime: isFullDay ? undefined : endTime,
      reason: reason.trim() || undefined
    }

    const updatedSlots = [...slots, newSlot]
    setIsSaving(true)

    try {
      await saveWintercupBlockedSlots(competition.id, updatedSlots)
      setSlots(updatedSlots)
      setSuccessMsg("Sperrzeit erfolgreich gespeichert.")
      setReason("")
      setTimeout(() => setSuccessMsg(""), 3000)
    } catch (err: any) {
      setError(err.message || "Fehler beim Speichern der Sperrzeit.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSlot = async (slotId: string) => {
    setError("")
    setSuccessMsg("")
    const updatedSlots = slots.filter((s) => s.id !== slotId)

    setIsSaving(true)
    try {
      await saveWintercupBlockedSlots(competition.id, updatedSlots)
      setSlots(updatedSlots)
      setSuccessMsg("Sperrzeit gelöscht.")
      setTimeout(() => setSuccessMsg(""), 3000)
    } catch (err: any) {
      setError(err.message || "Fehler beim Löschen der Sperrzeit.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetScores = async (target: 'ALL' | 'R1' | 'R2' | 'R3' | 'ZW' | 'PLAYOFFS', label: string) => {
    if (!window.confirm(`Möchtest du wirklich ${label}? Diese Aktion löscht alle Punkte und Match-Ergebnisse im gewählten Bereich.`)) return

    setIsSaving(true)
    setError("")
    setSuccessMsg("")

    try {
      const userName = session?.user?.name || session?.user?.email || "Admin"
      const userId = session?.user?.id || "admin"

      await resetWintercupScores(competition.id, target, userId, userName)
      setSuccessMsg(`Ergebnisse für ${label} wurden zurückgesetzt.`)
      setTimeout(() => setSuccessMsg(""), 4000)
    } catch (err: any) {
      setError(err.message || "Fehler beim Zurücksetzen der Ergebnisse.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white/70 backdrop-blur-md border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-extrabold text-emerald-700 tracking-wider flex items-center space-x-1.5">
            <Shield size={14} />
            <span>Admin Control Panel • CL-Format</span>
          </span>
          <h3 className="text-xl font-black text-slate-900 mt-1">{competition.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Konfiguration des CL-Formats, Spielzeiten, Sperrzeiten und Score-Verwaltung.
          </p>
        </div>

        <Link
          href={`/admin/competitions/${competition.id}`}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 transition-colors shadow-xs"
        >
          <Settings size={14} />
          <span>Wettbewerb im Admin-Bereich</span>
        </Link>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setAdminTab('config')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
            adminTab === 'config'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Sliders size={14} />
          <span>CL-Format Einstellungen</span>
        </button>

        {manageBlockedSlots && (
          <button
            onClick={() => setAdminTab('blockedSlots')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
              adminTab === 'blockedSlots'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Lock size={14} />
            <span>Sperrzeiten ({slots.length})</span>
          </button>
        )}

        <button
          onClick={() => setAdminTab('danger')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
            adminTab === 'danger'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ShieldAlert size={14} />
          <span>Ergebnisse & Danger Zone</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl font-bold flex items-center space-x-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl font-bold flex items-center space-x-2">
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: CL-Format Configuration Form */}
      {adminTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5">
            <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center space-x-1.5">
              <Sliders size={14} className="text-emerald-600" />
              <span>Format & Spielmodus</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Vorrunden-Modus</label>
                <select
                  value={vorrundenModus}
                  onChange={(e) => setVorrundenModus(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="GROUP_3">3er-Matchplay (Punkte 4 / 2 / 0)</option>
                  <option value="MATCHPLAY">Einzel-Matchplay (1v1, 1 Punkt für Sieg)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {vorrundenModus === "GROUP_3" 
                    ? "3 Spieler pro Match. Wertung nach Netto-Punkten (4/2/0 bzw. Teilungen)."
                    : "1v1 Matchplay. 1 Punkt für den Sieger, 0,5 bei geteilt, 0 bei Niederlage."
                  }
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Anzahl der Vorrunden</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={vorrundenCount}
                  onChange={(e) => setVorrundenCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">Anzahl der Vorrunden-Spieltage (Wintercup: 3).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Playoff-Größe (Teilnehmer)</label>
                <select
                  value={playoffCount}
                  onChange={(e) => setPlayoffCount(parseInt(e.target.value, 10) as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value={2}>2 Spieler (Direktes Finale)</option>
                  <option value={4}>4 Spieler (Halbfinale & Finale)</option>
                  <option value={8}>8 Spieler (Viertelfinale, Halbfinale & Finale)</option>
                  <option value={16}>16 Spieler (Achtelfinale bis Finale)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Zwischenrunde</label>
                <div className="flex items-center space-x-3 pt-1">
                  <label className="inline-flex items-center space-x-2 cursor-pointer text-xs font-extrabold text-slate-800">
                    <input
                      type="checkbox"
                      checked={hasZwischenrunde}
                      onChange={(e) => setHasZwischenrunde(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Zwischenrunde vorschalten</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Dynamic Qualification Info Box */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
              <span className="font-bold block text-emerald-950 uppercase tracking-wider text-[11px]">
                Qualifikations-Struktur:
              </span>
              {hasZwischenrunde ? (
                <>
                  <p>• Top {qual.directPlayoffRanks.length} ({qual.directPlayoffRanks.join(", ")}.) qualifizieren sich <strong>direkt</strong> für das {qual.playoffStages[0]}.</p>
                  <p>• Zwischenrunde: {qual.zwischenrundePairs.length} Partien ({qual.zwischenrundePairs.map(p => `${p.p1Rank}. vs ${p.p2Rank}.`).join(", ")}). Die Sieger rücken in das {qual.playoffStages[0]} auf.</p>
                </>
              ) : (
                <p>• Top {playoffCount} (1.–{playoffCount}.) qualifizieren sich direkt für die Playoffs ({qual.playoffStages.join(" → ")}).</p>
              )}
            </div>
          </div>

          {/* Scoring & Anonymization Settings */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center space-x-1.5">
              <Shield size={14} className="text-emerald-600" />
              <span>Handicap, Score-Eingabe & Sichtbarkeit</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="inline-flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-800 bg-white border border-slate-200 p-3 rounded-xl">
                <input
                  type="checkbox"
                  checked={ignoreCourseHandicap}
                  onChange={(e) => setIgnoreCourseHandicap(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Ignore Course Handicap (nur reines HC)</span>
              </label>

              <label className="inline-flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-800 bg-white border border-slate-200 p-3 rounded-xl">
                <input
                  type="checkbox"
                  checked={reducedScoreEntry}
                  onChange={(e) => setReducedScoreEntry(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Reduzierte Score-Eingabe (NP/BP & Ergebnis)</span>
              </label>

              <label className="inline-flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-800 bg-white border border-slate-200 p-3 rounded-xl">
                <input
                  type="checkbox"
                  checked={showAllRounds}
                  onChange={(e) => setShowAllRounds(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Alle Spieltage bereits anzeigen (Nein = anonymisiert)</span>
              </label>
            </div>
            {!showAllRounds && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl font-medium flex items-center space-x-2">
                <EyeOff size={14} className="flex-shrink-0 text-amber-600" />
                <span>Auslosung verdeckt: Spieler sehen nur die aktuell aktive Runde (bzw. Runde 1 vor Start). Zukünftige Spieltage bleiben bis zum Rundenbeginn anonymisiert.</span>
              </p>
            )}
          </div>

          {/* Scheduling Settings */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center space-x-1.5">
              <Calendar size={14} className="text-emerald-600" />
              <span>Terminierung & Kalender-Logik</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="inline-flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-800 bg-white border border-slate-200 p-3 rounded-xl">
                <input
                  type="checkbox"
                  checked={hasScheduling}
                  onChange={(e) => setHasScheduling(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Terminierungs-Logik aktivieren</span>
              </label>

              {hasScheduling && (
                <label className="inline-flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-800 bg-white border border-slate-200 p-3 rounded-xl">
                  <input
                    type="checkbox"
                    checked={exclusiveScheduling}
                    onChange={(e) => setExclusiveScheduling(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Exklusive Terminierung (Simulator-Kollisionsschutz)</span>
                </label>
              )}
            </div>

            {hasScheduling && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Dauer Vorrunden (Stunden)</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={slotDurationHoursVorrunde}
                    onChange={(e) => setSlotDurationHoursVorrunde(parseInt(e.target.value, 10) || 3)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Dauer Playoffs (Stunden)</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={slotDurationHoursPlayoff}
                    onChange={(e) => setSlotDurationHoursPlayoff(parseInt(e.target.value, 10) || 2)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={manageBlockedSlots}
                      onChange={(e) => setManageBlockedSlots(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Sperrzeiten verwalten</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Round Periods Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center space-x-1.5">
              <Clock size={14} className="text-emerald-600" />
              <span>Spielzeiträume der Runden</span>
            </h4>

            <div className="space-y-2">
              {roundPeriods.map((rp, idx) => (
                <div key={rp.roundName} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-white border border-slate-200 p-3 rounded-xl">
                  <span className="font-extrabold text-xs text-slate-800">{rp.roundName}</span>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Startdatum</span>
                    <input
                      type="date"
                      value={rp.startDate}
                      onChange={(e) => {
                        const updated = [...roundPeriods]
                        updated[idx].startDate = e.target.value
                        setRoundPeriods(updated)
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Enddatum</span>
                    <input
                      type="date"
                      value={rp.endDate}
                      onChange={(e) => {
                        const updated = [...roundPeriods]
                        updated[idx].endDate = e.target.value
                        setRoundPeriods(updated)
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-between items-center gap-4 pt-2">
            <div className="flex flex-col space-y-1">
              <button
                type="button"
                onClick={handlePreSeed}
                disabled={isSaving}
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <PlayCircle size={16} />
                <span>Auslosung & Spieltage pre-seeden</span>
              </button>
              {(competition.participants || []).length < 2 && (
                <span className="text-[11px] text-amber-600 font-bold">
                  ⚠️ Mindestens 2 Teilnehmer erforderlich (aktuell {(competition.participants || []).length})
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <CheckCircle size={16} />
              <span>{isSaving ? "Speichern..." : "Einstellungen Speichern"}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Blocked Slots (Sperrzeiten) */}
      {adminTab === 'blockedSlots' && manageBlockedSlots && (
        <div className="space-y-6">
          <form onSubmit={handleAddSlot} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center space-x-1.5">
              <Lock size={14} className="text-amber-600" />
              <span>Neue Sperrzeit Hinzufügen</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Datum</label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2 flex items-center space-x-3 pt-6">
                <label className="inline-flex items-center space-x-2 cursor-pointer text-xs font-extrabold text-slate-800">
                  <input
                    type="checkbox"
                    checked={isFullDay}
                    onChange={(e) => setIsFullDay(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Ganzen Tag sperren (24 Stunden)</span>
                </label>
              </div>
            </div>

            {!isFullDay && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Von (Uhrzeit)</label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {Array.from({ length: 23 }, (_, i) => {
                      const hour = 10 + Math.floor(i / 2)
                      const min = i % 2 === 0 ? "00" : "30"
                      if (hour > 21) return null
                      const time = `${String(hour).padStart(2, "0")}:${min}`
                      return (
                        <option key={time} value={time}>
                          {time} Uhr
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Bis (Uhrzeit)</label>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {Array.from({ length: 23 }, (_, i) => {
                      const hour = 10 + Math.floor(i / 2)
                      const min = i % 2 === 0 ? "00" : "30"
                      if (hour > 21) return null
                      const time = `${String(hour).padStart(2, "0")}:${min}`
                      return (
                        <option key={time} value={time}>
                          {time} Uhr
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Grund / Notiz (Optional)</label>
              <input
                type="text"
                placeholder="z.B. Wartung, Simulator reserviert, Feiertag..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Plus size={16} />
                <span>Sperre Speichern</span>
              </button>
            </div>
          </form>

          {/* List of Active Blocked Slots */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
              Aktive Sperrzeiten ({slots.length})
            </h4>

            {slots.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500 font-medium">
                Keine Sperrzeiten eingetragen. Der Kalender ist zu allen regulären Zeiten verfügbar.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {slots.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-xs hover:border-amber-400 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-sm text-slate-900">{s.date}</span>
                        {s.isFullDay ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                            Ganztägig
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 font-mono">
                            <Clock size={10} className="text-amber-600" />
                            <span>{s.startTime} – {s.endTime}</span>
                          </span>
                        )}
                      </div>
                      {s.reason && <p className="text-xs text-slate-600 italic">{s.reason}</p>}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSlot(s.id)}
                      disabled={isSaving}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title="Sperre löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Danger Zone */}
      {adminTab === 'danger' && (
        <div className="border-t border-slate-200 pt-2 space-y-4">
          <div className="bg-red-50/70 border border-red-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center space-x-2 text-red-700">
              <ShieldAlert size={18} />
              <h4 className="text-sm font-black uppercase tracking-wider">Danger Zone – Ergebnisse Zurücksetzen</h4>
            </div>
            <p className="text-xs text-red-600 font-medium">
              Achtung: Hier können eingetragene Ergebnisse gelöscht und zurückgesetzt werden. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleResetScores('ALL', 'ALLE Ergebnisse')}
                disabled={isSaving}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                Alle Ergebnisse löschen
              </button>

              <button
                type="button"
                onClick={() => handleResetScores('R1', 'Vorrunde 1')}
                disabled={isSaving}
                className="px-3.5 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                Vorrunde 1 löschen
              </button>

              <button
                type="button"
                onClick={() => handleResetScores('R2', 'Vorrunde 2')}
                disabled={isSaving}
                className="px-3.5 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                Vorrunde 2 löschen
              </button>

              <button
                type="button"
                onClick={() => handleResetScores('R3', 'Vorrunde 3')}
                disabled={isSaving}
                className="px-3.5 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                Vorrunde 3 löschen
              </button>

              <button
                type="button"
                onClick={() => handleResetScores('ZW', 'Zwischenrunde')}
                disabled={isSaving}
                className="px-3.5 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                Zwischenrunde löschen
              </button>

              <button
                type="button"
                onClick={() => handleResetScores('PLAYOFFS', 'Playoffs')}
                disabled={isSaving}
                className="px-3.5 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                Playoffs löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
