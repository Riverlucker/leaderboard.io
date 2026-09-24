"use client"

import React from "react"
import { Sparkles, Calendar, Award } from "lucide-react"
import { 
  getPlayingHandicap, 
  getMatchAllowance, 
  getMatchHoleStrokesMap, 
  parseHoleRange, 
  parseAllowancePercentage 
} from "../CompetitionClientView"

export function formatCupScore(score: number): string {
  const whole = Math.floor(score)
  const remainder = score - whole
  if (remainder >= 0.75) return `${whole + 1}`
  if (remainder >= 0.25) return whole > 0 ? `${whole} ½` : `½`
  return `${whole}`
}

export function computeRyderCupStatus(match: any, round: any, competition: any, diamondTeamId: string, heartsTeamId: string) {
  const isTeamMatchplay = match.type === 'TEAM_MATCHPLAY' || match.type === 'CHAPMAN' || (match.matchPlayers && match.matchPlayers.length === 4)

  const getPlayerMPAllowance = (pId: string, defVal: number) => {
    const mp = match.matchPlayers?.find((x: any) => x.participantId === pId)
    if (mp && mp.handicapAllowance !== null && mp.handicapAllowance !== undefined) {
      return mp.handicapAllowance
    }
    return defVal
  }

  if (isTeamMatchplay) {
    const pIds = match.matchPlayers.map((mp: any) => mp.participantId)
    const players = pIds.map((id: string) => competition.participants.find((p: any) => p.id === id)).filter(Boolean)

    if (players.length < 4) {
      return {
        statusText: "Setup Pending",
        holesPlayed: 0,
        totalHoles: 18,
        lead: 0,
        isFinished: false,
        isTeamMatchplay: true,
        team1Players: [],
        team2Players: [],
        team1Allowance: [0, 0],
        team2Allowance: [0, 0],
        decidedInfo: null
      }
    }

    let t1Players = players.filter((p: any) => p.teamId === diamondTeamId)
    let t2Players = players.filter((p: any) => p.teamId === heartsTeamId)

    if (t1Players.length !== 2 || t2Players.length !== 2) {
      t1Players = [players[0], players[1]]
      t2Players = [players[2], players[3]]
    }

    const hcp1_1 = getPlayingHandicap(t1Players[0], round)
    const hcp1_2 = getPlayingHandicap(t1Players[1], round)
    const hcp2_1 = getPlayingHandicap(t2Players[0], round)
    const hcp2_2 = getPlayingHandicap(t2Players[1], round)

    const minPH = Math.min(hcp1_1, hcp1_2, hcp2_1, hcp2_2)
    const percentage = parseAllowancePercentage(match.allowanceType)

    const allow1_1 = getPlayerMPAllowance(t1Players[0].id, Math.round((hcp1_1 - minPH) * percentage))
    const allow1_2 = getPlayerMPAllowance(t1Players[1].id, Math.round((hcp1_2 - minPH) * percentage))
    const allow2_1 = getPlayerMPAllowance(t2Players[0].id, Math.round((hcp2_1 - minPH) * percentage))
    const allow2_2 = getPlayerMPAllowance(t2Players[1].id, Math.round((hcp2_2 - minPH) * percentage))

    const roundHoles = round.holesPlayed && round.holesPlayed.length > 0
      ? [...round.holesPlayed].sort((a: number, b: number) => a - b)
      : Array.from({ length: 18 }, (_, i) => i + 1)
    const matchHoles = parseHoleRange(match.holeRange, roundHoles)

    const strokesMap1_1 = getMatchHoleStrokesMap(matchHoles, round, allow1_1)
    const strokesMap1_2 = getMatchHoleStrokesMap(matchHoles, round, allow1_2)
    const strokesMap2_1 = getMatchHoleStrokesMap(matchHoles, round, allow2_1)
    const strokesMap2_2 = getMatchHoleStrokesMap(matchHoles, round, allow2_2)

    const getMatchHoleStrokes = (score: any) => {
      if (!score) return null
      if (score.status === 'WIPED') return 99
      if (score.status === 'NOT_PLAYED') return null
      return score.grossStrokes
    }

    let t1Up = 0
    let t2Up = 0
    let holesPlayedCount = 0
    let decidedHole: number | null = null
    let decidedInfo: string | null = null

    const totalHoles = matchHoles.length

    for (let i = 0; i < totalHoles; i++) {
      const holeNum = matchHoles[i]
      const remainingHoles = totalHoles - (i + 1)
      const hole = round.course?.holes?.find((h: any) => h.number === holeNum)
      if (!hole) continue

      const s1_1 = t1Players[0]?.scores?.find((s: any) => s.roundId === round.id && (s.holeId === hole.id || s.hole?.number === holeNum))
      const s1_2 = t1Players[1]?.scores?.find((s: any) => s.roundId === round.id && (s.holeId === hole.id || s.hole?.number === holeNum))
      const s2_1 = t2Players[0]?.scores?.find((s: any) => s.roundId === round.id && (s.holeId === hole.id || s.hole?.number === holeNum))
      const s2_2 = t2Players[1]?.scores?.find((s: any) => s.roundId === round.id && (s.holeId === hole.id || s.hole?.number === holeNum))

      const gross1_1 = getMatchHoleStrokes(s1_1)
      const gross1_2 = getMatchHoleStrokes(s1_2)
      const gross2_1 = getMatchHoleStrokes(s2_1)
      const gross2_2 = getMatchHoleStrokes(s2_2)

      const net1_1 = gross1_1 !== null && gross1_1 !== undefined ? (gross1_1 === 99 ? 99 : gross1_1 - (strokesMap1_1[holeNum] || 0)) : 999
      const net1_2 = gross1_2 !== null && gross1_2 !== undefined ? (gross1_2 === 99 ? 99 : gross1_2 - (strokesMap1_2[holeNum] || 0)) : 999
      const net2_1 = gross2_1 !== null && gross2_1 !== undefined ? (gross2_1 === 99 ? 99 : gross2_1 - (strokesMap2_1[holeNum] || 0)) : 999
      const net2_2 = gross2_2 !== null && gross2_2 !== undefined ? (gross2_2 === 99 ? 99 : gross2_2 - (strokesMap2_2[holeNum] || 0)) : 999

      const best1 = Math.min(net1_1, net1_2)
      const best2 = Math.min(net2_1, net2_2)

      // Only count hole if both sides have entered at least one score on this hole
      if (best1 === 999 || best2 === 999) continue

      holesPlayedCount++

      if (best1 < best2) t1Up++
      else if (best2 < best1) t2Up++

      const diff = Math.abs(t1Up - t2Up)
      if (diff > remainingHoles && decidedHole === null) {
        decidedHole = holeNum
        decidedInfo = `${diff}&${remainingHoles}`
      }
    }

    const lead = t1Up - t2Up
    const isFinished = decidedHole !== null || (holesPlayedCount >= totalHoles && totalHoles > 0)

    let statusText = "A/S"
    if (lead > 0) {
      statusText = decidedInfo ? decidedInfo : `${lead}UP`
    } else if (lead < 0) {
      const absLead = Math.abs(lead)
      statusText = decidedInfo ? decidedInfo : `${absLead}UP`
    } else {
      statusText = holesPlayedCount > 0 ? "A/S" : "Not Started"
    }

    return {
      statusText,
      holesPlayed: holesPlayedCount,
      totalHoles,
      lead,
      isFinished,
      isTeamMatchplay: true,
      team1Players: t1Players,
      team2Players: t2Players,
      team1Allowance: [allow1_1, allow1_2],
      team2Allowance: [allow2_1, allow2_2],
      decidedInfo
    }
  } else {
    // Singles
    const pIds = match.matchPlayers.map((mp: any) => mp.participantId)
    const players = pIds.map((id: string) => competition.participants.find((p: any) => p.id === id)).filter(Boolean)

    if (players.length < 2) {
      return {
        statusText: "Not Started",
        holesPlayed: 0,
        totalHoles: 18,
        lead: 0,
        isFinished: false,
        isTeamMatchplay: false,
        team1Players: [],
        team2Players: [],
        team1Allowance: [0],
        team2Allowance: [0],
        decidedInfo: null
      }
    }

    let p1 = players.find((p: any) => p.teamId === diamondTeamId) || players[0]
    let p2 = players.find((p: any) => p.teamId === heartsTeamId) || players[1]

    const hcp1 = getPlayingHandicap(p1, round)
    const hcp2 = getPlayingHandicap(p2, round)

    const roundHoles = round.holesPlayed && round.holesPlayed.length > 0
      ? [...round.holesPlayed].sort((a: number, b: number) => a - b)
      : Array.from({ length: 18 }, (_, i) => i + 1)
    const matchHoles = parseHoleRange(match.holeRange, roundHoles)

    const diffHcp = Math.abs(hcp1 - hcp2)
    const allowance = getMatchAllowance(diffHcp, match.allowanceType, matchHoles.length)

    let allowD = 0
    let allowH = 0
    if (hcp1 > hcp2) allowD = getPlayerMPAllowance(p1.id, allowance)
    else if (hcp2 > hcp1) allowH = getPlayerMPAllowance(p2.id, allowance)

    const strokesMapD = getMatchHoleStrokesMap(matchHoles, round, allowD)
    const strokesMapH = getMatchHoleStrokesMap(matchHoles, round, allowH)

    const getMatchHoleStrokes = (score: any) => {
      if (!score) return null
      if (score.status === 'WIPED') return 99
      if (score.status === 'NOT_PLAYED') return null
      return score.grossStrokes
    }

    let dUp = 0
    let hUp = 0
    let holesPlayedCount = 0
    let decidedHole: number | null = null
    let decidedInfo: string | null = null

    const totalHoles = matchHoles.length

    for (let i = 0; i < totalHoles; i++) {
      const holeNum = matchHoles[i]
      const remainingHoles = totalHoles - (i + 1)
      const hole = round.course?.holes?.find((h: any) => h.number === holeNum)
      if (!hole) continue

      const sD = p1.scores?.find((s: any) => s.roundId === round.id && (s.holeId === hole.id || s.hole?.number === holeNum))
      const sH = p2.scores?.find((s: any) => s.roundId === round.id && (s.holeId === hole.id || s.hole?.number === holeNum))

      const grossD = getMatchHoleStrokes(sD)
      const grossH = getMatchHoleStrokes(sH)

      if (grossD === null || grossD === undefined || grossH === null || grossH === undefined) continue

      holesPlayedCount++

      const netD = grossD === 99 ? 99 : grossD - (strokesMapD[holeNum] || 0)
      const netH = grossH === 99 ? 99 : grossH - (strokesMapH[holeNum] || 0)

      if (netD < netH) dUp++
      else if (netH < netD) hUp++

      const diff = Math.abs(dUp - hUp)
      if (diff > remainingHoles && decidedHole === null) {
        decidedHole = holeNum
        decidedInfo = `${diff}&${remainingHoles}`
      }
    }

    const lead = dUp - hUp
    const isFinished = decidedHole !== null || (holesPlayedCount >= totalHoles && totalHoles > 0)

    let statusText = "A/S"
    if (lead > 0) {
      statusText = decidedInfo ? decidedInfo : `${lead}UP`
    } else if (lead < 0) {
      const absLead = Math.abs(lead)
      statusText = decidedInfo ? decidedInfo : `${absLead}UP`
    } else {
      statusText = holesPlayedCount > 0 ? "A/S" : "Not Started"
    }

    return {
      statusText,
      holesPlayed: holesPlayedCount,
      totalHoles,
      lead,
      isFinished,
      isTeamMatchplay: false,
      team1Players: [p1],
      team2Players: [p2],
      team1Allowance: [allowD],
      team2Allowance: [allowH],
      decidedInfo
    }
  }
}

export function getRyderCupMatchWeight(match: any, round: any): number {
  if (match.weight !== undefined && match.weight !== null) return match.weight
  if (match.type === "SINGLES" && (
    round.name.includes("VM") || 
    round.name.includes("NM") || 
    round.name.includes("Vormittag") || 
    round.name.includes("Nachmittag") ||
    match.holeRange === "1-9"
  )) {
    return 0.5
  }
  return 1.0
}

export function calculateRyderCupPoints(competition: any) {
  const teams = competition.teams || []
  const diamondTeam = teams.find((t: any) => t.name.toLowerCase().includes("diamond") || t.color === "blue") || teams[0] || { id: "team1", name: "Team Diamond", color: "blue" }
  const heartsTeam = teams.find((t: any) => t.name.toLowerCase().includes("heart") || t.color === "red") || teams[1] || { id: "team2", name: "Team Hearts", color: "red" }

  let diamondPoints = 0
  let heartsPoints = 0

  const allMatchesList: { round: any; match: any; status: any; weight: number }[] = []

  const rounds = competition.rounds || []
  rounds.forEach((r: any) => {
    (r.matches || []).forEach((m: any) => {
      const status = computeRyderCupStatus(m, r, competition, diamondTeam.id, heartsTeam.id)
      const weight = getRyderCupMatchWeight(m, r)
      allMatchesList.push({ round: r, match: m, status, weight })

      if (status.isFinished) {
        if (status.lead > 0) diamondPoints += weight
        else if (status.lead < 0) heartsPoints += weight
        else {
          diamondPoints += weight / 2
          heartsPoints += weight / 2
        }
      }
    })
  })

  // MVP & Donut Stats
  const mvpStats: Record<string, { participant: any; teamId: string; points: number; matches: number; wins: number; ties: number; losses: number }> = {};
  
  (competition.participants || []).forEach((p: any) => {
    mvpStats[p.id] = {
      participant: p,
      teamId: p.teamId,
      points: 0,
      matches: 0,
      wins: 0,
      ties: 0,
      losses: 0
    }
  })

  allMatchesList.forEach(({ status, weight }) => {
    if (!status.isFinished && status.holesPlayed === 0) return

    const dPlayerIds = status.team1Players.map((p: any) => p.id)
    const hPlayerIds = status.team2Players.map((p: any) => p.id)
    const isFinished = status.isFinished
    const lead = status.lead

    dPlayerIds.forEach((id: string) => {
      if (mvpStats[id] && isFinished) {
        mvpStats[id].matches++
        if (lead > 0) {
          mvpStats[id].points += weight
          mvpStats[id].wins++
        } else if (lead < 0) {
          mvpStats[id].losses++
        } else {
          mvpStats[id].points += weight / 2
          mvpStats[id].ties++
        }
      }
    })

    hPlayerIds.forEach((id: string) => {
      if (mvpStats[id] && isFinished) {
        mvpStats[id].matches++
        if (lead < 0) {
          mvpStats[id].points += weight
          mvpStats[id].wins++
        } else if (lead > 0) {
          mvpStats[id].losses++
        } else {
          mvpStats[id].points += weight / 2
          mvpStats[id].ties++
        }
      }
    })
  })

  const sortedMvp = Object.values(mvpStats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.matches - b.matches
  })

  const sortedDonuts = Object.values(mvpStats).sort((a, b) => {
    if (a.points !== b.points) return a.points - b.points
    if (b.losses !== a.losses) return b.losses - a.losses
    return b.matches - a.matches
  })

  return {
    diamondTeam,
    heartsTeam,
    diamondPoints,
    heartsPoints,
    allMatchesList,
    sortedMvp,
    sortedDonuts
  }
}

// 1. HERO BANNER (Shown at the top of the Leaderboard tab)
export function RyderCupHeroBanner({ competition }: { competition: any }) {
  const { diamondPoints, heartsPoints } = calculateRyderCupPoints(competition)

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden mb-6">
      {/* Top Gold Ribbon */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-black tracking-widest text-center py-2 text-xs uppercase shadow-md flex items-center justify-center gap-2">
        <Sparkles size={15} className="text-slate-900" />
        <span>THE REAL RYDER CUP 2026 · OFFICIAL SCOREBOARD</span>
        <Sparkles size={15} className="text-slate-900" />
      </div>

      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4 sm:gap-6">
          {/* Diamond (Blue) */}
          <div className="flex items-center justify-between md:justify-end gap-3 bg-blue-950/80 p-3.5 sm:p-5 rounded-2xl border border-blue-500/40 shadow-inner">
            <div className="text-left md:text-right">
              <div className="flex items-center md:justify-end gap-1.5 text-blue-400 font-black text-sm sm:text-base tracking-wide uppercase">
                <span>♦</span>
                <span>TEAM DIAMOND</span>
              </div>
              <div className="text-xs text-slate-400 font-medium">7 Spieler · Blau</div>
            </div>
            <div className="bg-blue-600 text-white font-black text-3xl sm:text-4xl md:text-5xl min-w-[70px] sm:min-w-[84px] h-[60px] sm:h-[72px] rounded-xl flex items-center justify-center shadow-lg tracking-wider border border-blue-400/40">
              {formatCupScore(diamondPoints)}
            </div>
          </div>

          {/* Center Logo & Target (Prominent Hero Display) */}
          <div className="flex flex-col items-center justify-center text-center order-first md:order-none py-1 px-1">
            {/* Top Target Pill */}
            <div className="mb-2 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-950/90 border border-amber-400/60 text-[11px] sm:text-xs text-slate-200 font-bold shadow-lg">
              <span className="text-amber-400 font-black tracking-wide">🏆 11 PKT ZUM SIEG</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 font-medium">21 Gesamt</span>
            </div>

            {/* Clean Transparent TRRC Emblem without white corners or redundant badge */}
            <div className="w-48 h-48 sm:w-60 sm:h-60 md:w-72 md:h-72 flex items-center justify-center transition-transform duration-300 hover:scale-105 filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)]">
              <img 
                src="/trrc.png" 
                alt="TRRC Logo" 
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src.endsWith('.png')) {
                    target.src = '/trrc.jpg';
                  } else {
                    target.style.display = 'none';
                  }
                }}
              />
            </div>
          </div>

          {/* Hearts (Red) */}
          <div className="flex items-center justify-between gap-3 bg-red-950/80 p-3.5 sm:p-5 rounded-2xl border border-red-500/40 shadow-inner">
            <div className="bg-red-600 text-white font-black text-3xl sm:text-4xl md:text-5xl min-w-[70px] sm:min-w-[84px] h-[60px] sm:h-[72px] rounded-xl flex items-center justify-center shadow-lg tracking-wider border border-red-400/40 order-last md:order-first">
              {formatCupScore(heartsPoints)}
            </div>
            <div className="text-right md:text-left">
              <div className="flex items-center md:justify-start justify-end gap-1.5 text-red-400 font-black text-sm sm:text-base tracking-wide uppercase">
                <span>TEAM HEARTS</span>
                <span>♥</span>
              </div>
              <div className="text-xs text-slate-400 font-medium">7 Spieler · Rot</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 mb-1.5 font-mono">
            <span className="text-blue-400">♦ Diamond: {diamondPoints} Pkt</span>
            <span className="text-amber-400">{21 - (diamondPoints + heartsPoints)} Pkt offen</span>
            <span className="text-red-400">{heartsPoints} Pkt :Hearts ♥</span>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex p-0.5 border border-slate-800">
            <div className="bg-blue-600 rounded-l-full transition-all duration-500" style={{ width: `${(diamondPoints / 21) * 100}%` }} />
            <div className="bg-slate-800 flex-1 transition-all duration-500" />
            <div className="bg-red-600 rounded-r-full transition-all duration-500" style={{ width: `${(heartsPoints / 21) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper to check if round pairings are anonymous
export function isRoundPairingsAnonymous(round: any): boolean {
  if (!round || !round.name) return false
  const name = round.name.toLowerCase()
  if (name.includes("tag 1 nm") || name.includes("tag 1 nachmittag")) return true
  if (name.includes("tag 2")) return true
  return false
}

// Helper to determine match tee time from official tournament plan (Strict 24h format, no AM/PM)
export function getMatchTeeTime(match: any, round: any, mIdx: number): string {
  const rName = (round?.name || "").toLowerCase()
  const cName = (round?.course?.name || "").toLowerCase()

  if (rName.includes("nm") || rName.includes("nachmittag") || rName.includes("chapman")) {
    const nmTimes = ["14:10", "14:20", "14:30", "14:40"]
    return nmTimes[mIdx] || "14:10"
  }
  if (rName.includes("final") || cName.includes("calvia") || cName.includes("calviá")) {
    const finalTimes = ["11:00", "11:10", "11:20", "11:30", "11:40", "11:50", "12:00"]
    return finalTimes[mIdx] || "11:00"
  }
  if (rName.includes("vm") || rName.includes("vormittag") || rName.includes("best ball")) {
    const vmTimes = ["08:50", "09:00", "09:10", "09:20"]
    return vmTimes[mIdx] || "08:50"
  }
  if (match?.scheduledDate) {
    return new Date(match.scheduledDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  if (round?.startDate) {
    const baseDate = new Date(round.startDate)
    const matchDate = new Date(baseDate.getTime() + mIdx * 10 * 60 * 1000)
    return matchDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return "TEE"
}

// 2. MAIN STANDINGS (Exact TV Broadcast Layout from Screenshot)
export function RyderCupMainStandings({
  competition,
  selectedRoundFilter,
  onSelectMatch
}: {
  competition: any
  selectedRoundFilter: string
  onSelectMatch: (match: any, round: any) => void
}) {
  const { diamondTeam, heartsTeam } = calculateRyderCupPoints(competition)
  const rounds = competition.rounds || []

  // Filter rounds according to standard dropdown value
  const displayedRounds = rounds.filter((r: any) => {
    if (selectedRoundFilter === "TOTAL" || !selectedRoundFilter) return true
    if (selectedRoundFilter === "DAY_1") {
      return r.name.toLowerCase().includes("tag 1") || r.course?.name?.toLowerCase().includes("palma")
    }
    if (selectedRoundFilter === "DAY_2") {
      return r.name.toLowerCase().includes("tag 2") || r.course?.name?.toLowerCase().includes("gual")
    }
    if (selectedRoundFilter === "DAY_3") {
      return r.name.toLowerCase().includes("final") || r.name.toLowerCase().includes("tag 3") || r.course?.name?.toLowerCase().includes("calvia")
    }
    return r.id === selectedRoundFilter
  })

  if (displayedRounds.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
        Keine Runden für die gewählte Auswahl gefunden.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {displayedRounds.map((round: any) => {
        const matches = round.matches || []
        if (matches.length === 0) return null

        let rDiamondPts = 0
        let rHeartsPts = 0
        matches.forEach((m: any) => {
          const status = computeRyderCupStatus(m, round, competition, diamondTeam.id, heartsTeam.id)
          const weight = getRyderCupMatchWeight(m, round)
          if (status.isFinished) {
            if (status.lead > 0) rDiamondPts += weight
            else if (status.lead < 0) rHeartsPts += weight
            else {
              rDiamondPts += weight / 2
              rHeartsPts += weight / 2
            }
          }
        })

        const isRoundAnon = isRoundPairingsAnonymous(round)
        const showRoundStandings = selectedRoundFilter !== "TOTAL" && Boolean(selectedRoundFilter)

        return (
          <div 
            key={round.id} 
            className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden"
          >
            {/* Header Ribbon (Yellow/Gold bar from Screenshot) */}
            <div className="bg-[#f0cb46] text-slate-950 px-5 py-3 flex items-center justify-between font-black uppercase text-base sm:text-xl tracking-wider shadow-sm">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-slate-950" />
                <span>{round.name.toUpperCase()}</span>
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-normal normal-case">
                {round.course?.name} · {round.holesPlayed?.length || 18} Loch
              </div>
            </div>

            {/* Team Score Sub-Header (Only shown if a specific round/day is selected, skipped on 'All Rounds (Cum)') */}
            {showRoundStandings && (
              <div className="grid grid-cols-2 gap-2 sm:gap-4 p-2.5 sm:p-3 bg-stone-100 border-b border-stone-200">
                {/* Left: Diamonds */}
                <div className="flex items-stretch rounded-md overflow-hidden shadow-sm">
                  <div className="flex-1 bg-[#3765e9] text-white font-black text-xs sm:text-base py-2 px-3 uppercase tracking-wider flex items-center">
                    <span>♦ DIAMONDS</span>
                  </div>
                  <div className="bg-[#f0cb46] text-slate-950 font-black text-base sm:text-xl px-3 sm:px-4 py-2 min-w-[42px] sm:min-w-[52px] flex items-center justify-center">
                    {formatCupScore(rDiamondPts)}
                  </div>
                </div>

                {/* Right: Hearts */}
                <div className="flex items-stretch rounded-md overflow-hidden shadow-sm">
                  <div className="bg-[#f0cb46] text-slate-950 font-black text-base sm:text-xl px-3 sm:px-4 py-2 min-w-[42px] sm:min-w-[52px] flex items-center justify-center">
                    {formatCupScore(rHeartsPts)}
                  </div>
                  <div className="flex-1 bg-[#cb3838] text-white font-black text-xs sm:text-base py-2 px-3 uppercase tracking-wider flex items-center justify-end">
                    <span>HEARTS ♥</span>
                  </div>
                </div>
              </div>
            )}

            {/* 5-Column Match Rows (Clean White Design from Screenshot) */}
            <div className="divide-y divide-stone-200 bg-white">
              {matches.map((match: any, mIdx: number) => {
                const status = computeRyderCupStatus(match, round, competition, diamondTeam.id, heartsTeam.id)
                const isFinished = status.isFinished
                const lead = status.lead
                const holesPlayed = status.holesPlayed

                const diamondLead = lead > 0
                const heartsLead = lead < 0
                const isAllSquare = holesPlayed > 0 && lead === 0

                // Anonymize player names for Tag 1 NM and entire Tag 2
                const t1Names = isRoundAnon
                  ? (match.type === 'SINGLES' ? ['Spieler (TBD)'] : ['Spieler (TBD)', 'Spieler (TBD)'])
                  : status.team1Players.map((p: any) => p.userId ? p.user?.name : p.dummyName || "Spieler")
                
                const t2Names = isRoundAnon
                  ? (match.type === 'SINGLES' ? ['Spieler (TBD)'] : ['Spieler (TBD)', 'Spieler (TBD)'])
                  : status.team2Players.map((p: any) => p.userId ? p.user?.name : p.dummyName || "Spieler")

                const teeTime = getMatchTeeTime(match, round, mIdx)

                return (
                  <div
                    key={match.id}
                    onClick={isRoundAnon ? undefined : () => onSelectMatch(match, round)}
                    className={`flex items-stretch min-h-[50px] sm:min-h-[56px] hover:bg-stone-50 transition-colors select-none group ${
                      isRoundAnon ? "cursor-default" : "cursor-pointer"
                    }`}
                    title={isRoundAnon ? "Paarungen werden noch bekanntgegeben" : "Scorecard anzeigen"}
                  >
                    {/* Col 1: Left Standing (Diamond) */}
                    <div className="w-14 sm:w-20 shrink-0 flex items-center justify-center font-black text-xs sm:text-base">
                      {diamondLead ? (
                        <div className="w-full h-full bg-[#3765e9] text-white flex items-center justify-center font-black tracking-wider">
                          {status.statusText}
                        </div>
                      ) : isAllSquare ? (
                        <div className="w-full h-full bg-white text-slate-950 flex items-center justify-center font-black tracking-wider border-r border-stone-200">
                          A/S
                        </div>
                      ) : (
                        <div className="w-full h-full bg-white border-r border-stone-100" />
                      )}
                    </div>

                    {/* Col 2: Diamond Players (Clean: Without Handicap Allowances) */}
                    <div className={`flex-1 px-2 sm:px-4 py-2 flex flex-col justify-center items-end text-right min-w-0 transition-colors ${
                      diamondLead ? "bg-[#3765e9] text-white" : "bg-white text-slate-900"
                    }`}>
                      {t1Names.map((name: string, i: number) => (
                        <div key={i} className={`truncate uppercase font-black text-xs sm:text-sm tracking-tight leading-snug ${
                          diamondLead ? "text-white" : "text-slate-900"
                        }`}>
                          {name}
                        </div>
                      ))}
                    </div>

                    {/* Col 3: Center Status Box (Clean TV Style) */}
                    {isFinished ? (
                      <div className="w-12 sm:w-16 shrink-0 bg-[#f0cb46] text-slate-950 font-black flex items-center justify-center border-x border-amber-300 text-sm sm:text-lg">
                        <span>F</span>
                      </div>
                    ) : holesPlayed > 0 ? (
                      <div className="w-12 sm:w-16 shrink-0 bg-[#f0cb46] text-slate-950 font-black flex items-center justify-center border-x border-amber-300 text-sm sm:text-lg">
                        <span>{holesPlayed}</span>
                      </div>
                    ) : (
                      <div className="w-12 sm:w-16 shrink-0 bg-stone-200 text-stone-700 font-extrabold flex items-center justify-center border-x border-stone-300 text-xs sm:text-sm font-mono">
                        <span>{teeTime}</span>
                      </div>
                    )}

                    {/* Col 4: Hearts Players (Clean: Without Handicap Allowances) */}
                    <div className={`flex-1 px-2 sm:px-4 py-2 flex flex-col justify-center items-start text-left min-w-0 transition-colors ${
                      heartsLead ? "bg-[#cb3838] text-white" : "bg-white text-slate-900"
                    }`}>
                      {t2Names.map((name: string, i: number) => (
                        <div key={i} className={`truncate uppercase font-black text-xs sm:text-sm tracking-tight leading-snug ${
                          heartsLead ? "text-white" : "text-slate-900"
                        }`}>
                          {name}
                        </div>
                      ))}
                    </div>

                    {/* Col 5: Right Standing (Hearts) */}
                    <div className="w-14 sm:w-20 shrink-0 flex items-center justify-center font-black text-xs sm:text-base">
                      {heartsLead ? (
                        <div className="w-full h-full bg-[#cb3838] text-white flex items-center justify-center font-black tracking-wider">
                          {status.statusText}
                        </div>
                      ) : isAllSquare ? (
                        <div className="w-full h-full bg-white text-slate-950 flex items-center justify-center font-black tracking-wider border-l border-stone-200">
                          A/S
                        </div>
                      ) : (
                        <div className="w-full h-full bg-white border-l border-stone-100" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 3. MVP STANDINGS (Ranked by most team points)
export function RyderCupMvpStandings({ competition }: { competition: any }) {
  const { diamondTeam, sortedMvp } = calculateRyderCupPoints(competition)

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Award size={20} className="text-amber-500" />
            <span>MVP LEADERBOARD · MOST VALUABLE PLAYER</span>
          </h2>
          <p className="text-xs text-slate-500">Wer hat die meisten Punkte fürs Team geholt? (Sieg = 1.0 bzw. 0.5 im Einzel VM/NM, Geteilt = halbe Punkte).</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <th className="py-3 px-3">Rang</th>
              <th className="py-3 px-4">Spieler</th>
              <th className="py-3 px-3">Team</th>
              <th className="py-3 px-3 text-center">Matches</th>
              <th className="py-3 px-3 text-center">W - L - T</th>
              <th className="py-3 px-4 text-right font-black text-slate-900">Punkte fürs Team</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold">
            {sortedMvp.map((item, idx) => {
              const isDiamond = item.teamId === diamondTeam.id
              const name = item.participant.userId ? item.participant.user?.name : item.participant.dummyName || "Spieler"
              return (
                <tr key={item.participant.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-slate-500">
                    {idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : `${idx + 1}`}
                  </td>
                  <td className="py-3 px-4 text-slate-900 font-bold">
                    {name}
                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({item.participant.compHandicap})</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      isDiamond ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {isDiamond ? "♦ Diamond" : "♥ Hearts"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-700">{item.matches}</td>
                  <td className="py-3 px-3 text-center font-mono text-slate-600">
                    <span className="text-emerald-600 font-bold">{item.wins}</span> - <span className="text-red-600 font-bold">{item.losses}</span> - <span className="text-amber-600 font-bold">{item.ties}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm sm:text-base">
                    {formatCupScore(item.points)} Pkt
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// 4. DONUT STANDINGS (Ranked by FEWEST team points - opposite of MVP)
export function RyderCupDonutStandings({ competition }: { competition: any }) {
  const { diamondTeam, sortedDonuts } = calculateRyderCupPoints(competition)

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <span className="text-2xl">🍩</span>
            <span>DONUT-WERTUNG · DIE WENIGSTEN TEAM-PUNKTE</span>
          </h2>
          <p className="text-xs text-slate-500">
            Das Gegenteil vom MVP: Wer hat in den 5 Runden die wenigsten Punkte für sein Team geholt? 0 Punkte = Der absolute Donut-König 🍩👑.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <th className="py-3 px-3">Rang</th>
              <th className="py-3 px-4">Spieler</th>
              <th className="py-3 px-3">Team</th>
              <th className="py-3 px-3 text-center">Matches</th>
              <th className="py-3 px-3 text-center">W - L - T</th>
              <th className="py-3 px-4 text-right font-black text-pink-600">Punkte fürs Team</th>
              <th className="py-3 px-4 text-right">Donut-Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold">
            {sortedDonuts.map((item, idx) => {
              const isDiamond = item.teamId === diamondTeam.id
              const name = item.participant.userId ? item.participant.user?.name : item.participant.dummyName || "Spieler"
              const isDonutKing = idx === 0 && item.points === 0
              const isZero = item.points === 0

              return (
                <tr key={item.participant.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-slate-500">
                    {isDonutKing ? "🍩👑 1" : isZero ? `🍩 ${idx + 1}` : `${idx + 1}`}
                  </td>
                  <td className="py-3 px-4 text-slate-900 font-bold">
                    {name}
                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({item.participant.compHandicap})</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      isDiamond ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {isDiamond ? "♦ Diamond" : "♥ Hearts"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-700">{item.matches}</td>
                  <td className="py-3 px-3 text-center font-mono text-slate-600">
                    <span className="text-emerald-600 font-bold">{item.wins}</span> - <span className="text-red-600 font-bold">{item.losses}</span> - <span className="text-amber-600 font-bold">{item.ties}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-pink-600 text-sm sm:text-base">
                    {formatCupScore(item.points)} Pkt
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isDonutKing ? (
                      <span className="px-2.5 py-1 rounded-full bg-pink-100 text-pink-700 font-black border border-pink-300 text-[10px] sm:text-[11px] shadow-sm">
                        🍩 DONUT-KÖNIG (0 Pkt)
                      </span>
                    ) : isZero ? (
                      <span className="px-2.5 py-1 rounded-full bg-pink-50 text-pink-600 font-bold border border-pink-200 text-[10px] sm:text-[11px]">
                        🍩 0 Punkte
                      </span>
                    ) : item.points === 0.5 ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200 text-[10px]">
                        ½ Punkt
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs font-mono">
                        {formatCupScore(item.points)} Pkt
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
