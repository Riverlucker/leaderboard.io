export interface BlockedSlot {
  id: string
  date: string // YYYY-MM-DD
  startTime?: string // HH:MM
  endTime?: string // HH:MM
  isFullDay: boolean
  reason?: string
}

export interface ClRoundPeriod {
  roundName: string
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

export interface ClConfig {
  vorrundenModus: "GROUP_3" | "MATCHPLAY"
  playoffCount: 2 | 4 | 8 | 16
  hasZwischenrunde: boolean
  vorrundenCount: number
  ignoreCourseHandicap: boolean
  reducedScoreEntry: boolean
  roundPeriods: ClRoundPeriod[]
  hasScheduling: boolean
  exclusiveScheduling: boolean
  slotDurationHoursVorrunde: number
  slotDurationHoursPlayoff: number
  showAllRounds: boolean
  manageBlockedSlots: boolean
  blockedSlots?: BlockedSlot[]
  primaryColor?: string
}

export const DEFAULT_CL_CONFIG: ClConfig = {
  vorrundenModus: "GROUP_3",
  playoffCount: 8,
  hasZwischenrunde: true,
  vorrundenCount: 3,
  ignoreCourseHandicap: true,
  reducedScoreEntry: true,
  roundPeriods: [
    { roundName: "Vorrunde 1", startDate: "2027-01-02", endDate: "2027-01-16" },
    { roundName: "Vorrunde 2", startDate: "2027-01-17", endDate: "2027-01-31" },
    { roundName: "Vorrunde 3", startDate: "2027-02-01", endDate: "2027-02-15" },
    { roundName: "Zwischenrunde", startDate: "2027-02-16", endDate: "2027-02-23" },
    { roundName: "Viertelfinale", startDate: "2027-02-24", endDate: "2027-02-28" },
    { roundName: "Halbfinale", startDate: "2027-03-01", endDate: "2027-03-05" },
    { roundName: "Finale", startDate: "2027-03-06", endDate: "2027-03-10" },
  ],
  hasScheduling: true,
  exclusiveScheduling: true,
  slotDurationHoursVorrunde: 3,
  slotDurationHoursPlayoff: 2,
  showAllRounds: false,
  manageBlockedSlots: true,
  blockedSlots: [],
}

/**
 * Extracts and normalizes ClConfig from competition.cssConfig
 */
export function getClConfig(competition: any): ClConfig {
  if (!competition?.cssConfig) return { ...DEFAULT_CL_CONFIG }

  try {
    const parsed = JSON.parse(competition.cssConfig)
    return {
      vorrundenModus: parsed.vorrundenModus === "MATCHPLAY" ? "MATCHPLAY" : "GROUP_3",
      playoffCount: [2, 4, 8, 16].includes(parsed.playoffCount) ? parsed.playoffCount : 8,
      hasZwischenrunde: parsed.hasZwischenrunde !== undefined ? Boolean(parsed.hasZwischenrunde) : true,
      vorrundenCount: typeof parsed.vorrundenCount === "number" && parsed.vorrundenCount > 0 ? parsed.vorrundenCount : 3,
      ignoreCourseHandicap: parsed.ignoreCourseHandicap !== undefined ? Boolean(parsed.ignoreCourseHandicap) : true,
      reducedScoreEntry: parsed.reducedScoreEntry !== undefined ? Boolean(parsed.reducedScoreEntry) : true,
      roundPeriods: Array.isArray(parsed.roundPeriods) && parsed.roundPeriods.length > 0 ? parsed.roundPeriods : DEFAULT_CL_CONFIG.roundPeriods,
      hasScheduling: parsed.hasScheduling !== undefined ? Boolean(parsed.hasScheduling) : true,
      exclusiveScheduling: parsed.exclusiveScheduling !== undefined ? Boolean(parsed.exclusiveScheduling) : true,
      slotDurationHoursVorrunde: typeof parsed.slotDurationHoursVorrunde === "number" ? parsed.slotDurationHoursVorrunde : (parsed.vorrundenModus === "MATCHPLAY" ? 2 : 3),
      slotDurationHoursPlayoff: typeof parsed.slotDurationHoursPlayoff === "number" ? parsed.slotDurationHoursPlayoff : 2,
      showAllRounds: parsed.showAllRounds !== undefined ? Boolean(parsed.showAllRounds) : false,
      manageBlockedSlots: parsed.manageBlockedSlots !== undefined ? Boolean(parsed.manageBlockedSlots) : true,
      blockedSlots: Array.isArray(parsed.blockedSlots) ? parsed.blockedSlots : [],
      primaryColor: parsed.primaryColor || "#059669"
    }
  } catch (_) {
    return { ...DEFAULT_CL_CONFIG }
  }
}

export interface QualificationStructure {
  directPlayoffRanks: number[] // e.g. [1, 2, 3, 4]
  zwischenrundePairs: Array<{ p1Rank: number; p2Rank: number; title: string }>
  playoffStages: string[] // e.g. ["Viertelfinale", "Halbfinale", "Finale"]
}

/**
 * Calculates Zwischenrunde pairings and direct qualifiers based on playoffCount & hasZwischenrunde
 */
export function getQualificationStructure(config: ClConfig): QualificationStructure {
  const { playoffCount, hasZwischenrunde } = config

  let playoffStages: string[] = []
  if (playoffCount === 16) playoffStages = ["Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"]
  else if (playoffCount === 8) playoffStages = ["Viertelfinale", "Halbfinale", "Finale"]
  else if (playoffCount === 4) playoffStages = ["Halbfinale", "Finale"]
  else if (playoffCount === 2) playoffStages = ["Finale"]

  if (!hasZwischenrunde) {
    return {
      directPlayoffRanks: Array.from({ length: playoffCount }, (_, i) => i + 1),
      zwischenrundePairs: [],
      playoffStages
    }
  }

  // With Zwischenrunde:
  // Half of the playoff spots are given directly to top ranks (playoffCount / 2).
  // The other half are contested in Zwischenrunde by the next playoffCount players (playoffCount players = playoffCount / 2 matches).
  const directCount = playoffCount / 2
  const directPlayoffRanks = Array.from({ length: directCount }, (_, i) => i + 1)

  const zwStartRank = directCount + 1
  const zwCount = playoffCount // number of players in Zwischenrunde
  const zwEndRank = directCount + zwCount

  const zwischenrundePairs: Array<{ p1Rank: number; p2Rank: number; title: string }> = []
  const matchesCount = zwCount / 2

  for (let i = 0; i < matchesCount; i++) {
    const higherRank = zwStartRank + i
    const lowerRank = zwEndRank - i
    zwischenrundePairs.push({
      p1Rank: higherRank,
      p2Rank: lowerRank,
      title: `Zwischenrunde ${i + 1} (${higherRank}. vs ${lowerRank}.)`
    })
  }

  return {
    directPlayoffRanks,
    zwischenrundePairs,
    playoffStages
  }
}

/**
 * Determines whether a round's pairings should be anonymized.
 * If config.showAllRounds is true -> never anonymized.
 * If config.showAllRounds is false:
 * - The round active by current date is shown.
 * - If no round is active yet (competition hasn't started), Round 1 is shown.
 * - Future unstarted rounds have their pairings anonymized.
 */
export function isRoundPairingsAnonymized(
  roundName: string,
  config: ClConfig,
  currentDate: Date = new Date()
): boolean {
  if (config.showAllRounds) return false

  const periods = config.roundPeriods || []
  const dateStr = currentDate.toISOString().split("T")[0]

  // Find active round by date
  const activePeriod = periods.find(p => p.startDate <= dateStr && dateStr <= p.endDate)

  if (activePeriod) {
    // If an active period exists, any round whose startDate is after today is anonymized
    const targetPeriod = periods.find(p => p.roundName === roundName)
    if (targetPeriod && targetPeriod.startDate > dateStr) {
      return true
    }
    return false
  }

  // If no round is currently active:
  // Check if competition is in the future
  const firstPeriod = periods[0]
  if (firstPeriod && dateStr < firstPeriod.startDate) {
    // Only the very first round is revealed, future rounds are anonymized
    return roundName !== firstPeriod.roundName && roundName !== "Vorrunde 1"
  }

  return false
}

/**
 * Generates pre-seeded pairings across multiple Vorrunden rounds.
 * For 1v1 MATCHPLAY: Uses standard round-robin (polygon method) ensuring NO repeat matchups.
 * For GROUP_3: Uses combinatorial rotation ensuring minimal repeat matchups.
 */
export function generateVorrundenPairings(
  participantIds: string[],
  vorrundenCount: number,
  mode: "GROUP_3" | "MATCHPLAY"
): Array<Array<string[]>> {
  const numPlayers = participantIds.length
  if (numPlayers === 0) return []

  if (mode === "MATCHPLAY") {
    // Round-robin pairing generator (Berger table algorithm)
    const players = [...participantIds]
    if (players.length % 2 !== 0) {
      players.push("BYE")
    }
    const n = players.length
    const rounds: Array<Array<string[]>> = []

    for (let r = 0; r < vorrundenCount; r++) {
      const roundPairings: Array<string[]> = []
      for (let i = 0; i < n / 2; i++) {
        const p1 = players[i]
        const p2 = players[n - 1 - i]
        if (p1 !== "BYE" && p2 !== "BYE") {
          roundPairings.push([p1, p2])
        }
      }
      rounds.push(roundPairings)

      // Rotate players keeping first element fixed
      players.splice(1, 0, players.pop()!)
    }
    return rounds
  }

  // mode === "GROUP_3"
  // Group players into 3-player matches across rounds
  const rounds: Array<Array<string[]>> = []
  const groupCount = Math.floor(numPlayers / 3)

  for (let r = 0; r < vorrundenCount; r++) {
    const roundMatches: Array<string[]> = []
    // Shift indices systematically so pairings rotate
    const offset = r * groupCount
    const shuffled = Array.from({ length: numPlayers }, (_, i) => participantIds[(i + offset) % numPlayers])

    for (let g = 0; g < groupCount; g++) {
      // Pick 1 from first third, 1 from middle third, 1 from last third for maximum mixing
      const idx1 = g
      const idx2 = (g + groupCount + r) % (numPlayers - groupCount)
      const idx3 = numPlayers - 1 - g
      
      const p1 = shuffled[idx1]
      const p2 = shuffled[idx2]
      const p3 = shuffled[idx3]
      
      const unique = Array.from(new Set([p1, p2, p3]))
      if (unique.length === 3) {
        roundMatches.push(unique)
      } else {
        // Fallback simple slice
        roundMatches.push(shuffled.slice(g * 3, g * 3 + 3))
      }
    }
    rounds.push(roundMatches)
  }

  return rounds
}
