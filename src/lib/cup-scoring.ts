export interface WeightedMatch { type: string; holeRange?: string | null; weight?: number | null }

/** Compatibility rule used once when freezing existing/new match weights. */
export function getRyderCupMatchWeight(match: WeightedMatch, round: { name: string }): number {
  if (match.weight != null) return match.weight
  return match.type === "SINGLES" && (
    ["VM", "NM", "Vormittag", "Nachmittag"].some(s => round.name.includes(s)) || match.holeRange === "1-9"
  ) ? 0.5 : 1
}

export function assertMatchWeight(weight: number) {
  if (weight !== 0.5 && weight !== 1) throw new Error("Matchgewicht muss 0,5 oder 1 sein.")
}

export function formatCupScore(score: number): string {
  if (!Number.isFinite(score)) return "–"
  const whole = Math.trunc(score)
  const fraction = Math.abs(score - whole)
  const quarter = Math.round(fraction * 4)
  if (Math.abs(fraction * 4 - quarter) > 1e-8) return String(score)
  const symbol = ["", "¼", "½", "¾"][quarter]
  if (symbol === undefined) return String(score)
  return symbol ? `${score < 0 ? "-" : ""}${whole ? `${Math.abs(whole)} ` : ""}${symbol}` : String(whole)
}
