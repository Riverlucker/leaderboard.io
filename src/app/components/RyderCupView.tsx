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

  // Sub-tabs: 'MATCHES' | 'MVP' | 'DONUTS'
  const [activeTab, setActiveTab] = useState<'MATCHES' | 'MVP' | 'DONUTS'>('MATCHES')

  // Selected Round filter: 'OVERALL' or round.id
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>("OVERALL")

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

      let lead = 0
      let holesPlayedCount = 0
      let decidedInfo: { winnerTeam: string; lead: number; remaining: number } | null = null

      for (let i = 0; i < matchHoles.length; i++) {
        const holeNum = matchHoles[i]
        const hole = round.course.holes.find((h: any) => h.number === holeNum)
        if (!hole) continue

        const score1_1 = t1Players[0].scores?.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
        const score1_2 = t1Players[1].scores?.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
        const score2_1 = t2Players[0].scores?.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
        const score2_2 = t2Players[1].scores?.find((s: any) => s.roundId === round.id && s.holeId === hole.id)

        const str1_1 = getMatchHoleStrokes(score1_1)
        const str1_2 = getMatchHoleStrokes(score1_2)
        const str2_1 = getMatchHoleStrokes(score2_1)
        const str2_2 = getMatchHoleStrokes(score2_2)

        const net1_1 = str1_1 !== null ? str1_1 - (strokesMap1_1[hole.number] || 0) : null
        const net1_2 = str1_2 !== null ? str1_2 - (strokesMap1_2[hole.number] || 0) : null
        const net2_1 = str2_1 !== null ? str2_1 - (strokesMap2_1[hole.number] || 0) : null
        const net2_2 = str2_2 !== null ? str2_2 - (strokesMap2_2[hole.number] || 0) : null

        const validTeam1 = [net1_1, net1_2].filter((v): v is number => v !== null)
        const validTeam2 = [net2_1, net2_2].filter((v): v is number => v !== null)

        if (validTeam1.length > 0 && validTeam2.length > 0) {
          holesPlayedCount++
          const best1 = Math.min(...validTeam1)
          const best2 = Math.min(...validTeam2)
          if (best1 < best2) lead++
          else if (best2 < best1) lead--

          const remaining = matchHoles.length - (i + 1)
          if (Math.abs(lead) > remaining && decidedInfo === null && !match.playUntilEnd) {
            decidedInfo = {
              winnerTeam: lead > 0 ? "DIAMOND" : "HEARTS",
              lead: Math.abs(lead),
              remaining
            }
          }
        }
      }

      let statusDisplay = ""
      const isFinished = decidedInfo !== null || (holesPlayedCount === matchHoles.length && matchHoles.length > 0)

      if (holesPlayedCount === 0) {
        statusDisplay = match.scheduledDate 
          ? new Date(match.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : "Tee Time"
      } else if (decidedInfo !== null) {
        statusDisplay = `${decidedInfo.lead}&${decidedInfo.remaining}`
      } else if (isFinished) {
        statusDisplay = lead === 0 ? "A/S" : `${Math.abs(lead)} UP`
      } else {
        statusDisplay = lead === 0 ? "A/S" : `${Math.abs(lead)} UP`
      }

      return {
        statusText: statusDisplay,
        holesPlayed: holesPlayedCount,
        totalHoles: matchHoles.length,
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
      // Singles match
      const p1 = competition.participants.find((p: any) => p.id === match.matchPlayers?.[0]?.participantId)
      const p2 = competition.participants.find((p: any) => p.id === match.matchPlayers?.[1]?.participantId)

      if (!p1 || !p2) {
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

      // Determine who belongs to Diamond vs Hearts
      const diamondP = p1.teamId === diamondTeam.id ? p1 : p2
      const heartsP = p1.teamId === diamondTeam.id ? p2 : p1

      const hcpD = getPlayingHandicap(diamondP, round)
      const hcpH = getPlayingHandicap(heartsP, round)

      const allowance = getMatchAllowance(match, hcpD, hcpH)
      const allowD = getPlayerMPAllowance(diamondP.id, hcpD > hcpH ? allowance : 0)
      const allowH = getPlayerMPAllowance(heartsP.id, hcpH > hcpD ? allowance : 0)

      const roundHoles = round.holesPlayed && round.holesPlayed.length > 0
        ? [...round.holesPlayed].sort((a: number, b: number) => a - b)
        : Array.from({ length: 18 }, (_, i) => i + 1)
      const matchHoles = parseHoleRange(match.holeRange, roundHoles)

      const strokesMapD = getMatchHoleStrokesMap(matchHoles, round, allowD)
      const strokesMapH = getMatchHoleStrokesMap(matchHoles, round, allowH)

      const getMatchHoleStrokes = (score: any) => {
        if (!score) return null
        if (score.status === 'WIPED') return 99
        if (score.status === 'NOT_PLAYED') return null
        return score.grossStrokes
      }

      let lead = 0 // > 0 means Diamond lead, < 0 means Hearts lead
      let holesPlayedCount = 0
      let decidedInfo: { winnerTeam: string; lead: number; remaining: number } | null = null

      for (let i = 0; i < matchHoles.length; i++) {
        const holeNum = matchHoles[i]
        const hole = round.course.holes.find((h: any) => h.number === holeNum)
        if (!hole) continue

        const scoreD = diamondP.scores?.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
        const scoreH = heartsP.scores?.find((s: any) => s.roundId === round.id && s.holeId === hole.id)

        const strD = getMatchHoleStrokes(scoreD)
        const strH = getMatchHoleStrokes(scoreH)

        const netD = strD !== null ? strD - (strokesMapD[hole.number] || 0) : null
        const netH = strH !== null ? strH - (strokesMapH[hole.number] || 0) : null

        if (netD !== null && netH !== null) {
          holesPlayedCount++
          if (netD < netH) lead++
          else if (netH < netD) lead--

          const remaining = matchHoles.length - (i + 1)
          if (Math.abs(lead) > remaining && decidedInfo === null && !match.playUntilEnd) {
            decidedInfo = {
              winnerTeam: lead > 0 ? "DIAMOND" : "HEARTS",
              lead: Math.abs(lead),
              remaining
            }
          }
        }
      }

      let statusDisplay = ""
      const isFinished = decidedInfo !== null || (holesPlayedCount === matchHoles.length && matchHoles.length > 0)

      if (holesPlayedCount === 0) {
        statusDisplay = match.scheduledDate 
          ? new Date(match.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : "Tee Time"
      } else if (decidedInfo !== null) {
        statusDisplay = `${decidedInfo.lead}&${decidedInfo.remaining}`
      } else if (isFinished) {
        statusDisplay = lead === 0 ? "A/S" : `${Math.abs(lead)} UP`
      } else {
        statusDisplay = lead === 0 ? "A/S" : `${Math.abs(lead)} UP`
      }

      return {
        statusText: statusDisplay,
        holesPlayed: holesPlayedCount,
        totalHoles: matchHoles.length,
        lead,
        isFinished,
        isTeamMatchplay: false,
        team1Players: [diamondP],
        team2Players: [heartsP],
        team1Allowance: [allowD],
        team2Allowance: [allowH],
        decidedInfo
      }
    }
  }

  // Weight of match points: 0.5 for singles in VM/NM, 1.0 for all others
  const getMatchWeight = (match: any, round: any) => {
    if (match.type === "SINGLES" && (round.name.includes("VM") || round.name.includes("NM") || match.holeRange === "1-9")) {
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

  // Filter matches based on selectedRoundFilter
  const displayedRounds = selectedRoundFilter === "OVERALL"
    ? rounds
    : rounds.filter((r: any) => r.id === selectedRoundFilter)

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

  const sortedMvp = Object.values(mvpStats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.matches - b.matches
  })

  // Calculate Donut Stats (Streicher / WIPED / Double Bogey or worse)
  const donutStats: Record<string, { participant: any; teamId: string; donuts: number; holesPlayed: number }> = {}
  
  ;(competition.participants || []).forEach((p: any) => {
    let donuts = 0
    let holesPlayed = 0
    ;(p.scores || []).forEach((s: any) => {
      if (s.grossStrokes !== null || s.status === 'WIPED') {
        holesPlayed++
        if (s.status === 'WIPED') {
          donuts++
        } else if (s.grossStrokes !== null) {
          const round = rounds.find((r: any) => r.id === s.roundId)
          const hole = round?.course?.holes?.find((h: any) => h.id === s.holeId)
          if (hole && s.grossStrokes - hole.par >= 2) {
            donuts++
          }
        }
      }
    })
    donutStats[p.id] = {
      participant: p,
      teamId: p.teamId,
      donuts,
      holesPlayed
    }
  })

  const sortedDonuts = Object.values(donutStats).sort((a, b) => {
    if (b.donuts !== a.donuts) return b.donuts - a.donuts
    return b.holesPlayed - a.holesPlayed
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

        {/* HERO RYDER CUP BANNER (Inspired by Bild 2 & Official Logo Bild 4) */}
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
              <div className="flex flex-col items-center justify-center text-center order-first md:order-none py-1">
                <div className="relative group">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-amber-400/80 shadow-2xl shadow-amber-500/20 bg-slate-950 flex items-center justify-center p-0.5">
                    <img 
                      src="/trrc.jpg" 
                      alt="TRRC Logo" 
                      className="w-full h-full object-cover object-center rounded-full group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        // Fallback if image path differs
                        (e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                  </div>
                  <div className="absolute -bottom-2 inset-x-0 mx-auto w-max px-2.5 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black uppercase rounded-full shadow-md">
                    21 Punkte Gesamt
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-slate-300 font-medium flex items-center gap-1.5">
                  <span className="text-amber-400 font-bold">11 Pkt</span> zum Gesamtsieg
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
          
          {/* Left: Round / Session Dropdown */}
          <div className="flex items-center space-x-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Session:
            </label>
            <select
              value={selectedRoundFilter}
              onChange={(e) => setSelectedRoundFilter(e.target.value)}
              className="bg-slate-950 text-white font-semibold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-700/80 focus:ring-2 focus:ring-amber-400 outline-none w-full md:w-auto shadow-inner cursor-pointer"
            >
              <option value="OVERALL">⚡ Alle Matches (Overall)</option>
              {rounds.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.course?.name || "Golf Course"})
                </option>
              ))}
            </select>
          </div>

          {/* Right: Sub-Leaderboard Tabs (Matches, MVP, Donuts) */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 self-center sm:self-auto w-full sm:w-auto justify-center">
            <button
              onClick={() => setActiveTab('MATCHES')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'MATCHES'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Matches (Ryder Cup)
            </button>
            <button
              onClick={() => setActiveTab('MVP')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'MVP'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              MVP Wertung
            </button>
            <button
              onClick={() => setActiveTab('DONUTS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'DONUTS'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🍩 Donut-Wertung
            </button>
          </div>

        </div>

        {/* TAB CONTENT: 1. MATCHES (RYDER CUP BROADCAST BOARD) */}
        {activeTab === 'MATCHES' && (
          <div className="space-y-6">
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
                  className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/90 shadow-2xl overflow-hidden"
                >
                  {/* Session Header Banner (Styled like Bild 2 yellow bar) */}
                  <div className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 text-slate-950 px-4 py-2.5 flex items-center justify-between font-black uppercase text-xs sm:text-sm tracking-widest shadow-sm">
                    <div className="flex items-center gap-2">
                      <Calendar size={15} className="text-slate-900" />
                      <span>{round.name.toUpperCase()}</span>
                      <span className="text-[11px] font-bold text-slate-800 lowercase">
                        · {round.course?.name} ({round.holesPlayed?.length || 18} Loch)
                      </span>
                    </div>
                    <div className="text-[11px] font-mono bg-slate-950 text-amber-300 px-2 py-0.5 rounded font-extrabold">
                      {matches.length} MATCHES
                    </div>
                  </div>

                  {/* Team Sub-Header (EUROPE / UNITED STATES style from Bild 2) */}
                  <div className="grid grid-cols-2 text-xs font-black uppercase tracking-wider border-b border-slate-800">
                    <div className="bg-blue-900/80 text-white px-4 py-2 flex items-center justify-between border-r border-slate-800">
                      <span className="flex items-center gap-1.5">
                        <span className="text-blue-400 text-sm">♦</span>
                        <span>DIAMOND</span>
                      </span>
                      <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded font-black text-sm">
                        {formatCupScore(rDiamondPts)}
                      </span>
                    </div>
                    <div className="bg-red-900/80 text-white px-4 py-2 flex items-center justify-between">
                      <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded font-black text-sm">
                        {formatCupScore(rHeartsPts)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span>HEARTS</span>
                        <span className="text-red-400 text-sm">♥</span>
                      </span>
                    </div>
                  </div>

                  {/* Matches List (Pixel-exact adaptation of Bild 2) */}
                  <div className="divide-y divide-slate-800/80">
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
                          className="grid grid-cols-12 items-center hover:bg-slate-800/40 transition-colors cursor-pointer text-xs sm:text-sm font-semibold select-none group"
                        >
                          {/* Col 1-2: Left Standing (Diamond) */}
                          <div className="col-span-2 sm:col-span-2 h-14 sm:h-16 flex items-center justify-center font-black">
                            {diamondLead ? (
                              <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center font-mono font-black text-xs sm:text-sm tracking-wider shadow-inner">
                                {status.statusText}
                              </div>
                            ) : isAllSquare ? (
                              <div className="w-full h-full bg-slate-800 text-amber-300 border-r border-slate-700 flex items-center justify-center font-mono font-bold text-xs">
                                A/S
                              </div>
                            ) : (
                              <div className="w-full h-full bg-slate-950/40 text-slate-600 flex items-center justify-center">
                                -
                              </div>
                            )}
                          </div>

                          {/* Col 3-5: Diamond Players */}
                          <div className="col-span-3 sm:col-span-3 px-2 sm:px-4 py-2 text-right">
                            {t1Names.map((name: string, i: number) => (
                              <div key={i} className="truncate uppercase font-bold text-slate-200 group-hover:text-blue-300 transition-colors text-[11px] sm:text-xs leading-tight">
                                {name}
                                {status.team1Allowance[i] > 0 && (
                                  <span className="ml-1 text-[10px] text-blue-400 font-mono">({status.team1Allowance[i]})</span>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Col 6-7: Center Status Pill (Gold / Yellow background like Bild 2) */}
                          <div className="col-span-2 sm:col-span-2 h-14 sm:h-16 flex flex-col items-center justify-center bg-amber-400 text-slate-950 font-black border-x border-amber-500">
                            <span className="text-xs sm:text-sm tracking-wider">
                              {isFinished ? "F" : holesPlayed > 0 ? `${holesPlayed}` : "0"}
                            </span>
                            <span className="text-[9px] font-mono tracking-tighter opacity-80 uppercase">
                              {isFinished ? "FINAL" : holesPlayed > 0 ? `THRU ${holesPlayed}` : (
                                match.scheduledDate 
                                  ? new Date(match.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : "TEE 1"
                              )}
                            </span>
                            {weight < 1.0 && (
                              <span className="text-[8px] bg-slate-950 text-amber-300 px-1 rounded-sm mt-0.5">
                                0.5 PT
                              </span>
                            )}
                          </div>

                          {/* Col 8-10: Hearts Players */}
                          <div className="col-span-3 sm:col-span-3 px-2 sm:px-4 py-2 text-left">
                            {t2Names.map((name: string, i: number) => (
                              <div key={i} className="truncate uppercase font-bold text-slate-200 group-hover:text-red-300 transition-colors text-[11px] sm:text-xs leading-tight">
                                {name}
                                {status.team2Allowance[i] > 0 && (
                                  <span className="ml-1 text-[10px] text-red-400 font-mono">({status.team2Allowance[i]})</span>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Col 11-12: Right Standing (Hearts) */}
                          <div className="col-span-2 sm:col-span-2 h-14 sm:h-16 flex items-center justify-center font-black">
                            {heartsLead ? (
                              <div className="w-full h-full bg-red-600 text-white flex items-center justify-center font-mono font-black text-xs sm:text-sm tracking-wider shadow-inner">
                                {status.statusText}
                              </div>
                            ) : isAllSquare ? (
                              <div className="w-full h-full bg-slate-800 text-amber-300 border-l border-slate-700 flex items-center justify-center font-mono font-bold text-xs">
                                A/S
                              </div>
                            ) : (
                              <div className="w-full h-full bg-slate-950/40 text-slate-600 flex items-center justify-center">
                                -
                              </div>
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

        {/* TAB CONTENT: 2. MVP WERTUNG */}
        {activeTab === 'MVP' && (
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/90 shadow-2xl overflow-hidden p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Award size={20} className="text-amber-400" />
                  <span>MVP LEADERBOARD · MOST VALUABLE PLAYER</span>
                </h2>
                <p className="text-xs text-slate-400">Punkteverteilung: Sieg = 1.0 (oder 0.5 im Einzel VM/NM), Geteilt = halbe Punkte.</p>
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
                    <th className="py-3 px-4 text-right font-black text-amber-400">Punkte</th>
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
                          {formatCupScore(item.points)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 3. DONUT-WERTUNG (🍩) */}
        {activeTab === 'DONUTS' && (
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/90 shadow-2xl overflow-hidden p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span className="text-2xl">🍩</span>
                  <span>DONUT-WERTUNG · DIE STREICHER-TABELLE</span>
                </h2>
                <p className="text-xs text-slate-400">Gezählt werden gestrichene Löcher (WIPED) sowie Double-Bogey oder schlechter.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <th className="py-3 px-3">Rang</th>
                    <th className="py-3 px-4">Spieler</th>
                    <th className="py-3 px-3">Team</th>
                    <th className="py-3 px-3 text-center">Gespielte Löcher</th>
                    <th className="py-3 px-4 text-right font-black text-pink-400">🍩 Donuts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-semibold">
                  {sortedDonuts.map((item, idx) => {
                    const isDiamond = item.teamId === diamondTeam.id
                    const name = item.participant.userId ? item.participant.user?.name : item.participant.dummyName || "Spieler"
                    return (
                      <tr key={item.participant.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-400">
                          {idx === 0 ? "👑 1" : `${idx + 1}`}
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
                        <td className="py-3 px-3 text-center font-mono">{item.holesPlayed}</td>
                        <td className="py-3 px-4 text-right font-mono font-black text-pink-400 text-sm sm:text-base">
                          {item.donuts}
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
