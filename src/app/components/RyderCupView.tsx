"use client"

import React, { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Trophy, Share2, CheckCircle, RefreshCw, Calendar, 
  MapPin, Clock, Shield, Sparkles, ChevronRight, Award
} from "lucide-react"
import { MatchplayScorecardModal } from "./MatchplayScorecardModal"
import { 
  getPlayingHandicap, 
  getMatchAllowance, 
  getMatchHoleStrokesMap, 
  getCompactName, 
  parseHoleRange, 
  parseAllowancePercentage 
} from "../CompetitionClientView"

interface RyderCupViewProps {
  competition: any
  session: any
}

// Helper to format Ryder Cup score: 2.5 -> "2 ½", 0.5 -> "½", 0 -> "0", 3 -> "3"
export function formatCupScore(score: number): string {
  const whole = Math.floor(score)
  const remainder = score - whole
  if (remainder >= 0.75) return `${whole + 1}`
  if (remainder >= 0.25) return whole > 0 ? `${whole} ½` : `½`
  return `${whole}`
}

export function RyderCupView({ competition, session }: RyderCupViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  // Sub-tabs: 'MAIN' | 'MVP' | 'DONUTS'
  const [activeTab, setActiveTab] = useState<'MAIN' | 'MVP' | 'DONUTS'>('MAIN')
  // Selected Day/Session filter: 'ALL' | 'DAY_1' | 'DAY_2' | 'DAY_3' or round.id
  const [dayFilter, setDayFilter] = useState<string>("ALL")

  // Scorecard modal state
  const [selectedMatchForScorecard, setSelectedMatchForScorecard] = useState<any>(null)
  const [selectedMatchRoundForScorecard, setSelectedMatchRoundForScorecard] = useState<any>(null)

  const handleRefresh = () => {
    setManualRefreshing(true)
    startTransition(() => {
      router.refresh()
    })
    setTimeout(() => {
      setManualRefreshing(false)
    }, 600)
  }

  const isRefreshing = isPending || manualRefreshing

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
        .then(() => {
          setShareCopied(true)
          setTimeout(() => setShareCopied(false), 2000)
        })
        .catch(err => console.error("Could not copy URL: ", err))
    }
  }

  // Identify Teams
  const teams = competition.teams || []
  const diamondTeam = teams.find((t: any) => t.name.toLowerCase().includes("diamond") || t.color === "blue") || teams[0] || { name: "Team Diamond", color: "blue" }
  const heartsTeam = teams.find((t: any) => t.name.toLowerCase().includes("heart") || t.color === "red") || teams[1] || { name: "Team Hearts", color: "red" }

  // Status calculation for each match
  const computeMatchplayStatus = (match: any, round: any) => {
    const isTeamMatchplay = match.type === 'TEAM_MATCHPLAY' || match.type === 'CHAPMAN' || (match.matchPlayers && match.matchPlayers.length === 4)

    const getPlayerMPAllowance = (pId: string, defVal: number) => {
      const mp = match.matchPlayers?.find((x: any) => x.participantId === pId)
      if (mp && mp.handicapAllowance !== null && mp.handicapAllowance !== undefined) {
        return mp.handicapAllowance
      }
      return defVal
    }

    const allNames = (competition.participants || []).map((p: any) =>
      p.userId ? p.user?.name : p.dummyName
    ).filter((n: any): n is string => typeof n === 'string' && n.length > 0)

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
          team2Allowance: [0, 0]
        }
      }

      // Group into Diamond and Hearts
      let t1Players = players.filter((p: any) => p.teamId === diamondTeam.id)
      let t2Players = players.filter((p: any) => p.teamId === heartsTeam.id)

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

        const s1_1 = t1Players[0].scores?.find((s: any) => s.holeNumber === holeNum && s.roundId === round.id)
        const s1_2 = t1Players[1].scores?.find((s: any) => s.holeNumber === holeNum && s.roundId === round.id)
        const s2_1 = t2Players[0].scores?.find((s: any) => s.holeNumber === holeNum && s.roundId === round.id)
        const s2_2 = t2Players[1].scores?.find((s: any) => s.holeNumber === holeNum && s.roundId === round.id)

        const gross1_1 = getMatchHoleStrokes(s1_1)
        const gross1_2 = getMatchHoleStrokes(s1_2)
        const gross2_1 = getMatchHoleStrokes(s2_1)
        const gross2_2 = getMatchHoleStrokes(s2_2)

        const t1Played = (gross1_1 !== null && gross1_1 !== undefined) || (gross1_2 !== null && gross1_2 !== undefined)
        const t2Played = (gross2_1 !== null && gross2_1 !== undefined) || (gross2_2 !== null && gross2_2 !== undefined)

        if (!t1Played && !t2Played) continue

        holesPlayedCount++

        const net1_1 = gross1_1 !== null ? (gross1_1 === 99 ? 99 : gross1_1 - (strokesMap1_1[holeNum] || 0)) : 99
        const net1_2 = gross1_2 !== null ? (gross1_2 === 99 ? 99 : gross1_2 - (strokesMap1_2[holeNum] || 0)) : 99
        const net2_1 = gross2_1 !== null ? (gross2_1 === 99 ? 99 : gross2_1 - (strokesMap2_1[holeNum] || 0)) : 99
        const net2_2 = gross2_2 !== null ? (gross2_2 === 99 ? 99 : gross2_2 - (strokesMap2_2[holeNum] || 0)) : 99

        const best1 = Math.min(net1_1, net1_2)
        const best2 = Math.min(net2_1, net2_2)

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
        if (decidedInfo) statusText = decidedInfo
        else if (isFinished) statusText = `${lead} UP`
        else statusText = `${lead} UP`
      } else if (lead < 0) {
        const absLead = Math.abs(lead)
        if (decidedInfo) statusText = decidedInfo
        else if (isFinished) statusText = `${absLead} UP`
        else statusText = `${absLead} UP`
      } else {
        statusText = holesPlayedCount > 0 ? "A/S" : "-"
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
      // Singles matchplay
      const pIds = match.matchPlayers.map((mp: any) => mp.participantId)
      const players = pIds.map((id: string) => competition.participants.find((p: any) => p.id === id)).filter(Boolean)

      if (players.length < 2) {
        return {
          statusText: "Setup Pending",
          holesPlayed: 0,
          totalHoles: 18,
          lead: 0,
          isFinished: false,
          isTeamMatchplay: false,
          team1Players: [],
          team2Players: [],
          team1Allowance: [0],
          team2Allowance: [0]
        }
      }

      let p1 = players.find((p: any) => p.teamId === diamondTeam.id) || players[0]
      let p2 = players.find((p: any) => p.teamId === heartsTeam.id) || players[1]

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

        const sD = p1.scores?.find((s: any) => s.holeNumber === holeNum && s.roundId === round.id)
        const sH = p2.scores?.find((s: any) => s.holeNumber === holeNum && s.roundId === round.id)

        const grossD = getMatchHoleStrokes(sD)
        const grossH = getMatchHoleStrokes(sH)

        if ((grossD === null || grossD === undefined) && (grossH === null || grossH === undefined)) continue

        holesPlayedCount++

        const netD = grossD !== null ? (grossD === 99 ? 99 : grossD - (strokesMapD[holeNum] || 0)) : 99
        const netH = grossH !== null ? (grossH === 99 ? 99 : grossH - (strokesMapH[holeNum] || 0)) : 99

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
        if (decidedInfo) statusText = decidedInfo
        else if (isFinished) statusText = `${lead} UP`
        else statusText = `${lead} UP`
      } else if (lead < 0) {
        const absLead = Math.abs(lead)
        if (decidedInfo) statusText = decidedInfo
        else if (isFinished) statusText = `${absLead} UP`
        else statusText = `${absLead} UP`
      } else {
        statusText = holesPlayedCount > 0 ? "A/S" : "-"
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

  // Weight of match points: 0.5 for singles in VM/NM, 1.0 for all others
  const getMatchWeight = (match: any, round: any) => {
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

  // Calculate Cup Points for Diamonds and Hearts
  let diamondPoints = 0
  let heartsPoints = 0
  let liveDiamondPoints = 0
  let liveHeartsPoints = 0

  const allMatchesList: { round: any; match: any; status: any; weight: number }[] = []

  const rounds = competition.rounds || []
  rounds.forEach((r: any) => {
    (r.matches || []).forEach((m: any) => {
      const status = computeMatchplayStatus(m, r)
      const weight = getMatchWeight(m, r)
      allMatchesList.push({ round: r, match: m, status, weight })

      if (status.isFinished) {
        if (status.lead > 0) diamondPoints += weight
        else if (status.lead < 0) heartsPoints += weight
        else {
          diamondPoints += weight / 2
          heartsPoints += weight / 2
        }
      } else if (status.holesPlayed > 0) {
        // Live projected points
        if (status.lead > 0) liveDiamondPoints += weight
        else if (status.lead < 0) liveHeartsPoints += weight
        else {
          liveDiamondPoints += weight / 2
          liveHeartsPoints += weight / 2
        }
      }
    })
  })

  // Filter rounds by selected Day/Session
  const displayedRounds = rounds.filter((r: any) => {
    if (dayFilter === "ALL") return true
    if (dayFilter === "DAY_1") {
      return r.name.toLowerCase().includes("tag 1") || r.course?.name?.toLowerCase().includes("palma")
    }
    if (dayFilter === "DAY_2") {
      return r.name.toLowerCase().includes("tag 2") || r.course?.name?.toLowerCase().includes("gual")
    }
    if (dayFilter === "DAY_3") {
      return r.name.toLowerCase().includes("final") || r.name.toLowerCase().includes("tag 3") || r.course?.name?.toLowerCase().includes("calvia")
    }
    return r.id === dayFilter
  })

  // Calculate MVP Stats across all matches
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

  allMatchesList.forEach(({ match, status, weight }) => {
    if (!status.isFinished && status.holesPlayed === 0) return

    const dPlayerIds = status.team1Players.map((p: any) => p.id)
    const hPlayerIds = status.team2Players.map((p: any) => p.id)

    const isFinished = status.isFinished
    const lead = status.lead

    dPlayerIds.forEach((id: string) => {
      if (mvpStats[id]) {
        if (isFinished) {
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
      }
    })

    hPlayerIds.forEach((id: string) => {
      if (mvpStats[id]) {
        if (isFinished) {
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
      }
    })
  })

  // MVP: Most points first
  const sortedMvp = Object.values(mvpStats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.matches - b.matches
  })

  // Donut-Wertung: Das GEGENTEIL von MVP!
  // Wer hat die WENIGSTEN Punkte fürs Team in den 5 Runden geholt? (0 Punkte = absoluter Donut 🍩)
  const sortedDonuts = Object.values(mvpStats).sort((a, b) => {
    if (a.points !== b.points) return a.points - b.points // Wenigste Punkte zuerst!
    if (b.losses !== a.losses) return b.losses - a.losses // Meiste Niederlagen zuerst
    return b.matches - a.matches // Meiste gespielte Matches zuerst
  })

  return (
    <div 
      className="min-h-screen text-slate-100 bg-cover bg-center bg-fixed relative selection:bg-blue-600 selection:text-white"
      style={{
        backgroundImage: `url(${competition.bgImage || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRP_5PoMe0NfOTIWvIbvLl_I24sZrPNxtPtFi3Q1PdsVauPMf0NqqSBr2w&s=10"})`
      }}
    >
      {/* Dark frosted glass overlay */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6">

        {/* Top Controls / App Header */}
        <div className="flex items-center justify-between bg-slate-900/80 backdrop-blur-lg border border-slate-800/80 rounded-2xl p-3 sm:p-4 shadow-2xl">
          <div className="flex items-center space-x-3">
            <Link 
              href="/"
              className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 hover:text-white transition-all border border-slate-700/50"
              title="Home"
            >
              <Trophy size={18} className="text-amber-400" />
            </Link>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-wide uppercase text-white flex items-center gap-2">
                <span>{competition.name}</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-400/30">
                  {competition.uniqueSlug}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">18. – 21. Dez 2026 · Mallorca (T-Palma · Son Gual · T-Calviá)</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleShare}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-all shadow-sm flex items-center gap-1.5 text-xs font-semibold"
              title="Share"
            >
              {shareCopied ? <CheckCircle size={15} className="text-emerald-400 animate-pulse" /> : <Share2 size={15} />}
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-all shadow-sm"
              title="Refresh"
            >
              <RefreshCw size={15} className={isRefreshing ? "animate-spin text-amber-400" : ""} />
            </button>
            {session?.user && (
              <Link
                href={`/admin/competitions/${competition.id}`}
                className="p-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl border border-amber-500/40 transition-all shadow-sm text-xs font-bold"
                title="Admin Settings"
              >
                Admin
              </Link>
            )}
          </div>
        </div>

        {/* HERO RYDER CUP BANNER */}
        <div className="bg-gradient-to-b from-slate-900/90 via-slate-900/95 to-slate-950/95 rounded-3xl border border-slate-800/90 shadow-2xl overflow-hidden backdrop-blur-xl">
          
          {/* Top Gold Ribbon */}
          <div className="bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 text-slate-950 font-black tracking-widest text-center py-2 text-xs sm:text-sm uppercase shadow-md flex items-center justify-center gap-2">
            <Sparkles size={16} className="text-slate-900" />
            <span>THE REAL RYDER CUP · OFFICIAL SCOREBOARD</span>
            <Sparkles size={16} className="text-slate-900" />
          </div>

          {/* Main Team Standings Banner */}
          <div className="p-4 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4 sm:gap-6">
              
              {/* Team Diamond (Blue) */}
              <div className="flex items-center justify-between md:justify-end gap-4 bg-gradient-to-r from-blue-950/90 to-blue-900/90 p-4 sm:p-5 rounded-2xl border-2 border-blue-500/50 shadow-lg shadow-blue-950/50">
                <div className="text-left md:text-right">
                  <div className="flex items-center md:justify-end gap-1.5 text-blue-400 font-extrabold text-sm tracking-wider uppercase">
                    <span className="text-lg">♦</span>
                    <span>TEAM DIAMOND</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium">7 Spieler · Blau</div>
                </div>
                <div className="bg-blue-600 text-white font-black text-3xl sm:text-4xl min-w-[70px] sm:min-w-[84px] h-[58px] sm:h-[68px] rounded-xl flex items-center justify-center shadow-inner tracking-wider border border-blue-400/40">
                  {formatCupScore(diamondPoints)}
                </div>
              </div>

              {/* Center Logo & Match Status */}
              <div className="flex flex-col items-center justify-center text-center order-first md:order-none py-2 px-1">
                <div className="relative group">
                  {/* Outer Golden Glow Aura */}
                  <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-600 opacity-75 blur-md group-hover:opacity-100 transition duration-300"></div>

                  <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-amber-400 shadow-2xl bg-slate-950 flex items-center justify-center p-1">
                    <img 
                      src="/trrc.jpg" 
                      alt="TRRC Logo" 
                      className="w-full h-full object-cover object-center rounded-full group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                  </div>
                  <div className="absolute -bottom-3 inset-x-0 mx-auto w-max px-3.5 py-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 text-[11px] font-black uppercase tracking-wider rounded-full shadow-lg border border-amber-200">
                    TRRC 2026
                  </div>
                </div>

                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/90 border border-amber-400/50 text-[12px] text-slate-200 font-semibold shadow-inner">
                  <span className="text-amber-400 font-extrabold tracking-wide">🏆 11 PKT ZUM SIEG</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-300 font-medium">21 Gesamt</span>
                </div>
              </div>

              {/* Team Hearts (Red) */}
              <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-red-900/90 to-red-950/90 p-4 sm:p-5 rounded-2xl border-2 border-red-500/50 shadow-lg shadow-red-950/50">
                <div className="bg-red-600 text-white font-black text-3xl sm:text-4xl min-w-[70px] sm:min-w-[84px] h-[58px] sm:h-[68px] rounded-xl flex items-center justify-center shadow-inner tracking-wider border border-red-400/40 order-last md:order-first">
                  {formatCupScore(heartsPoints)}
                </div>
                <div className="text-right md:text-left">
                  <div className="flex items-center md:justify-start justify-end gap-1.5 text-red-400 font-extrabold text-sm tracking-wider uppercase">
                    <span>TEAM HEARTS</span>
                    <span className="text-lg">♥</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium">7 Spieler · Rot</div>
                </div>
              </div>

            </div>

            {/* Cup Progress Bar */}
            <div className="mt-6 pt-5 border-t border-slate-800/80">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-2">
                <span className="text-blue-400 flex items-center gap-1">
                  <span>♦ Diamond:</span>
                  <span className="text-white font-mono">{diamondPoints} Pkt</span>
                </span>
                <span className="text-amber-400/90 font-mono text-[11px]">
                  {21 - (diamondPoints + heartsPoints)} Punkte noch offen
                </span>
                <span className="text-red-400 flex items-center gap-1">
                  <span className="text-white font-mono">{heartsPoints} Pkt</span>
                  <span>:Hearts ♥</span>
                </span>
              </div>

              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex p-0.5 border border-slate-800">
                <div 
                  className="bg-blue-600 rounded-l-full transition-all duration-500" 
                  style={{ width: `${(diamondPoints / 21) * 100}%` }}
                />
                <div 
                  className="bg-slate-800 transition-all duration-500 flex-1"
                />
                <div 
                  className="bg-red-600 rounded-r-full transition-all duration-500" 
                  style={{ width: `${(heartsPoints / 21) * 100}%` }}
                />
              </div>
            </div>

          </div>
        </div>

        {/* NAVIGATION & FILTER CONTROLS BAR */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Left: Quick Day Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
              Filter:
            </span>
            <button
              onClick={() => setDayFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dayFilter === "ALL"
                  ? "bg-amber-400 text-slate-950 shadow-md"
                  : "bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800"
              }`}
            >
              Alle Spieltage
            </button>
            <button
              onClick={() => setDayFilter("DAY_1")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dayFilter === "DAY_1"
                  ? "bg-amber-400 text-slate-950 shadow-md"
                  : "bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800"
              }`}
            >
              Tag 1 (Sa · Palma)
            </button>
            <button
              onClick={() => setDayFilter("DAY_2")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dayFilter === "DAY_2"
                  ? "bg-amber-400 text-slate-950 shadow-md"
                  : "bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800"
              }`}
            >
              Tag 2 (So · Son Gual)
            </button>
            <button
              onClick={() => setDayFilter("DAY_3")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dayFilter === "DAY_3"
                  ? "bg-amber-400 text-slate-950 shadow-md"
                  : "bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800"
              }`}
            >
              Tag 3 (Mo · Calviá)
            </button>
          </div>

          {/* Right: Sub-Leaderboard Tabs (Main Standings, MVP, Donuts) */}
          <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 self-center sm:self-auto w-full sm:w-auto justify-center">
            <button
              onClick={() => setActiveTab('MAIN')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'MAIN'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Main Standings
            </button>
            <button
              onClick={() => setActiveTab('MVP')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'MVP'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              MVP Wertung
            </button>
            <button
              onClick={() => setActiveTab('DONUTS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'DONUTS'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🍩 Donut-Wertung
            </button>
          </div>

        </div>

        {/* TAB CONTENT: 1. MAIN STANDINGS (RYDER CUP BROADCAST BOARD) */}
        {activeTab === 'MAIN' && (
          <div className="space-y-8">
            {displayedRounds.map((round: any) => {
              const matches = round.matches || []
              if (matches.length === 0) return null

              // Calculate session score
              let rDiamondPts = 0
              let rHeartsPts = 0
              matches.forEach((m: any) => {
                const status = computeMatchplayStatus(m, round)
                const weight = getMatchWeight(m, round)
                if (status.isFinished) {
                  if (status.lead > 0) rDiamondPts += weight
                  else if (status.lead < 0) rHeartsPts += weight
                  else {
                    rDiamondPts += weight / 2
                    rHeartsPts += weight / 2
                  }
                }
              })

              return (
                <div 
                  key={round.id} 
                  className="bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
                >
                  {/* Session Header Banner (Yellow/Gold Bar from Ryder Cup Broadcast) */}
                  <div className="bg-[#f0cb46] text-slate-950 px-5 sm:px-6 py-3.5 flex items-center justify-between font-black uppercase text-base sm:text-xl tracking-wider shadow-sm">
                    <div className="flex items-center gap-2">
                      <Calendar size={18} className="text-slate-950" />
                      <span>{round.name.toUpperCase()}</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-normal normal-case">
                      {round.course?.name} · {round.holesPlayed?.length || 18} Loch
                    </div>
                  </div>

                  {/* Team Sub-Header (EUROPE 6 | 6 UNITED STATES Style) */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-4 p-2 sm:p-3 bg-stone-100 border-b border-stone-200">
                    {/* Left: Diamond */}
                    <div className="flex items-stretch rounded-md overflow-hidden shadow-sm">
                      <div className="flex-1 bg-[#3765e9] text-white font-black text-xs sm:text-lg py-2 px-3 sm:px-4 uppercase tracking-wider flex items-center">
                        <span>♦ DIAMONDS</span>
                      </div>
                      <div className="bg-[#f0cb46] text-slate-950 font-black text-base sm:text-2xl px-3 sm:px-5 py-2 min-w-[42px] sm:min-w-[56px] flex items-center justify-center">
                        {formatCupScore(rDiamondPts)}
                      </div>
                    </div>

                    {/* Right: Hearts */}
                    <div className="flex items-stretch rounded-md overflow-hidden shadow-sm">
                      <div className="bg-[#f0cb46] text-slate-950 font-black text-base sm:text-2xl px-3 sm:px-5 py-2 min-w-[42px] sm:min-w-[56px] flex items-center justify-center">
                        {formatCupScore(rHeartsPts)}
                      </div>
                      <div className="flex-1 bg-[#cb3838] text-white font-black text-xs sm:text-lg py-2 px-3 sm:px-4 uppercase tracking-wider flex items-center justify-end">
                        <span>HEARTS ♥</span>
                      </div>
                    </div>
                  </div>

                  {/* Matches List (Clean Broadcast Rows with 5 Columns) */}
                  <div className="divide-y divide-stone-200 bg-white">
                    {matches.map((match: any, mIdx: number) => {
                      const status = computeMatchplayStatus(match, round)
                      const weight = getMatchWeight(match, round)
                      const isFinished = status.isFinished
                      const lead = status.lead
                      const holesPlayed = status.holesPlayed

                      const diamondLead = lead > 0
                      const heartsLead = lead < 0
                      const isAllSquare = holesPlayed > 0 && lead === 0

                      const t1Names = status.team1Players.map((p: any) => p.userId ? p.user?.name : p.dummyName || "Spieler")
                      const t2Names = status.team2Players.map((p: any) => p.userId ? p.user?.name : p.dummyName || "Spieler")

                      return (
                        <div
                          key={match.id}
                          onClick={() => {
                            setSelectedMatchForScorecard(match)
                            setSelectedMatchRoundForScorecard(round)
                          }}
                          className="flex items-stretch min-h-[50px] sm:min-h-[56px] hover:bg-stone-50 transition-colors cursor-pointer select-none group"
                        >
                          {/* Col 1: Left Score / Lead (Diamond) */}
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

                          {/* Col 2: Diamond Players */}
                          <div className="flex-1 px-2 sm:px-4 py-2 flex flex-col justify-center items-end text-right min-w-0">
                            {t1Names.map((name: string, i: number) => (
                              <div key={i} className="truncate uppercase font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors text-xs sm:text-sm tracking-tight leading-snug">
                                {name}
                                {status.team1Allowance[i] > 0 && (
                                  <span className="ml-1 text-[10px] font-mono text-blue-600 font-bold">
                                    (+{status.team1Allowance[i]})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Col 3: Center Status Box (Gold #f0cb46) */}
                          <div className="w-12 sm:w-16 shrink-0 bg-[#f0cb46] text-slate-950 font-black flex flex-col items-center justify-center border-x border-amber-300">
                            <span className="text-xs sm:text-base tracking-wider leading-none">
                              {isFinished ? "F" : holesPlayed > 0 ? `${holesPlayed}` : "0"}
                            </span>
                            <span className="text-[8px] sm:text-[9px] font-mono tracking-tighter uppercase opacity-80 mt-0.5 leading-none">
                              {isFinished ? "FINAL" : holesPlayed > 0 ? `L${holesPlayed}` : (
                                match.scheduledDate 
                                  ? new Date(match.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : "TEE 1"
                              )}
                            </span>
                            {weight < 1.0 && (
                              <span className="text-[8px] bg-slate-950 text-amber-300 px-1 rounded-sm mt-0.5 leading-none">
                                0.5 PT
                              </span>
                            )}
                          </div>

                          {/* Col 4: Hearts Players */}
                          <div className="flex-1 px-2 sm:px-4 py-2 flex flex-col justify-center items-start text-left min-w-0">
                            {t2Names.map((name: string, i: number) => (
                              <div key={i} className="truncate uppercase font-extrabold text-slate-900 group-hover:text-red-700 transition-colors text-xs sm:text-sm tracking-tight leading-snug">
                                {name}
                                {status.team2Allowance[i] > 0 && (
                                  <span className="ml-1 text-[10px] font-mono text-red-600 font-bold">
                                    (+{status.team2Allowance[i]})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Col 5: Right Score / Lead (Hearts) */}
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
        )}

        {/* TAB CONTENT: 2. MVP WERTUNG (MOST TEAM POINTS) */}
        {activeTab === 'MVP' && (
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/90 shadow-2xl overflow-hidden p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Award size={20} className="text-amber-400" />
                  <span>MVP LEADERBOARD · MOST VALUABLE PLAYER</span>
                </h2>
                <p className="text-xs text-slate-400">Wer hat die meisten Punkte fürs Team geholt? (Sieg = 1.0 bzw. 0.5 im Einzel VM/NM, Geteilt = halbe Punkte).</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <th className="py-3 px-3">Rang</th>
                    <th className="py-3 px-4">Spieler</th>
                    <th className="py-3 px-3">Team</th>
                    <th className="py-3 px-3 text-center">Matches</th>
                    <th className="py-3 px-3 text-center">W - L - T</th>
                    <th className="py-3 px-4 text-right font-black text-amber-400">Punkte fürs Team</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-semibold">
                  {sortedMvp.map((item, idx) => {
                    const isDiamond = item.teamId === diamondTeam.id
                    const name = item.participant.userId ? item.participant.user?.name : item.participant.dummyName || "Spieler"
                    return (
                      <tr key={item.participant.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-400">
                          {idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : `${idx + 1}`}
                        </td>
                        <td className="py-3 px-4 text-white font-bold">
                          {name}
                          <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({item.participant.compHandicap})</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            isDiamond ? 'bg-blue-900/60 text-blue-300 border border-blue-500/30' : 'bg-red-900/60 text-red-300 border border-red-500/30'
                          }`}>
                            {isDiamond ? "♦ Diamond" : "♥ Hearts"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{item.matches}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">
                          <span className="text-emerald-400 font-bold">{item.wins}</span> - <span className="text-red-400 font-bold">{item.losses}</span> - <span className="text-amber-400 font-bold">{item.ties}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-amber-400 text-sm sm:text-base">
                          {formatCupScore(item.points)} Pkt
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 3. DONUT-WERTUNG (GEGENTEIL VON MVP: WENIGSTE TEAMPUNKTE) */}
        {activeTab === 'DONUTS' && (
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/90 shadow-2xl overflow-hidden p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span className="text-2xl">🍩</span>
                  <span>DONUT-WERTUNG · DIE WENIGSTEN TEAM-PUNKTE</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Das Gegenteil vom MVP: Wer hat in den 5 Runden die wenigsten Punkte für sein Team geholt? 0 Punkte = Der absolute Donut-König 🍩👑.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <th className="py-3 px-3">Rang</th>
                    <th className="py-3 px-4">Spieler</th>
                    <th className="py-3 px-3">Team</th>
                    <th className="py-3 px-3 text-center">Matches</th>
                    <th className="py-3 px-3 text-center">W - L - T</th>
                    <th className="py-3 px-4 text-right font-black text-pink-400">Punkte fürs Team</th>
                    <th className="py-3 px-4 text-right">Donut-Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-semibold">
                  {sortedDonuts.map((item, idx) => {
                    const isDiamond = item.teamId === diamondTeam.id
                    const name = item.participant.userId ? item.participant.user?.name : item.participant.dummyName || "Spieler"
                    const isDonutKing = idx === 0 && item.points === 0
                    const isZero = item.points === 0

                    return (
                      <tr key={item.participant.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-400">
                          {isDonutKing ? "🍩👑 1" : isZero ? `🍩 ${idx + 1}` : `${idx + 1}`}
                        </td>
                        <td className="py-3 px-4 text-white font-bold">
                          {name}
                          <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({item.participant.compHandicap})</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            isDiamond ? 'bg-blue-900/60 text-blue-300 border border-blue-500/30' : 'bg-red-900/60 text-red-300 border border-red-500/30'
                          }`}>
                            {isDiamond ? "♦ Diamond" : "♥ Hearts"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{item.matches}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">
                          <span className="text-emerald-400 font-bold">{item.wins}</span> - <span className="text-red-400 font-bold">{item.losses}</span> - <span className="text-amber-400 font-bold">{item.ties}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-pink-400 text-sm sm:text-base">
                          {formatCupScore(item.points)} Pkt
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isDonutKing ? (
                            <span className="px-2.5 py-1 rounded-full bg-pink-500/20 text-pink-300 font-black border border-pink-500/40 text-[10px] sm:text-[11px] shadow-sm animate-pulse">
                              🍩 DONUT-KÖNIG (0 Pkt)
                            </span>
                          ) : isZero ? (
                            <span className="px-2.5 py-1 rounded-full bg-pink-500/10 text-pink-400 font-bold border border-pink-500/30 text-[10px] sm:text-[11px]">
                              🍩 0 Punkte
                            </span>
                          ) : item.points === 0.5 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/30 text-[10px]">
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
        )}

      </div>

      {/* Matchplay Scorecard Modal */}
      {selectedMatchForScorecard && selectedMatchRoundForScorecard && (
        <MatchplayScorecardModal
          selectedMatchForScorecard={selectedMatchForScorecard}
          selectedMatchRoundForScorecard={selectedMatchRoundForScorecard}
          competition={competition}
          onClose={() => {
            setSelectedMatchForScorecard(null)
            setSelectedMatchRoundForScorecard(null)
          }}
          computeMatchplayStatus={computeMatchplayStatus}
          onShare={handleShare}
          shareCopied={shareCopied}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      )}
    </div>
  )
}
