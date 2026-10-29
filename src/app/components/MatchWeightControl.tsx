"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateMatchWeight } from "@/app/admin/competitions/actions"
import { getRyderCupMatchWeight, type WeightedMatch } from "@/lib/cup-scoring"

export function MatchWeightControl({match, round, competitionId}: {
  match: WeightedMatch & {id: string}; round: {name: string}; competitionId: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  return <label className="block text-xs font-semibold mt-2">
    Matchpunkte bei Sieg
    <select aria-label="Matchpunkte bei Sieg" value={getRyderCupMatchWeight(match, round)} disabled={saving}
      className="ml-2 rounded border border-slate-400 bg-transparent px-2 py-1"
      onChange={async e => {
        setSaving(true); setError("")
        try { await updateMatchWeight(match.id, competitionId, Number(e.target.value)); router.refresh() }
        catch (err) { setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.") }
        finally { setSaving(false) }
      }}>
      <option value={0.5}>0,5</option><option value={1}>1</option>
    </select>
    {error && <span role="alert" className="block text-red-500">{error}</span>}
  </label>
}
