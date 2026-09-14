"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, Lock, Trash2, Plus, Settings, AlertCircle, CheckCircle, Clock, ShieldAlert } from "lucide-react"
import { saveWintercupBlockedSlots, resetWintercupScores, BlockedSlot } from "@/app/actions/wintercup"

interface WintercupAdminViewProps {
  competition: any
  session: any
}

export function WintercupAdminView({ competition, session }: WintercupAdminViewProps) {
  const router = useRouter()

  // Parse existing blocked slots from competition.cssConfig
  let initialSlots: BlockedSlot[] = []
  if (competition.cssConfig) {
    try {
      const parsed = JSON.parse(competition.cssConfig)
      if (Array.isArray(parsed.blockedSlots)) {
        initialSlots = parsed.blockedSlots
      }
    } catch (_) {}
  }

  const [slots, setSlots] = useState<BlockedSlot[]>(initialSlots)
  const [dateStr, setDateStr] = useState("2027-01-10")
  const [isFullDay, setIsFullDay] = useState(false)
  const [startTime, setStartTime] = useState("10:00")
  const [endTime, setEndTime] = useState("14:00")
  const [reason, setReason] = useState("")

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

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
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-extrabold text-emerald-700 tracking-wider flex items-center space-x-1.5">
            <Shield size={14} />
            <span>Admin Control Panel</span>
          </span>
          <h3 className="text-xl font-black text-slate-900 mt-1">Verfügbarkeiten & Sperrzeiten</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sperre Tage oder bestimmte Uhrzeiten am Golfsimulator für die Terminierung.
          </p>
        </div>

        <Link
          href={`/admin/competitions/${competition.id}`}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 transition-colors shadow-xs"
        >
          <Settings size={14} />
          <span>Wettbewerb bearbeiten</span>
        </Link>
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

      {/* Form: Block New Slot */}
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
              min="2027-01-03"
              max="2027-03-15"
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
            className="inline-flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm disabled:opacity-50"
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
            Keine Sperrzeiten eingetragen. Der Kalender ist zu allen regulären Zeiten (10:00 – 21:00 Uhr) verfügbar.
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
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Sperre löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone: Scores Reset */}
      <div className="border-t border-slate-200 pt-6 space-y-4">
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
              onClick={() => handleResetScores('ALL', 'ALLE Ergebnisse des Wintercups')}
              disabled={isSaving}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              Alle Ergebnisse löschen
            </button>

            <button
              type="button"
              onClick={() => handleResetScores('R1', 'Vorrunde 1 (Adamstal)')}
              disabled={isSaving}
              className="px-3.5 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              Vorrunde 1 löschen
            </button>

            <button
              type="button"
              onClick={() => handleResetScores('R2', 'Vorrunde 2 (Schladming)')}
              disabled={isSaving}
              className="px-3.5 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              Vorrunde 2 löschen
            </button>

            <button
              type="button"
              onClick={() => handleResetScores('R3', 'Vorrunde 3 (Altentann)')}
              disabled={isSaving}
              className="px-3.5 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              Vorrunde 3 löschen
            </button>

            <button
              type="button"
              onClick={() => handleResetScores('ZW', 'Zwischenrunde (Westendorf)')}
              disabled={isSaving}
              className="px-3.5 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              Zwischenrunde löschen
            </button>

            <button
              type="button"
              onClick={() => handleResetScores('PLAYOFFS', 'Playoffs (Viertelfinale bis Finale)')}
              disabled={isSaving}
              className="px-3.5 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              Playoffs löschen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
