import { calculateCourseHandicap, getRoundHoleInfo, type Hole, type Tee } from "./scoring"
interface PlayerTee extends Tee { id?: string }
interface RoundInfo {
  id: string
  course?: {holes: Hole[]; tees?: PlayerTee[]} | null
  tee?: PlayerTee | null
  holesPlayed?: number[]
  ninePreset?: string | null
}
interface PlayerInfo {
  id?: string
  compHandicap?: number | null
  manualRoundHandicaps?: {roundId: string; handicapValue?: number | null; teeId?: string | null; tee?: PlayerTee | null}[]
}
interface MatchInfo {type?: string; allowanceType?: string | null; handicapAllowance?: number | null; matchPlayers?: {participantId:string}[]}

export function getPlayingHandicap(p: PlayerInfo, round: RoundInfo | null | undefined) {
  if (!round) return 0
  // Check manual override
  const manualHcp = p.manualRoundHandicaps?.find((mr) => mr.roundId === round.id)
  if (manualHcp !== undefined && manualHcp !== null && manualHcp.handicapValue !== null && manualHcp.handicapValue !== undefined) {
    return manualHcp.handicapValue
  }

  // Fall back to WHS formula using player's tee (or round tee) and course
  const course = round.course
  if (!course) return 0

  const tee = manualHcp?.tee ||
              (manualHcp?.teeId && course.tees?.find((t) => t.id === manualHcp.teeId)) ||
              round.tee ||
              course.tees?.find((t) => t.name.toLowerCase().includes('yellow') || t.name.toLowerCase().includes('gelb')) ||
              course.tees?.find((t) => t.name.toLowerCase().includes('white') || t.name.toLowerCase().includes('weiß')) ||
              course.tees?.[0]

  if (!tee || p.compHandicap === null || p.compHandicap === undefined) return 0

  const coursePar = course.holes.reduce((sum, h) => sum + h.par, 0)
  return calculateCourseHandicap(p.compHandicap, tee, coursePar)
}

export function getPlayerTeeForRound(p: PlayerInfo, round: RoundInfo | null | undefined) {
  if (!round) return null
  const manualHcp = p.manualRoundHandicaps?.find((mr) => mr.roundId === round.id)
  const course = round.course
  if (manualHcp?.tee) return manualHcp.tee
  if (manualHcp?.teeId && course?.tees) {
    const found = course.tees.find((t) => t.id === manualHcp.teeId)
    if (found) return found
  }
  return round.tee ||
         course?.tees?.find((t) => t.name.toLowerCase().includes('yellow') || t.name.toLowerCase().includes('gelb')) ||
         course?.tees?.[0] || null
}

export function parseAllowancePercentage(allowanceType?: string | null): number {
  if (!allowanceType) return 0.75
  const cleaned = allowanceType.replace('%', '').trim()
  const num = parseFloat(cleaned)
  if (!isNaN(num)) return num / 100
  return 0.75
}

export function getMatchAllowance(match: MatchInfo, hcpA: number, hcpB: number) {
  if (match.handicapAllowance !== null && match.handicapAllowance !== undefined) {
    return match.handicapAllowance
  }
  const diff = Math.abs(hcpA - hcpB)
  const percentage = parseAllowancePercentage(match.allowanceType)
  return Math.round(diff * percentage)
}

export function getPlayerCalculatedAllowance(mp: {participantId: string; handicapAllowance?: number | null}, match: MatchInfo, round: RoundInfo, participants: PlayerInfo[]) {
  if (mp.handicapAllowance !== null && mp.handicapAllowance !== undefined) {
    return mp.handicapAllowance
  }
  const p = participants.find((x) => x.id === mp.participantId)
  if (!p) return 0

  const pHcp = getPlayingHandicap(p, round)

  const matchPlayersList = (match.matchPlayers || []).map((x) => participants.find((y) => y.id === x.participantId)).filter((p): p is PlayerInfo => p !== undefined)
  const hcps = matchPlayersList.map((x) => getPlayingHandicap(x, round))

  if (match.type === "TEAM_MATCHPLAY") {
    if (hcps.length === 0) return 0
    const minPH = Math.min(...hcps)
    const diff = pHcp - minPH
    const percentage = parseAllowancePercentage(match.allowanceType)
    return Math.round(diff * percentage)
  } else if (match.type === "SINGLES" && matchPlayersList.length === 2) {
    const p1 = matchPlayersList[0]
    const p2 = matchPlayersList[1]
    const hcp1 = getPlayingHandicap(p1, round)
    const hcp2 = getPlayingHandicap(p2, round)
    const allowanceVal = getMatchAllowance(match, hcp1, hcp2)

    if (p.id === p1.id) {
      return hcp1 > hcp2 ? allowanceVal : 0
    } else {
      return hcp2 > hcp1 ? allowanceVal : 0
    }
  } else {
    if (hcps.length === 0) return 0
    const minPH = Math.min(...hcps)
    return pHcp - minPH
  }
}

export function getMatchHandicapStrokesOnHole(allowance: number, strokeIndex: number) {
  const base = Math.floor(allowance / 18)
  const remainder = allowance % 18
  return base + (strokeIndex <= remainder ? 1 : 0)
}

export function parseHoleRange(rangeStr: string | null | undefined, roundHoles: number[]): number[] {
  if (!rangeStr) return roundHoles.length > 0 ? roundHoles : Array.from({ length: 18 }, (_, i) => i + 1)
  if (["1-9,1-9", "10-18,10-18"].includes(rangeStr.replace(/\s/g, ""))) return Array.from({length: 18}, (_, i) => i + 1)
  return parseHoleRangeString(rangeStr)
}

export function parseHoleRangeString(rangeStr: string): number[] {
  const result: number[] = []
  if (!rangeStr) return result

  const parts = rangeStr.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    if (trimmed.includes('-')) {
      const bounds = trimmed.split('-')
      if (bounds.length === 2) {
        const start = parseInt(bounds[0].trim(), 10)
        const end = parseInt(bounds[1].trim(), 10)
        if (!isNaN(start) && !isNaN(end)) {
          if (start <= end) {
            for (let i = start; i <= end; i++) {
              result.push(i)
            }
          } else {
            for (let i = start; i >= end; i--) {
              result.push(i)
            }
          }
        }
      }
    } else {
      const num = parseInt(trimmed, 10)
      if (!isNaN(num)) {
        result.push(num)
      }
    }
  }
  return result
}

export function getHoleRangeString(round: Pick<RoundInfo, "holesPlayed" | "ninePreset"> | null | undefined): string {
  if (!round) return "1-18"

  if (round.ninePreset === 'BACK_9_TWICE') return "10-18,10-18"
  if (round.ninePreset === 'FRONT_9_TWICE') {
    return "1-9,1-9"
  }

  const holes = round.holesPlayed || []
  if (holes.length === 0) return "1-18"

  // Check if it's consecutive ascending
  let isConsecutive = true
  for (let i = 1; i < holes.length; i++) {
    if (holes[i] !== holes[i - 1] + 1) {
      isConsecutive = false
      break
    }
  }
  if (isConsecutive) {
    return `${holes[0]}-${holes[holes.length - 1]}`
  }

  const isFrontTwice = holes.length === 18 && holes.slice(0, 9).every((h: number, idx: number) => h === idx + 1) && holes.slice(9, 18).every((h: number, idx: number) => h === idx + 1)
  if (isFrontTwice) return "1-9,1-9"

  const isBackTwice = holes.length === 18 && holes.slice(0, 9).every((h: number, idx: number) => h === idx + 10) && holes.slice(9, 18).every((h: number, idx: number) => h === idx + 10)
  if (isBackTwice) return "10-18,10-18"

  const parts: string[] = []
  let start = holes[0]
  let prev = holes[0]

  for (let i = 1; i < holes.length; i++) {
    const current = holes[i]
    if (current === prev + 1) {
      prev = current
    } else {
      if (start === prev) {
        parts.push(String(start))
      } else {
        parts.push(`${start}-${prev}`)
      }
      start = current
      prev = current
    }
  }
  if (start === prev) {
    parts.push(String(start))
  } else {
    parts.push(`${start}-${prev}`)
  }
  return parts.join(",")
}

export function getMatchHoleStrokesMap(matchHoles: number[], round: RoundInfo, allowance: number): Record<number, number> {
  const holeInfos = matchHoles.map(num => {
    const hole = round.course?.holes.find((h) => h.number === num)
    const adjusted = getRoundHoleInfo(round, num)
    const strokeIndex = adjusted ? adjusted.strokeIndex : (hole?.strokeIndex || 18)
    return { num, strokeIndex }
  }).filter(h => h.num !== undefined)

  // Sort by strokeIndex ascending (hardest first)
  holeInfos.sort((a, b) => a.strokeIndex - b.strokeIndex)

  const N = holeInfos.length
  if (N === 0) return {}

  const base = Math.floor(allowance / N)
  const remainder = allowance % N

  const strokesMap: Record<number, number> = {}
  for (let i = 0; i < N; i++) {
    const hInfo = holeInfos[i]
    strokesMap[hInfo.num] = base + (i < remainder ? 1 : 0)
  }
  return strokesMap
}

export function getCompactName(fullName: string, allNames: string[]) {
  if (!fullName) return "Unknown"
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return fullName

  const firstName = parts[0]
  const lastName = parts.slice(1).join(" ")
  const lastInitial = lastName.charAt(0)

  const others = allNames.filter(n => {
    if (!n || n === fullName) return false
    const p = n.trim().split(/\s+/)
    return p[0] === firstName
  })

  if (others.length === 0) return firstName

  const sameInitial = others.some(n => {
    const p = n.trim().split(/\s+/)
    const otherLast = p.slice(1).join(" ")
    return otherLast.charAt(0) === lastInitial
  })

  if (sameInitial) return fullName
  return `${firstName} ${lastInitial}.`
}
