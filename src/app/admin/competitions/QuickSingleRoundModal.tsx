"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createQuickSingleRound } from "./actions"
import { X, Plus, Trash2, Loader2, Zap, UserPlus } from "lucide-react"

interface QuickSingleRoundModalProps {
  courses: Array<{
    id: string
    name: string
    tees: Array<{ id: string; name: string }>
  }>
  users: Array<{
    id: string
    name: string | null
    email: string | null
    handicap: number | null
  }>
  isOpen: boolean
  onClose: () => void
}

export function QuickSingleRoundModal({
  courses,
  users,
  isOpen,
  onClose
}: QuickSingleRoundModalProps) {
  const router = useRouter()

  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || "")
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [selectedTeeId, setSelectedTeeId] = useState<string>("")
  const [formatType, setFormatType] = useState<string>("NETTO_STABLEFORD")

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [customPlayers, setCustomPlayers] = useState<Array<{ id: string; name: string; handicap: string }>>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const currentCourse = courses.find(c => c.id === selectedCourseId) || courses[0]
  const availableTees = currentCourse?.tees || []

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const addCustomPlayerField = () => {
    setCustomPlayers(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), name: "", handicap: "" }
    ])
  }

  const removeCustomPlayerField = (id: string) => {
    setCustomPlayers(prev => prev.filter(p => p.id !== id))
  }

  const updateCustomPlayer = (id: string, field: "name" | "handicap", value: string) => {
    setCustomPlayers(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourseId) {
      setError("Bitte wähle einen Golfplatz aus.")
      return
    }

    const validCustomPlayers = customPlayers.filter(p => p.name.trim().length > 0)
    if (selectedUserIds.length === 0 && validCustomPlayers.length === 0) {
      setError("Bitte wähle mindestens einen Spieler aus oder erstelle einen neuen Spieler.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await createQuickSingleRound({
        courseId: selectedCourseId,
        date: selectedDate,
        teeId: selectedTeeId || undefined,
        type: formatType,
        selectedUserIds,
        customPlayers: validCustomPlayers.map(p => ({
          name: p.name.trim(),
          handicap: p.handicap !== "" ? parseFloat(p.handicap) : undefined
        }))
      })

      onClose()
      // Redirect straight to spectator/admin live entry page
      router.push(`/?comp=${res.uniqueSlug}`)
    } catch (err: any) {
      setError(err?.message || "Fehler beim Erstellen der Einzelrunde.")
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 md:p-6 shadow-2xl space-y-5 text-slate-100 my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white leading-tight">Schnell-Einzelrunde</h2>
              <p className="text-xs text-slate-400">Runde direkt am Handy konfigurieren &amp; starten</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/60 border border-red-800/80 text-red-300 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {/* Golfplatz */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Golfplatz *
            </label>
            <select
              value={selectedCourseId}
              onChange={e => {
                setSelectedCourseId(e.target.value)
                setSelectedTeeId("")
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              required
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Datum & Tee Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Datum
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Abschlag (Tee)
              </label>
              <select
                value={selectedTeeId}
                onChange={e => setSelectedTeeId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Standard (Gelb)</option>
                {availableTees.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Modus / Format */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Wertung / Format
            </label>
            <select
              value={formatType}
              onChange={e => setFormatType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="NETTO_STABLEFORD">Netto Stableford (Standard)</option>
              <option value="STROKEPLAY_GROSS">Strokeplay Gross (Brutto Zählspiel)</option>
              <option value="MATCHPLAY">Matchplay</option>
            </select>
          </div>

          {/* Existing Registered Users */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Spieler aus Datenbank
            </label>
            <div className="max-h-36 overflow-y-auto space-y-1.5 bg-slate-950 border border-slate-800 p-2.5 rounded-xl scrollbar-thin">
              {users.map(u => {
                const isSelected = selectedUserIds.includes(u.id)
                const name = u.name || u.email || "Spieler"
                return (
                  <label
                    key={u.id}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300"
                        : "hover:bg-slate-800/60 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUserSelection(u.id)}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span>{name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      HCP {u.handicap !== null && u.handicap !== undefined ? u.handicap.toFixed(1) : "-"}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Custom / Gast Players */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Weitere Gast-Spieler
              </label>
              <button
                type="button"
                onClick={addCustomPlayerField}
                className="inline-flex items-center space-x-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
              >
                <UserPlus size={14} />
                <span>+ Gast hinzufügen</span>
              </button>
            </div>

            {customPlayers.map(cp => (
              <div key={cp.id} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Name (z.B. Daniel Loreck)"
                  value={cp.name}
                  onChange={e => updateCustomPlayer(cp.id, "name", e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="HCP (z.B. 16.1)"
                  value={cp.handicap}
                  onChange={e => updateCustomPlayer(cp.id, "handicap", e.target.value)}
                  className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => removeCustomPlayerField(cp.id)}
                  className="p-2 text-red-400 hover:bg-red-950/40 rounded-xl cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Submit Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-sm py-3 px-4 rounded-xl transition-colors shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Erstelle Einzelrunde...</span>
                </>
              ) : (
                <>
                  <Zap size={18} />
                  <span>Einzelrunde erstellen &amp; Starten</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
