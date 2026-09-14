"use client"

import React, { useState } from "react"
import { X, Calendar, Clock, Save, Loader2, AlertCircle } from "lucide-react"
import { saveWintercupMatchSchedule } from "@/app/actions/wintercup"

interface WintercupScheduleModalProps {
  match: any
  round: any
  competition: any
  session: any
  onClose: () => void
  onSuccess: () => void
}

export function WintercupScheduleModal({
  match,
  round,
  competition,
  session,
  onClose,
  onSuccess
}: WintercupScheduleModalProps) {
  const is3PlayerMatch = match.type === "GROUP_3" || round.name.startsWith("Vorrunde")
  const durationText = is3PlayerMatch ? "3 Stunden" : "2 Stunden"

  // Initial date / time
  const initialIso = match.scheduledDate ? new Date(match.scheduledDate) : new Date("2027-01-05T12:00:00")
  
  const formatDateVal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  const formatTimeVal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [dateStr, setDateStr] = useState(formatDateVal(initialIso))
  const [timeStr, setTimeStr] = useState(formatTimeVal(initialIso))

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      if (!dateStr || !timeStr) {
        setError("Bitte wähle Datum und Uhrzeit aus.")
        setIsSubmitting(false)
        return
      }

      const isoCombined = `${dateStr}T${timeStr}:00.000Z`
      const userName = session?.user?.name || session?.user?.email || "Admin"
      const userId = session?.user?.id || "admin"

      await saveWintercupMatchSchedule({
        matchId: match.id,
        compId: competition.id,
        scheduledDateISO: isoCombined,
        enteredByUserId: userId,
        enteredByUserName: userName
      })

      // Update match object in client immediately
      match.scheduledDate = `${dateStr}T${timeStr}:00`

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || "Fehler beim Terminieren des Matches.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper to check if a specific time option on dateStr is blocked by Admin or Match collision
  const getTimeOptionStatus = (time: string) => {
    if (!dateStr) return { isBlocked: false, label: `${time} Uhr` }

    const [h, m] = time.split(":").map(Number)
    const reqStartMin = h * 60 + m
    const reqDurationMin = is3PlayerMatch ? 180 : 120
    const reqEndMin = reqStartMin + reqDurationMin

    // 1. Check Admin Blocked Slots
    let blockedSlots: any[] = []
    if (competition.cssConfig) {
      try {
        const parsed = JSON.parse(competition.cssConfig)
        if (Array.isArray(parsed.blockedSlots)) blockedSlots = parsed.blockedSlots
      } catch (_) {}
    }

    for (const slot of blockedSlots) {
      if (slot.date === dateStr) {
        if (slot.isFullDay) {
          return { isBlocked: true, label: `${time} Uhr (Tag gesperrt)` }
        }
        if (slot.startTime && slot.endTime) {
          const [sH, sM] = slot.startTime.split(":").map(Number)
          const [eH, eM] = slot.endTime.split(":").map(Number)
          const slotStartMin = sH * 60 + sM
          const slotEndMin = eH * 60 + eM

          if (reqStartMin < slotEndMin && reqEndMin > slotStartMin) {
            return { isBlocked: true, label: `${time} Uhr (Admin-Sperrzeit)` }
          }
        }
      }
    }

    // 2. Check Match Collisions on same date
    const rounds = competition.rounds || []
    for (const r of rounds) {
      const matches = r.matches || []
      for (const mObj of matches) {
        if (mObj.id === match.id || !mObj.scheduledDate) continue
        const mDate = new Date(mObj.scheduledDate)
        const pad = (n: number) => String(n).padStart(2, '0')
        const mDateStr = `${mDate.getFullYear()}-${pad(mDate.getMonth() + 1)}-${pad(mDate.getDate())}`

        if (mDateStr === dateStr) {
          const mStartMin = mDate.getHours() * 60 + mDate.getMinutes()
          const mDurationMin = (mObj.type === "GROUP_3" || r.name.startsWith("Vorrunde") ? 180 : 120)
          const mEndMin = mStartMin + mDurationMin

          if (reqStartMin < mEndMin && reqEndMin > mStartMin) {
            const pad = (n: number) => String(n).padStart(2, '0')
            const mStartStr = `${pad(mDate.getHours())}:${pad(mDate.getMinutes())}`
            const mEndH = Math.floor(mEndMin / 60)
            const mEndM = mEndMin % 60
            const mEndStr = `${pad(mEndH)}:${pad(mEndM)}`
            return { isBlocked: true, label: `${time} Uhr (Match ${mStartStr}–${mEndStr})` }
          }
        }
      }
    }

    return { isBlocked: false, label: `${time} Uhr` }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 font-sans">
      <div className="bg-white border border-slate-250 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-5">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-3">
          <div>
            <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-700">
              {round.name} • {round.course?.name || "Golfsimulator"}
            </span>
            <h3 className="text-lg font-black text-slate-900 mt-0.5 flex items-center space-x-2">
              <Calendar size={18} className="text-emerald-700" />
              <span>Match Terminieren</span>
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl font-bold flex items-start space-x-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 font-medium space-y-1">
            <p>Spieldauer für diese Partie: <strong>{durationText}</strong></p>
            <p className="text-[11px] text-emerald-800">Termine: 03. Jan – 15. März 2027 (10:00 – 21:00 Uhr).</p>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-700 mb-1">
              Datum
            </label>
            <input
              type="date"
              min="2027-01-03"
              max="2027-03-15"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-700 mb-1">
              Uhrzeit (Start)
            </label>
            <select
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
            >
              {Array.from({ length: 23 }, (_, i) => {
                const hour = 10 + Math.floor(i / 2)
                const min = i % 2 === 0 ? "00" : "30"
                if (hour > 21) return null
                const time = `${String(hour).padStart(2, '0')}:${min}`
                const { isBlocked, label } = getTimeOptionStatus(time)

                return (
                  <option 
                    key={time} 
                    value={time} 
                    disabled={isBlocked}
                    className={isBlocked ? "text-slate-400 bg-slate-100 italic" : ""}
                  >
                    {label}
                  </option>
                )
              })}
            </select>
          </div>

          <div className="border-t border-slate-200 pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-md disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{isSubmitting ? "Terminieren..." : "Termin Speichern"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
