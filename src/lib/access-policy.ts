import type { Role } from "@prisma/client"

export function isAdmin(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN"
}

export function canManageUser(actorRole: Role, targetRole: Role, requestedRole: Role = targetRole): boolean {
  return actorRole === "SUPER_ADMIN" ||
    (actorRole === "ADMIN" && targetRole === "USER" && requestedRole === "USER")
}

export function assertScoreValue(strokes: number | null, status: string | null) {
  if (status !== null && status !== "WIPED" && status !== "NOT_PLAYED") throw new Error("Ungültiger Scorestatus.")
  if (status === null && strokes !== null && (!Number.isInteger(strokes) || strokes < 1 || strokes > 99)) {
    throw new Error("Schlagzahl muss eine ganze Zahl zwischen 1 und 99 sein.")
  }
  if (status !== null && strokes !== null && strokes !== 0) throw new Error("Status und Schlagzahl widersprechen sich.")
}

export function assertHandicap(value: number | null | undefined) {
  if (value != null && (!Number.isFinite(value) || value < -10 || value > 54)) throw new Error("Ungültiger Handicapindex.")
}

export function assertPlayingHandicap(value: number | null | undefined) {
  if (value != null && (!Number.isInteger(value) || value < -36 || value > 108)) throw new Error("Ungültige Spielvorgabe.")
}

export function assertHoles(holes: number[]) {
  if (!Array.isArray(holes) || !holes.length || holes.length > 18 || new Set(holes).size !== holes.length ||
      holes.some(h => !Number.isInteger(h) || h < 1 || h > 18)) throw new Error("Ungültige Lochauswahl.")
}

export function holeNumbers(range: string | null | undefined, fallback: number[]): number[] {
  if (!range) return fallback
  if (["1-9,1-9", "10-18,10-18"].includes(range.replace(/\s/g, ""))) return Array.from({length: 18}, (_, i) => i + 1)
  const result: number[] = []
  for (const part of range.split(',')) {
    if (!/^\s*\d{1,2}(\s*-\s*\d{1,2})?\s*$/.test(part)) throw new Error("Ungültiger Lochbereich.")
    const [start, end = start] = part.trim().split(/\s*-\s*/).map(Number)
    if (end < start) throw new Error("Ungültiger Lochbereich.")
    for (let h = start; h <= end; h++) result.push(h)
  }
  assertHoles(result)
  return result
}
