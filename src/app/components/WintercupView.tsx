"use client"

import React, { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn, signOut } from "next-auth/react"
import { 
  Trophy, Home, LogOut, Key, Share2, BookOpen, Settings, Edit, 
  CheckCircle, CheckCircle2, Edit3, Award, Calendar, Clock, Lock, EyeOff, RefreshCw
} from "lucide-react"
import { WintercupScoreModal } from "./WintercupScoreModal"
import { WintercupScheduleModal } from "./WintercupScheduleModal"
import { WintercupAdminView } from "./WintercupAdminView"
import { getClConfig, isRoundPairingsAnonymized, getQualificationStructure } from "@/lib/clFormat"

interface WintercupViewProps {
  competition: any
  session: any
}

export function WintercupView({ competition, session }: WintercupViewProps) {
  const clConfig = getClConfig(competition)
  const qual = getQualificationStructure(clConfig)
  const router = useRouter()

  let primaryColor = "#059669"
  try {
    if (competition.cssConfig) {
      const parsed = JSON.parse(competition.cssConfig)
      if (parsed.primaryColor) primaryColor = parsed.primaryColor
    }
  } catch (_) {}

  // Active top tab: Leaderboard | Details | Admin
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'details' | 'admin'>('leaderboard')

  // Filter State (matching screenshot dropdowns)
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>("R1") // R1, R2, R3, ZW, PLAYOFFS, TOTAL
  const [selectedLeaderboardType, setSelectedLeaderboardType] = useState<string>("PAIRINGS") // PAIRINGS (default), MAIN, NETTO, BRUTTO

  // Match Sort Option (Right top in sub-panel bar)
  const [matchSortOption, setMatchSortOption] = useState<'MATCH_NUM' | 'PLAYED_FIRST' | 'SOONEST_FIRST'>('MATCH_NUM')

  const [shareCopied, setShareCopied] = useState(false)
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [isPending, startTransition] = useTransition()

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
  
  // Modals state
  const [activeModalMatch, setActiveModalMatch] = useState<{ match: any; round: any } | null>(null)
  const [activeScheduleMatch, setActiveScheduleMatch] = useState<{ match: any; round: any } | null>(null)

  // Sync open modals with freshly fetched competition data
  useEffect(() => {
    if (activeModalMatch && competition?.rounds) {
      const freshRound = competition.rounds.find((r: any) => r.id === activeModalMatch.round?.id)
      if (freshRound) {
        const freshMatch = freshRound.matches?.find((m: any) => m.id === activeModalMatch.match?.id)
        if (freshMatch) {
          setActiveModalMatch({ match: freshMatch, round: freshRound })
        }
      }
    }
    if (activeScheduleMatch && competition?.rounds) {
      const freshRound = competition.rounds.find((r: any) => r.id === activeScheduleMatch.round?.id)
      if (freshRound) {
        const freshMatch = freshRound.matches?.find((m: any) => m.id === activeScheduleMatch.match?.id)
        if (freshMatch) {
          setActiveScheduleMatch({ match: freshMatch, round: freshRound })
        }
      }
    }
  }, [competition])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search)
      const rParam = sp.get("round")
      const tParam = sp.get("type")
      const tabParam = sp.get("tab")
      if (rParam) setSelectedRoundFilter(rParam)
      if (tParam) setSelectedLeaderboardType(tParam)
      if (tabParam === 'details' || tabParam === 'admin') setActiveTab(tabParam)
    }
  }, [])

  const handleShareView = () => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.set("round", selectedRoundFilter)
      url.searchParams.set("type", selectedLeaderboardType)
      url.searchParams.set("tab", activeTab)
      
      navigator.clipboard.writeText(url.toString())
        .then(() => {
          setShareCopied(true)
          setTimeout(() => setShareCopied(false), 2000)
        })
        .catch(err => console.error("Could not copy URL: ", err))
    }
  }

  const participants = competition.participants || []
  const rounds = competition.rounds || []

  const vorrundeRounds = rounds
    .filter((r: any) => r.name.startsWith("Vorrunde"))
    .sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  const r1 = vorrundeRounds[0] || rounds.find((r: any) => r.name === "Vorrunde 1")
  const r2 = vorrundeRounds[1] || rounds.find((r: any) => r.name === "Vorrunde 2")
  const r3 = vorrundeRounds[2] || rounds.find((r: any) => r.name === "Vorrunde 3")
  const rZwischen = rounds.find((r: any) => r.name === "Zwischenrunde")
  const rAF = rounds.find((r: any) => r.name === "Achtelfinale")
  const rVF = rounds.find((r: any) => r.name === "Viertelfinale")
  const rHF = rounds.find((r: any) => r.name === "Halbfinale")
  const rFin = rounds.find((r: any) => r.name === "Finale")

  // Helper to check if a match is scored
  const isMatchScoredForRound = (match: any, roundId: string) => {
    if (!match) return false
    if (match.allowanceType || match.playUntilEnd) return true // Matchplay winner set
    const matchPlayerIds = (match.matchPlayers || []).map((mp: any) => mp.participantId)
    if (matchPlayerIds.length === 0) return false
    const matchPlayers = matchPlayerIds.map((id: string) => participants.find((p: any) => p.id === id)).filter(Boolean)
    return matchPlayers.every((p: any) => {
      const score = p?.scores?.find((s: any) => s.roundId === roundId)
      return score && score.netStrokes !== null && score.grossStrokes !== null
    })
  }

  // Helper to gather all matches for "TOTAL" (All Rounds) view
  const getAllMatchesForTotal = () => {
    const list: any[] = []

    vorrundeRounds.forEach((r: any, rIdx: number) => {
      (r.matches || []).forEach((m: any, idx: number) => {
        list.push({ ...m, targetRound: r, roundLabel: r.name, roundOrder: rIdx + 1, originalIdx: idx, matchKind: "VORRUNDE" })
      })
    })

    if (rZwischen?.matches) {
      rZwischen.matches.forEach((m: any, idx: number) => {
        list.push({ ...m, targetRound: rZwischen, roundLabel: "Zwischenrunde", roundOrder: 4, originalIdx: idx, matchKind: "ZWISCHENRUNDE" })
      })
    }
    if (rAF?.matches) {
      rAF.matches.forEach((m: any, idx: number) => {
        list.push({ ...m, targetRound: rAF, roundLabel: "Achtelfinale", roundOrder: 4.5, originalIdx: idx, matchKind: "AF" })
      })
    }
    if (rVF?.matches) {
      rVF.matches.forEach((m: any, idx: number) => {
        list.push({ ...m, targetRound: rVF, roundLabel: "Viertelfinale", roundOrder: 5, originalIdx: idx, matchKind: "VF" })
      })
    }
    if (rHF?.matches) {
      rHF.matches.forEach((m: any, idx: number) => {
        list.push({ ...m, targetRound: rHF, roundLabel: "Halbfinale", roundOrder: 6, originalIdx: idx, matchKind: "HF" })
      })
    }
    if (rFin?.matches) {
      rFin.matches.forEach((m: any, idx: number) => {
        list.push({ ...m, targetRound: rFin, roundLabel: "Finale", roundOrder: 7, originalIdx: idx, matchKind: "FIN" })
      })
    }

    return list
  }

  // Helper to get timestamp for sorting
  const getMatchTimestamp = (m: any) => {
    const dStr = m.scheduledDate || m.updatedAt || m.createdAt
    if (!dStr) return 0
    const t = new Date(dStr).getTime()
    return isNaN(t) ? 0 : t
  }

  // Helper to format played date display
  const formatPlayedDateDisplay = (dISO: string | Date | null | undefined) => {
    if (!dISO) return "Gespielt"
    const date = new Date(dISO)
    if (isNaN(date.getTime())) return "Gespielt"
    const pad = (n: number) => String(n).padStart(2, '0')
    const dayNum = pad(date.getDate())
    const monthNum = pad(date.getMonth() + 1)
    return `Gespielt am ${dayNum}.${monthNum}.`
  }

  // Helper to calculate total match order (Runde before Partie)
  const getMatchOrder = (m: any) => {
    const rOrder = m.roundOrder !== undefined ? m.roundOrder : (m.targetRound?.order ?? 1)
    const mIdx = m.originalIdx !== undefined ? m.originalIdx : 0
    return rOrder * 1000 + mIdx
  }

  // Helper to sort matches list based on matchSortOption
  const sortRoundMatches = (matchesList: any[], fallbackRoundId?: string) => {
    const list = matchesList.map((m, originalIdx) => {
      const tRound = m.targetRound || rounds.find((r: any) => r.id === fallbackRoundId)
      return { 
        ...m, 
        targetRound: tRound,
        roundOrder: m.roundOrder !== undefined ? m.roundOrder : (tRound?.order ?? 1),
        originalIdx: m.originalIdx !== undefined ? m.originalIdx : originalIdx 
      }
    })

    if (matchSortOption === 'PLAYED_FIRST') {
      return list.sort((a, b) => {
        const aRoundId = a.targetRound?.id || fallbackRoundId
        const bRoundId = b.targetRound?.id || fallbackRoundId
        const aScored = isMatchScoredForRound(a, aRoundId) ? 1 : 0
        const bScored = isMatchScoredForRound(b, bRoundId) ? 1 : 0

        // 1. Played matches come FIRST
        if (aScored !== bScored) return bScored - aScored

        // BOTH ARE SCORED: sort played date DESCENDING
        if (aScored && bScored) {
          const aTime = getMatchTimestamp(a)
          const bTime = getMatchTimestamp(b)
          if (bTime !== aTime) return bTime - aTime
          return getMatchOrder(a) - getMatchOrder(b)
        }

        // BOTH ARE NOT SCORED:
        const aSched = a.scheduledDate ? 1 : 0
        const bSched = b.scheduledDate ? 1 : 0

        // Scheduled comes before unscheduled
        if (aSched !== bSched) return bSched - aSched

        // Both are scheduled: sort scheduled date ASCENDING (bald zuerst)
        if (aSched && bSched) {
          const aTime = getMatchTimestamp(a)
          const bTime = getMatchTimestamp(b)
          if (aTime !== bTime) return aTime - bTime
          return getMatchOrder(a) - getMatchOrder(b)
        }

        // Both are unscheduled: sort Runde & Partie aufsteigend
        return getMatchOrder(a) - getMatchOrder(b)
      })
    }

    if (matchSortOption === 'SOONEST_FIRST') {
      return list.sort((a, b) => {
        const aRoundId = a.targetRound?.id || fallbackRoundId
        const bRoundId = b.targetRound?.id || fallbackRoundId
        const aScored = isMatchScoredForRound(a, aRoundId) ? 1 : 0
        const bScored = isMatchScoredForRound(b, bRoundId) ? 1 : 0

        // 1. Non-scored matches come FIRST, Scored matches LAST
        if (aScored !== bScored) return aScored - bScored

        // BOTH ARE SCORED (at the very bottom): sort played date DESCENDING
        if (aScored && bScored) {
          const aTime = getMatchTimestamp(a)
          const bTime = getMatchTimestamp(b)
          if (bTime !== aTime) return bTime - aTime
          return getMatchOrder(a) - getMatchOrder(b)
        }

        // BOTH ARE NON-SCORED:
        const aSched = a.scheduledDate ? 1 : 0
        const bSched = b.scheduledDate ? 1 : 0

        // Scheduled comes before unscheduled
        if (aSched !== bSched) return bSched - aSched

        // Both are scheduled: sort scheduled date ASCENDING (bald zuerst)
        if (aSched && bSched) {
          const aTime = getMatchTimestamp(a)
          const bTime = getMatchTimestamp(b)
          if (aTime !== bTime) return aTime - bTime
          return getMatchOrder(a) - getMatchOrder(b)
        }

        // Both are unscheduled: sort Runde & Partie aufsteigend
        return getMatchOrder(a) - getMatchOrder(b)
      })
    }

    // Default MATCH_NUM: sort by Runde & Partie aufsteigend
    return list.sort((a, b) => getMatchOrder(a) - getMatchOrder(b))
  }

  // Check if Vorrunde is fully complete
  const isRoundComplete = (round: any) => {
    if (!round || !round.matches || round.matches.length === 0) return false
    return round.matches.every((m: any) => isMatchScoredForRound(m, round.id))
  }

  const isVorrundeComplete = vorrundeRounds.length > 0 && vorrundeRounds.every((r: any) => isRoundComplete(r))

  // Helper to check if a match has scored results
  const isMatchScored = (m: any) => {
    if (!m) return false
    if (m.allowanceType) return true
    if (m.matchPlayers && m.matchPlayers.length > 0) {
      const roundId = m.targetRound?.id
      return m.matchPlayers.every((mp: any) => {
        const p = participants.find((x: any) => x.id === mp.participantId)
        const s = p?.scores?.find((sc: any) => sc.roundId === roundId)
        return s && s.netStrokes !== null && s.grossStrokes !== null
      })
    }
    return false
  }

  // Helper to get match by kind and index
  const getMatchByKindAndIndex = (kind: string, origIdx: number) => {
    const roundObj = kind === "ZWISCHENRUNDE" ? rZwischen 
      : kind === "VF" ? rVF 
      : kind === "HF" ? rHF 
      : kind === "FIN" ? rFin 
      : null
    if (!roundObj || !roundObj.matches) return null
    return roundObj.matches.find((m: any) => m.originalIdx === origIdx || m.id === roundObj.matches[origIdx]?.id) || roundObj.matches[origIdx]
  }

  // Check if players for a match are fixed and ready to be scheduled
  const isMatchPlayersFixed = (match: any) => {
    let kind = match.matchKind
    if (!kind) {
      const rId = match.roundId || match.targetRound?.id
      if (rId === rZwischen?.id) kind = "ZWISCHENRUNDE"
      else if (rId === rVF?.id) kind = "VF"
      else if (rId === rHF?.id) kind = "HF"
      else if (rId === rFin?.id) kind = "FIN"
      else if (match.type === "GROUP_3") kind = "VORRUNDE"
    }

    if (!kind || kind === "VORRUNDE") return true
    const idx = match.originalIdx ?? 0

    if (kind === "ZWISCHENRUNDE") {
      return isVorrundeComplete
    }

    if (kind === "VF") {
      if (!isVorrundeComplete) return false
      const zwMap = [3, 0, 1, 2]
      const targetZwIdx = zwMap[idx]
      const zwMatch = getMatchByKindAndIndex("ZWISCHENRUNDE", targetZwIdx)
      return isMatchScored(zwMatch)
    }

    if (kind === "HF") {
      const vfMap = idx === 0 ? [0, 3] : [1, 2]
      return vfMap.every(vfIdx => isMatchScored(getMatchByKindAndIndex("VF", vfIdx)))
    }

    if (kind === "FIN") {
      return isMatchScored(getMatchByKindAndIndex("HF", 0)) && isMatchScored(getMatchByKindAndIndex("HF", 1))
    }

    return true
  }

  // Compute Vorrunde Standings for each participant
  const vorrundeStandings = participants.map((p: any) => {
    let playedMatches = 0
    let matchPoints = 0
    let totalNetto = 0
    let totalBrutto = 0

    const vorrundeRoundIds = vorrundeRounds.map((r: any) => r.id).filter(Boolean)

    vorrundeRoundIds.forEach((rId: string) => {
      const s = p.scores?.find((x: any) => x.roundId === rId)
      if (s && s.netStrokes !== null && s.grossStrokes !== null) {
        playedMatches += 1
        matchPoints += s.points || 0
        totalNetto += s.netStrokes || 0
        totalBrutto += s.grossStrokes || 0
      }
    })

    const name = p.dummyName || p.user?.name || `Player ${p.id.slice(0, 4)}`

    return {
      participant: p,
      name,
      playedMatches,
      matchPoints,
      totalNetto,
      totalBrutto
    }
  })

  // Sort Standings
  vorrundeStandings.sort((a: any, b: any) => {
    if (selectedLeaderboardType === "NETTO") {
      if (b.totalNetto !== a.totalNetto) return b.totalNetto - a.totalNetto
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints
      if (a.playedMatches !== b.playedMatches) return a.playedMatches - b.playedMatches
      if (b.totalBrutto !== a.totalBrutto) return b.totalBrutto - a.totalBrutto
      return a.name.localeCompare(b.name)
    } else if (selectedLeaderboardType === "BRUTTO") {
      if (b.totalBrutto !== a.totalBrutto) return b.totalBrutto - a.totalBrutto
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints
      if (a.playedMatches !== b.playedMatches) return a.playedMatches - b.playedMatches
      if (b.totalNetto !== a.totalNetto) return b.totalNetto - a.totalNetto
      return a.name.localeCompare(b.name)
    } else {
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints
      if (a.playedMatches !== b.playedMatches) return a.playedMatches - b.playedMatches
      if (b.totalNetto !== a.totalNetto) return b.totalNetto - a.totalNetto
      if (b.totalBrutto !== a.totalBrutto) return b.totalBrutto - a.totalBrutto
      return a.name.localeCompare(b.name)
    }
  })

  // Assign Ranks with shared position T1, T2 logic
  let currentRank = 1
  const rankedStandings = vorrundeStandings.map((item: any, idx: number) => {
    if (idx > 0) {
      const prev = vorrundeStandings[idx - 1]
      let isEqual = false
      if (selectedLeaderboardType === "NETTO") {
        isEqual = item.totalNetto === prev.totalNetto && item.matchPoints === prev.matchPoints && item.playedMatches === prev.playedMatches && item.totalBrutto === prev.totalBrutto
      } else if (selectedLeaderboardType === "BRUTTO") {
        isEqual = item.totalBrutto === prev.totalBrutto && item.matchPoints === prev.matchPoints && item.playedMatches === prev.playedMatches && item.totalBrutto === prev.totalBrutto
      } else {
        isEqual = item.matchPoints === prev.matchPoints && item.playedMatches === prev.playedMatches && item.totalNetto === prev.totalNetto && item.totalBrutto === prev.totalBrutto
      }
      if (!isEqual) {
        currentRank = idx + 1
      }
    }

    const next = vorrundeStandings[idx + 1]
    let isTied = false
    if (next) {
      if (selectedLeaderboardType === "NETTO") {
        isTied = item.totalNetto === next.totalNetto && item.matchPoints === next.matchPoints && item.playedMatches === next.playedMatches && item.totalBrutto === next.totalBrutto
      } else if (selectedLeaderboardType === "BRUTTO") {
        isTied = item.totalBrutto === next.totalBrutto && item.matchPoints === next.matchPoints && item.playedMatches === next.playedMatches && item.totalBrutto === next.totalBrutto
      } else {
        isTied = item.matchPoints === next.matchPoints && item.playedMatches === next.playedMatches && item.totalNetto === next.totalNetto && item.totalBrutto === next.totalBrutto
      }
    }
    const prev = idx > 0 ? vorrundeStandings[idx - 1] : null
    if (prev) {
      if (selectedLeaderboardType === "NETTO") {
        if (item.totalNetto === prev.totalNetto && item.matchPoints === prev.matchPoints && item.playedMatches === prev.playedMatches && item.totalBrutto === prev.totalBrutto) isTied = true
      } else if (selectedLeaderboardType === "BRUTTO") {
        if (item.totalBrutto === prev.totalBrutto && item.matchPoints === prev.matchPoints && item.playedMatches === prev.playedMatches && item.totalNetto === prev.totalNetto) isTied = true
      } else {
        if (item.matchPoints === prev.matchPoints && item.playedMatches === prev.playedMatches && item.totalNetto === prev.totalNetto && item.totalBrutto === prev.totalBrutto) isTied = true
      }
    }

    const rankDisplay = isTied ? `T${currentRank}` : `${currentRank}`
    return { ...item, rankDisplay, originalRank: idx + 1 }
  })

  // Permission Checker
  const canUserEditMatch = (match: any) => {
    if (!session?.user) return false
    const role = session.user.role
    if (role === "ADMIN" || role === "SUPER_ADMIN") return true

    const currentUserId = session.user.id
    const currentUserEmail = session.user.email

    const matchPlayerIds = (match.matchPlayers || []).map((mp: any) => mp.participantId)
    const matchParticipants = matchPlayerIds.map((id: string) => participants.find((p: any) => p.id === id)).filter(Boolean)

    return matchParticipants.some((p: any) => 
      p.userId === currentUserId || (p.user && p.user.email === currentUserEmail)
    )
  }

  const isAdminUser = session && (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN')

  const getActiveRound = () => {
    if (selectedRoundFilter.startsWith("R")) {
      const num = parseInt(selectedRoundFilter.replace("R", ""), 10) - 1
      return vorrundeRounds[isNaN(num) ? 0 : num] || vorrundeRounds[0] || r1
    }
    if (selectedRoundFilter === "ZW") return rZwischen
    if (selectedRoundFilter === "PLAYOFFS") return rVF || rAF || rHF || rFin
    return null
  }
  const activeRound = getActiveRound()

  // Format Scheduled Date (e.g. "Dienstag, 12.01. 12:30")
  const formatScheduledDateDisplay = (dISO: string | Date | null | undefined) => {
    if (!dISO) return ""
    const date = new Date(dISO)
    if (isNaN(date.getTime())) return ""
    const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]
    const dayName = days[date.getDay()]
    const pad = (n: number) => String(n).padStart(2, '0')
    const dayNum = pad(date.getDate())
    const monthNum = pad(date.getMonth() + 1)
    const hours = pad(date.getHours())
    const mins = pad(date.getMinutes())
    return `${dayName}, ${dayNum}.${monthNum}. ${hours}:${mins}`
  }

  // Get Medal Class for Points (Gold, Silver, Bronze)
  const getMedalBadgeStyle = (pts: number, allScoresInMatch: any[]) => {
    // Sort scores descending by points
    const sortedPts = [...allScoresInMatch].map(x => x.score?.points ?? -1).sort((a, b) => b - a)
    const maxPts = sortedPts[0]
    const secondPts = sortedPts[1]

    if (pts === maxPts && pts > 0) {
      // 1st place or T1 -> Gold
      return "bg-amber-100 text-amber-900 border-amber-300 font-black shadow-xs"
    } else if (pts === secondPts && pts > 0) {
      // 2nd place or T2 -> Silver
      return "bg-slate-200 text-slate-900 border-slate-300 font-black shadow-xs"
    } else {
      // 3rd place or 0 Pkt -> Bronze
      return "bg-orange-100 text-orange-950 border-orange-300 font-black shadow-xs"
    }
  }

  return (
    <div 
      className="min-h-screen bg-slate-100 text-slate-800 flex flex-col transition-all duration-300 font-sans"
      style={{
        backgroundImage: competition.bgImage ? `linear-gradient(to bottom, rgba(248, 250, 252, 0.5), rgba(248, 250, 252, 0.7)), url(${JSON.stringify(competition.bgImage)})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* 1. TOP HEADER */}
      <header className="border-b border-slate-250 bg-white/45 backdrop-blur-md sticky top-0 z-40 px-4 py-2.5 md:py-4 shadow-sm flex justify-between items-center h-12 md:h-16">
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500">leaderboard.io</div>
          <h1 className="text-sm md:text-xl font-black text-slate-900 flex items-center gap-1.5">
            <span style={{ color: primaryColor }}>{competition.name}</span>
            <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
              CL-Format
            </span>
          </h1>
        </div>

        {/* Center: Build Timestamp */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200/70 border border-slate-300/80 text-[10px] font-mono text-slate-600 font-semibold shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="whitespace-nowrap">Build: {process.env.NEXT_PUBLIC_BUILD_TIME || "Live"}</span>
        </div>

        <div className="flex items-center space-x-1.5 md:space-x-2.5">
          <button 
            onClick={() => {
              if (typeof window !== "undefined") {
                document.cookie = "last-comp-slug=; path=/; max-age=0; SameSite=Lax";
                window.location.href = "/";
              }
            }}
            className="p-1.5 md:p-2 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-lg border border-slate-200 transition-colors shadow-sm inline-flex items-center justify-center cursor-pointer"
            title="Turnier wechseln / Home"
          >
            <Home size={16} />
          </button>
        </div>
      </header>

      {/* 2. TABS BAR: Leaderboard | Details | Admin (Admin ONLY if admin logged in) */}
      <div className="bg-white/35 backdrop-blur-md border-b border-slate-200 sticky top-12 md:top-16 z-30 flex justify-center shadow-sm h-10 md:h-14">
        <div className="flex w-full max-w-7xl px-4 h-full">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-2 md:py-4 text-center text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center space-x-1.5 md:space-x-2 ${
              activeTab === 'leaderboard'
                ? 'text-emerald-500 bg-emerald-500/20 font-black'
                : 'border-transparent text-slate-700 hover:text-slate-950 font-black'
            }`}
            style={{ borderBottomColor: activeTab === 'leaderboard' ? primaryColor : 'transparent' }}
          >
            <Trophy size={16} />
            <span>Leaderboard</span>
          </button>

          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-2 md:py-4 text-center text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center space-x-1.5 md:space-x-2 ${
              activeTab === 'details'
                ? 'text-emerald-500 bg-emerald-500/20 font-black'
                : 'border-transparent text-slate-700 hover:text-slate-950 font-black'
            }`}
            style={{ borderBottomColor: activeTab === 'details' ? primaryColor : 'transparent' }}
          >
            <BookOpen size={16} />
            <span>Details</span>
          </button>

          {isAdminUser && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-2 md:py-4 text-center text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center space-x-1.5 md:space-x-2 ${
                activeTab === 'admin'
                  ? 'text-emerald-500 bg-emerald-500/20 font-black'
                  : 'border-transparent text-slate-700 hover:text-slate-950 font-black'
              }`}
              style={{ borderBottomColor: activeTab === 'admin' ? primaryColor : 'transparent' }}
            >
              <Settings size={16} />
              <span>Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. MAIN CONTENT AREA */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">

        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {/* Filter Controls Bar (Exact layout from user screenshot) */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center bg-white/35 backdrop-blur-sm border border-slate-200 p-4 rounded-2xl shadow-sm">
              {/* Left: Dropdowns */}
              <div className="flex flex-wrap items-center gap-4">
                {/* VIEW ROUND Dropdown */}
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">VIEW ROUND</span>
                  <select
                    value={selectedRoundFilter}
                    onChange={(e) => setSelectedRoundFilter(e.target.value)}
                    className="bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-1.5 text-sm font-black text-emerald-850 focus:ring-emerald-500 focus:outline-none cursor-pointer shadow-sm transition-all"
                  >
                    <option value="TOTAL">All Rounds (Vorrunde Leaderboard)</option>
                    {vorrundeRounds.map((r: any, idx: number) => (
                      <option key={r.id} value={`R${idx + 1}`}>
                        {r.name} ({r.course?.name || "Golfplatz"})
                      </option>
                    ))}
                    {rZwischen && (
                      <option value="ZW">Zwischenrunde ({rZwischen.course?.name || "Golfplatz"})</option>
                    )}
                    {(rAF || rVF || rHF || rFin) && (
                      <option value="PLAYOFFS">Playoffs</option>
                    )}
                  </select>
                </div>

                {/* LEADERBOARD / VIEW Dropdown */}
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">LEADERBOARD</span>
                  <select
                    value={selectedLeaderboardType}
                    onChange={(e) => setSelectedLeaderboardType(e.target.value)}
                    className="bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-1.5 text-sm font-black text-emerald-850 focus:ring-emerald-500 focus:outline-none cursor-pointer shadow-sm transition-all"
                  >
                    <option value="PAIRINGS">Pairings (Partien & Auslosung)</option>
                    {(selectedRoundFilter.startsWith("R") || selectedRoundFilter === "TOTAL") && (
                      <option value="MAIN">Leaderboard (Match-Punkte)</option>
                    )}
                    <option value="NETTO">Netto-Leaderboard (NP Points)</option>
                    <option value="BRUTTO">Brutto-Leaderboard (BP Points)</option>
                  </select>
                </div>
              </div>

              {/* Right: Share & Refresh Buttons */}
              <div className="flex items-center space-x-2 sm:ml-auto">
                {/* Share Button */}
                <button
                  onClick={handleShareView}
                  className="p-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-lg border border-slate-200 transition-colors shadow-sm inline-flex items-center justify-center cursor-pointer"
                  title="Share Current View"
                >
                  {shareCopied ? (
                    <CheckCircle size={16} className="text-emerald-600 animate-pulse" />
                  ) : (
                    <Share2 size={16} />
                  )}
                </button>

                {/* Refresh Leaderboard Button */}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-lg border border-slate-200 transition-colors shadow-sm inline-flex items-center justify-center cursor-pointer"
                  title="Leaderboard aktualisieren"
                >
                  <RefreshCw size={16} className={isRefreshing ? "animate-spin text-emerald-600" : ""} />
                </button>
              </div>
            </div>

            {/* SECTION A: PAIRINGS (DEFAULT VIEW FOR ANY ROUND) */}
            {selectedLeaderboardType === "PAIRINGS" && (
              <div className="space-y-4">
                
                {/* ALL ROUNDS PAIRINGS (TOTAL) */}
                {selectedRoundFilter === "TOTAL" && (
                  <div className="space-y-4">
                    {isRoundPairingsAnonymized(activeRound?.name || "", clConfig) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center space-x-3 text-amber-900 text-xs font-semibold shadow-xs">
                        <EyeOff size={18} className="text-amber-600 shrink-0" />
                        <div>
                          <span className="font-extrabold block">Paarungen noch verdeckt</span>
                          <span className="text-amber-700 font-normal">Die Auslosung für {activeRound?.name} wird erst zu Beginn des Spielzeitraums sichtbar geschaltet.</span>
                        </div>
                      </div>
                    )}

                    {/* Sub-panel bar with Round title on left, Sort Dropdown on right */}
                    <div className="bg-white/45 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-xs">
                      <div>
                        <span className="font-black text-emerald-700 uppercase tracking-wider block">
                          Alle Runden • {competition.name}
                        </span>
                        <span className="text-slate-600 font-bold text-[11px]">
                          Alle Partien (Vorrunde, Zwischenrunde & Playoffs)
                        </span>
                      </div>

                      {/* Right top Sort Dropdown */}
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">Sortierung:</span>
                        <select
                          value={matchSortOption}
                          onChange={(e) => setMatchSortOption(e.target.value as any)}
                          className="bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-1 text-xs font-black text-emerald-850 focus:ring-emerald-500 focus:outline-none cursor-pointer shadow-xs transition-all"
                        >
                          <option value="MATCH_NUM">Match-Nummer</option>
                          <option value="PLAYED_FIRST">Gespielte zuerst</option>
                          <option value="SOONEST_FIRST">Bald startenden zuerst</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sortRoundMatches(getAllMatchesForTotal()).map((match: any, idx: number) => {
                        const targetRound = match.targetRound
                        const displayIndex = match.originalIdx !== undefined ? match.originalIdx + 1 : idx + 1

                        if (match.matchKind === "VORRUNDE") {
                          const matchPlayerIds = (match.matchPlayers || []).map((mp: any) => mp.participantId)
                          const matchPlayers = matchPlayerIds.map((id: string) => participants.find((p: any) => p.id === id)).filter(Boolean)

                          const scoresList = matchPlayers.map((p: any) => {
                            const s = p.scores?.find((x: any) => x.roundId === targetRound?.id)
                            return { player: p, score: s }
                          })

                          const isScored = scoresList.every((item: any) => item.score && item.score.netStrokes !== null && item.score.grossStrokes !== null)

                          if (isScored) {
                            scoresList.sort((a: any, b: any) => {
                              const aPts = a.score?.points ?? -1
                              const bPts = b.score?.points ?? -1
                              if (bPts !== aPts) return bPts - aPts
                              const aNet = a.score?.netStrokes ?? -1
                              const bNet = b.score?.netStrokes ?? -1
                              if (bNet !== aNet) return bNet - aNet
                              const aGross = a.score?.grossStrokes ?? -1
                              const bGross = b.score?.grossStrokes ?? -1
                              return bGross - aGross
                            })
                          }
                          const isScheduled = Boolean(match.scheduledDate)
                          const canEdit = canUserEditMatch(match)
                          const isAnonymized = isRoundPairingsAnonymized(targetRound?.name || "", clConfig)

                          return (
                            <div 
                              key={match.id}
                              className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 hover:border-emerald-400 hover:shadow-md transition-all"
                            >
                              {/* Card Header & Status Badge */}
                              <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                                <span className="text-xs font-black uppercase text-emerald-700 tracking-wider">
                                  {match.roundLabel} - PARTIE {displayIndex}
                                </span>

                                {isAnonymized ? (
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                    <Lock size={12} className="text-slate-400" />
                                    <span>Auslosung noch verdeckt</span>
                                  </span>
                                ) : isScored ? (
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                                    <CheckCircle2 size={12} />
                                    <span>{formatPlayedDateDisplay(match.scheduledDate || match.updatedAt || match.createdAt)}</span>
                                  </span>
                                ) : isScheduled ? (
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full shadow-xs">
                                    <Clock size={12} className="text-emerald-700" />
                                    <span>{formatScheduledDateDisplay(match.scheduledDate)}</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                    Ausstehend
                                  </span>
                                )}
                              </div>

                              {/* Player Rows */}
                              <div className="space-y-2">
                                {scoresList.map((item: any, pIdx: number) => {
                                  const p = item.player
                                  const s = item.score
                                  const pName = isAnonymized ? `Spieler ${pIdx + 1}` : (p.dummyName || p.user?.name || `Player ${pIdx + 1}`)
                                  const hcp = isAnonymized ? "—" : (p.compHandicap !== null && p.compHandicap !== undefined ? p.compHandicap : (pIdx + 1))

                                  return (
                                    <div 
                                      key={p.id}
                                      className="bg-white border border-slate-200 rounded-xl p-2.5 flex justify-between items-center shadow-xs"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <span className="font-extrabold text-sm text-slate-900">{pName}</span>
                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                                          Hcp {hcp}
                                        </span>
                                      </div>
                                      
                                      {isAnonymized ? (
                                        <span className="text-xs text-slate-400 font-mono">—</span>
                                      ) : s && s.netStrokes !== null && s.grossStrokes !== null ? (
                                        <div className="flex items-center space-x-2 text-xs font-mono">
                                          <span className="text-slate-600">NP: <strong className="text-slate-900">{s.netStrokes}</strong></span>
                                          <span className="text-slate-600">BP: <strong className="text-slate-900">{s.grossStrokes}</strong></span>
                                          <span className={`px-2 py-0.5 rounded border ${getMedalBadgeStyle(s.points, scoresList)}`}>
                                            {s.points} Pkt
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-400 font-mono">-</span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Card Footer Actions */}
                              <div className="pt-1 flex justify-between items-center text-xs border-t border-slate-100 mt-2">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  {isAnonymized ? "Auslosung wird zum Rundenstart freigeschaltet" : canEdit ? (
                                    isScored ? "Ergebnis eingetragen" : isScheduled ? "Bereit für Score-Eingabe" : "Terminierung erforderlich"
                                  ) : session ? "Nur Beteiligte / Admin" : "Log in zum Scoren/Terminieren"}
                                </span>

                                <div className="flex items-center space-x-2">
                                  {!isAnonymized && canEdit && (
                                    <>
                                      {isScored ? (
                                        <button
                                          type="button"
                                          onClick={() => setActiveModalMatch({ match, round: targetRound })}
                                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-extrabold border border-emerald-300 transition-colors shadow-xs"
                                          title="Score ändern"
                                        >
                                          <Edit3 size={13} />
                                        </button>
                                      ) : isScheduled ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => setActiveScheduleMatch({ match, round: targetRound })}
                                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-bold border border-slate-300 transition-colors"
                                            title="Termin ändern"
                                          >
                                            <Calendar size={13} />
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => setActiveModalMatch({ match, round: targetRound })}
                                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-extrabold border border-emerald-300 transition-colors shadow-xs"
                                          >
                                            <Edit3 size={13} />
                                            <span>Score</span>
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setActiveScheduleMatch({ match, round: targetRound })}
                                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-colors shadow-xs"
                                        >
                                          <Calendar size={13} />
                                          <span>Termin vereinbaren</span>
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        } else {
                          // 2-Player Matchplay (Zwischenrunde / Playoffs)
                          const seedPairs = [
                            { p1Rank: 5, p2Rank: 12, title: "Zwischenrunde 1 (5. vs 12.)" },
                            { p1Rank: 6, p2Rank: 11, title: "Zwischenrunde 2 (6. vs 11.)" },
                            { p1Rank: 7, p2Rank: 10, title: "Zwischenrunde 3 (7. vs 10.)" },
                            { p1Rank: 8, p2Rank: 9,  title: "Zwischenrunde 4 (8. vs 9.)" },
                          ]
                          const seed = match.matchKind === "ZWISCHENRUNDE" 
                            ? (seedPairs[match.originalIdx] || { title: `Zwischenrunde ${displayIndex}` })
                            : { title: match.matchKind === "VF" ? `Viertelfinale - VF ${displayIndex}` : match.matchKind === "HF" ? `Halbfinale - HF ${displayIndex}` : "Finale" }

                          let p1Name = match.matchKind === "ZWISCHENRUNDE" ? `Vorrunde ${(seed as any).p1Rank}.` : "Spieler 1"
                          let p2Name = match.matchKind === "ZWISCHENRUNDE" ? `Vorrunde ${(seed as any).p2Rank}.` : "Spieler 2"
                          let p1Obj = null
                          let p2Obj = null

                          if (match.matchKind === "ZWISCHENRUNDE" && isVorrundeComplete) {
                            p1Obj = vorrundeStandings[(seed as any).p1Rank - 1]?.participant
                            p2Obj = vorrundeStandings[(seed as any).p2Rank - 1]?.participant
                            if (p1Obj) p1Name = p1Obj.dummyName || p1Obj.user?.name || p1Name
                            if (p2Obj) p2Name = p2Obj.dummyName || p2Obj.user?.name || p2Name
                          }

                          const winnerId = match.allowanceType
                          const isScored = Boolean(winnerId)
                          const isScheduled = Boolean(match.scheduledDate)
                          const canEdit = canUserEditMatch(match)

                          const headerTitle = match.matchKind === "ZWISCHENRUNDE" 
                            ? `Zwischenrunde - Partie ${displayIndex}`
                            : match.matchKind === "VF" 
                            ? `Viertelfinale - VF ${displayIndex}`
                            : match.matchKind === "HF" 
                            ? `Halbfinale - HF ${displayIndex}`
                            : "Finale"

                          const isPlayersFixed = isMatchPlayersFixed(match)

                          return (
                            <div 
                              key={match.id} 
                              className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 hover:border-emerald-400 transition-all"
                            >
                              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                <span className="text-xs font-black uppercase text-emerald-700">{headerTitle}</span>
                                {isScored ? (
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                                    <CheckCircle2 size={12} />
                                    <span>{formatPlayedDateDisplay(match.scheduledDate || match.updatedAt || match.createdAt)}</span>
                                  </span>
                                ) : isScheduled ? (
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                                    <Clock size={12} className="text-emerald-700" />
                                    <span>{formatScheduledDateDisplay(match.scheduledDate)}</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                    Ausstehend
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-3 items-center text-center">
                                <div className={`p-3 rounded-xl border ${winnerId === p1Obj?.id ? "bg-emerald-100 border-emerald-400 font-black text-emerald-900" : "bg-white border-slate-200 text-slate-800"}`}>
                                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                                    {match.matchKind === "ZWISCHENRUNDE" ? `Rang ${(seed as any).p1Rank}` : "Partei 1"}
                                  </span>
                                  <span className="font-extrabold text-sm">{p1Name}</span>
                                </div>

                                <div className={`p-3 rounded-xl border ${winnerId === p2Obj?.id ? "bg-emerald-100 border-emerald-400 font-black text-emerald-900" : "bg-white border-slate-200 text-slate-800"}`}>
                                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                                    {match.matchKind === "ZWISCHENRUNDE" ? `Rang ${(seed as any).p2Rank}` : "Partei 2"}
                                  </span>
                                  <span className="font-extrabold text-sm">{p2Name}</span>
                                </div>
                              </div>

                              <div className="pt-1 flex justify-between items-center text-xs border-t border-slate-100 mt-2">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  {canEdit ? (
                                    isScored ? "Ergebnis eingetragen" : isScheduled ? "Bereit für Score-Eingabe" : !isPlayersFixed ? "Spieler stehen noch nicht fest" : "Terminierung erforderlich"
                                  ) : session ? "Nur Beteiligte / Admin" : "Log in zum Scoren/Terminieren"}
                                </span>

                                <div className="flex items-center space-x-2">
                                  {canEdit && (
                                    <>
                                      {isScored ? (
                                        <button
                                          type="button"
                                          onClick={() => setActiveModalMatch({ match, round: targetRound })}
                                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-extrabold border border-emerald-300 transition-colors shadow-xs"
                                          title="Score ändern"
                                        >
                                          <Edit3 size={13} />
                                        </button>
                                      ) : isScheduled ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => setActiveScheduleMatch({ match, round: targetRound })}
                                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-bold border border-slate-300 transition-colors"
                                            title="Termin ändern"
                                          >
                                            <Calendar size={13} />
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => setActiveModalMatch({ match, round: targetRound })}
                                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-extrabold border border-emerald-300 transition-colors shadow-xs"
                                          >
                                            <Edit3 size={13} />
                                            <span>Score</span>
                                          </button>
                                        </>
                                      ) : isPlayersFixed ? (
                                        <button
                                          type="button"
                                          onClick={() => setActiveScheduleMatch({ match, round: targetRound })}
                                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-colors shadow-xs"
                                        >
                                          <Calendar size={13} />
                                          <span>Termin vereinbaren</span>
                                        </button>
                                      ) : (
                                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                                          Wartet auf vorherige Runden
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        }
                      })}
                    </div>
                  </div>
                )}

                {/* Vorrunde Single Round Pairings (R1, R2, R3) */}
                {(selectedRoundFilter.startsWith("R")) && (
                  <div className="space-y-4">
                    {/* Sub-panel bar with Round title on left, Sort Dropdown on right */}
                    <div className="bg-white/45 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-xs">
                      <span className="font-black text-emerald-700 uppercase tracking-wider">
                        {activeRound?.name || "Vorrunde"} • {activeRound?.course?.name || "Golfplatz"}
                      </span>

                      {/* Right top Sort Dropdown */}
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">Sortierung:</span>
                        <select
                          value={matchSortOption}
                          onChange={(e) => setMatchSortOption(e.target.value as any)}
                          className="bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-1 text-xs font-black text-emerald-850 focus:ring-emerald-500 focus:outline-none cursor-pointer shadow-xs transition-all"
                        >
                          <option value="MATCH_NUM">Match-Nummer</option>
                          <option value="PLAYED_FIRST">Gespielte zuerst</option>
                          <option value="SOONEST_FIRST">Bald startenden zuerst</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sortRoundMatches((activeRound || r1)?.matches || [], (activeRound || r1)?.id).map((match: any, idx: number) => {
                        const targetRound = activeRound || r1
                        const matchPlayerIds = (match.matchPlayers || []).map((mp: any) => mp.participantId)
                        const matchPlayers = matchPlayerIds.map((id: string) => participants.find((p: any) => p.id === id)).filter(Boolean)

                        const scoresList = matchPlayers.map((p: any) => {
                          const s = p.scores?.find((x: any) => x.roundId === targetRound.id)
                          return { player: p, score: s }
                        })

                        const isScored = scoresList.every((item: any) => item.score && item.score.netStrokes !== null && item.score.grossStrokes !== null)

                        if (isScored) {
                          scoresList.sort((a: any, b: any) => {
                            const aPts = a.score?.points ?? -1
                            const bPts = b.score?.points ?? -1
                            if (bPts !== aPts) return bPts - aPts
                            const aNet = a.score?.netStrokes ?? -1
                            const bNet = b.score?.netStrokes ?? -1
                            if (bNet !== aNet) return bNet - aNet
                            const aGross = a.score?.grossStrokes ?? -1
                            const bGross = b.score?.grossStrokes ?? -1
                            return bGross - aGross
                          })
                        }

                        const isScheduled = Boolean(match.scheduledDate)
                        const canEdit = canUserEditMatch(match)
                        const displayIndex = match.originalIdx !== undefined ? match.originalIdx + 1 : idx + 1
                        const isAnonymized = isRoundPairingsAnonymized(targetRound?.name || "", clConfig)

                        return (
                          <div 
                            key={match.id}
                            className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 hover:border-emerald-400 hover:shadow-md transition-all"
                          >
                            {/* Card Header & Status Badge */}
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                              <span className="text-xs font-black uppercase text-emerald-700 tracking-wider">
                                PARTIE {displayIndex}
                              </span>

                              {isAnonymized ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                  <Lock size={12} className="text-slate-400" />
                                  <span>Auslosung noch verdeckt</span>
                                </span>
                              ) : isScored ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                                  <CheckCircle2 size={12} />
                                  <span>{formatPlayedDateDisplay(match.scheduledDate || match.updatedAt || match.createdAt)}</span>
                                </span>
                              ) : isScheduled ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full shadow-xs">
                                  <Clock size={12} className="text-emerald-700" />
                                  <span>{formatScheduledDateDisplay(match.scheduledDate)}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                  Ausstehend
                                </span>
                              )}
                            </div>

                            {/* Player Rows */}
                            <div className="space-y-2">
                              {scoresList.map((item: any, pIdx: number) => {
                                const p = item.player
                                const s = item.score
                                const pName = isAnonymized ? `Spieler ${pIdx + 1}` : (p.dummyName || p.user?.name || `Player ${pIdx + 1}`)
                                const hcp = isAnonymized ? "—" : (p.compHandicap !== null && p.compHandicap !== undefined ? p.compHandicap : (pIdx + 1))

                                return (
                                  <div 
                                    key={p.id}
                                    className="bg-white border border-slate-200 rounded-xl p-2.5 flex justify-between items-center shadow-xs"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <span className="font-extrabold text-sm text-slate-900">{pName}</span>
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                                        Hcp {hcp}
                                      </span>
                                    </div>
                                    
                                    {isAnonymized ? (
                                      <span className="text-xs text-slate-400 font-mono">—</span>
                                    ) : s && s.netStrokes !== null && s.grossStrokes !== null ? (
                                      <div className="flex items-center space-x-2 text-xs font-mono">
                                        <span className="text-slate-600">NP: <strong className="text-slate-900">{s.netStrokes}</strong></span>
                                        <span className="text-slate-600">BP: <strong className="text-slate-900">{s.grossStrokes}</strong></span>
                                        <span className={`px-2 py-0.5 rounded border ${getMedalBadgeStyle(s.points, scoresList)}`}>
                                          {s.points} Pkt
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-400 font-mono">-</span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>

                            {/* Card Footer Actions: Termin vs Score */}
                            <div className="pt-1 flex justify-between items-center text-xs border-t border-slate-100 mt-2">
                              <span className="text-[11px] font-semibold text-slate-500">
                                {canEdit ? (
                                  isScored ? "Ergebnis eingetragen" : isScheduled ? "Bereit für Score-Eingabe" : "Terminierung erforderlich"
                                ) : session ? "Nur Beteiligte / Admin" : "Log in zum Scoren/Terminieren"}
                              </span>

                              <div className="flex items-center space-x-2">
                                {canEdit && (
                                  <>
                                    {isScored ? (
                                      // Played match: Pencil icon button ONLY for editing score (no Termin ändern)
                                      <button
                                        type="button"
                                        onClick={() => setActiveModalMatch({ match, round: targetRound })}
                                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-extrabold border border-emerald-300 transition-colors shadow-xs"
                                        title="Score ändern"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                    ) : isScheduled ? (
                                      // Scheduled match (not played yet): Score button + Termin calendar icon
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setActiveScheduleMatch({ match, round: targetRound })}
                                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-bold border border-slate-300 transition-colors"
                                          title="Termin ändern"
                                        >
                                          <Calendar size={13} />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setActiveModalMatch({ match, round: targetRound })}
                                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-extrabold border border-emerald-300 transition-colors shadow-xs"
                                        >
                                          <Edit3 size={13} />
                                          <span>Score</span>
                                        </button>
                                      </>
                                    ) : (
                                      // Unscheduled match: ONLY "Termin vereinbaren" button!
                                      <button
                                        type="button"
                                        onClick={() => setActiveScheduleMatch({ match, round: targetRound })}
                                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-colors shadow-xs"
                                      >
                                        <Calendar size={13} />
                                        <span>Termin vereinbaren</span>
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Zwischenrunde Pairings */}
                {selectedRoundFilter === "ZW" && (
                  <div className="space-y-4">
                    <div className="bg-white/45 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-xs">
                      <div>
                        <span className="font-black text-emerald-700 uppercase tracking-wider block">Zwischenrunde • Westendorf</span>
                        <span className="text-slate-600 font-bold text-[11px]">1v1 Matchplay (Platz 5–12)</span>
                      </div>

                      {/* Right top Sort Dropdown */}
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">Sortierung:</span>
                        <select
                          value={matchSortOption}
                          onChange={(e) => setMatchSortOption(e.target.value as any)}
                          className="bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-1 text-xs font-black text-emerald-850 focus:ring-emerald-500 focus:outline-none cursor-pointer shadow-xs transition-all"
                        >
                          <option value="MATCH_NUM">Match-Nummer</option>
                          <option value="PLAYED_FIRST">Gespielte zuerst</option>
                          <option value="SOONEST_FIRST">Bald startenden zuerst</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sortRoundMatches(rZwischen?.matches || [], rZwischen?.id).map((match: any, idx: number) => {
                        const seedPairs = qual.zwischenrundePairs.length > 0 ? qual.zwischenrundePairs : [
                          { p1Rank: 5, p2Rank: 12, title: "Zwischenrunde 1 (5. vs 12.)" },
                          { p1Rank: 6, p2Rank: 11, title: "Zwischenrunde 2 (6. vs 11.)" },
                          { p1Rank: 7, p2Rank: 10, title: "Zwischenrunde 3 (7. vs 10.)" },
                          { p1Rank: 8, p2Rank: 9,  title: "Zwischenrunde 4 (8. vs 9.)" },
                        ]
                        const seed = seedPairs[match.originalIdx ?? idx] || { p1Rank: 5, p2Rank: 12, title: `Zwischenrunde ${idx + 1}` }

                        let p1Name = `Vorrunde ${seed.p1Rank}.`
                        let p2Name = `Vorrunde ${seed.p2Rank}.`
                        let p1Obj = null
                        let p2Obj = null

                        if (isVorrundeComplete) {
                          p1Obj = vorrundeStandings[seed.p1Rank - 1]?.participant
                          p2Obj = vorrundeStandings[seed.p2Rank - 1]?.participant
                          if (p1Obj) p1Name = p1Obj.dummyName || p1Obj.user?.name || p1Name
                          if (p2Obj) p2Name = p2Obj.dummyName || p2Obj.user?.name || p2Name
                        }

                        const winnerId = match.allowanceType
                        const isScored = Boolean(winnerId)
                        const isScheduled = Boolean(match.scheduledDate)
                        const canEdit = canUserEditMatch(match)

                        const isPlayersFixed = isMatchPlayersFixed(match)

                        return (
                          <div 
                            key={match.id} 
                            className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 hover:border-emerald-400 transition-all"
                          >
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <span className="text-xs font-black uppercase text-emerald-700">{seed.title}</span>
                              {isScored ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                                  <CheckCircle2 size={12} />
                                  <span>{formatPlayedDateDisplay(match.scheduledDate || match.updatedAt || match.createdAt)}</span>
                                </span>
                              ) : isScheduled ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                                  <Clock size={12} className="text-emerald-700" />
                                  <span>{formatScheduledDateDisplay(match.scheduledDate)}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                  Ausstehend
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 items-center text-center">
                              <div className={`p-3 rounded-xl border ${winnerId === p1Obj?.id ? "bg-emerald-100 border-emerald-400 font-black text-emerald-900" : "bg-white border-slate-200 text-slate-800"}`}>
                                <span className="text-[10px] uppercase font-bold text-slate-500 block">Rang {seed.p1Rank}</span>
                                <span className="font-extrabold text-sm">{p1Name}</span>
                              </div>

                              <div className={`p-3 rounded-xl border ${winnerId === p2Obj?.id ? "bg-emerald-100 border-emerald-400 font-black text-emerald-900" : "bg-white border-slate-200 text-slate-800"}`}>
                                <span className="text-[10px] uppercase font-bold text-slate-500 block">Rang {seed.p2Rank}</span>
                                <span className="font-extrabold text-sm">{p2Name}</span>
                              </div>
                            </div>

                            <div className="pt-1 flex justify-between items-center text-xs border-t border-slate-100 mt-2">
                              <span className="text-[11px] font-semibold text-slate-500">
                                {canEdit ? (
                                  isScored ? "Ergebnis eingetragen" : isScheduled ? "Bereit für Score-Eingabe" : !isPlayersFixed ? "Spieler stehen noch nicht fest" : "Terminierung erforderlich"
                                ) : session ? "Nur Beteiligte / Admin" : "Log in zum Scoren/Terminieren"}
                              </span>

                              <div className="flex items-center space-x-2">
                                {canEdit && (
                                  <>
                                    {isScored ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const matchWithPlayers = {
                                            ...match,
                                            matchPlayers: [
                                              { participantId: p1Obj?.id || "" },
                                              { participantId: p2Obj?.id || "" }
                                            ]
                                          }
                                          setActiveModalMatch({ match: matchWithPlayers, round: rZwischen })
                                        }}
                                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-extrabold border border-emerald-300 transition-colors shadow-xs"
                                        title="Score ändern"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                    ) : isScheduled ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const matchWithPlayers = {
                                              ...match,
                                              matchPlayers: [
                                                { participantId: p1Obj?.id || "" },
                                                { participantId: p2Obj?.id || "" }
                                              ]
                                            }
                                            setActiveScheduleMatch({ match: matchWithPlayers, round: rZwischen })
                                          }}
                                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-bold border border-slate-300 transition-colors"
                                          title="Termin ändern"
                                        >
                                          <Calendar size={13} />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const matchWithPlayers = {
                                              ...match,
                                              matchPlayers: [
                                                { participantId: p1Obj?.id || "" },
                                                { participantId: p2Obj?.id || "" }
                                              ]
                                            }
                                            setActiveModalMatch({ match: matchWithPlayers, round: rZwischen })
                                          }}
                                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-extrabold border border-emerald-300 transition-colors shadow-xs"
                                        >
                                          <Edit3 size={13} />
                                          <span>Score</span>
                                        </button>
                                      </>
                                    ) : isPlayersFixed ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const matchWithPlayers = {
                                            ...match,
                                            matchPlayers: [
                                              { participantId: p1Obj?.id || "" },
                                              { participantId: p2Obj?.id || "" }
                                            ]
                                          }
                                          setActiveScheduleMatch({ match: matchWithPlayers, round: rZwischen })
                                        }}
                                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-colors shadow-xs"
                                      >
                                        <Calendar size={13} />
                                        <span>Termin vereinbaren</span>
                                      </button>
                                    ) : (
                                      <span className="text-[11px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                                        Wartet auf Vorrunde
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Playoffs Pairings */}
                {selectedRoundFilter === "PLAYOFFS" && (
                  <div className="space-y-6">
                    {/* Header bar with Sort Dropdown for Playoffs */}
                    <div className="bg-white/45 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-xs">
                      <div>
                        <span className="font-black text-emerald-700 uppercase tracking-wider block">Playoffs • K.O.-Runden</span>
                        <span className="text-slate-600 font-bold text-[11px]">Viertelfinale, Halbfinale & Finale</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">Sortierung:</span>
                        <select
                          value={matchSortOption}
                          onChange={(e) => setMatchSortOption(e.target.value as any)}
                          className="bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-1 text-xs font-black text-emerald-850 focus:ring-emerald-500 focus:outline-none cursor-pointer shadow-xs transition-all"
                        >
                          <option value="MATCH_NUM">Match-Nummer</option>
                          <option value="PLAYED_FIRST">Gespielte zuerst</option>
                          <option value="SOONEST_FIRST">Bald startenden zuerst</option>
                        </select>
                      </div>
                    </div>

                    {/* Viertelfinale */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Viertelfinale (Schönborn)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sortRoundMatches(rVF?.matches || [], rVF?.id).map((match: any, idx: number) => {
                          const vfTitles = [
                            "VF 1: Vorrunde 1. vs Sieger (8. v 9.)",
                            "VF 2: Vorrunde 2. vs Sieger (5. v 12.)",
                            "VF 3: Vorrunde 3. vs Sieger (6. v 11.)",
                            "VF 4: Vorrunde 4. vs Sieger (7. v 10.)"
                          ]
                          const canEdit = canUserEditMatch(match)
                          const isScheduled = Boolean(match.scheduledDate)
                          const isScored = Boolean(match.allowanceType)
                          const titleIndex = match.originalIdx ?? idx
                          const isPlayersFixed = isMatchPlayersFixed(match)

                          return (
                            <div 
                              key={match.id} 
                              className="bg-white/60 border border-slate-200 rounded-2xl p-4 space-y-3 hover:border-emerald-400 transition-all"
                            >
                              <div className="text-xs font-black text-emerald-700 flex justify-between items-center">
                                <span>{vfTitles[titleIndex] || `VF ${titleIndex + 1}`}</span>
                                {isScored ? (
                                  <span className="text-[10px] bg-emerald-50 border border-emerald-300 text-emerald-700 px-2 py-0.5 rounded font-bold">
                                    {formatPlayedDateDisplay(match.scheduledDate || match.updatedAt || match.createdAt)}
                                  </span>
                                ) : isScheduled ? (
                                  <span className="text-[10px] bg-emerald-100 border border-emerald-300 text-slate-800 px-2 py-0.5 rounded font-bold">
                                    {formatScheduledDateDisplay(match.scheduledDate)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded font-bold">
                                    Ausstehend
                                  </span>
                                )}
                              </div>

                              <div className="bg-white border border-slate-200 p-3 rounded-xl flex justify-between items-center text-xs font-bold text-slate-800">
                                <span>Matchplay Partie {titleIndex + 1}</span>
                                {canEdit && (
                                  <div className="flex items-center space-x-2">
                                    {!isScheduled ? (
                                      isPlayersFixed ? (
                                        <button 
                                          onClick={() => setActiveScheduleMatch({ match, round: rVF })}
                                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-extrabold shadow-xs"
                                        >
                                          Termin vereinbaren
                                        </button>
                                      ) : (
                                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                          Wartet auf Vorrunde/Zwischenrunde
                                        </span>
                                      )
                                    ) : isScored ? (
                                      <button 
                                        onClick={() => setActiveModalMatch({ match, round: rVF })} 
                                        className="p-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-extrabold"
                                        title="Score ändern"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                    ) : (
                                      <>
                                        <button 
                                          onClick={() => setActiveScheduleMatch({ match, round: rVF })} 
                                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-300"
                                          title="Termin ändern"
                                        >
                                          <Calendar size={13} />
                                        </button>
                                        <button 
                                          onClick={() => setActiveModalMatch({ match, round: rVF })} 
                                          className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-extrabold"
                                        >
                                          Score
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Halbfinale */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Halbfinale (Diamond Country Club)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sortRoundMatches(rHF?.matches || [], rHF?.id).map((match: any, idx: number) => {
                          const canEdit = canUserEditMatch(match)
                          const isScheduled = Boolean(match.scheduledDate)
                          const isScored = Boolean(match.allowanceType)
                          const titleIndex = match.originalIdx ?? idx
                          const isPlayersFixed = isMatchPlayersFixed(match)

                          return (
                            <div 
                              key={match.id} 
                              className="bg-white/60 border border-slate-200 rounded-2xl p-4 space-y-3 hover:border-emerald-400 transition-all"
                            >
                              <div className="text-xs font-black text-emerald-700 flex justify-between items-center">
                                <span>Halbfinale {titleIndex + 1}</span>
                                {isScored ? (
                                  <span className="text-[10px] bg-emerald-50 border border-emerald-300 text-emerald-700 px-2 py-0.5 rounded font-bold">
                                    {formatPlayedDateDisplay(match.scheduledDate || match.updatedAt || match.createdAt)}
                                  </span>
                                ) : isScheduled ? (
                                  <span className="text-[10px] bg-emerald-100 border border-emerald-300 text-slate-800 px-2 py-0.5 rounded font-bold">
                                    {formatScheduledDateDisplay(match.scheduledDate)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded font-bold">
                                    Ausstehend
                                  </span>
                                )}
                              </div>

                              <div className="bg-white border border-slate-200 p-3 rounded-xl flex justify-between items-center text-xs font-bold text-slate-800">
                                <span>{titleIndex === 0 ? "Sieger VF1 vs Sieger VF4" : "Sieger VF2 vs Sieger VF3"}</span>
                                {canEdit && (
                                  <div className="flex items-center space-x-2">
                                    {!isScheduled ? (
                                      isPlayersFixed ? (
                                        <button 
                                          onClick={() => setActiveScheduleMatch({ match, round: rHF })}
                                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-extrabold shadow-xs"
                                        >
                                          Termin vereinbaren
                                        </button>
                                      ) : (
                                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                          Wartet auf Viertelfinale
                                        </span>
                                      )
                                    ) : isScored ? (
                                      <button 
                                        onClick={() => setActiveModalMatch({ match, round: rHF })} 
                                        className="p-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-extrabold"
                                        title="Score ändern"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                    ) : (
                                      <>
                                        <button 
                                          onClick={() => setActiveScheduleMatch({ match, round: rHF })} 
                                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-300"
                                          title="Termin ändern"
                                        >
                                          <Calendar size={13} />
                                        </button>
                                        <button 
                                          onClick={() => setActiveModalMatch({ match, round: rHF })} 
                                          className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-extrabold"
                                        >
                                          Score
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Finale */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-amber-700 uppercase tracking-wider">Finale (Fontana)</h4>
                      {(rFin?.matches || []).map((match: any) => {
                        const canEdit = canUserEditMatch(match)
                        const isScheduled = Boolean(match.scheduledDate)
                        const isScored = Boolean(match.allowanceType)
                        const isPlayersFixed = isMatchPlayersFixed(match)

                        return (
                          <div 
                            key={match.id} 
                            className="bg-white/80 border-2 border-amber-300 rounded-2xl p-4 shadow-sm space-y-3"
                          >
                            <div className="flex justify-between items-center text-xs font-black">
                              <span>Sieger Halbfinale 1 vs Sieger Halbfinale 2</span>
                              {isScored ? (
                                <span className="text-[10px] bg-amber-100 border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-bold">
                                  {formatPlayedDateDisplay(match.scheduledDate || match.updatedAt || match.createdAt)}
                                </span>
                              ) : isScheduled ? (
                                <span className="text-[10px] bg-emerald-100 border border-emerald-300 text-slate-800 px-2 py-0.5 rounded font-bold">
                                  {formatScheduledDateDisplay(match.scheduledDate)}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded font-bold">
                                  Ausstehend
                                </span>
                              )}
                            </div>

                            {canEdit && (
                              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                                {!isScheduled ? (
                                  isPlayersFixed ? (
                                    <button 
                                      onClick={() => setActiveScheduleMatch({ match, round: rFin })} 
                                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs"
                                    >
                                      Termin vereinbaren
                                    </button>
                                  ) : (
                                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg">
                                      Wartet auf Halbfinale
                                    </span>
                                  )
                                ) : isScored ? (
                                  <button 
                                    onClick={() => setActiveModalMatch({ match, round: rFin })} 
                                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-xs"
                                  >
                                    Finale Score Ändern
                                  </button>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => setActiveScheduleMatch({ match, round: rFin })} 
                                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold"
                                      title="Termin ändern"
                                    >
                                      <Calendar size={13} />
                                    </button>
                                    <button 
                                      onClick={() => setActiveModalMatch({ match, round: rFin })} 
                                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-xs"
                                    >
                                      Finale Scoren
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- SECTION B: STANDINGS TABLE (MAIN, NETTO, BRUTTO) --- */}
            {selectedLeaderboardType !== "PAIRINGS" && (
              <div className="space-y-4">
                <div className="bg-white/45 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 flex flex-wrap justify-between items-center text-xs font-semibold text-slate-700">
                  <div>
                    Wertung: <strong className="text-slate-900">{selectedLeaderboardType === "MAIN" ? "Match-Punkte (4/2/0)" : selectedLeaderboardType === "NETTO" ? "Netto Stableford (NP)" : "Brutto Stableford (BP)"}</strong>
                  </div>
                  <div>
                    <span className="text-emerald-700 font-black">Top {qual.directPlayoffRanks.length} = {qual.playoffStages[0]}</span>
                    {qual.zwischenrundePairs.length > 0 && (
                      <span> • <span className="text-cyan-700 font-black">{qual.directPlayoffRanks.length + 1}.–{qual.directPlayoffRanks.length + qual.zwischenrundePairs.length * 2}. = Zwischenrunde</span></span>
                    )}
                  </div>
                </div>

                <div className="bg-white/70 backdrop-blur-md border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/70 text-[11px] font-black uppercase text-slate-600 tracking-wider border-b border-slate-200">
                          <th className="py-3.5 px-4 text-center w-16">Rang</th>
                          <th className="py-3.5 px-4">Spieler</th>
                          <th className="py-3.5 px-4 text-center w-24">Matches</th>
                          <th className="py-3.5 px-4 text-center w-28">Match-Pkt</th>
                          <th className="py-3.5 px-4 text-center w-24">Netto (NP)</th>
                          <th className="py-3.5 px-4 text-center w-24">Brutto (BP)</th>
                          <th className="py-3.5 px-4 text-right pr-6 w-32">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-800">
                        {rankedStandings.map((row: any) => {
                          const isDirectPlayoff = row.originalRank <= qual.directPlayoffRanks.length
                          const isPlayIn = qual.zwischenrundePairs.length > 0 && row.originalRank > qual.directPlayoffRanks.length && row.originalRank <= (qual.directPlayoffRanks.length + qual.zwischenrundePairs.length * 2)

                          return (
                            <tr 
                              key={row.participant.id}
                              className={`hover:bg-slate-50 transition-colors ${
                                isDirectPlayoff 
                                  ? "bg-emerald-50/40 border-l-4 border-l-emerald-500" 
                                  : isPlayIn 
                                  ? "bg-cyan-50/40 border-l-4 border-l-cyan-500" 
                                  : ""
                              }`}
                            >
                              <td className="py-3.5 px-4 text-center font-black text-slate-900">
                                {row.rankDisplay}
                              </td>

                              <td className="py-3.5 px-4 font-extrabold text-slate-900">
                                {row.name}
                              </td>

                              <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                                {row.playedMatches} / {clConfig.vorrundenCount}
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                <span className="font-black text-emerald-800 font-mono bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg">
                                  {row.matchPoints} Pkt
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900">
                                {row.totalNetto}
                              </td>

                              <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                                {row.totalBrutto}
                              </td>

                              <td className="py-3.5 px-4 text-right pr-6 text-xs font-extrabold">
                                {isDirectPlayoff ? (
                                  <span className="text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full">
                                    {qual.playoffStages[0]}
                                  </span>
                                ) : isPlayIn ? (
                                  <span className="text-cyan-800 bg-cyan-100 border border-cyan-300 px-2.5 py-1 rounded-full">
                                    Zwischenrunde
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Ausscheiden</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- DETAILS TAB (ONLY Reglement & Austragungsmodus) --- */}
        {activeTab === 'details' && (
          <div className="bg-white/60 backdrop-blur-md border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-xl font-black text-slate-900">Mattsee Wintercup 27 – Reglement & Austragungsmodus</h3>
              <p className="text-xs text-slate-500 mt-1">Indoor Golf Simulator Serie mit 24 Spielern</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-700">
              <div className="space-y-3">
                <h4 className="font-extrabold text-emerald-700 text-xs uppercase tracking-wider">Vorrunde (Spieltage 1–3)</h4>
                <ul className="space-y-2 list-disc list-inside text-xs leading-relaxed text-slate-600">
                  <li>3 Vorrunden-Partien à 3 Spieler (Adamstal, Schladming, Altentann).</li>
                  <li>Alle Spieler spielen mit ihrem exakten Handicap (kein Course Handicap Abzug indoor).</li>
                  <li>Netto Stableford (NP) & Brutto Stableford (BP) Punkte pro Partie.</li>
                  <li>Matchpunkte: 1. Platz = 4 Pkt, 2. Platz = 2 Pkt, 3. Platz = 0 Pkt (Teilung bei Punktegleichstand).</li>
                  <li>Rangfolge: Matchpunkte → Spiele → Netto → Brutto.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-extrabold text-cyan-700 text-xs uppercase tracking-wider">Zwischenrunde & Playoffs</h4>
                <ul className="space-y-2 list-disc list-inside text-xs leading-relaxed text-slate-600">
                  <li>Plätze 1–4 steigen direkt ins Viertelfinale auf.</li>
                  <li>Plätze 5–12 spielen in der Zwischenrunde (Westendorf) 1v1 Matchplay.</li>
                  <li>Viertelfinale (Schönborn), Halbfinale (Diamond CC) & Finale (Fontana).</li>
                  <li>1v1 Matchplay Ergebnisse (2 up, 3&1, 1ext etc.).</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* --- ADMIN TAB --- */}
        {activeTab === 'admin' && isAdminUser && (
          <WintercupAdminView competition={competition} session={session} />
        )}

      </main>

      {/* SCORE MODAL */}
      {activeModalMatch && (
        <WintercupScoreModal
          match={activeModalMatch.match}
          round={activeModalMatch.round}
          competition={competition}
          session={session}
          onClose={() => setActiveModalMatch(null)}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* SCHEDULE MODAL */}
      {activeScheduleMatch && (
        <WintercupScheduleModal
          match={activeScheduleMatch.match}
          round={activeScheduleMatch.round}
          competition={competition}
          session={session}
          onClose={() => setActiveScheduleMatch(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  )
}
