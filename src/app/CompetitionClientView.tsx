"use client"

import { TeamScorecardModal } from "./components/TeamScorecardModal"
import { MatchplayScorecardModal } from "./components/MatchplayScorecardModal"
import { PlayerScorecardModal } from "./components/PlayerScorecardModal"
import { useState, useEffect } from "react"
import { signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { 
  Trophy, BookOpen, Key, LogOut, CheckCircle, 
  Settings, ChevronRight, Users, Play, Edit, 
  HelpCircle, Eye, RefreshCw, X, Loader2, Save, Trash2, ShieldAlert, Home, Plus, Share2
} from "lucide-react"

import { 
  calculateCourseHandicap, 
  getHandicapStrokesOnHole, 
  calculateStablefordPoints, 
  assignLeaderboardRanks,
  getRoundHoleInfo
} from "@/lib/scoring"
import { getTeamColorConfig, TEAM_COLOR_LIST } from "@/lib/teamColors"

import { 
  saveManualRoundHandicap, 
  recalculateRoundHandicaps, 
  recalculatePlayerHandicaps, 
  resetAllScores, 
  resetRoundScores, 
  resetPlayerScores, 
  resetPlayerRoundScores 
} from "@/app/actions/scores"

import { 
  updateCompetitionGeneral, 
  addRound, 
  deleteRound, 
  updateRoundHoles,
  addTeam, 
  deleteTeam, 
  updateTeamColor,
  addParticipant, 
  deleteParticipant,
  updateParticipant,
  addMatch,
  deleteMatch,
  updateMatchAllowance,
  updateMatchPlayUntilEnd,
  updateMatchHoleRange,
  updateMatchPlayerAllowance
} from "@/app/admin/competitions/actions"

import { BulkScorecardEntry } from "./BulkScorecardEntry"
import { LiveScoreEntry } from "./LiveScoreEntry"

// Helpers for dates
const formatDateInput = (dateVal: any) => {
  if (!dateVal) return ""
  return new Date(dateVal).toISOString().split('T')[0]
}

const formatDateTimeInput = (dateVal: any) => {
  if (!dateVal) return ""
  const date = new Date(dateVal)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const getTeamHue = (team: any, teams: any[] = []): number => {
  if (!team) return 210 // Default blue-ish
  
  if (typeof team === 'string') {
    const matchedTeam = teams.find(t => t.name.toLowerCase() === team.toLowerCase())
    if (matchedTeam) {
      return getTeamHue(matchedTeam, teams)
    }
    // Fallback: generate hue deterministically from name
    let hash = 0
    for (let i = 0; i < team.length; i++) {
      hash = team.charCodeAt(i) + ((hash << 5) - hash)
    }
    return Math.abs(hash % 360)
  }

  const idx = teams.findIndex(t => t.id === team.id)
  const config = getTeamColorConfig(team.color, idx === -1 ? 0 : idx)
  return config.hue
}

const getTeamRowStyle = (team: any, teams: any[] = []) => {
  const hue = getTeamHue(team, teams)
  return {
    backgroundColor: `hsla(${hue}, 85%, 97%, 0.65)`,
    borderLeft: `4px solid hsl(${hue}, 75%, 55%)`
  }
}



export function getPlayingHandicap(p: any, round: any) {
  if (!round) return 0
  // Check manual override
  const manualHcp = p.manualRoundHandicaps?.find((mr: any) => mr.roundId === round.id)
  if (manualHcp !== undefined && manualHcp !== null) {
    return manualHcp.handicapValue
  }

  // Fall back to WHS formula using round tee and course
  const course = round.course
  if (!course) return 0

  const tee = round.tee ||
              course.tees?.find((t: any) => t.name.toLowerCase().includes('yellow')) ||
              course.tees?.find((t: any) => t.name.toLowerCase().includes('white')) ||
              course.tees?.[0]

  if (!tee || p.compHandicap === null || p.compHandicap === undefined) return 0

  const coursePar = course.holes.reduce((sum: number, h: any) => sum + h.par, 0)
  return calculateCourseHandicap(p.compHandicap, tee, coursePar)
}

export function getMatchAllowance(match: any, hcpA: number, hcpB: number) {
  if (match.handicapAllowance !== null && match.handicapAllowance !== undefined) {
    return match.handicapAllowance
  }
  const diff = Math.abs(hcpA - hcpB)
  const allowanceType = match.allowanceType || "75%"
  let percentage = 0.75
  if (allowanceType === "50%") percentage = 0.50
  if (allowanceType === "100%") percentage = 1.00
  if (allowanceType === "0%") percentage = 0.00
  return Math.round(diff * percentage)
}

export function getPlayerCalculatedAllowance(mp: any, match: any, round: any, participants: any[]) {
  if (mp.handicapAllowance !== null && mp.handicapAllowance !== undefined) {
    return mp.handicapAllowance
  }
  const p = participants.find((x: any) => x.id === mp.participantId)
  if (!p) return 0

  const pHcp = getPlayingHandicap(p, round)

  const matchPlayersList = match.matchPlayers.map((x: any) => participants.find((y: any) => y.id === x.participantId)).filter(Boolean)
  const hcps = matchPlayersList.map((x: any) => getPlayingHandicap(x, round))

  if (match.type === "TEAM_MATCHPLAY") {
    if (hcps.length === 0) return 0
    const minPH = Math.min(...hcps)
    const diff = pHcp - minPH
    const allowanceType = match.allowanceType || "75%"
    let percentage = 0.75
    if (allowanceType === "50%") percentage = 0.50
    if (allowanceType === "100%") percentage = 1.00
    if (allowanceType === "0%") percentage = 0.00
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

export function getHoleRangeString(round: any): string {
  if (!round) return "1-18"
  
  if (round.ninePreset === 'FRONT_9_TWICE' || round.ninePreset === 'BACK_9_TWICE') {
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

export function getMatchHoleStrokesMap(matchHoles: number[], round: any, allowance: number) {
  const holeInfos = matchHoles.map(num => {
    const hole = round.course.holes.find((h: any) => h.number === num)
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

interface CompetitionClientViewProps {
  competition: any
  session: any
  courses: any[]
  users: any[]
}

export function CompetitionClientView({ competition, session, courses = [], users = [] }: CompetitionClientViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'details' | 'scores' | 'admin'>('leaderboard')

  // parse cssConfig for primaryColor
  let primaryColor = "#059669" // default emerald-600
  try {
    if (competition.cssConfig) {
      const parsed = JSON.parse(competition.cssConfig)
      if (parsed.primaryColor) primaryColor = parsed.primaryColor
    }
  } catch (_) {}

  const getPlayableHolesForRound = (round: any) => {
    const roundHoles = round.holesPlayed && round.holesPlayed.length > 0
      ? [...round.holesPlayed].sort((a: number, b: number) => a - b)
      : Array.from({ length: 18 }, (_, i) => i + 1)

    const hasAnyScores = (competition.participants || []).some((p: any) =>
      (p.scores || []).some((s: any) => s.roundId === round.id && (s.grossStrokes !== null || s.status === 'WIPED'))
    )
    if (!hasAnyScores) return roundHoles

    return roundHoles.filter((holeNum: number) => {
      const hole = round.course.holes.find((h: any) => h.number === holeNum)
      if (!hole) return false

      const holeScores = (competition.participants || [])
        .map((p: any) => (p.scores || []).find((s: any) => s.roundId === round.id && s.holeId === hole.id))
        .filter(Boolean)

      const isExcluded = holeScores.length > 0 && holeScores.every((s: any) => s.status === 'NOT_PLAYED')
      return !isExcluded
    })
  }

  // compute totalCompHoles
  let totalCompHoles = 0
  for (const round of (competition.rounds || [])) {
    totalCompHoles += getPlayableHolesForRound(round).length
  }


  
  // Leaderboard filters
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>("TOTAL")
  const [selectedLeaderboardType, setSelectedLeaderboardType] = useState<string>("MAIN")

  const [shareCopied, setShareCopied] = useState(false)

  const handleShareView = () => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.set("round", selectedRoundFilter)
      url.searchParams.set("type", selectedLeaderboardType)
      
      navigator.clipboard.writeText(url.toString())
        .then(() => {
          setShareCopied(true)
          setTimeout(() => setShareCopied(false), 2000)
        })
        .catch(err => {
          console.error("Could not copy URL: ", err)
        })
    }
  }
  
  // Scorecard modal state
  const [selectedParticipantForScorecard, setSelectedParticipantForScorecard] = useState<any | null>(null)
  const [selectedRoundIdForScorecard, setSelectedRoundIdForScorecard] = useState<string | null>(null)
  const [selectedMatchForScorecard, setSelectedMatchForScorecard] = useState<any | null>(null)
  const [selectedMatchRoundForScorecard, setSelectedMatchRoundForScorecard] = useState<any | null>(null)
  const [selectedTeamForScorecard, setSelectedTeamForScorecard] = useState<any | null>(null)
  
  // Score Entry state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  
  // Score Entry setup state (persisted in localStorage)
  const [selectedRoundId, setSelectedRoundId] = useState(competition.rounds[0]?.id || "")
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [entryMode, setEntryMode] = useState<'LIVE' | 'BULK'>('LIVE')
  const [setupConfirmed, setSetupConfirmed] = useState(false)
  const [liveHoleIndex, setLiveHoleIndex] = useState(0)
  const [focusInputId, setFocusInputId] = useState("")

  // Admin section sub-tab
  const [adminSubTab, setAdminSubTab] = useState<'configure' | 'audit' | 'danger'>('configure')
  const [configureSubTab, setConfigureSubTab] = useState<'general' | 'rounds' | 'teams' | 'participants' | 'matches'>('general')

  // Manual course handicaps editing state (overrides map)
  const [manualHandicapInputValues, setManualHandicapInputValues] = useState<Record<string, string>>({}) // key: "partId-courseId" -> string
  const [savingManualHandicap, setSavingManualHandicap] = useState<Record<string, boolean>>({})

  // Editable compHandicap state
  const [compHandicapInputValues, setCompHandicapInputValues] = useState<Record<string, string>>({})
  const [savingCompHandicap, setSavingCompHandicap] = useState<Record<string, boolean>>({})

  // Admin settings states
  const [compName, setCompName] = useState(competition.name)
  const [compSlug, setCompSlug] = useState(competition.uniqueSlug)
  const [compType, setCompType] = useState(competition.type)
  const [isTeamComp, setIsTeamComp] = useState(competition.isTeamComp)
  const [startDate, setStartDate] = useState(formatDateInput(competition.startDate))
  const [endDate, setEndDate] = useState(formatDateInput(competition.endDate))
  const [cssConfig, setCssConfig] = useState(competition.cssConfig || "")
  const [bgImage, setBgImage] = useState(competition.bgImage || "")
  const [selectedExtraLeaderboards, setSelectedExtraLeaderboards] = useState<string[]>(competition.extraLeaderboards || [])
  const [showRelToPar, setShowRelToPar] = useState(competition.showRelToPar || false)
  const [isSavingGeneral, setIsSavingGeneral] = useState(false)
  const [generalError, setGeneralError] = useState("")
  const [generalSuccess, setGeneralSuccess] = useState(false)

  // Admin rounds setup state
  const [newRoundName, setNewRoundName] = useState("")
  const [newRoundCourseId, setNewRoundCourseId] = useState(courses[0]?.id || "")
  const [newRoundTeeId, setNewRoundTeeId] = useState("")
  const [newRoundStart, setNewRoundStart] = useState("")
  const [newRoundEnd, setNewRoundEnd] = useState("")
  const [newRoundHolesPreset, setNewRoundHolesPreset] = useState<'ALL' | 'FRONT' | 'BACK' | 'FRONT_TWICE' | 'BACK_TWICE' | 'RANGE' | 'CUSTOM'>('ALL')
  const [newRoundHoleRange, setNewRoundHoleRange] = useState("")
  const [newRoundCustomHoles, setNewRoundCustomHoles] = useState<number[]>(Array.from({ length: 18 }, (_, i) => i + 1))
  const [isAddingRound, setIsAddingRound] = useState(false)
  const [roundError, setRoundError] = useState("")

  // Edit Round inline state
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null)
  const [editingHolesPreset, setEditingHolesPreset] = useState<'ALL' | 'FRONT' | 'BACK' | 'FRONT_TWICE' | 'BACK_TWICE' | 'RANGE' | 'CUSTOM'>('ALL')
  const [editingHoleRange, setEditingHoleRange] = useState("")
  const [editingCustomHoles, setEditingCustomHoles] = useState<number[]>([])
  const [editingRoundTeeId, setEditingRoundTeeId] = useState("")
  const [isUpdatingRound, setIsUpdatingRound] = useState(false)
  const [editingRoundError, setEditingRoundError] = useState("")

  // Admin teams state
  const [newTeamName, setNewTeamName] = useState("")
  const [isAddingTeam, setIsAddingTeam] = useState(false)
  const [teamError, setTeamError] = useState("")
  const [localTeamColors, setLocalTeamColors] = useState<Record<string, string>>({})

  // Admin participants state
  const [participantMode, setParticipantMode] = useState<'registered' | 'dummy'>('registered')
  const [partUserId, setPartUserId] = useState("")
  const [partDummyName, setPartDummyName] = useState("")
  const [partHandicap, setPartHandicap] = useState("")
  const [partTeamId, setPartTeamId] = useState("")
  const [isAddingParticipant, setIsAddingParticipant] = useState(false)
  const [partError, setPartError] = useState("")

  // Danger zone reset states
  const [dangerResetRoundId, setDangerResetRoundId] = useState("")
  const [dangerResetPlayerId, setDangerResetPlayerId] = useState("")
  const [isResetting, setIsResetting] = useState(false)

  // Matches / Pairings State
  const [matchType, setMatchType] = useState("SINGLES")
  const [allowanceType, setAllowanceType] = useState("75%")
  const [playUntilEnd, setPlayUntilEnd] = useState(false)
  const [holeRange, setHoleRange] = useState("1-18")
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([])
  const [overrideAllowances, setOverrideAllowances] = useState<Record<string, string>>({})
  const [savingAllowance, setSavingAllowance] = useState<Record<string, boolean>>({})
  const [overrideMatchPlayerAllowances, setOverrideMatchPlayerAllowances] = useState<Record<string, string>>({})
  const [savingMatchPlayerAllowance, setSavingMatchPlayerAllowance] = useState<Record<string, boolean>>({})
  const [overrideHoleRanges, setOverrideHoleRanges] = useState<Record<string, string>>({})
  const [savingHoleRange, setSavingHoleRange] = useState<Record<string, boolean>>({})
  const [pairingError, setPairingError] = useState("")
  const [isCreatingPairing, setIsCreatingPairing] = useState(false)

  const selectedRound = competition.rounds.find((r: any) => r.id === selectedRoundId)

  // Handle credentials login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    setLoginError("")
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: loginEmail,
        password: loginPassword
      })
      if (res?.error) {
        setLoginError("Invalid email or password.")
      } else {
        router.refresh()
      }
    } catch (err: any) {
      setLoginError(err.message || "An unexpected error occurred.")
    } finally {
      setIsLoggingIn(false)
    }
  }

  const selectedScoringRound = competition.rounds.find((r: any) => r.id === selectedRoundId) || competition.rounds[0]
  const selectedScoringPlayers = competition.participants.filter((p: any) => selectedPlayerIds.includes(p.id))

  const scoringMatch = selectedScoringRound?.matches?.find((m: any) => 
    m.matchPlayers.some((mp: any) => selectedPlayerIds.includes(mp.participantId))
  )
  const roundHoles = selectedScoringRound?.holesPlayed && selectedScoringRound.holesPlayed.length > 0
    ? [...selectedScoringRound.holesPlayed].sort((a: number, b: number) => a - b)
    : Array.from({ length: 18 }, (_, i) => i + 1)
  const scoringHoles = scoringMatch 
    ? parseHoleRange(scoringMatch.holeRange, roundHoles)
    : roundHoles

  const handleToggleEntryMode = (newMode: 'LIVE' | 'BULK') => {
    const rounds = competition.rounds || []
    const scoringRound = rounds.find((r: any) => r.id === selectedRoundId) || rounds[0]
    const scoringPlayers = competition.participants.filter((p: any) => selectedPlayerIds.includes(p.id))

    const match = scoringRound?.matches?.find((m: any) => 
      m.matchPlayers.some((mp: any) => selectedPlayerIds.includes(mp.participantId))
    )
    const roundHoles = scoringRound?.holesPlayed && scoringRound.holesPlayed.length > 0
      ? [...scoringRound.holesPlayed].sort((a: number, b: number) => a - b)
      : Array.from({ length: 18 }, (_, i) => i + 1)
    const activeHoles = match 
      ? parseHoleRange(match.holeRange, roundHoles)
      : roundHoles

    if (newMode === 'LIVE') {
      const firstIncompleteIdx = findFirstIncompleteHoleIndex(scoringRound, scoringPlayers, activeHoles)
      setLiveHoleIndex(firstIncompleteIdx)
      setEntryMode('LIVE')
      setSetupConfirmed(true)
    } else {
      let focusId = ""
      outerLoop: for (let pIdx = 0; pIdx < scoringPlayers.length; pIdx++) {
        const p = scoringPlayers[pIdx]
        for (const holeNum of activeHoles) {
          const hole = scoringRound.course.holes.find((h: any) => h.number === holeNum)
          if (hole) {
            const score = p.scores.find((s: any) => s.roundId === scoringRound.id && s.holeId === hole.id)
            if (!score || (score.status === null && score.grossStrokes === null)) {
              focusId = `input-${pIdx}-${holeNum}`
              break outerLoop
            }
          }
        }
      }
      if (!focusId) {
        focusId = `input-0-${activeHoles[0]}`
      }
      setFocusInputId(focusId)
      setEntryMode('BULK')
      setSetupConfirmed(true)
    }
    
    saveSetupToStorage(selectedRoundId, selectedPlayerIds, newMode, true)
  }

  const handleLiveHoleChange = (idx: number) => {
    setLiveHoleIndex(idx)
    if (typeof window !== "undefined") {
      localStorage.setItem(`setup-hole-${competition.id}`, idx.toString())
    }
  }

  // Dynamic document title update
  useEffect(() => {
    if (activeTab === 'admin') {
      document.title = "leaderboard.io - admin"
    } else {
      document.title = `leaderboard.io - ${competition.name}`
    }
  }, [activeTab, competition.name])

  // Sync input values when competition participants prop updates from server
  useEffect(() => {
    setCompHandicapInputValues({})
  }, [competition.participants])

  // Initialize selected tee when round course changes
  const selectedCourseForNewRound = courses.find(c => c.id === newRoundCourseId)
  useEffect(() => {
    if (selectedCourseForNewRound?.tees?.length > 0) {
      setNewRoundTeeId(selectedCourseForNewRound.tees[0].id)
    } else {
      setNewRoundTeeId("")
    }
  }, [newRoundCourseId, selectedCourseForNewRound])

  // Pre-populate match holeRange state from round holesPlayed
  useEffect(() => {
    const r = competition.rounds.find((x: any) => x.id === selectedRoundId)
    if (r) {
      setHoleRange(getHoleRangeString(r))
    }
  }, [selectedRoundId, competition.rounds])

  // Local storage persistence for setups and setting mount cookie
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Set cookie to remember this competition
      document.cookie = `last-comp-slug=${competition.uniqueSlug}; path=/; max-age=31536000; SameSite=Lax`

      const savedRoundId = localStorage.getItem(`setup-round-${competition.id}`)
      const savedPlayers = localStorage.getItem(`setup-players-${competition.id}`)
      const savedMode = localStorage.getItem(`setup-mode-${competition.id}`)
      const savedConfirmed = localStorage.getItem(`setup-confirmed-${competition.id}`)
      const savedHoleIdx = localStorage.getItem(`setup-hole-${competition.id}`)

      const savedTab = localStorage.getItem(`active-tab-${competition.id}`)
      const savedLeaderboard = localStorage.getItem(`leaderboard-type-${competition.id}`)
      const savedRoundFilter = localStorage.getItem(`round-filter-${competition.id}`)

      // Determine initial round ID (must exist in this competition)
      const isValidSavedRound = competition.rounds.some((r: any) => r.id === savedRoundId)
      const initialRoundId = isValidSavedRound 
        ? (savedRoundId as string)
        : (competition.rounds[0]?.id || "")

      setSelectedRoundId(initialRoundId)

      let activePlayerIds: string[] = []
      if (savedPlayers) {
        try {
          const parsedPlayers = JSON.parse(savedPlayers)
          if (Array.isArray(parsedPlayers)) {
            activePlayerIds = parsedPlayers.filter((pId: string) => 
              competition.participants.some((p: any) => p.id === pId)
            )
            setSelectedPlayerIds(activePlayerIds)
          }
        } catch (_) {}
      } else {
        if (competition.participants.length <= 4) {
          activePlayerIds = competition.participants.map((p: any) => p.id)
          setSelectedPlayerIds(activePlayerIds)
        }
      }

      if (savedMode === 'LIVE' || savedMode === 'BULK') setEntryMode(savedMode)
      if (savedConfirmed === 'true' && initialRoundId) {
        const r = competition.rounds.find((round: any) => round.id === initialRoundId) || competition.rounds[0]
        const pl = competition.participants.filter((p: any) => activePlayerIds.includes(p.id))
        
        const match = r?.matches?.find((m: any) => 
          m.matchPlayers.some((mp: any) => activePlayerIds.includes(mp.participantId))
        )
        const roundHoles = r?.holesPlayed && r.holesPlayed.length > 0
          ? [...r.holesPlayed].sort((a: number, b: number) => a - b)
          : Array.from({ length: 18 }, (_, i) => i + 1)
        const activeHoles = match 
          ? parseHoleRange(match.holeRange, roundHoles)
          : roundHoles

        let holeIndex = 0
        if (savedHoleIdx !== null) {
          holeIndex = parseInt(savedHoleIdx)
        } else {
          holeIndex = findFirstIncompleteHoleIndex(r, pl, activeHoles)
        }
        setLiveHoleIndex(holeIndex)
        setSetupConfirmed(true)
      } else {
        setSetupConfirmed(false)
      }

      // Restore view filters & tabs
      if (savedTab) {
        setActiveTab(savedTab as any)
      } else if (savedConfirmed === 'true') {
        setActiveTab('scores')
      }

      // Restore view filters & tabs from URL query params (takes precedence) or fallback to localStorage
      const sp = new URLSearchParams(window.location.search)
      const typeParam = sp.get("type")
      const roundParam = sp.get("round")

      if (typeParam) {
        setSelectedLeaderboardType(typeParam)
      } else if (savedLeaderboard) {
        setSelectedLeaderboardType(savedLeaderboard)
      }

      if (roundParam) {
        setSelectedRoundFilter(roundParam)
      } else if (savedRoundFilter) {
        setSelectedRoundFilter(savedRoundFilter)
      }
    }
  }, [competition.id, competition.rounds, competition.participants])

  const saveSetupToStorage = (roundId: string, players: string[], mode: string, confirmed: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`setup-round-${competition.id}`, roundId)
      localStorage.setItem(`setup-players-${competition.id}`, JSON.stringify(players))
      localStorage.setItem(`setup-mode-${competition.id}`, mode)
      localStorage.setItem(`setup-confirmed-${competition.id}`, confirmed ? 'true' : 'false')
    }
  }

  // Save filters & tab state when they change
  useEffect(() => {
    if (typeof window !== "undefined" && activeTab) {
      localStorage.setItem(`active-tab-${competition.id}`, activeTab)
    }
  }, [activeTab, competition.id])

  useEffect(() => {
    if (typeof window !== "undefined" && selectedLeaderboardType) {
      localStorage.setItem(`leaderboard-type-${competition.id}`, selectedLeaderboardType)
    }
  }, [selectedLeaderboardType, competition.id])

  useEffect(() => {
    if (typeof window !== "undefined" && selectedRoundFilter) {
      localStorage.setItem(`round-filter-${competition.id}`, selectedRoundFilter)
    }
  }, [selectedRoundFilter, competition.id])

  // Auto-fill logged in player in scoring flight list
  useEffect(() => {
    if (session?.user?.email && selectedPlayerIds.length === 0) {
      const matchedPart = competition.participants.find((p: any) => p.userId && p.user?.email === session.user.email)
      if (matchedPart) {
        setSelectedPlayerIds([matchedPart.id])
      }
    }
  }, [session, competition.participants, selectedPlayerIds])

  // Get unique courses played in this competition's rounds
  const uniqueCoursesMap = new Map<string, any>()
  for (const round of (competition.rounds || [])) {
    if (round.course && !uniqueCoursesMap.has(round.course.id)) {
      uniqueCoursesMap.set(round.course.id, round.course)
    }
  }
  const uniqueCourses = Array.from(uniqueCoursesMap.values())

// --- RELOCATED END ---

  const computeMatchplayStatus = (match: any, round: any) => {
    const isTeamMatchplay = match.type === 'TEAM_MATCHPLAY'

    const getPlayerMPAllowance = (pId: string, defVal: number) => {
      const mp = match.matchPlayers.find((x: any) => x.participantId === pId)
      if (mp && mp.handicapAllowance !== null && mp.handicapAllowance !== undefined) {
        return mp.handicapAllowance
      }
      return defVal
    }

    if (isTeamMatchplay) {
      const pIds = match.matchPlayers.map((mp: any) => mp.participantId)
      const players = pIds.map((id: string) => competition.participants.find((p: any) => p.id === id)).filter(Boolean)

      if (players.length < 4) {
        return { statusText: "Setup Pending", holesPlayed: 0, totalHoles: 18, allowance: 0, player1Name: "Unknown", player2Name: "Unknown", player3Name: "Unknown", player4Name: "Unknown", player1Allowance: 0, player2Allowance: 0, player3Allowance: 0, player4Allowance: 0, isFinished: false, isTeamMatchplay: true, lead: 0 }
      }

      const allNames = competition.participants.map((p: any) =>
        p.userId ? p.user?.name : p.dummyName
      ).filter((n: any): n is string => typeof n === 'string' && n.length > 0)

      const teamIds = Array.from(new Set(players.map((p: any) => p.teamId))).filter(Boolean)
      let team1Id = teamIds[0]
      let team2Id = teamIds[1]

      const christoph = players.find((p: any) => (p.user?.name || p.dummyName || "").toLowerCase().includes("christoph"))
      if (christoph && christoph.teamId === team2Id) {
        const temp = team1Id
        team1Id = team2Id
        team2Id = temp
      }

      const team1Players = players.filter((p: any) => p.teamId === team1Id)
      const team2Players = players.filter((p: any) => p.teamId === team2Id)

      if (team1Players.length !== 2 || team2Players.length !== 2) {
        return { statusText: "Team Division Error", holesPlayed: 0, totalHoles: 18, allowance: 0, player1Name: "Unknown", player2Name: "Unknown", player3Name: "Unknown", player4Name: "Unknown", player1Allowance: 0, player2Allowance: 0, player3Allowance: 0, player4Allowance: 0, isFinished: false, isTeamMatchplay: true, lead: 0 }
      }

      team1Players.sort((a: any, b: any) => getPlayingHandicap(a, round) - getPlayingHandicap(b, round))
      team2Players.sort((a: any, b: any) => getPlayingHandicap(a, round) - getPlayingHandicap(b, round))

      const hcp1_1 = getPlayingHandicap(team1Players[0], round)
      const hcp1_2 = getPlayingHandicap(team1Players[1], round)
      const hcp2_1 = getPlayingHandicap(team2Players[0], round)
      const hcp2_2 = getPlayingHandicap(team2Players[1], round)

      const minPH = Math.min(hcp1_1, hcp1_2, hcp2_1, hcp2_2)

      const allowanceType = match.allowanceType || "75%"
      let percentage = 0.75
      if (allowanceType === "50%") percentage = 0.50
      if (allowanceType === "100%") percentage = 1.00
      if (allowanceType === "0%") percentage = 0.00

      const allowance1_1 = getPlayerMPAllowance(team1Players[0].id, Math.round((hcp1_1 - minPH) * percentage))
      const allowance1_2 = getPlayerMPAllowance(team1Players[1].id, Math.round((hcp1_2 - minPH) * percentage))
      const allowance2_1 = getPlayerMPAllowance(team2Players[0].id, Math.round((hcp2_1 - minPH) * percentage))
      const allowance2_2 = getPlayerMPAllowance(team2Players[1].id, Math.round((hcp2_2 - minPH) * percentage))

      const name1_1 = getCompactName(team1Players[0].userId ? team1Players[0].user?.name : team1Players[0].dummyName || "", allNames)
      const name1_2 = getCompactName(team1Players[1].userId ? team1Players[1].user?.name : team1Players[1].dummyName || "", allNames)
      const name2_1 = getCompactName(team2Players[0].userId ? team2Players[0].user?.name : team2Players[0].dummyName || "", allNames)
      const name2_2 = getCompactName(team2Players[1].userId ? team2Players[1].user?.name : team2Players[1].dummyName || "", allNames)

      const roundHoles = round.holesPlayed && round.holesPlayed.length > 0
        ? [...round.holesPlayed].sort((a: number, b: number) => a - b)
        : Array.from({ length: 18 }, (_, i) => i + 1)

      const matchHoles = parseHoleRange(match.holeRange, roundHoles)

      const strokesMap1_1 = getMatchHoleStrokesMap(matchHoles, round, allowance1_1)
      const strokesMap1_2 = getMatchHoleStrokesMap(matchHoles, round, allowance1_2)
      const strokesMap2_1 = getMatchHoleStrokesMap(matchHoles, round, allowance2_1)
      const strokesMap2_2 = getMatchHoleStrokesMap(matchHoles, round, allowance2_2)

      const team1Name = team1Players[0].team?.name || "Team 1"
      const team2Name = team2Players[0].team?.name || "Team 2"

      let lead = 0
      let holesPlayedCount = 0
      let excludedHolesCount = 0
      let decidedInfo: { winnerName: string; lead: number; remaining: number } | null = null

      const getMatchHoleStrokes = (score: any) => {
        if (!score) return null
        if (score.status === 'WIPED') return 99
        if (score.status === 'NOT_PLAYED') return null
        return score.grossStrokes
      }

      for (let i = 0; i < matchHoles.length; i++) {
        const holeNum = matchHoles[i]
        const hole = round.course.holes.find((h: any) => h.number === holeNum)
        if (!hole) continue

        const score1_1 = team1Players[0].scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
        const score1_2 = team1Players[1].scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
        const score2_1 = team2Players[0].scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
        const score2_2 = team2Players[1].scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)

        const strokes1_1 = getMatchHoleStrokes(score1_1)
        const strokes1_2 = getMatchHoleStrokes(score1_2)
        const strokes2_1 = getMatchHoleStrokes(score2_1)
        const strokes2_2 = getMatchHoleStrokes(score2_2)

        const scores = [score1_1, score1_2, score2_1, score2_2].filter(Boolean)
        const isExplicitlyExcluded = scores.length > 0 && scores.every((s: any) => s.status === 'NOT_PLAYED')

        if (isExplicitlyExcluded) {
          excludedHolesCount++
          continue
        }

        const isHoleUnplayed = strokes1_1 === null && strokes1_2 === null && strokes2_1 === null && strokes2_2 === null
        if (isHoleUnplayed) {
          continue
        }

        const getNetOnHole = (strokes: number | null, strokesGiven: number) => {
          if (strokes === null) return 999
          if (strokes === 99) return 99
          return strokes - strokesGiven
        }

        const net1_1 = getNetOnHole(strokes1_1, strokesMap1_1[holeNum] || 0)
        const net1_2 = getNetOnHole(strokes1_2, strokesMap1_2[holeNum] || 0)
        const net2_1 = getNetOnHole(strokes2_1, strokesMap2_1[holeNum] || 0)
        const net2_2 = getNetOnHole(strokes2_2, strokesMap2_2[holeNum] || 0)

        const teamNet1 = Math.min(net1_1, net1_2)
        const teamNet2 = Math.min(net2_1, net2_2)

        if (teamNet1 !== 999 && teamNet2 !== 999) {
          holesPlayedCount++
          if (teamNet1 < teamNet2) {
            lead++
          } else if (teamNet1 > teamNet2) {
            lead--
          }

          if (competition.shortTrackLimit !== null && competition.shortTrackLimit !== undefined) {
            if (lead > competition.shortTrackLimit) {
              lead = competition.shortTrackLimit
            } else if (lead < -competition.shortTrackLimit) {
              lead = -competition.shortTrackLimit
            }
          }

          const remaining = matchHoles.length - (holesPlayedCount + excludedHolesCount)
          if (!match.playUntilEnd && Math.abs(lead) > remaining && decidedInfo === null) {
            decidedInfo = {
              winnerName: lead > 0 ? team1Name : team2Name,
              lead: Math.abs(lead),
              remaining
            }
          }
        }
      }

      let statusText = ""
      if (decidedInfo !== null) {
        if (decidedInfo.remaining === 0) {
          statusText = `${decidedInfo.winnerName} ${decidedInfo.lead}up`
        } else {
          statusText = `${decidedInfo.winnerName} ${decidedInfo.lead}&${decidedInfo.remaining}`
        }
      } else {
        if (holesPlayedCount === 0) {
          statusText = "Not Started"
        } else if (lead === 0) {
          statusText = "All Square"
        } else if (lead > 0) {
          statusText = `${team1Name} ${lead}up`
        } else {
          statusText = `${team2Name} ${Math.abs(lead)}up`
        }
      }

      return {
        statusText,
        holesPlayed: holesPlayedCount,
        totalHoles: matchHoles.length - excludedHolesCount,
        allowance: 0,
        player1Name: name1_1,
        player2Name: name1_2,
        player3Name: name2_1,
        player4Name: name2_2,
        player1Allowance: allowance1_1,
        player2Allowance: allowance1_2,
        player3Allowance: allowance2_1,
        player4Allowance: allowance2_2,
        isFinished: decidedInfo !== null || (holesPlayedCount + excludedHolesCount === matchHoles.length),
        isTeamMatchplay: true,
        lead
      }
    } else {
      const p1 = competition.participants.find((p: any) => p.id === match.matchPlayers[0]?.participantId)
      const p2 = competition.participants.find((p: any) => p.id === match.matchPlayers[1]?.participantId)
      if (!p1 || !p2) return { statusText: "Unknown Players", holesPlayed: 0, totalHoles: 18, allowance: 0, player1Name: "Unknown", player2Name: "Unknown", player3Name: "Unknown", player4Name: "Unknown", player1Allowance: 0, player2Allowance: 0, player3Allowance: 0, player4Allowance: 0, isFinished: false, isTeamMatchplay: false, lead: 0 }

      const hcp1 = getPlayingHandicap(p1, round)
      const hcp2 = getPlayingHandicap(p2, round)

      const allowance = getMatchAllowance(match, hcp1, hcp2)
      const p1Allowance = getPlayerMPAllowance(p1.id, hcp1 > hcp2 ? allowance : 0)
      const p2Allowance = getPlayerMPAllowance(p2.id, hcp2 > hcp1 ? allowance : 0)

      const allNames = competition.participants.map((p: any) =>
        p.userId ? p.user?.name : p.dummyName
      ).filter((n: any): n is string => typeof n === 'string' && n.length > 0)

      const fullName1 = p1.userId ? p1.user?.name : p1.dummyName || ""
      const fullName2 = p2.userId ? p2.user?.name : p2.dummyName || ""

      const name1 = getCompactName(fullName1, allNames)
      const name2 = getCompactName(fullName2, allNames)

      const roundHoles = round.holesPlayed && round.holesPlayed.length > 0
        ? [...round.holesPlayed].sort((a: number, b: number) => a - b)
        : Array.from({ length: 18 }, (_, i) => i + 1)

      const matchHoles = parseHoleRange(match.holeRange, roundHoles)
      const strokesMap = getMatchHoleStrokesMap(matchHoles, round, allowance)

      let lead = 0
      let holesPlayedCount = 0
      let excludedHolesCount = 0
      let decidedInfo: { winnerName: string; lead: number; remaining: number } | null = null

      const getMatchHoleStrokes = (score: any) => {
        if (!score) return null
        if (score.status === 'WIPED') return 99
        if (score.status === 'NOT_PLAYED') return null
        return score.grossStrokes
      }

      for (let i = 0; i < matchHoles.length; i++) {
        const holeNum = matchHoles[i]
        const hole = round.course.holes.find((h: any) => h.number === holeNum)
        if (!hole) continue

        const score1 = p1.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
        const score2 = p2.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)

        const strokes1 = getMatchHoleStrokes(score1)
        const strokes2 = getMatchHoleStrokes(score2)

        const scores = [score1, score2].filter(Boolean)
        const isExplicitlyExcluded = scores.length > 0 && scores.every((s: any) => s.status === 'NOT_PLAYED')

        if (isExplicitlyExcluded) {
          excludedHolesCount++
          continue
        }

        const isHoleUnplayed = strokes1 === null && strokes2 === null
        if (isHoleUnplayed) {
          continue
        }

        if (strokes1 !== null && strokes2 !== null) {
          holesPlayedCount++
          const strokesGiven = strokesMap[holeNum] || 0
          const net1Calculated = hcp1 > hcp2 ? (strokes1 === 99 ? 99 : strokes1 - strokesGiven) : strokes1
          const net2Calculated = hcp2 > hcp1 ? (strokes2 === 99 ? 99 : strokes2 - strokesGiven) : strokes2

          if (net1Calculated < net2Calculated) {
            lead++
          } else if (net1Calculated > net2Calculated) {
            lead--
          }

          if (competition.shortTrackLimit !== null && competition.shortTrackLimit !== undefined) {
            if (lead > competition.shortTrackLimit) {
              lead = competition.shortTrackLimit
            } else if (lead < -competition.shortTrackLimit) {
              lead = -competition.shortTrackLimit
            }
          }

          const remaining = matchHoles.length - (holesPlayedCount + excludedHolesCount)
          if (!match.playUntilEnd && Math.abs(lead) > remaining && decidedInfo === null) {
            decidedInfo = {
              winnerName: lead > 0 ? name1 : name2,
              lead: Math.abs(lead),
              remaining
            }
          }
        }
      }

      let statusText = ""
      if (decidedInfo !== null) {
        if (decidedInfo.remaining === 0) {
          statusText = `${decidedInfo.winnerName} ${decidedInfo.lead}up`
        } else {
          statusText = `${decidedInfo.winnerName} ${decidedInfo.lead}&${decidedInfo.remaining}`
        }
      } else {
        if (holesPlayedCount === 0) {
          statusText = "Not Started"
        } else if (lead === 0) {
          statusText = "All Square"
        } else if (lead > 0) {
          statusText = `${name1} ${lead}up`
        } else {
          statusText = `${name2} ${Math.abs(lead)}up`
        }
      }

      return {
        statusText,
        holesPlayed: holesPlayedCount,
        totalHoles: matchHoles.length - excludedHolesCount,
        allowance,
        player1Name: name1,
        player2Name: name2,
        player3Name: "",
        player4Name: "",
        player1Allowance: p1Allowance,
        player2Allowance: p2Allowance,
        player3Allowance: 0,
        player4Allowance: 0,
        isFinished: decidedInfo !== null || (holesPlayedCount + excludedHolesCount === matchHoles.length),
        isTeamMatchplay: false,
        lead
      }
    }
  }

  // Helper: Find the first hole index where any player's score is missing
  const findFirstIncompleteHoleIndex = (scoringRound: any, scoringPlayers: any[], activeHolesOverride?: number[]) => {
    if (!scoringRound || !scoringPlayers || scoringPlayers.length === 0) return 0
    const activeHoles = activeHolesOverride && activeHolesOverride.length > 0
      ? activeHolesOverride
      : (scoringRound.holesPlayed && scoringRound.holesPlayed.length > 0
          ? [...scoringRound.holesPlayed].sort((a: number, b: number) => a - b)
          : Array.from({ length: 18 }, (_, i) => i + 1))

    for (let i = 0; i < activeHoles.length; i++) {
      const holeNum = activeHoles[i]
      const hole = scoringRound.course.holes.find((h: any) => h.number === holeNum)
      if (hole) {
        const anyIncomplete = scoringPlayers.some((p: any) => {
          const score = p.scores.find((s: any) => s.roundId === scoringRound.id && s.holeId === hole.id)
          return !score || (score.status === null && score.grossStrokes === null)
        })
        if (anyIncomplete) {
          return i
        }
      }
    }
    return 0
  }

  // Handle saving manual playing handicap
  const handleManualHandicapChange = (partId: string, roundId: string, val: string) => {
    setManualHandicapInputValues(prev => ({
      ...prev,
      [`${partId}-${roundId}`]: val
    }))
  }

  const saveManualHandicap = async (partId: string, roundId: string) => {
    const key = `${partId}-${roundId}`
    const val = manualHandicapInputValues[key]
    if (val === undefined) return

    setSavingManualHandicap(prev => ({ ...prev, [key]: true }))
    try {
      const parsedVal = parseInt(val)
      if (isNaN(parsedVal)) {
        alert("Please enter a valid integer score.")
        return
      }
      await saveManualRoundHandicap(partId, roundId, parsedVal)
      setManualHandicapInputValues(prev => {
        const copy = { ...prev }
        delete copy[key]
        return copy
      })
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setSavingManualHandicap(prev => ({ ...prev, [key]: false }))
    }
  }

  const triggerRecalcRound = async (roundId: string, roundName: string) => {
    if (confirm(`Recalculate playing handicaps for ALL players in ${roundName}? This deletes manual overwrites.`)) {
      await recalculateRoundHandicaps(competition.id, roundId)
      setManualHandicapInputValues({})
      router.refresh()
    }
  }

  const triggerRecalcPlayer = async (partId: string, playerName: string) => {
    if (confirm(`Recalculate playing handicaps for ${playerName} across ALL courses? This deletes manual overwrites.`)) {
      await recalculatePlayerHandicaps(competition.id, partId)
      setManualHandicapInputValues({})
      router.refresh()
    }
  }

  const handleCompHandicapChange = (pId: string, val: string) => {
    setCompHandicapInputValues(prev => ({
      ...prev,
      [pId]: val
    }))
  }

  const saveCompHandicap = async (pId: string) => {
    const val = compHandicapInputValues[pId]
    if (val === undefined) return

    setSavingCompHandicap(prev => ({ ...prev, [pId]: true }))
    try {
      const hcVal = val === "" ? null : parseFloat(val)
      if (hcVal !== null && isNaN(hcVal)) {
        alert("Please enter a valid handicap number.")
        return
      }
      await updateParticipant(pId, competition.id, {
        compHandicap: hcVal,
        teamId: competition.participants.find((p: any) => p.id === pId)?.teamId || null
      })
      router.refresh()
    } catch (err: any) {
      alert(err.message || "Failed to save handicap.")
    } finally {
      setSavingCompHandicap(prev => ({ ...prev, [pId]: false }))
    }
  }

  // --- LEADERBOARDS CALCULATIONS ---

  // Build Leaderboard Entries based on selected filter
  const computeLeaderboard = () => {
    const rounds = competition.rounds || []
    const activeRounds = selectedRoundFilter === 'TOTAL' 
      ? rounds 
      : rounds.filter((r: any) => r.id === selectedRoundFilter)

    if (selectedLeaderboardType === 'MAIN') {
      // Netto Stableford default
      const entries = competition.participants.map((p: any) => {
        let totalPoints = 0
        let totalStrokes = 0
        let holesPlayed = 0
        const roundPoints: Record<string, number> = {}
        const roundRelToPar: Record<string, number> = {}

        for (const round of rounds) {
          const courseHandicap = getPlayingHandicap(p, round)
          const roundHoles = getPlayableHolesForRound(round)

          let roundPts = 0
          let roundHolesPlayed = false
          let roundHolesCount = 0

          for (const holeNum of roundHoles) {
            const hole = round.course.holes.find((h: any) => h.number === holeNum)
            if (!hole) continue

            const adjusted = getRoundHoleInfo(round, holeNum)
            const holePar = adjusted ? adjusted.par : hole.par
            const holeStrokeIndex = adjusted ? adjusted.strokeIndex : hole.strokeIndex

            const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
            if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
              roundHolesPlayed = true
              roundHolesCount++
              
              const isActive = activeRounds.some((ar: any) => ar.id === round.id)
              if (isActive) holesPlayed++

              if (score.status === 'WIPED') {
                roundPts += 0
                if (isActive) totalStrokes += holePar + 3 // wiped hole is triple bogey
              } else if (score.grossStrokes !== null) {
                if (isActive) totalStrokes += score.grossStrokes
                const hcpStrokes = getHandicapStrokesOnHole(courseHandicap, holeStrokeIndex)
                const points = calculateStablefordPoints(score.grossStrokes, holePar, hcpStrokes, true)
                if (points !== null) roundPts += points
              }
            }
          }

          if (roundHolesPlayed) {
            roundPoints[round.id] = roundPts
            roundRelToPar[round.id] = (roundHolesCount * 2) - roundPts
            if (activeRounds.some((ar: any) => ar.id === round.id)) {
              totalPoints += roundPts
            }
          }
        }

        const relToPar = (holesPlayed * 2) - totalPoints

        return {
          participantId: p.id,
          participant: p,
          name: p.userId ? (p.user?.name || p.user?.email) : p.dummyName,
          totalPoints,
          totalStrokes,
          holesPlayed,
          roundPoints,
          roundRelToPar,
          relToPar
        }
      })
      return assignLeaderboardRanks(entries, competition.showRelToPar)
    }

    if (selectedLeaderboardType === 'STROKEPLAY') {
      const entries = competition.participants.map((p: any) => {
        let totalStrokes = 0
        let holesPlayed = 0
        const roundPoints: Record<string, number> = {}

        for (const round of rounds) {
          const roundHoles = getPlayableHolesForRound(round)

          let roundStrokes = 0
          let roundHolesPlayed = false

          for (const holeNum of roundHoles) {
            const hole = round.course.holes.find((h: any) => h.number === holeNum)
            if (!hole) continue

            const adjusted = getRoundHoleInfo(round, holeNum)
            const holePar = adjusted ? adjusted.par : hole.par

            const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
            if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
              roundHolesPlayed = true
              const isActive = activeRounds.some((ar: any) => ar.id === round.id)
              if (isActive) holesPlayed++

              if (score.status === 'WIPED') {
                roundStrokes += holePar + 3 // wiped hole is triple bogey in strokeplay gross
              } else if (score.grossStrokes !== null) {
                roundStrokes += score.grossStrokes
              }
            }
          }

          if (roundHolesPlayed) {
            roundPoints[round.id] = roundStrokes
            if (activeRounds.some((ar: any) => ar.id === round.id)) {
              totalStrokes += roundStrokes
            }
          } else {
            roundPoints[round.id] = 0
          }
        }

        return {
          participantId: p.id,
          participant: p,
          name: p.userId ? (p.user?.name || p.user?.email) : p.dummyName,
          totalPoints: totalStrokes, // Use totalPoints field as rank sorting value
          totalStrokes,
          holesPlayed,
          roundPoints
        }
      })
      
      // Sort ascending (lowest strokes win)
      const sorted = [...entries].sort((a, b) => {
        if (a.totalPoints !== b.totalPoints) return a.totalPoints - b.totalPoints
        return b.holesPlayed - a.holesPlayed
      })
      
      // Assign ranks manually
      return sorted.map((entry, idx) => {
        const ties = sorted.filter(x => x.totalPoints === entry.totalPoints)
        const isTied = ties.length > 1
        const firstIdx = sorted.findIndex(x => x.totalPoints === entry.totalPoints) + 1
        return {
          ...entry,
          rank: isTied ? `T${firstIdx}` : `${idx + 1}`
        }
      })
    }

    if (selectedLeaderboardType === 'STABLEFORD_NETTO' || selectedLeaderboardType === 'STABLEFORD_BRUTTO') {
      const isNet = selectedLeaderboardType === 'STABLEFORD_NETTO'
      const entries = competition.participants.map((p: any) => {
        let totalPoints = 0
        let totalStrokes = 0
        let holesPlayed = 0
        const roundPoints: Record<string, number> = {}
        const roundRelToPar: Record<string, number> = {}

        for (const round of rounds) {
          const courseHandicap = getPlayingHandicap(p, round)
          const roundHoles = getPlayableHolesForRound(round)

          let roundPts = 0
          let roundHolesPlayed = false
          let roundHolesCount = 0

          for (const holeNum of roundHoles) {
            const hole = round.course.holes.find((h: any) => h.number === holeNum)
            if (!hole) continue

            const adjusted = getRoundHoleInfo(round, holeNum)
            const holePar = adjusted ? adjusted.par : hole.par
            const holeStrokeIndex = adjusted ? adjusted.strokeIndex : hole.strokeIndex

            const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
            if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
              roundHolesPlayed = true
              roundHolesCount++
              const isActive = activeRounds.some((ar: any) => ar.id === round.id)
              if (isActive) holesPlayed++

              if (score.status === 'WIPED') {
                roundPts += 0
                if (isActive) totalStrokes += holePar + 3 // wiped hole is triple bogey
              } else if (score.grossStrokes !== null) {
                if (isActive) totalStrokes += score.grossStrokes
                const hcpStrokes = getHandicapStrokesOnHole(courseHandicap, holeStrokeIndex)
                const points = calculateStablefordPoints(score.grossStrokes, holePar, hcpStrokes, isNet)
                if (points !== null) roundPts += points
              }
            }
          }

          if (roundHolesPlayed) {
            roundPoints[round.id] = roundPts
            roundRelToPar[round.id] = (roundHolesCount * 2) - roundPts
            if (activeRounds.some((ar: any) => ar.id === round.id)) {
              totalPoints += roundPts
            }
          }
        }

        const relToPar = (holesPlayed * 2) - totalPoints

        return {
          participantId: p.id,
          participant: p,
          name: p.userId ? (p.user?.name || p.user?.email) : p.dummyName,
          totalPoints,
          totalStrokes,
          holesPlayed,
          roundPoints,
          roundRelToPar,
          relToPar
        }
      })
      return assignLeaderboardRanks(entries, competition.showRelToPar)
    }

    if (selectedLeaderboardType === 'BIRDIE') {
      const entries = competition.participants.map((p: any) => {
        let birdies = 0
        let pars = 0
        let holesPlayed = 0
        const roundPoints: Record<string, number> = {}

        for (const round of rounds) {
          const roundHoles = getPlayableHolesForRound(round)

          let roundBirdies = 0
          let roundHolesPlayed = false

          for (const holeNum of roundHoles) {
            const hole = round.course.holes.find((h: any) => h.number === holeNum)
            if (!hole) continue

            const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
            if (score && score.status !== 'NOT_PLAYED' && score.status !== 'WIPED' && score.grossStrokes !== null) {
              roundHolesPlayed = true
              const isActive = activeRounds.some((ar: any) => ar.id === round.id)
              if (isActive) {
                holesPlayed++
                const diff = score.grossStrokes - hole.par
                if (diff <= -1) birdies++
                else if (diff === 0) pars++
              }
              const diff = score.grossStrokes - hole.par
              if (diff <= -1) roundBirdies++
            }
          }

          if (roundHolesPlayed) {
            roundPoints[round.id] = roundBirdies
          } else {
            roundPoints[round.id] = 0
          }
        }

        return {
          participantId: p.id,
          participant: p,
          name: p.userId ? (p.user?.name || p.user?.email) : p.dummyName,
          totalPoints: birdies,
          pars,
          holesPlayed,
          roundPoints
        }
      })

      // Sort descending by birdies, then by pars
      const sorted = [...entries].sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
        return b.pars - a.pars
      })

      return sorted.map((entry, idx) => {
        const ties = sorted.filter(x => x.totalPoints === entry.totalPoints && x.pars === entry.pars)
        const isTied = ties.length > 1
        const firstIdx = sorted.findIndex(x => x.totalPoints === entry.totalPoints && x.pars === entry.pars) + 1
        return {
          ...entry,
          rank: isTied ? `T${firstIdx}` : `${idx + 1}`
        }
      })
    }

    if (selectedLeaderboardType === 'DOUBLE_BOGEY_PLUS') {
      const entries = competition.participants.map((p: any) => {
        let dbPlus = 0
        let bogeys = 0
        let holesPlayed = 0
        const roundPoints: Record<string, number> = {}

        for (const round of rounds) {
          const roundHoles = getPlayableHolesForRound(round)

          let roundDbPlus = 0
          let roundHolesPlayed = false

          for (const holeNum of roundHoles) {
            const hole = round.course.holes.find((h: any) => h.number === holeNum)
            if (!hole) continue

            const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
            if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
              roundHolesPlayed = true
              const isActive = activeRounds.some((ar: any) => ar.id === round.id)
              if (isActive) {
                holesPlayed++
                if (score.status === 'WIPED') {
                  dbPlus++
                } else if (score.grossStrokes !== null) {
                  const diff = score.grossStrokes - hole.par
                  if (diff >= 2) dbPlus++
                  else if (diff === 1) bogeys++
                }
              }

              if (score.status === 'WIPED') {
                roundDbPlus++
              } else if (score.grossStrokes !== null) {
                const diff = score.grossStrokes - hole.par
                if (diff >= 2) roundDbPlus++
              }
            }
          }

          if (roundHolesPlayed) {
            roundPoints[round.id] = roundDbPlus
          } else {
            roundPoints[round.id] = 0
          }
        }

        return {
          participantId: p.id,
          participant: p,
          name: p.userId ? (p.user?.name || p.user?.email) : p.dummyName,
          totalPoints: dbPlus,
          bogeys,
          holesPlayed,
          roundPoints
        }
      })

      // Sort descending by DB+, then by bogeys
      const sorted = [...entries].sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
        return b.bogeys - a.bogeys
      })

      return sorted.map((entry, idx) => {
        const ties = sorted.filter(x => x.totalPoints === entry.totalPoints && x.bogeys === entry.bogeys)
        const isTied = ties.length > 1
        const firstIdx = sorted.findIndex(x => x.totalPoints === entry.totalPoints && x.bogeys === entry.bogeys) + 1
        return {
          ...entry,
          rank: isTied ? `T${firstIdx}` : `${idx + 1}`
        }
      })
    }

    if (selectedLeaderboardType === 'PAR_PLUS_SERIES') {
      const entries = competition.participants.map((p: any) => {
        let holesPlayed = 0
        const roundPoints: Record<string, number> = {}

        for (const round of rounds) {
          const roundHoles = getPlayableHolesForRound(round)

          let roundMaxStreak = 0
          let roundCurrentStreak = 0
          let roundHolesPlayed = false

          for (const holeNum of roundHoles) {
            const hole = round.course.holes.find((h: any) => h.number === holeNum)
            if (!hole) continue

            const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
            if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
              roundHolesPlayed = true
              
              const isActive = activeRounds.some((ar: any) => ar.id === round.id)
              if (isActive) {
                if (score.status !== 'WIPED' && score.grossStrokes !== null && score.grossStrokes <= hole.par) {
                  roundCurrentStreak++
                  if (roundCurrentStreak > roundMaxStreak) roundMaxStreak = roundCurrentStreak
                } else {
                  roundCurrentStreak = 0
                }
              }
            }
          }

          if (roundHolesPlayed) {
            roundPoints[round.id] = roundMaxStreak
          } else {
            roundPoints[round.id] = 0
          }
        }

        // Count played holes inside active rounds only
        for (const ar of activeRounds) {
          const roundHoles = getPlayableHolesForRound(ar)
          for (const holeNum of roundHoles) {
            const hole = ar.course.holes.find((h: any) => h.number === holeNum)
            if (hole) {
              const score = p.scores.find((s: any) => s.roundId === ar.id && s.holeId === hole.id)
              if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) holesPlayed++
            }
          }
        }

        let totalPoints = 0
        if (selectedRoundFilter === 'TOTAL') {
          totalPoints = activeRounds.length > 0
            ? Math.max(...activeRounds.map((ar: any) => roundPoints[ar.id] || 0))
            : 0
        } else {
          totalPoints = roundPoints[selectedRoundFilter] || 0
        }

        return {
          participantId: p.id,
          participant: p,
          name: p.userId ? (p.user?.name || p.user?.email) : p.dummyName,
          totalPoints,
          holesPlayed,
          roundPoints
        }
      })

      // Sort descending by max streak
      const sorted = [...entries].sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
        return b.holesPlayed - a.holesPlayed
      })

      return sorted.map((entry, idx) => {
        const ties = sorted.filter(x => x.totalPoints === entry.totalPoints)
        const isTied = ties.length > 1
        const firstIdx = sorted.findIndex(x => x.totalPoints === entry.totalPoints) + 1
        return {
          ...entry,
          rank: isTied ? `T${firstIdx}` : `${idx + 1}`
        }
      })
    }

    // TEAM STANDINGS CALCULATIONS
    if (selectedLeaderboardType.startsWith('TEAM_')) {
      const isStroke = selectedLeaderboardType === 'TEAM_STROKEPLAY'
      const isNet = selectedLeaderboardType === 'TEAM_STABLEFORD_NETTO'
      const isBrut = selectedLeaderboardType === 'TEAM_STABLEFORD_BRUTTO'

      const isBestball = competition.type === 'TEAM_MATCHPLAY'

      const teamEntries = competition.teams.map((t: any) => {
        const teamParticipants = competition.participants.filter((p: any) => p.teamId === t.id)

        let teamPoints = 0
        let teamStrokes = 0
        let holesPlayedCount = 0
        let totalHolesCount = 0

        const roundPoints: Record<string, number> = {}
        const roundRelToPar: Record<string, number> = {}

        for (const round of activeRounds) {
          let rPoints = 0
          let rStrokes = 0
          let rPlayedHoles = 0

          const roundHoles = getPlayableHolesForRound(round)

          totalHolesCount += roundHoles.length

          for (const holeNum of roundHoles) {
            const hole = round.course.holes.find((h: any) => h.number === holeNum)
            if (!hole) continue

            const adjusted = getRoundHoleInfo(round, holeNum)
            const holePar = adjusted ? adjusted.par : hole.par
            const holeStrokeIndex = adjusted ? adjusted.strokeIndex : hole.strokeIndex

            // Calculate score for each member on this hole
            const memberHoleStats: { pts: number; str: number }[] = teamParticipants.map((p: any) => {
              const courseHandicap = getPlayingHandicap(p, round)
              const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
              let pts = 0
              let str = 0
              if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
                if (score.status === 'WIPED') {
                  str = holePar + 3
                } else if (score.grossStrokes !== null) {
                  str = score.grossStrokes
                  const hcpStrokes = getHandicapStrokesOnHole(courseHandicap, holeStrokeIndex)
                  const pStableford = calculateStablefordPoints(score.grossStrokes, holePar, hcpStrokes, isNet)
                  if (pStableford !== null) pts = pStableford
                }
              }
              return { pts, str }
            })

            // A team has played a hole if at least one participant has grossStrokes or status WIPED
            const anyPlayed = teamParticipants.some((p: any) => {
              const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
              return score && (score.grossStrokes !== null || score.status === 'WIPED')
            })
            if (anyPlayed) {
              holesPlayedCount++
              rPlayedHoles++
            }

            if (isBestball) {
              rPoints += Math.max(...memberHoleStats.map(m => m.pts), 0)
              const activeStrokes = memberHoleStats.map(m => m.str).filter(s => s > 0)
              rStrokes += activeStrokes.length > 0 ? Math.min(...activeStrokes) : (holePar + 3)
            } else {
              rPoints += memberHoleStats.reduce((sum, m) => sum + m.pts, 0)
              rStrokes += memberHoleStats.reduce((sum, m) => sum + m.str, 0)
            }
          }

          teamPoints += rPoints
          teamStrokes += rStrokes

          roundPoints[round.id] = rPoints
          roundRelToPar[round.id] = (rPlayedHoles * 2) - rPoints
        }

        const totalRelToPar = Object.values(roundRelToPar).reduce((sum, val) => sum + val, 0)

        const memberNames = teamParticipants
          .map((p: any) => p.userId ? (p.user?.name || p.user?.email) : p.dummyName)
          .join(", ")

        return {
          teamId: t.id,
          team: t,
          name: t.name,
          memberNames,
          totalPoints: isStroke ? teamStrokes : teamPoints,
          totalStrokes: teamStrokes,
          holesPlayed: holesPlayedCount,
          totalHoles: totalHolesCount,
          roundPoints,
          roundRelToPar,
          relToPar: totalRelToPar
        }
      })

      // Sort
      let sorted = []
      if (isStroke) {
        sorted = [...teamEntries].sort((a, b) => a.totalPoints - b.totalPoints)
      } else {
        sorted = [...teamEntries].sort((a, b) => b.totalPoints - a.totalPoints)
      }

      return sorted.map((entry, idx) => {
        const ties = sorted.filter(x => x.totalPoints === entry.totalPoints)
        const isTied = ties.length > 1
        const firstIdx = sorted.findIndex(x => x.totalPoints === entry.totalPoints) + 1
        return {
          ...entry,
          rank: isTied ? `T${firstIdx}` : `${idx + 1}`
        }
      })
    }

    if (selectedLeaderboardType === 'MVP') {
      const entries = competition.participants.map((p: any) => {
        let totalPoints = 0
        let totalMvpHolesPlayed = 0
        const roundPoints: Record<string, number> = {}

        for (const round of activeRounds) {
          let roundMVPPoints = 0
          const teamMatches = (round.matches || []).filter((m: any) => m.type === 'TEAM_MATCHPLAY')
          
          for (const match of teamMatches) {
            const isPlayerInMatch = match.matchPlayers.some((mp: any) => mp.participantId === p.id)
            if (!isPlayerInMatch) continue

            const pIds = match.matchPlayers.map((mp: any) => mp.participantId)
            const players = pIds.map((id: string) => competition.participants.find((x: any) => x.id === id)).filter(Boolean)
            if (players.length < 4) continue

            const teamIds = Array.from(new Set(players.map((x: any) => x.teamId))).filter(Boolean)
            let team1Id = teamIds[0]
            let team2Id = teamIds[1]

            const christoph = players.find((x: any) => (x.user?.name || x.dummyName || "").toLowerCase().includes("christoph"))
            if (christoph && christoph.teamId === team2Id) {
              const temp = team1Id
              team1Id = team2Id
              team2Id = temp
            }

            const team1Players = players.filter((x: any) => x.teamId === team1Id)
            const team2Players = players.filter((x: any) => x.teamId === team2Id)

            if (team1Players.length !== 2 || team2Players.length !== 2) continue

            team1Players.sort((a: any, b: any) => getPlayingHandicap(a, round) - getPlayingHandicap(b, round))
            team2Players.sort((a: any, b: any) => getPlayingHandicap(a, round) - getPlayingHandicap(b, round))

            const hcp1_1 = getPlayingHandicap(team1Players[0], round)
            const hcp1_2 = getPlayingHandicap(team1Players[1], round)
            const hcp2_1 = getPlayingHandicap(team2Players[0], round)
            const hcp2_2 = getPlayingHandicap(team2Players[1], round)

            const minPH = Math.min(hcp1_1, hcp1_2, hcp2_1, hcp2_2)

            const allowance1_1 = hcp1_1 - minPH
            const allowance1_2 = hcp1_2 - minPH
            const allowance2_1 = hcp2_1 - minPH
            const allowance2_2 = hcp2_2 - minPH

            const roundHoles = getPlayableHolesForRound(round)

            const matchHoles = parseHoleRange(match.holeRange, roundHoles)

            // accumulate played holes for player
            const status = computeMatchplayStatus(match, round)
            totalMvpHolesPlayed += status.holesPlayed

            const strokesMap1_1 = getMatchHoleStrokesMap(matchHoles, round, allowance1_1)
            const strokesMap1_2 = getMatchHoleStrokesMap(matchHoles, round, allowance1_2)
            const strokesMap2_1 = getMatchHoleStrokesMap(matchHoles, round, allowance2_1)
            const strokesMap2_2 = getMatchHoleStrokesMap(matchHoles, round, allowance2_2)

            for (const holeNum of matchHoles) {
              const hole = round.course.holes.find((h: any) => h.number === holeNum)
              if (!hole) continue

              const score1_1 = team1Players[0].scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
              const score1_2 = team1Players[1].scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
              const score2_1 = team2Players[0].scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
              const score2_2 = team2Players[1].scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)

              const getHoleStrokes = (score: any) => {
                if (!score || score.status === 'NOT_PLAYED' || score.grossStrokes === null) return null
                if (score.status === 'WIPED') return 99
                return score.grossStrokes
              }

              const strokes1_1 = getHoleStrokes(score1_1)
              const strokes1_2 = getHoleStrokes(score1_2)
              const strokes2_1 = getHoleStrokes(score2_1)
              const strokes2_2 = getHoleStrokes(score2_2)

              if (strokes1_1 === null && strokes1_2 === null && strokes2_1 === null && strokes2_2 === null) {
                continue
              }

              const getNet = (strokes: number | null, strokesGiven: number) => {
                if (strokes === null) return 999
                if (strokes === 99) return 99
                return strokes - strokesGiven
              }

              const net1_1 = getNet(strokes1_1, strokesMap1_1[holeNum] || 0)
              const net1_2 = getNet(strokes1_2, strokesMap1_2[holeNum] || 0)
              const net2_1 = getNet(strokes2_1, strokesMap2_1[holeNum] || 0)
              const net2_2 = getNet(strokes2_2, strokesMap2_2[holeNum] || 0)

              const teamNet1 = Math.min(net1_1, net1_2)
              const teamNet2 = Math.min(net2_1, net2_2)

              if (teamNet1 !== 999 && teamNet2 !== 999) {
                if (teamNet1 < teamNet2) {
                  if (p.id === team1Players[0].id) {
                    if (net1_1 < net1_2) roundMVPPoints += 1
                    else if (net1_1 === net1_2) roundMVPPoints += 0.5
                  } else if (p.id === team1Players[1].id) {
                    if (net1_2 < net1_1) roundMVPPoints += 1
                    else if (net1_2 === net1_1) roundMVPPoints += 0.5
                  }
                } else if (teamNet2 < teamNet1) {
                  if (p.id === team2Players[0].id) {
                    if (net2_1 < net2_2) roundMVPPoints += 1
                    else if (net2_1 === net2_2) roundMVPPoints += 0.5
                  } else if (p.id === team2Players[1].id) {
                    if (net2_2 < net2_1) roundMVPPoints += 1
                    else if (net2_2 === net2_1) roundMVPPoints += 0.5
                  }
                } else {
                  let active1 = []
                  if (net1_1 === teamNet1) active1.push(team1Players[0].id)
                  if (net1_2 === teamNet1) active1.push(team1Players[1].id)

                  let active2 = []
                  if (net2_1 === teamNet2) active2.push(team2Players[0].id)
                  if (net2_2 === teamNet2) active2.push(team2Players[1].id)

                  const isActive = (p.id === team1Players[0].id && active1.includes(p.id)) ||
                                   (p.id === team1Players[1].id && active1.includes(p.id)) ||
                                   (p.id === team2Players[0].id && active2.includes(p.id)) ||
                                   (p.id === team2Players[1].id && active2.includes(p.id))

                  if (isActive) {
                    const activeCount = (p.teamId === team1Id) ? active1.length : active2.length
                    if (activeCount === 1) roundMVPPoints += 0.5
                    else if (activeCount === 2) roundMVPPoints += 0.25
                  }
                }
              }
            }
          }

          roundPoints[round.id] = roundMVPPoints
          totalPoints += roundMVPPoints
        }

        const name = p.userId ? p.user?.name : p.dummyName
        return {
          participantId: p.id,
          participant: p,
          name,
          totalPoints,
          roundPoints,
          holesPlayed: totalMvpHolesPlayed
        }
      })

      const sorted = [...entries].sort((a, b) => b.totalPoints - a.totalPoints)
      return sorted.map((entry, idx) => {
        const ties = sorted.filter(x => x.totalPoints === entry.totalPoints)
        const isTied = ties.length > 1
        const firstIdx = sorted.findIndex(x => x.totalPoints === entry.totalPoints) + 1
        return {
          ...entry,
          rank: isTied ? `T${firstIdx}` : `${idx + 1}`
        }
      })
    }

    return []
  }

  const leaderboardList = computeLeaderboard()

  // --- ADMIN ACTIONS HANDLERS ---

  const handleUpdateGeneral = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingGeneral(true)
    setGeneralError("")
    setGeneralSuccess(false)
    try {
      await updateCompetitionGeneral(competition.id, {
        name: compName,
        uniqueSlug: compSlug,
        type: compType,
        isTeamComp,
        showRelToPar,
        startDate: startDate || null,
        endDate: endDate || null,
        cssConfig: cssConfig || null,
        bgImage: bgImage || null,
        extraLeaderboards: selectedExtraLeaderboards
      })
      setGeneralSuccess(true)
      router.refresh()
    } catch (err: any) {
      setGeneralError(err.message || "Failed to update general settings.")
    } finally {
      setIsSavingGeneral(false)
    }
  }

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingRound(true)
    setRoundError("")
    try {
      let holes: number[] = []
      let ninePreset: string | null = null
      if (newRoundHolesPreset === 'ALL') {
        holes = Array.from({ length: 18 }, (_, i) => i + 1)
      } else if (newRoundHolesPreset === 'FRONT') {
        holes = Array.from({ length: 9 }, (_, i) => i + 1)
      } else if (newRoundHolesPreset === 'BACK') {
        holes = Array.from({ length: 9 }, (_, i) => i + 10)
      } else if (newRoundHolesPreset === 'FRONT_TWICE') {
        holes = Array.from({ length: 18 }, (_, i) => i + 1)
        ninePreset = 'FRONT_9_TWICE'
      } else if (newRoundHolesPreset === 'BACK_TWICE') {
        holes = Array.from({ length: 18 }, (_, i) => i + 1)
        ninePreset = 'BACK_9_TWICE'
      } else if (newRoundHolesPreset === 'RANGE') {
        holes = parseHoleRangeString(newRoundHoleRange)
      } else {
        holes = [...newRoundCustomHoles]
      }

      if (holes.length === 0) throw new Error("Please select at least one hole.")

      await addRound(competition.id, {
        name: newRoundName,
        courseId: newRoundCourseId,
        startDate: newRoundStart || null,
        endDate: newRoundEnd || null,
        holesPlayed: holes,
        teeId: newRoundTeeId || null,
        ninePreset: ninePreset
      })

      setNewRoundName("")
      setNewRoundStart("")
      setNewRoundEnd("")
      setNewRoundHolesPreset('ALL')
      setNewRoundHoleRange("")
      router.refresh()
    } catch (err: any) {
      setRoundError(err.message || "Failed to create round.")
    } finally {
      setIsAddingRound(false)
    }
  }

  const triggerDeleteRound = async (roundId: string) => {
    if (confirm("Are you sure you want to delete this round? All matches and scores will be permanently deleted.")) {
      await deleteRound(roundId, competition.id)
      router.refresh()
    }
  }

  const handleStartEditRound = (round: any) => {
    setEditingRoundId(round.id)
    setEditingRoundTeeId(round.teeId || "")
    const holes = round.holesPlayed || []
    setEditingCustomHoles(holes)
    setEditingHoleRange(holes.join(","))

    if (round.ninePreset === 'FRONT_9_TWICE') {
      setEditingHolesPreset('FRONT_TWICE')
    } else if (round.ninePreset === 'BACK_9_TWICE') {
      setEditingHolesPreset('BACK_TWICE')
    } else if (holes.length === 18 && holes.every((h: number, idx: number) => h === idx + 1)) {
      setEditingHolesPreset('ALL')
    } else if (holes.length === 9 && holes[0] === 1) {
      setEditingHolesPreset('FRONT')
    } else if (holes.length === 9 && holes[0] === 10) {
      setEditingHolesPreset('BACK')
    } else {
      const hasDuplicates = new Set(holes).size !== holes.length
      const isSorted = holes.every((val: number, i: number, arr: number[]) => !i || val >= arr[i - 1])
      if (hasDuplicates || !isSorted) {
        setEditingHolesPreset('RANGE')
      } else {
        setEditingHolesPreset('CUSTOM')
      }
    }
  }

  const handleUpdateRoundSubmit = async (roundId: string) => {
    setIsUpdatingRound(true)
    setEditingRoundError("")
    try {
      let holes: number[] = []
      let ninePreset: string | null = null
      if (editingHolesPreset === 'ALL') {
        holes = Array.from({ length: 18 }, (_, i) => i + 1)
      } else if (editingHolesPreset === 'FRONT') {
        holes = Array.from({ length: 9 }, (_, i) => i + 1)
      } else if (editingHolesPreset === 'BACK') {
        holes = Array.from({ length: 9 }, (_, i) => i + 10)
      } else if (editingHolesPreset === 'FRONT_TWICE') {
        holes = Array.from({ length: 18 }, (_, i) => i + 1)
        ninePreset = 'FRONT_9_TWICE'
      } else if (editingHolesPreset === 'BACK_TWICE') {
        holes = Array.from({ length: 18 }, (_, i) => i + 1)
        ninePreset = 'BACK_9_TWICE'
      } else if (editingHolesPreset === 'RANGE') {
        holes = parseHoleRangeString(editingHoleRange)
      } else {
        holes = [...editingCustomHoles]
      }

      await updateRoundHoles(roundId, competition.id, holes, editingRoundTeeId, ninePreset)
      setEditingRoundId(null)
      router.refresh()
    } catch (err: any) {
      setEditingRoundError(err.message || "Failed to update round.")
    } finally {
      setIsUpdatingRound(false)
    }
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingTeam(true)
    setTeamError("")
    try {
      await addTeam(competition.id, newTeamName)
      setNewTeamName("")
      router.refresh()
    } catch (err: any) {
      setTeamError(err.message || "Failed to create team.")
    } finally {
      setIsAddingTeam(false)
    }
  }

  const triggerDeleteTeam = async (teamId: string) => {
    if (confirm("Are you sure you want to delete this team? Members will be unassigned.")) {
      await deleteTeam(teamId, competition.id)
      router.refresh()
    }
  }

  const handleUpdateTeamColor = async (teamId: string, color: string) => {
    setLocalTeamColors(prev => ({ ...prev, [teamId]: color }))
    try {
      await updateTeamColor(teamId, competition.id, color)
      router.refresh()
    } catch (err) {
      console.error("Failed to update team color:", err)
      alert("Failed to update team color.")
      setLocalTeamColors(prev => {
        const next = { ...prev }
        delete next[teamId]
        return next
      })
    }
  }

  const togglePartSelection = (id: string) => {
    if (selectedPartIds.includes(id)) {
      setSelectedPartIds(selectedPartIds.filter(x => x !== id))
    } else {
      setSelectedPartIds([...selectedPartIds, id])
    }
  }

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRoundId) return
    setIsCreatingPairing(true)
    setPairingError("")
    try {
      await addMatch(selectedRoundId, competition.id, {
        type: matchType,
        participantIds: selectedPartIds,
        allowanceType: (matchType === "SINGLES" || matchType === "TEAM_MATCHPLAY") ? allowanceType : null,
        playUntilEnd: (matchType === "SINGLES" || matchType === "TEAM_MATCHPLAY") ? playUntilEnd : null,
        holeRange: (matchType === "SINGLES" || matchType === "TEAM_MATCHPLAY") ? holeRange : null
      })
      setSelectedPartIds([])
      router.refresh()
    } catch (err: any) {
      setPairingError(err.message || "Failed to create pairing.")
    } finally {
      setIsCreatingPairing(false)
    }
  }

  const handleDeleteMatch = async (matchId: string) => {
    if (confirm("Are you sure you want to delete this match?")) {
      await deleteMatch(matchId, competition.id)
      router.refresh()
    }
  }

  const handleSaveAllowance = async (matchId: string) => {
    const val = overrideAllowances[matchId]
    if (val === undefined) return
    setSavingAllowance(prev => ({ ...prev, [matchId]: true }))
    try {
      const parsed = val === "" ? null : parseInt(val)
      await updateMatchAllowance(matchId, competition.id, parsed)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to update allowance")
    } finally {
      setSavingAllowance(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const handleSaveMatchPlayerAllowance = async (matchPlayerId: string) => {
    const val = overrideMatchPlayerAllowances[matchPlayerId]
    if (val === undefined) return
    setSavingMatchPlayerAllowance(prev => ({ ...prev, [matchPlayerId]: true }))
    try {
      const parsed = val === "" ? null : parseInt(val)
      await updateMatchPlayerAllowance(matchPlayerId, competition.id, parsed)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to update player allowance")
    } finally {
      setSavingMatchPlayerAllowance(prev => ({ ...prev, [matchPlayerId]: false }))
    }
  }

  const handleSaveHoleRange = async (matchId: string) => {
    const val = overrideHoleRanges[matchId]
    if (val === undefined) return
    setSavingHoleRange(prev => ({ ...prev, [matchId]: true }))
    try {
      await updateMatchHoleRange(matchId, competition.id, val)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to update hole range")
    } finally {
      setSavingHoleRange(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const handleTogglePlayUntilEnd = async (matchId: string, currentVal: boolean) => {
    try {
      await updateMatchPlayUntilEnd(matchId, competition.id, !currentVal)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to toggle play until end")
    }
  }

  const handleCreateParticipant = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingParticipant(true)
    setPartError("")
    try {
      const hcp = partHandicap ? parseFloat(partHandicap) : null
      await addParticipant(competition.id, {
        userId: partUserId || null,
        dummyName: partDummyName || null,
        compHandicap: hcp,
        teamId: partTeamId || null
      })
      setPartUserId("")
      setPartDummyName("")
      setPartHandicap("")
      setPartTeamId("")
      router.refresh()
    } catch (err: any) {
      setPartError(err.message || "Failed to add participant.")
    } finally {
      setIsAddingParticipant(false)
    }
  }

  const triggerDeleteParticipant = async (partId: string) => {
    if (confirm("Are you sure you want to remove this player from the competition? All their scores will be deleted.")) {
      await deleteParticipant(partId, competition.id)
      router.refresh()
    }
  }

  // Danger zone score resets
  const handleResetAll = async () => {
    if (confirm("🚨 DANGER! Are you sure you want to delete ALL scores for this competition? This cannot be undone.")) {
      setIsResetting(true)
      await resetAllScores(competition.id, session.user.id, session.user.name || session.user.email)
      setIsResetting(false)
      alert("All scores cleared successfully.")
      router.refresh()
    }
  }

  const handleResetRound = async () => {
    if (!dangerResetRoundId) return
    const rName = competition.rounds.find((r: any) => r.id === dangerResetRoundId)?.name || dangerResetRoundId
    if (confirm(`🚨 Are you sure you want to reset all scores for ${rName}?`)) {
      setIsResetting(true)
      await resetRoundScores(competition.id, dangerResetRoundId, session.user.id, session.user.name || session.user.email)
      setIsResetting(false)
      alert(`Scores for ${rName} cleared successfully.`)
      router.refresh()
    }
  }

  const handleResetPlayer = async () => {
    if (!dangerResetPlayerId) return
    const p = competition.participants.find((p: any) => p.id === dangerResetPlayerId)
    const pName = p?.userId ? (p.user?.name || p.user?.email) : p?.dummyName
    if (confirm(`🚨 Are you sure you want to reset all scores for player ${pName}?`)) {
      setIsResetting(true)
      await resetPlayerScores(competition.id, dangerResetPlayerId, session.user.id, session.user.name || session.user.email)
      setIsResetting(false)
      alert(`Scores for ${pName} cleared successfully.`)
      router.refresh()
    }
  }

  const handleResetPlayerRound = async () => {
    if (!dangerResetRoundId || !dangerResetPlayerId) return
    const rName = competition.rounds.find((r: any) => r.id === dangerResetRoundId)?.name || dangerResetRoundId
    const p = competition.participants.find((p: any) => p.id === dangerResetPlayerId)
    const pName = p?.userId ? (p.user?.name || p.user?.email) : p?.dummyName
    if (confirm(`🚨 Are you sure you want to reset scores for player ${pName} in round ${rName}?`)) {
      setIsResetting(true)
      await resetPlayerRoundScores(competition.id, dangerResetRoundId, dangerResetPlayerId, session.user.id, session.user.name || session.user.email)
      setIsResetting(false)
      alert(`Scores for ${pName} in ${rName} cleared successfully.`)
      router.refresh()
    }
  }

  const isAdminUser = session && (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN')

  return (
    <div 
      className="min-h-screen bg-slate-100 text-slate-800 flex flex-col transition-all duration-300"
      style={{
        backgroundImage: competition.bgImage ? `linear-gradient(to bottom, rgba(248, 250, 252, 0.1), rgba(248, 250, 252, 0.25)), url("${competition.bgImage}")` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Top Header */}
      <header className="border-b border-slate-250 bg-white/45 backdrop-blur-md sticky top-0 z-40 px-4 py-2 md:py-4 shadow-sm flex justify-between items-center h-12 md:h-16 landscape:h-10">
        <div className="space-y-0 md:space-y-0.5">
          <div className="text-[9px] md:text-[10px] uppercase font-bold tracking-widest text-slate-500 landscape:hidden">leaderboard.io</div>
          <h1 className="text-sm md:text-xl font-black text-slate-900 flex items-center gap-1.5">
            <span style={{ color: primaryColor }}>{competition.name}</span>
            <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider landscape:hidden">
              {competition.type}
            </span>
          </h1>
        </div>

        <div className="flex items-center space-x-2 md:space-x-3">
          <button 
            onClick={() => {
              if (typeof window !== "undefined") {
                document.cookie = "last-comp-slug=; path=/; max-age=0; SameSite=Lax";
                window.location.href = "/";
              }
            }}
            className="p-1 md:p-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-655 rounded-lg border border-slate-200 transition-colors shadow-sm inline-flex items-center justify-center cursor-pointer"
            title="Switch Competition"
          >
            <Home size={16} className="landscape:w-3.5 landscape:h-3.5" />
          </button>

          {session ? (
            <div className="flex items-center space-x-1.5 md:space-x-2">
              <span className="text-xs text-slate-655 font-medium hidden md:inline landscape:hidden">Logged in as {session.user.name || session.user.email}</span>
              <button 
                onClick={() => signOut({ callbackUrl: `/?comp=${competition.uniqueSlug}` })}
                className="p-1 md:p-1.5 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-655 rounded-lg border border-slate-200 transition-colors shadow-sm cursor-pointer"
                title="Log Out"
              >
                <LogOut size={16} className="landscape:w-3.5 landscape:h-3.5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setActiveTab('scores')}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-255 text-xs font-semibold rounded-lg transition-all shadow-sm landscape:py-0.5 landscape:px-2 cursor-pointer"
            >
              <Key size={14} className="landscape:w-3 landscape:h-3" />
              <span>Login to Score</span>
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white/35 backdrop-blur-md border-b border-slate-200 sticky top-12 md:top-16 landscape:top-10 z-30 flex justify-center shadow-sm h-10 md:h-14 landscape:h-8.5">
        <div className="flex w-full max-w-7xl px-4 h-full">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-2 md:py-4 text-center text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center space-x-1.5 md:space-x-2 landscape:py-1 ${
              activeTab === 'leaderboard'
                ? 'text-emerald-500 bg-emerald-500/20 font-black'
                : 'border-transparent text-slate-700 hover:text-slate-950 font-black'
            }`}
            style={{ borderBottomColor: activeTab === 'leaderboard' ? primaryColor : 'transparent' }}
          >
            <Trophy size={16} className="landscape:w-3.5 landscape:h-3.5" />
            <span>Leaderboard</span>
          </button>

          <button
            onClick={() => setActiveTab('scores')}
            className={`flex-1 py-2 md:py-4 text-center text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center space-x-1.5 md:space-x-2 landscape:py-1 ${
              activeTab === 'scores'
                ? 'text-emerald-500 bg-emerald-500/20 font-black'
                : 'border-transparent text-slate-700 hover:text-slate-950 font-black'
            }`}
            style={{ borderBottomColor: activeTab === 'scores' ? primaryColor : 'transparent' }}
          >
            <Edit size={16} className="landscape:w-3.5 landscape:h-3.5" />
            <span>Score Entry</span>
          </button>

          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-2 md:py-4 text-center text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center space-x-1.5 md:space-x-2 landscape:py-1 ${
              activeTab === 'details'
                ? 'text-emerald-500 bg-emerald-500/20 font-black'
                : 'border-transparent text-slate-700 hover:text-slate-950 font-black'
            }`}
            style={{ borderBottomColor: activeTab === 'details' ? primaryColor : 'transparent' }}
          >
            <BookOpen size={16} className="landscape:w-3.5 landscape:h-3.5" />
            <span>Details</span>
          </button>

          {isAdminUser && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-2 md:py-4 text-center text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center space-x-1.5 md:space-x-2 landscape:py-1 ${
                activeTab === 'admin'
                  ? 'text-emerald-500 bg-emerald-500/20 font-black'
                  : 'border-transparent text-slate-700 hover:text-slate-950 font-black'
              }`}
              style={{ borderBottomColor: activeTab === 'admin' ? primaryColor : 'transparent' }}
            >
              <Settings size={16} className="landscape:w-3.5 landscape:h-3.5" />
              <span>Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabbed Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Tab 1: Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            
            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center bg-white/35 backdrop-blur-sm border border-slate-200 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-black text-slate-800 uppercase">View Round</span>
                <select
                  value={selectedRoundFilter}
                  onChange={e => setSelectedRoundFilter(e.target.value)}
                  className="bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-1.5 text-sm font-black text-emerald-850 focus:ring-emerald-500 focus:outline-none cursor-pointer shadow-sm transition-all"
                >
                  <option value="TOTAL">All Rounds (Cumulative)</option>
                  {competition.rounds.map((round: any) => (
                    <option key={round.id} value={round.id}>{round.name}</option>
                  ))}
                </select>
              </div>

              {/* Extra Leaderboard Dropdown */}
              <div className="flex items-center space-x-3">
                <span className="text-xs font-black text-slate-800 uppercase">Leaderboard</span>
                <select
                  value={selectedLeaderboardType}
                  onChange={e => setSelectedLeaderboardType(e.target.value)}
                  className="bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-1.5 text-sm font-black text-emerald-850 focus:ring-emerald-500 focus:outline-none cursor-pointer shadow-sm transition-all"
                >
                  <option value="MAIN">
                    {competition.type === 'TEAM_MATCHPLAY'
                      ? 'Team Matchplay'
                      : competition.type === 'MATCHPLAY'
                        ? 'Matchplays'
                        : `Main Standings (${competition.type === 'NETTO_STABLEFORD' ? 'Stableford Netto' : competition.type})`
                    }
                  </option>
                  {selectedExtraLeaderboards.includes('STROKEPLAY') && competition.type !== 'STROKEPLAY_GROSS' && (
                    <option value="STROKEPLAY">Strokeplay Gross</option>
                  )}
                  {selectedExtraLeaderboards.includes('STABLEFORD_NETTO') && competition.type !== 'NETTO_STABLEFORD' && (
                    <option value="STABLEFORD_NETTO">Stableford Netto</option>
                  )}
                  {selectedExtraLeaderboards.includes('STABLEFORD_BRUTTO') && (
                    <option value="STABLEFORD_BRUTTO">Stableford Brutto</option>
                  )}
                  {selectedExtraLeaderboards.includes('BIRDIE') && (
                    <option value="BIRDIE">Birdie Leaderboard</option>
                  )}
                  {selectedExtraLeaderboards.includes('DOUBLE_BOGEY_PLUS') && (
                    <option value="DOUBLE_BOGEY_PLUS">Double Bogey+ Leaderboard</option>
                  )}
                  {selectedExtraLeaderboards.includes('PAR_PLUS_SERIES') && (
                    <option value="PAR_PLUS_SERIES">Par+ Series</option>
                  )}
                  {isTeamComp && selectedExtraLeaderboards.includes('TEAM_STROKEPLAY') && (
                    <option value="TEAM_STROKEPLAY">Team Strokeplay</option>
                  )}
                  {isTeamComp && selectedExtraLeaderboards.includes('TEAM_STABLEFORD_NETTO') && (
                    <option value="TEAM_STABLEFORD_NETTO">Team Stableford Netto</option>
                  )}
                  {isTeamComp && selectedExtraLeaderboards.includes('TEAM_STABLEFORD_BRUTTO') && (
                    <option value="TEAM_STABLEFORD_BRUTTO">Team Stableford Brutto</option>
                  )}
                  {competition.rounds.some((r: any) => r.matches?.some((m: any) => m.type === "SINGLES")) && competition.type !== 'MATCHPLAY' && (
                    <option value="MATCHPLAY">Matchplays</option>
                  )}
                  {competition.rounds.some((r: any) => r.matches?.some((m: any) => m.type === "TEAM_MATCHPLAY")) && competition.type !== 'TEAM_MATCHPLAY' && (
                    <option value="TEAM_MATCHPLAY">Team Matchplay</option>
                  )}
                  {selectedExtraLeaderboards.includes('MVP') && (
                    <option value="MVP">MVP Leaderboard</option>
                  )}
                </select>
              </div>

              {/* Share View Button */}
              <button
                onClick={handleShareView}
                className="p-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-655 rounded-lg border border-slate-200 transition-colors shadow-sm inline-flex items-center justify-center cursor-pointer ml-2"
                title="Share Current View"
              >
                {shareCopied ? (
                  <CheckCircle size={16} className="text-emerald-600 animate-pulse" />
                ) : (
                  <Share2 size={16} />
                )}
              </button>
            </div>

            {(() => {
              const isViewingTeamMatchplay = selectedLeaderboardType === 'TEAM_MATCHPLAY' || (selectedLeaderboardType === 'MAIN' && competition.type === 'TEAM_MATCHPLAY')
              const isViewingSinglesMatchplay = selectedLeaderboardType === 'MATCHPLAY' || (selectedLeaderboardType === 'MAIN' && competition.type === 'MATCHPLAY')

              if (isViewingTeamMatchplay || isViewingSinglesMatchplay) {
                return (
                  <div className="bg-white/35 backdrop-blur-sm border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-100/50 text-slate-550 uppercase tracking-wider text-xs border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-4">Round</th>
                          <th className="px-5 py-4">Match</th>
                          <th className="px-5 py-4 text-center">Holes</th>
                          <th className="px-5 py-4 text-right">Standing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white/15 text-slate-700">
                        {(() => {
                          const matchplayList: any[] = []
                          const roundsToUse = selectedRoundFilter === 'TOTAL'
                            ? competition.rounds
                            : competition.rounds.filter((r: any) => r.id === selectedRoundFilter)

                          for (const r of roundsToUse) {
                            const matches = (r.matches || []).filter((m: any) => 
                              isViewingTeamMatchplay ? m.type === 'TEAM_MATCHPLAY' : m.type === 'SINGLES'
                            )
                            for (const m of matches) {
                              matchplayList.push({ round: r, match: m })
                            }
                          }

                          if (matchplayList.length === 0) {
                            return (
                              <tr>
                                <td colSpan={5} className="px-5 py-8 text-center text-slate-500 italic">
                                  No matchplay pairings found for the selected filter.
                                </td>
                              </tr>
                            )
                          }

                          // Evaluate status to sort
                          const evaluated = matchplayList.map(({ round, match }) => {
                            const status = computeMatchplayStatus(match, round)
                            return { round, match, status }
                          })

                          // Sort: Live matches first, then Not Started, then Finished (newest first)
                          evaluated.sort((a, b) => {
                            const isFinishedA = a.status.isFinished
                            const isFinishedB = b.status.isFinished

                            const holesA = a.status.holesPlayed
                            const holesB = b.status.holesPlayed

                            // 1. Finished status
                            if (isFinishedA && !isFinishedB) return 1
                            if (!isFinishedA && isFinishedB) return -1

                            if (!isFinishedA && !isFinishedB) {
                              const isLiveA = holesA > 0
                              const isLiveB = holesB > 0
                              // Live matches first
                              if (isLiveA && !isLiveB) return -1
                              if (!isLiveA && isLiveB) return 1

                              // Live / Not started: oldest round first
                              const dateA = new Date(a.round.startDate).getTime()
                              const dateB = new Date(b.round.startDate).getTime()
                              return dateA - dateB
                            }

                            // Both finished: newest first
                            const dateA = new Date(a.round.startDate).getTime()
                            const dateB = new Date(b.round.startDate).getTime()
                            return dateB - dateA
                          })

                          return evaluated.map(({ round, match, status }) => {
                            const { statusText, holesPlayed, totalHoles, player1Name, player2Name, player3Name, player4Name, player1Allowance, player2Allowance, player3Allowance, player4Allowance, isTeamMatchplay, lead } = status
                            return (
                              <tr key={match.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => {
                                setSelectedMatchForScorecard(match)
                                setSelectedMatchRoundForScorecard(round)
                              }}>
                                <td className="px-5 py-4 font-bold text-slate-900">{round.name}</td>
                                <td className="px-5 py-4">
                                  {isTeamMatchplay ? (
                                    <div className="flex flex-col space-y-0.5 text-left font-semibold text-slate-800 leading-tight">
                                      <span>
                                        {player1Name}
                                        {player1Allowance > 0 && ` (${player1Allowance})`}
                                        {` & `}
                                        {player2Name}
                                        {player2Allowance > 0 && ` (${player2Allowance})`}
                                        <span className="text-slate-400 font-normal ml-1">v</span>
                                      </span>
                                      <span>
                                        {player3Name}
                                        {player3Allowance > 0 && ` (${player3Allowance})`}
                                        {` & `}
                                        {player4Name}
                                        {player4Allowance > 0 && ` (${player4Allowance})`}
                                        {match.holeRange && match.holeRange !== "1-18" && (
                                          <span className="ml-1.5 text-[8px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-mono">({match.holeRange})</span>
                                        )}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col space-y-0.5 text-left font-semibold text-slate-800 leading-tight">
                                      <span>
                                        {player1Name}
                                        {player1Allowance > 0 && ` (${player1Allowance})`}
                                        <span className="text-slate-400 font-normal ml-1">v</span>
                                      </span>
                                      <span>
                                        {player2Name}
                                        {player2Allowance > 0 && ` (${player2Allowance})`}
                                        {match.holeRange && match.holeRange !== "1-18" && (
                                          <span className="ml-1.5 text-[8px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-mono">({match.holeRange})</span>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-center font-mono text-slate-600">
                                  {holesPlayed}/{totalHoles}
                                </td>
                                <td className={`px-5 py-4 text-right font-black text-sm md:text-base ${
                                  holesPlayed === 0 
                                    ? "text-slate-400 font-bold" 
                                    : lead > 0 
                                      ? "text-emerald-600" 
                                      : lead < 0 
                                        ? "text-red-600" 
                                        : "text-slate-600"
                                }`}>
                                  {statusText}
                                </td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                )
              }

              if (!selectedLeaderboardType.startsWith('TEAM_')) {
                return (
                  <div className="bg-white/35 backdrop-blur-sm border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-100/50 text-slate-550 uppercase tracking-wider text-xs border-b border-slate-200">
                        <tr>
                          <th className="px-2 py-2.5 md:px-5 md:py-4 text-center w-10 md:w-14">Rank</th>
                          <th className="px-3 py-2.5 md:px-5 md:py-4 min-w-[110px] md:min-w-[140px]">Player</th>
                          <th className="px-2 py-2.5 md:px-5 md:py-4 text-center w-20 md:w-28">
                            {competition.showRelToPar && (selectedLeaderboardType === 'MAIN' || selectedLeaderboardType === 'STABLEFORD_NETTO' || selectedLeaderboardType === 'STABLEFORD_BRUTTO')
                              ? 'Score (+/-)'
                              : (selectedLeaderboardType === 'STROKEPLAY' ? 'Gross Strokes' : selectedLeaderboardType === 'BIRDIE' ? 'Birdies (Pars)' : selectedLeaderboardType === 'DOUBLE_BOGEY_PLUS' ? 'DB+' : selectedLeaderboardType === 'PAR_PLUS_SERIES' ? 'Streak' : 'Total Points')
                            }
                          </th>
                          <th className="px-2 py-2.5 md:px-4 md:py-4 text-center w-16 md:w-24">Played</th>
                          {competition.rounds.map((round: any, i: number) => {
                            return (
                              <th key={round.id} className="px-1 py-2.5 md:px-3 md:py-4 text-center text-xs font-semibold text-slate-555 min-w-[75px] md:min-w-[90px]">
                                <div>R{i + 1}</div>
                                {round.tee && (
                                  <div className="text-[8px] md:text-[9px] text-slate-400 font-mono font-medium uppercase tracking-wider block mt-0.5">
                                    {round.tee.name.split(" ")[0]}
                                  </div>
                                )}
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white/15 text-slate-700">
                        {leaderboardList.map((entry) => {
                          const totalHolesForFilter = selectedRoundFilter === 'TOTAL'
                            ? totalCompHoles
                            : (() => {
                                const r = competition.rounds.find((r: any) => r.id === selectedRoundFilter)
                                return r ? getPlayableHolesForRound(r).length : 18
                              })()

                          const isStableford = selectedLeaderboardType === 'STABLEFORD_NETTO' || selectedLeaderboardType === 'STABLEFORD_BRUTTO' || (selectedLeaderboardType === 'MAIN' && competition.type === 'NETTO_STABLEFORD')
                          const isMvp = selectedLeaderboardType === 'MVP'
                          const highlightTeam = isStableford || isMvp
                          const team = entry.participant?.team
                          const rowStyle = (isTeamComp && highlightTeam && team)
                            ? getTeamRowStyle(team, competition.teams)
                            : {}

                          return (
                            <tr key={entry.participantId} style={rowStyle} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-2 py-2.5 md:px-5 md:py-4 text-center font-extrabold font-mono text-slate-700">
                                {entry.rank}
                              </td>
                              <td className="px-3 py-2.5 md:px-5 md:py-4">
                                <div 
                                  style={isTeamComp && highlightTeam && team ? { color: `hsl(${getTeamHue(team, competition.teams)}, 75%, 25%)` } : {}}
                                  className="font-extrabold text-slate-900 text-sm md:text-base leading-tight"
                                >
                                  {entry.name}
                                </div>
                                {team && (
                                  isTeamComp && highlightTeam ? (
                                    <span 
                                      style={{
                                        backgroundColor: `hsla(${getTeamHue(team, competition.teams)}, 80%, 92%, 0.85)`,
                                        color: `hsl(${getTeamHue(team, competition.teams)}, 85%, 25%)`,
                                        border: `1px solid hsla(${getTeamHue(team, competition.teams)}, 80%, 75%, 0.9)`
                                      }}
                                      className="inline-block text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider mt-1"
                                    >
                                      {team.name}
                                    </span>
                                  ) : (
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{team.name}</div>
                                  )
                                )}
                              </td>
                              <td className="px-2 py-2.5 md:px-5 md:py-4 text-center text-emerald-600 font-black text-base md:text-xl">
                                {competition.showRelToPar && (selectedLeaderboardType === 'MAIN' || selectedLeaderboardType === 'STABLEFORD_NETTO' || selectedLeaderboardType === 'STABLEFORD_BRUTTO')
                                  ? (entry.relToPar === 0 ? "Even" : (entry.relToPar < 0 ? String(entry.relToPar) : `+${entry.relToPar}`))
                                  : (selectedLeaderboardType === 'BIRDIE' ? `${entry.totalPoints} (${entry.pars})` : entry.totalPoints)
                                }
                              </td>
                              <td className="px-2 py-2.5 md:px-4 md:py-4 text-center font-mono text-slate-500 text-xs md:text-sm">
                                {entry.holesPlayed}/{totalHolesForFilter}
                              </td>

                              {competition.rounds.map((round: any) => {
                                const pts = entry.roundPoints[round.id]
                                const showRel = competition.showRelToPar && (selectedLeaderboardType === 'MAIN' || selectedLeaderboardType === 'STABLEFORD_NETTO' || selectedLeaderboardType === 'STABLEFORD_BRUTTO')
                                
                                let displayVal = "-"
                                if (pts !== undefined) {
                                  if (showRel) {
                                    const rel = entry.roundRelToPar?.[round.id] ?? 0
                                    displayVal = rel === 0 ? "Even" : (rel < 0 ? String(rel) : `+${rel}`)
                                  } else {
                                    displayVal = String(pts)
                                  }
                                }

                                return (
                                  <td key={round.id} className="px-1 py-1.5 md:px-3 md:py-4 text-center">
                                    <button
                                      onClick={() => {
                                        if (selectedLeaderboardType === 'MVP') {
                                          const match = round.matches?.find((m: any) =>
                                            m.matchPlayers.some((mp: any) => mp.participantId === entry.participant.id)
                                          )
                                          if (match) {
                                            setSelectedMatchForScorecard(match)
                                            setSelectedMatchRoundForScorecard(round)
                                          }
                                        } else {
                                          setSelectedParticipantForScorecard(entry.participant)
                                          setSelectedRoundIdForScorecard(round.id)
                                        }
                                      }}
                                      className="px-2 py-0.5 md:px-2.5 md:py-1 text-xs font-extrabold bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-250 text-slate-700 hover:text-emerald-600 rounded-md transition-all font-mono shadow-sm"
                                      title={`View Round ${round.name} Scorecard`}
                                    >
                                      {displayVal}
                                    </button>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              }

              return (
                <div className="bg-white/35 backdrop-blur-sm border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-100/50 text-slate-550 uppercase tracking-wider text-xs border-b border-slate-200">
                      <tr>
                        <th className="px-2 py-2.5 md:px-5 md:py-4 text-center w-10 md:w-14">Rank</th>
                        <th className="px-3 py-2.5 md:px-5 md:py-4 min-w-[110px] md:min-w-[140px]">Team Name</th>
                        <th className="px-2 py-2.5 md:px-5 md:py-4 text-center w-20 md:w-28">
                          {competition.showRelToPar && (selectedLeaderboardType === 'TEAM_STABLEFORD_NETTO' || selectedLeaderboardType === 'TEAM_STABLEFORD_BRUTTO')
                            ? 'Score (+/-)'
                            : (selectedLeaderboardType === 'TEAM_STROKEPLAY' ? 'Gross Strokes' : 'Total Points')
                          }
                        </th>
                        <th className="px-2 py-2.5 md:px-4 md:py-4 text-center w-16 md:w-24">Played</th>
                        {competition.rounds.map((round: any, i: number) => {
                          return (
                            <th key={round.id} className="px-1 py-2.5 md:px-3 md:py-4 text-center text-xs font-semibold text-slate-555 min-w-[75px] md:min-w-[90px]">
                              <div>R{i + 1}</div>
                              {round.tee && (
                                <div className="text-[8px] md:text-[9px] text-slate-400 font-mono font-medium uppercase tracking-wider block mt-0.5">
                                  {round.tee.name.split(" ")[0]}
                                </div>
                              )}
                            </th>
                          )
                        })}
                        <th className="px-2 py-2.5 md:px-5 md:py-4 text-right w-12 md:w-16">Cards</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white/15 text-slate-700">
                      {leaderboardList.map((entry) => {
                        const totalHolesForFilter = selectedRoundFilter === 'TOTAL'
                          ? totalCompHoles
                          : (() => {
                              const r = competition.rounds.find((r: any) => r.id === selectedRoundFilter)
                              return r ? getPlayableHolesForRound(r).length : 18
                            })()

                        return (
                          <tr key={entry.teamId} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-2 py-2.5 md:px-5 md:py-4 text-center font-extrabold font-mono text-slate-700">
                              {entry.rank}
                            </td>
                            <td className="px-3 py-2.5 md:px-5 md:py-4 font-bold text-slate-900 text-sm md:text-base leading-tight">
                              {entry.name}
                            </td>
                            <td className="px-2 py-2.5 md:px-5 md:py-4 text-center text-emerald-600 font-black text-base md:text-xl">
                              {competition.showRelToPar && (selectedLeaderboardType === 'TEAM_STABLEFORD_NETTO' || selectedLeaderboardType === 'TEAM_STABLEFORD_BRUTTO')
                                ? (entry.relToPar === 0 ? "Even" : (entry.relToPar < 0 ? String(entry.relToPar) : `+${entry.relToPar}`))
                                : entry.totalPoints
                              }
                            </td>
                            <td className="px-2 py-2.5 md:px-4 md:py-4 text-center font-mono text-slate-500 text-xs md:text-sm">
                              {entry.holesPlayed}/{totalHolesForFilter}
                            </td>

                            {competition.rounds.map((round: any) => {
                              const pts = entry.roundPoints[round.id]
                              const showRel = competition.showRelToPar && (selectedLeaderboardType === 'TEAM_STABLEFORD_NETTO' || selectedLeaderboardType === 'TEAM_STABLEFORD_BRUTTO')
                              
                              let displayVal = "-"
                              if (pts !== undefined) {
                                if (showRel) {
                                  const rel = entry.roundRelToPar?.[round.id] ?? 0
                                  displayVal = rel === 0 ? "Even" : (rel < 0 ? String(rel) : `+${rel}`)
                                } else {
                                  displayVal = String(pts)
                                }
                              }

                              return (
                                <td key={round.id} className="px-1 py-1.5 md:px-3 md:py-4 text-center">
                                  <button
                                    onClick={() => {
                                      setSelectedTeamForScorecard(entry.team)
                                    }}
                                    className="px-2 py-0.5 md:px-2.5 md:py-1 text-xs font-extrabold bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-250 text-slate-700 hover:text-emerald-600 rounded-md transition-all font-mono shadow-sm"
                                    title={`View Round ${round.name} Team Scorecard`}
                                  >
                                    {displayVal}
                                  </button>
                                </td>
                              )
                            })}
                            </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        )}

        {/* Tab 2: Details */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Settings */}
              <div className="bg-white/35 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-xl font-bold border-b border-slate-150 pb-3" style={{ color: primaryColor }}>
                  Competition Settings
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-700 block font-extrabold">Format Modus</span>
                    <span className="text-slate-800 font-bold uppercase">{competition.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-700 block font-extrabold">Type</span>
                    <span className="text-slate-800 font-bold">
                      {competition.isTeamComp ? "Team Competition" : "Individual Competition"}
                    </span>
                  </div>
                  {competition.startDate && (
                    <div>
                      <span className="text-slate-700 block font-extrabold">Start Date</span>
                      <span className="text-slate-800 font-bold">
                        {new Date(competition.startDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {competition.endDate && (
                    <div>
                      <span className="text-slate-700 block font-extrabold">End Date</span>
                      <span className="text-slate-800 font-bold">
                        {new Date(competition.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rounds List */}
              <div className="bg-white/35 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-xl font-bold border-b border-slate-150 pb-3">Rounds Schedule</h3>
                <div className="space-y-4">
                  {competition.rounds.map((round: any) => {
                    const holeCount = round.holesPlayed && round.holesPlayed.length > 0 ? round.holesPlayed.length : 18
                    const teeLabel = round.tee ? ` (${round.tee.name})` : ""

                    return (
                      <div key={round.id} className="bg-white/20 backdrop-blur-sm border border-slate-200/60 p-4 rounded-xl flex justify-between items-center">
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-slate-800">{round.name}</h4>
                          <p className="text-xs text-emerald-655 font-black">
                            {round.course.name}{teeLabel}
                          </p>
                          <p className="text-[10px] text-slate-700 font-mono font-bold">
                            Holes played: {holeCount} holes
                          </p>
                        </div>
                        {round.startDate && (
                          <div className="text-right text-xs text-slate-800 font-mono font-black">
                            {new Date(round.startDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Side Column: Participants List */}
            <div className="bg-white/35 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 h-fit">
              <h3 className="text-lg font-bold border-b border-slate-150 pb-3 flex items-center justify-between">
                <span>Participants</span>
                <span className="text-xs font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                  {competition.participants.length}
                </span>
              </h3>
              <div className="divide-y divide-slate-100">
                {competition.participants.map((p: any) => {
                  const name = p.userId ? (p.user?.name || p.user?.email) : p.dummyName
                  return (
                    <div key={p.id} className="py-2.5 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-sm text-slate-850 truncate max-w-[150px]">{name}</div>
                        {isTeamComp && p.team && (
                          <div className="text-[10px] font-black text-slate-655 uppercase mt-0.5">
                            Team: {p.team.name}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-mono font-black text-cyan-750">
                        {p.compHandicap !== null ? p.compHandicap.toFixed(1) : "-"}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Score Entry */}
        {activeTab === 'scores' && (
          <div className="space-y-6">
            {!session ? (
              /* Inline Login Form */
              <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="text-2xl font-black text-slate-800">Scoring Sign In</h3>
                  <p className="text-xs text-slate-500">Please authenticate to register scores for this round.</p>
                </div>

                {loginError && (
                  <div className="bg-red-50 border border-red-200 text-red-500 text-xs px-3 py-2 rounded-lg text-center">
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-550 mb-1 uppercase">Email Address</label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="player@example.com"
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-550 mb-1 uppercase">Password</label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full flex items-center justify-center space-x-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* Logged In Entry Flow */
              <div className="space-y-6">
                {!setupConfirmed ? (
                  /* Setup Phase */
                  <div className="bg-white/35 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Setup Scoring Flight</h3>
                      <p className="text-xs text-slate-550">Select the playing round and up to 4 players (including yourself) to enter scores for.</p>
                    </div>

                    <div className="space-y-4">
                      {/* Round Selection */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Select Round / Course</label>
                        <select
                          value={selectedRoundId}
                          onChange={e => {
                            setSelectedRoundId(e.target.value)
                            saveSetupToStorage(e.target.value, selectedPlayerIds, entryMode, false)
                          }}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        >
                          {competition.rounds.map((round: any) => (
                            <option key={round.id} value={round.id}>
                              {round.name} ({round.course.name}){round.tee ? ` - Tee: ${round.tee.name}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Flight Players selection */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Select Players (Max 4)</label>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 divide-y divide-slate-200 max-h-60 overflow-y-auto scrollbar-thin">
                          {competition.participants.map((p: any) => {
                            const name = p.userId ? (p.user?.name || p.user?.email) : p.dummyName
                            const isChecked = selectedPlayerIds.includes(p.id)

                            return (
                              <label
                                key={p.id}
                                className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-slate-100 select-none px-2 rounded-lg"
                              >
                                <div className="flex items-center space-x-3">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      let updated = []
                                      if (isChecked) {
                                        updated = selectedPlayerIds.filter(id => id !== p.id)
                                      } else {
                                        if (selectedPlayerIds.length >= 4) {
                                          alert("You can select a maximum of 4 players for scoring.")
                                          return
                                        }
                                        updated = [...selectedPlayerIds, p.id]
                                      }
                                      setSelectedPlayerIds(updated)
                                      saveSetupToStorage(selectedRoundId, updated, entryMode, false)
                                    }}
                                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded bg-white focus:ring-emerald-500 focus:outline-none"
                                  />
                                  <span className="text-sm font-bold text-slate-800">{name}</span>
                                </div>
                                <span className="text-xs font-mono font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded font-bold">
                                  HC {p.compHandicap !== null ? p.compHandicap.toFixed(1) : "-"}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      {/* Entry Mode Selection */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Scoring Input Mode</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEntryMode('LIVE')
                              saveSetupToStorage(selectedRoundId, selectedPlayerIds, 'LIVE', false)
                            }}
                            className={`py-3 text-xs font-bold rounded-xl border transition-all ${
                              entryMode === 'LIVE'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-600 shadow-sm'
                                : 'border-slate-200 bg-slate-50 text-slate-550 hover:text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            Live (Hole-by-Hole)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEntryMode('BULK')
                              saveSetupToStorage(selectedRoundId, selectedPlayerIds, 'BULK', false)
                            }}
                            className={`py-3 text-xs font-bold rounded-xl border transition-all ${
                              entryMode === 'BULK'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-600 shadow-sm'
                                : 'border-slate-200 bg-slate-50 text-slate-550 hover:text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            Bulk Scorecard
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={selectedPlayerIds.length === 0}
                      onClick={() => {
                        const r = competition.rounds.find((round: any) => round.id === selectedRoundId) || competition.rounds[0]
                        const pl = competition.participants.filter((p: any) => selectedPlayerIds.includes(p.id))
                        const match = r?.matches?.find((m: any) => 
                          m.matchPlayers.some((mp: any) => selectedPlayerIds.includes(mp.participantId))
                        )
                        const roundHoles = r?.holesPlayed && r.holesPlayed.length > 0
                          ? [...r.holesPlayed].sort((a: number, b: number) => a - b)
                          : Array.from({ length: 18 }, (_, i) => i + 1)
                        const activeHoles = match 
                          ? parseHoleRange(match.holeRange, roundHoles)
                          : roundHoles

                        const idx = findFirstIncompleteHoleIndex(r, pl, activeHoles)
                        setLiveHoleIndex(idx)
                        setSetupConfirmed(true)
                        saveSetupToStorage(selectedRoundId, selectedPlayerIds, entryMode, true)
                        if (typeof window !== "undefined") {
                          localStorage.setItem(`setup-hole-${competition.id}`, idx.toString())
                        }
                      }}
                      className="w-full flex items-center justify-center space-x-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl disabled:opacity-40 disabled:pointer-events-none transition-colors shadow"
                    >
                      <Play size={16} />
                      <span>Start Entering Scores</span>
                    </button>
                  </div>
                ) : (
                  /* Entry Active Phase */
                  <div className="space-y-4 w-full">
                    {/* Setup Bar */}
                    <div className="flex justify-between items-center bg-white/35 backdrop-blur-sm border border-slate-200 p-4 rounded-xl shadow-sm text-slate-800 w-full">
                      <div className="text-xs font-medium">
                        Round: <span className="font-bold text-emerald-650">{selectedScoringRound?.name}</span> | Players:{" "}
                        <span className="font-bold text-slate-800">
                          {selectedScoringPlayers.map((p: any) => p.userId ? (p.user?.name || p.user?.email) : p.dummyName).join(", ")}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {entryMode === 'LIVE' ? (
                          <button
                            onClick={() => handleToggleEntryMode('BULK')}
                            className="flex items-center space-x-1 text-xs text-emerald-650 hover:text-emerald-700 hover:bg-emerald-50 font-bold px-2.5 py-1 border border-emerald-200 rounded bg-white transition-colors shadow-sm focus:outline-none cursor-pointer"
                          >
                            <BookOpen size={12} />
                            <span>Bulk Entry</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleEntryMode('LIVE')}
                            className="flex items-center space-x-1 text-xs text-emerald-650 hover:text-emerald-700 hover:bg-emerald-50 font-bold px-2.5 py-1 border border-emerald-200 rounded bg-white transition-colors shadow-sm focus:outline-none cursor-pointer"
                          >
                            <Play size={12} />
                            <span>Live Entry</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSetupConfirmed(false)
                            saveSetupToStorage(selectedRoundId, selectedPlayerIds, entryMode, false)
                          }}
                          className="flex items-center space-x-1 text-xs text-slate-500 hover:text-emerald-600 font-bold px-2.5 py-1 border border-slate-200 rounded bg-slate-50 transition-colors shadow-sm focus:outline-none cursor-pointer"
                        >
                          <Settings size={12} />
                          <span>Change Flight</span>
                        </button>
                      </div>
                    </div>

                    {/* Rendering target mode */}
                    {entryMode === 'LIVE' ? (
                      <LiveScoreEntry
                        round={selectedScoringRound}
                        selectedParticipants={selectedScoringPlayers}
                        session={session}
                        onScoreSaved={() => router.refresh()}
                        initialHoleIndex={liveHoleIndex}
                        onToggleMode={handleToggleEntryMode}
                        onHoleChange={handleLiveHoleChange}
                        holesToPlay={scoringHoles}
                        isTeamComp={isTeamComp}
                        competition={competition}
                      />
                    ) : (
                      <BulkScorecardEntry
                        round={selectedScoringRound}
                        selectedParticipants={selectedScoringPlayers}
                        session={session}
                        onScoreSaved={() => router.refresh()}
                        initialFocusId={focusInputId}
                        onToggleMode={handleToggleEntryMode}
                        holesToPlay={scoringHoles}
                        isTeamComp={isTeamComp}
                        competition={competition}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Admin Controls */}
        {activeTab === 'admin' && isAdminUser && (
          <div className="space-y-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            {/* Sub-tabs row */}
            <div className="flex border-b border-slate-200 pb-3 gap-6">
              <button
                onClick={() => setAdminSubTab('configure')}
                className={`pb-1 text-sm font-bold border-b-2 transition-all ${
                  adminSubTab === 'configure' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-650'
                }`}
              >
                Configure Settings
              </button>
              <button
                onClick={() => setAdminSubTab('audit')}
                className={`pb-1 text-sm font-bold border-b-2 transition-all ${
                  adminSubTab === 'audit' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-650'
                }`}
              >
                Result Audit Log
              </button>
              <button
                onClick={() => setAdminSubTab('danger')}
                className={`pb-1 text-sm font-bold border-b-2 transition-all ${
                  adminSubTab === 'danger' ? 'border-red-500 text-red-500 font-black' : 'border-transparent text-slate-400 hover:text-slate-655'
                }`}
              >
                Danger Zone
              </button>
            </div>

            {/* Sub-tab 1: Configure */}
            {adminSubTab === 'configure' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* Configure Sub-Sidebar */}
                <div className="md:col-span-1 flex flex-col space-y-1.5 border-r border-slate-100 pr-4">
                  <button
                    onClick={() => setConfigureSubTab('general')}
                    className={`px-3 py-2 text-left text-xs font-bold rounded-lg transition-all ${
                      configureSubTab === 'general' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    General Settings
                  </button>
                  <button
                    onClick={() => setConfigureSubTab('rounds')}
                    className={`px-3 py-2 text-left text-xs font-bold rounded-lg transition-all ${
                      configureSubTab === 'rounds' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Rounds
                  </button>
                  <button
                    onClick={() => setConfigureSubTab('teams')}
                    className={`px-3 py-2 text-left text-xs font-bold rounded-lg transition-all ${
                      configureSubTab === 'teams' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Teams
                  </button>
                  <button
                    onClick={() => setConfigureSubTab('participants')}
                    className={`px-3 py-2 text-left text-xs font-bold rounded-lg transition-all ${
                      configureSubTab === 'participants' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Participants
                  </button>
                  <button
                    onClick={() => setConfigureSubTab('matches')}
                    className={`px-3 py-2 text-left text-xs font-bold rounded-lg transition-all ${
                      configureSubTab === 'matches' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Pairings & Matches
                  </button>
                </div>

                {/* Configure Sub-Content */}
                <div className="md:col-span-3">
                  
                  {/* General settings panel */}
                  {configureSubTab === 'general' && (
                    <form onSubmit={handleUpdateGeneral} className="space-y-4">
                      <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-650 pb-2 border-b border-slate-100">
                        General Settings
                      </h4>
                      {generalError && (
                        <div className="bg-red-50 text-red-500 p-2.5 rounded-lg text-xs border border-red-200">{generalError}</div>
                      )}
                      {generalSuccess && (
                        <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-lg text-xs border border-emerald-200">Settings updated successfully!</div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-500 mb-1">COMPETITION NAME</label>
                          <input
                            type="text"
                            value={compName}
                            onChange={e => setCompName(e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">UNIQUE SLUG URL</label>
                          <input
                            type="text"
                            value={compSlug}
                            onChange={e => setCompSlug(e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">MODUS FORMAT</label>
                          <select
                            value={compType}
                            onChange={e => setCompType(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          >
                            <option value="NETTO_STABLEFORD">Netto Stableford</option>
                            <option value="STROKEPLAY_GROSS">Strokeplay Gross</option>
                            <option value="MATCHPLAY">Matchplay (Ryder Cup)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">START DATE</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">END DATE</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                        <div className="col-span-2 flex flex-col space-y-2">
                          <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isTeamComp}
                              onChange={e => setIsTeamComp(e.target.checked)}
                              className="w-4 h-4 text-emerald-600 rounded bg-slate-50 border-slate-300"
                            />
                            <span>IS TEAM COMPETITION?</span>
                          </label>
                          <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showRelToPar}
                              onChange={e => setShowRelToPar(e.target.checked)}
                              className="w-4 h-4 text-emerald-600 rounded bg-slate-50 border-slate-300"
                            />
                            <span>SHOW LEADERBOARD +/- RELATIVE TO PAR?</span>
                          </label>
                        </div>

                        {/* Extra Leaderboards Options */}
                        <div className="col-span-2 space-y-2.5 pt-2">
                          <label className="block text-xs font-semibold text-slate-500 uppercase">Enable Extra Side Leaderboards</label>
                          <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                            {[
                              { id: 'STROKEPLAY', label: 'Strokeplay Gross', needsTeam: false, hideForModus: 'STROKEPLAY_GROSS' },
                              { id: 'STABLEFORD_NETTO', label: 'Stableford Netto', needsTeam: false, hideForModus: 'NETTO_STABLEFORD' },
                              { id: 'STABLEFORD_BRUTTO', label: 'Stableford Brutto', needsTeam: false, hideForModus: '' },
                              { id: 'BIRDIE', label: 'Birdie Leaderboard', needsTeam: false, hideForModus: '' },
                              { id: 'DOUBLE_BOGEY_PLUS', label: 'Double Bogey+ Leaderboard', needsTeam: false, hideForModus: '' },
                              { id: 'PAR_PLUS_SERIES', label: 'Par+ Streak Leaderboard', needsTeam: false, hideForModus: '' },
                              { id: 'TEAM_STROKEPLAY', label: 'Team Strokeplay', needsTeam: true, hideForModus: '' },
                              { id: 'TEAM_STABLEFORD_NETTO', label: 'Team Stableford Netto', needsTeam: true, hideForModus: '' },
                              { id: 'TEAM_STABLEFORD_BRUTTO', label: 'Team Stableford Brutto', needsTeam: true, hideForModus: '' }
                            ].map(opt => {
                              const disabled = (opt.needsTeam && !isTeamComp) || (opt.hideForModus && compType === opt.hideForModus)
                              const checked = selectedExtraLeaderboards.includes(opt.id)

                              return (
                                <label key={opt.id} className={`flex items-center space-x-2 text-xs select-none ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <input
                                    type="checkbox"
                                    checked={checked && !disabled}
                                    disabled={!!disabled}
                                    onChange={() => {
                                      if (checked) {
                                        setSelectedExtraLeaderboards(selectedExtraLeaderboards.filter(x => x !== opt.id))
                                      } else {
                                        setSelectedExtraLeaderboards([...selectedExtraLeaderboards, opt.id])
                                      }
                                    }}
                                    className="w-4 h-4 text-emerald-600 rounded bg-white border-slate-350"
                                  />
                                  <span className="font-semibold text-slate-700">{opt.label}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-500 mb-1">CSS CONFIG JSON</label>
                          <textarea
                            value={cssConfig}
                            onChange={e => setCssConfig(e.target.value)}
                            rows={3}
                            placeholder='{"primaryColor": "#10b981"}'
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Background Image File (Stored in DB)</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                const reader = new FileReader()
                                reader.onloadend = () => {
                                  setBgImage(reader.result as string)
                                }
                                reader.readAsDataURL(file)
                              }
                            }}
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                          />
                          {bgImage && (
                            <div className="mt-3 relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                              <img 
                                src={bgImage} 
                                alt="Background Preview" 
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => setBgImage("")}
                                className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-md transition-colors"
                                title="Remove Background Image"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSavingGeneral}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Save size={16} />
                        <span>Save Configuration</span>
                      </button>
                    </form>
                  )}

                  {/* Rounds Settings Panel */}
                  {configureSubTab === 'rounds' && (
                    <div className="space-y-6">
                      <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-650 pb-2 border-b border-slate-100">
                        Rounds Schedule
                      </h4>

                      {/* Add Round Form */}
                      <form onSubmit={handleCreateRound} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                        <h5 className="font-bold text-xs text-slate-650 uppercase">Add New Round</h5>
                        {roundError && <div className="text-red-500 text-xs">{roundError}</div>}
                        
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="col-span-2">
                            <label className="block font-semibold text-slate-550 mb-0.5">ROUND NAME</label>
                            <input
                              type="text"
                              value={newRoundName}
                              onChange={e => setNewRoundName(e.target.value)}
                              placeholder="e.g. Round 1, Day 2"
                              required
                              className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-550 mb-0.5">GOLF COURSE</label>
                            <select
                              value={newRoundCourseId}
                              onChange={e => setNewRoundCourseId(e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                            >
                              {courses.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Round Tee selection dropdown */}
                          <div>
                            <label className="block font-semibold text-slate-550 mb-0.5">ROUND TEE BOX</label>
                            <select
                              value={newRoundTeeId}
                              onChange={e => setNewRoundTeeId(e.target.value)}
                              required
                              className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                            >
                              {selectedCourseForNewRound?.tees?.map((tee: any) => (
                                <option key={tee.id} value={tee.id}>
                                  {tee.name} (CR: {tee.courseRating} / Slope: {tee.slope})
                                </option>
                              ))}
                              {(!selectedCourseForNewRound?.tees || selectedCourseForNewRound.tees.length === 0) && (
                                <option value="">No Tees Configured</option>
                              )}
                            </select>
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-550 mb-0.5">START DATE & TIME</label>
                            <input
                              type="datetime-local"
                              value={newRoundStart}
                              onChange={e => setNewRoundStart(e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-550 mb-0.5">END DATE & TIME</label>
                            <input
                              type="datetime-local"
                              value={newRoundEnd}
                              onChange={e => setNewRoundEnd(e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="block font-semibold text-slate-550 mb-1">HOLES PLAYED</label>
                            <div className="flex gap-4 mb-2.5 flex-wrap">
                              <label className="flex items-center space-x-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="holesPreset"
                                  checked={newRoundHolesPreset === 'ALL'}
                                  onChange={() => setNewRoundHolesPreset('ALL')}
                                />
                                <span>All 18</span>
                              </label>
                              <label className="flex items-center space-x-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="holesPreset"
                                  checked={newRoundHolesPreset === 'FRONT'}
                                  onChange={() => setNewRoundHolesPreset('FRONT')}
                                />
                                <span>Front 9 (1-9)</span>
                              </label>
                              <label className="flex items-center space-x-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="holesPreset"
                                  checked={newRoundHolesPreset === 'BACK'}
                                  onChange={() => setNewRoundHolesPreset('BACK')}
                                />
                                <span>Back 9 (10-18)</span>
                              </label>
                              <label className="flex items-center space-x-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="holesPreset"
                                  checked={newRoundHolesPreset === 'FRONT_TWICE'}
                                  onChange={() => setNewRoundHolesPreset('FRONT_TWICE')}
                                />
                                <span>Front 9 Twice</span>
                              </label>
                              <label className="flex items-center space-x-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="holesPreset"
                                  checked={newRoundHolesPreset === 'BACK_TWICE'}
                                  onChange={() => setNewRoundHolesPreset('BACK_TWICE')}
                                />
                                <span>Back 9 Twice</span>
                              </label>
                              <label className="flex items-center space-x-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="holesPreset"
                                  checked={newRoundHolesPreset === 'RANGE'}
                                  onChange={() => setNewRoundHolesPreset('RANGE')}
                                />
                                <span>Hole Range</span>
                              </label>
                              <label className="flex items-center space-x-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="holesPreset"
                                  checked={newRoundHolesPreset === 'CUSTOM'}
                                  onChange={() => {
                                    setNewRoundHolesPreset('CUSTOM')
                                    setNewRoundCustomHoles([1])
                                  }}
                                />
                                <span>Custom</span>
                              </label>
                            </div>

                            {newRoundHolesPreset === 'RANGE' && (
                              <div className="mt-2 space-y-1">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase">Hole Range Expression</label>
                                <input
                                  type="text"
                                  value={newRoundHoleRange}
                                  onChange={e => setNewRoundHoleRange(e.target.value)}
                                  placeholder="e.g. 1-10,12,14 or 1-9,1-3"
                                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                                  required
                                />
                              </div>
                            )}

                            {newRoundHolesPreset === 'CUSTOM' && (
                              <div className="grid grid-cols-6 gap-2 bg-white border border-slate-200 p-3 rounded">
                                {Array.from({ length: 18 }, (_, i) => i + 1).map(num => {
                                  const isChecked = newRoundCustomHoles.includes(num)
                                  return (
                                    <label key={num} className="flex items-center space-x-1 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (isChecked) {
                                            setNewRoundCustomHoles(newRoundCustomHoles.filter(n => n !== num))
                                          } else {
                                            setNewRoundCustomHoles([...newRoundCustomHoles, num])
                                          }
                                        }}
                                      />
                                      <span>Hole {num}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isAddingRound}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition-colors"
                        >
                          {isAddingRound ? "Creating..." : "Add Round"}
                        </button>
                      </form>

                      {/* Configured Rounds List */}
                      <div className="space-y-3">
                        {competition.rounds.map((round: any) => {
                          const isEditing = editingRoundId === round.id
                          const holeCount = round.holesPlayed && round.holesPlayed.length > 0 ? round.holesPlayed.length : 18

                          return (
                            <div key={round.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h5 className="font-extrabold text-slate-800 text-sm">{round.name}</h5>
                                  <p className="text-xs text-emerald-650 font-bold mt-0.5">
                                    {round.course.name}{round.tee ? ` (${round.tee.name})` : ""}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                                    Holes: {holeCount} holes played
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleStartEditRound(round)}
                                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-500 hover:text-emerald-600 shadow-sm"
                                    title="Edit holes / tee"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => triggerDeleteRound(round.id)}
                                    className="p-1.5 bg-white hover:bg-red-50 border border-slate-200 rounded text-slate-500 hover:text-red-650 shadow-sm"
                                    title="Delete round"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>

                              {isEditing && (
                                <div className="mt-4 border-t border-slate-200 pt-4 space-y-3">
                                  <h6 className="font-bold text-xs text-slate-600">Edit Round Config</h6>
                                  {editingRoundError && <div className="text-red-500 text-xs">{editingRoundError}</div>}

                                  {/* Edit Tee select */}
                                  <div className="max-w-xs text-xs space-y-1">
                                    <label className="block font-semibold text-slate-550">Tee Box</label>
                                    <select
                                      value={editingRoundTeeId}
                                      onChange={e => setEditingRoundTeeId(e.target.value)}
                                      className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                                    >
                                      {round.course.tees.map((t: any) => (
                                        <option key={t.id} value={t.id}>
                                          {t.name} (CR: {t.courseRating} / Slope: {t.slope})
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="text-xs space-y-1">
                                    <label className="block font-semibold text-slate-550">Holes Played</label>
                                    <div className="flex gap-4 flex-wrap">
                                      <label className="flex items-center space-x-1 cursor-pointer">
                                        <input
                                          type="radio"
                                          checked={editingHolesPreset === 'ALL'}
                                          onChange={() => setEditingHolesPreset('ALL')}
                                        />
                                        <span>All 18</span>
                                      </label>
                                      <label className="flex items-center space-x-1 cursor-pointer">
                                        <input
                                          type="radio"
                                          checked={editingHolesPreset === 'FRONT'}
                                          onChange={() => setEditingHolesPreset('FRONT')}
                                        />
                                        <span>Front 9</span>
                                      </label>
                                      <label className="flex items-center space-x-1 cursor-pointer">
                                        <input
                                          type="radio"
                                          checked={editingHolesPreset === 'BACK'}
                                          onChange={() => setEditingHolesPreset('BACK')}
                                        />
                                        <span>Back 9</span>
                                      </label>
                                      <label className="flex items-center space-x-1 cursor-pointer">
                                        <input
                                          type="radio"
                                          checked={editingHolesPreset === 'FRONT_TWICE'}
                                          onChange={() => setEditingHolesPreset('FRONT_TWICE')}
                                        />
                                        <span>Front 9 Twice</span>
                                      </label>
                                      <label className="flex items-center space-x-1 cursor-pointer">
                                        <input
                                          type="radio"
                                          checked={editingHolesPreset === 'BACK_TWICE'}
                                          onChange={() => setEditingHolesPreset('BACK_TWICE')}
                                        />
                                        <span>Back 9 Twice</span>
                                      </label>
                                      <label className="flex items-center space-x-1 cursor-pointer">
                                        <input
                                          type="radio"
                                          checked={editingHolesPreset === 'RANGE'}
                                          onChange={() => setEditingHolesPreset('RANGE')}
                                        />
                                        <span>Hole Range</span>
                                      </label>
                                      <label className="flex items-center space-x-1 cursor-pointer">
                                        <input
                                          type="radio"
                                          checked={editingHolesPreset === 'CUSTOM'}
                                          onChange={() => {
                                            setEditingHolesPreset('CUSTOM')
                                            setEditingCustomHoles([1])
                                          }}
                                        />
                                        <span>Custom</span>
                                      </label>
                                    </div>

                                    {editingHolesPreset === 'RANGE' && (
                                      <div className="mt-2 space-y-1">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase">Hole Range Expression</label>
                                        <input
                                          type="text"
                                          value={editingHoleRange}
                                          onChange={e => setEditingHoleRange(e.target.value)}
                                          placeholder="e.g. 1-10,12,14 or 1-9,1-3"
                                          className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                                          required
                                        />
                                      </div>
                                    )}

                                    {editingHolesPreset === 'CUSTOM' && (
                                      <div className="grid grid-cols-6 gap-2 bg-white border border-slate-200 p-3 rounded mt-2">
                                        {Array.from({ length: 18 }, (_, i) => i + 1).map(num => {
                                          const isChecked = editingCustomHoles.includes(num)
                                          return (
                                            <label key={num} className="flex items-center space-x-1 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                  if (isChecked) {
                                                    setEditingCustomHoles(editingCustomHoles.filter(n => n !== num))
                                                  } else {
                                                    setEditingCustomHoles([...editingCustomHoles, num])
                                                  }
                                                }}
                                              />
                                              <span>Hole {num}</span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateRoundSubmit(round.id)}
                                      disabled={isUpdatingRound}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs"
                                    >
                                      {isUpdatingRound ? "Saving..." : "Save Holes & Tee"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingRoundId(null)}
                                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded text-xs"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Teams settings panel */}
                  {configureSubTab === 'teams' && (
                    <div className="space-y-6">
                      <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-650 pb-2 border-b border-slate-100">
                        Teams Setup
                      </h4>

                      {/* Add Team Form */}
                      <form onSubmit={handleCreateTeam} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3 items-end">
                        <div className="flex-1 text-xs">
                          <label className="block font-semibold text-slate-550 mb-0.5">TEAM NAME</label>
                          <input
                            type="text"
                            value={newTeamName}
                            onChange={e => setNewTeamName(e.target.value)}
                            placeholder="e.g. Europe, USA, Team Red"
                            required
                            className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isAddingTeam}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition-colors h-[34px]"
                        >
                          {isAddingTeam ? "Creating..." : "Add Team"}
                        </button>
                      </form>

                      {/* Team List */}
                      <div className="divide-y divide-slate-150">
                        {competition.teams.map((t: any, tIdx: number) => {
                          const membersCount = competition.participants.filter((p: any) => p.teamId === t.id).length
                          const selectedColor = localTeamColors[t.id] !== undefined ? localTeamColors[t.id] : (t.color || "")
                          const teamConfig = getTeamColorConfig(selectedColor, tIdx)
                          const defaultAssignedColorKey = TEAM_COLOR_LIST[tIdx % TEAM_COLOR_LIST.length]

                          return (
                            <div key={t.id} className="py-3 flex justify-between items-center gap-4">
                              <div className="flex items-center space-x-2">
                                <span className={`w-3.5 h-3.5 rounded-full ${teamConfig.badge} border border-slate-300 shadow-sm`} />
                                <div>
                                  <span className="font-extrabold text-slate-800">{t.name}</span>
                                  <span className="text-xs text-slate-400 font-mono ml-2">
                                    ({membersCount} members)
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center space-x-4">
                                {/* 9x1 color picker */}
                                <div className="flex flex-col space-y-1 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm w-fit">
                                  <div className="grid grid-cols-9 gap-1">
                                    {TEAM_COLOR_LIST.map((colorKey) => {
                                      const config = getTeamColorConfig(colorKey, 0)
                                      const isSelected = selectedColor === colorKey || (!selectedColor && colorKey === defaultAssignedColorKey)
                                      return (
                                        <button
                                          key={colorKey}
                                          type="button"
                                          onClick={() => handleUpdateTeamColor(t.id, colorKey)}
                                          className={`w-3 h-3 rounded-full ${config.badge} transition-all cursor-pointer ${
                                            isSelected 
                                              ? 'ring-2 ring-emerald-500 scale-125 border border-white shadow' 
                                              : 'opacity-40 hover:opacity-100 hover:scale-110'
                                          }`}
                                          title={config.name}
                                        />
                                      )
                                    })}
                                  </div>
                                </div>

                                <button
                                  onClick={() => triggerDeleteTeam(t.id)}
                                  className="p-1 bg-white hover:bg-red-50 border border-slate-200 rounded text-slate-400 hover:text-red-600 shadow-sm"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Participants setup with editable course handicaps */}
                  {configureSubTab === 'participants' && (
                    <div className="space-y-6">
                      <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-650 pb-2 border-b border-slate-100">
                        Participants Setup
                      </h4>

                      {/* Add Participant Form */}
                      <form onSubmit={handleCreateParticipant} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                        <h5 className="font-bold text-xs text-slate-650 uppercase">Add Participant</h5>
                        {partError && <div className="text-red-500 text-xs">{partError}</div>}

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block font-semibold text-slate-550 mb-0.5">PLAYER ACCOUNT TYPE</label>
                            <select
                              value={participantMode}
                              onChange={e => setParticipantMode(e.target.value as any)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                            >
                              <option value="registered">Registered System User</option>
                              <option value="dummy">Dummy / Guest Player</option>
                            </select>
                          </div>

                          {participantMode === 'registered' ? (
                            <div>
                              <label className="block font-semibold text-slate-550 mb-0.5">SELECT REGISTERED USER</label>
                              <select
                                value={partUserId}
                                onChange={e => setPartUserId(e.target.value)}
                                required
                                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                              >
                                <option value="">-- Choose User --</option>
                                {users.map(u => (
                                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div>
                              <label className="block font-semibold text-slate-550 mb-0.5">DUMMY PLAYER NAME</label>
                              <input
                                type="text"
                                value={partDummyName}
                                onChange={e => setPartDummyName(e.target.value)}
                                placeholder="Enter full name"
                                required
                                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                              />
                            </div>
                          )}

                          <div>
                            <label className="block font-semibold text-slate-550 mb-0.5">TOURNAMENT HANDICAP INDEX</label>
                            <input
                              type="number"
                              step="0.1"
                              value={partHandicap}
                              onChange={e => setPartHandicap(e.target.value)}
                              placeholder="e.g. 12.4"
                              required
                              className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-550 mb-0.5">ASSIGN TO TEAM (OPTIONAL)</label>
                            <select
                              value={partTeamId}
                              onChange={e => setPartTeamId(e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                            >
                              <option value="">-- None --</option>
                              {competition.teams.map((t: any) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isAddingParticipant}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition-colors"
                        >
                          Add Player
                        </button>
                      </form>

                      {/* Participant list table with editable handicaps */}
                      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm w-full">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-50 text-slate-550 uppercase tracking-wider font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3">Player</th>
                              <th className="px-4 py-3">Team</th>
                              <th className="px-4 py-3 text-center">HCP Index</th>
                              
                              {/* Rounds columns with recalc button */}
                              {competition.rounds.map((round: any) => (
                                <th key={round.id} className="px-4 py-3 text-center border-l border-slate-200 min-w-[120px]">
                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                    <span className="font-extrabold">{round.name}</span>
                                    <span className="text-[9px] text-slate-450 normal-case font-medium">{round.course.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => triggerRecalcRound(round.id, round.name)}
                                      className="mt-1 p-0.5 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-500 hover:text-emerald-600"
                                      title="Recalculate Playing Handicaps for all players in this round"
                                    >
                                      <RefreshCw size={10} />
                                    </button>
                                  </div>
                                </th>
                              ))}

                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 text-slate-700 bg-white">
                            {competition.participants.map((p: any) => {
                              const name = p.userId ? (p.user?.name || p.user?.email) : p.dummyName
                              
                              return (
                                <tr key={p.id} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 font-extrabold text-slate-800">
                                    {name}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 font-medium">
                                    {p.team?.name || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-center border-l border-slate-200">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <input
                                        type="text"
                                        value={compHandicapInputValues[p.id] !== undefined
                                          ? compHandicapInputValues[p.id]
                                          : (p.compHandicap !== null ? String(p.compHandicap) : "")}
                                        onChange={e => handleCompHandicapChange(p.id, e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') saveCompHandicap(p.id)
                                        }}
                                        className={`w-12 py-0.5 text-center text-xs font-black rounded border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                                          compHandicapInputValues[p.id] !== undefined && compHandicapInputValues[p.id] !== String(p.compHandicap)
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-black'
                                            : 'border-slate-350 bg-slate-50 text-slate-700 font-mono font-bold'
                                        }`}
                                      />
                                      {compHandicapInputValues[p.id] !== undefined && compHandicapInputValues[p.id] !== String(p.compHandicap) && (
                                        <button
                                          onClick={() => saveCompHandicap(p.id)}
                                          disabled={savingCompHandicap[p.id]}
                                          className="p-1 bg-white hover:bg-emerald-50 border border-slate-350 text-slate-500 hover:text-emerald-600 rounded shadow-sm"
                                        >
                                          {savingCompHandicap[p.id] ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                        </button>
                                      )}
                                    </div>
                                  </td>

                                  {/* Round Handicaps inputs */}
                                  {competition.rounds.map((round: any) => {
                                    const key = `${p.id}-${round.id}`
                                    const manualRecord = p.manualRoundHandicaps?.find((mr: any) => mr.roundId === round.id)
                                    const calculatedVal = getPlayingHandicap(p, round)
                                    
                                    // Use input state or fall back to current database value
                                    const currentValStr = manualHandicapInputValues[key] !== undefined
                                      ? manualHandicapInputValues[key]
                                      : (manualRecord ? String(manualRecord.handicapValue) : String(calculatedVal))

                                    const isModified = manualRecord !== undefined && manualRecord !== null
                                    const isSaving = savingManualHandicap[key]

                                    return (
                                      <td key={round.id} className="px-3 py-2 text-center border-l border-slate-200">
                                        <div className="flex items-center justify-center gap-1">
                                          <input
                                            type="text"
                                            value={currentValStr}
                                            onChange={e => handleManualHandicapChange(p.id, round.id, e.target.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') saveManualHandicap(p.id, round.id)
                                            }}
                                            className={`w-12 py-0.5 text-center text-xs font-black rounded border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                                              isModified
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-black'
                                                : 'border-slate-300 bg-slate-50 text-slate-700'
                                            }`}
                                            title={isModified ? "Manually overwritten round handicap" : "Automatically computed standard playing handicap"}
                                          />
                                          {currentValStr !== String(calculatedVal) && (
                                            <button
                                              onClick={() => saveManualHandicap(p.id, round.id)}
                                              disabled={isSaving}
                                              className="p-1 bg-white hover:bg-emerald-50 border border-slate-350 text-slate-500 hover:text-emerald-600 rounded"
                                            >
                                              {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    )
                                  })}

                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                      {/* Recalc player handicaps trigger */}
                                      <button
                                        onClick={() => triggerRecalcPlayer(p.id, name)}
                                        className="p-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-500 hover:text-emerald-600 shadow-sm"
                                        title="Recalculate playing handicaps (delete manual overrides) for this player only"
                                      >
                                        <RefreshCw size={12} />
                                      </button>
                                      <button
                                        onClick={() => triggerDeleteParticipant(p.id)}
                                        className="p-1 bg-white hover:bg-red-50 border border-slate-200 rounded text-slate-400 hover:text-red-655 shadow-sm"
                                        title="Delete player"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {configureSubTab === 'matches' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100 flex-wrap gap-4">
                        <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-650">
                          Pairings & Matches
                        </h4>
                        <div className="flex items-center space-x-2">
                          <label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Select Round:</label>
                          <select
                            value={selectedRoundId}
                            onChange={e => {
                              setSelectedRoundId(e.target.value)
                              setSelectedPartIds([])
                            }}
                            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          >
                            {competition.rounds.length === 0 && <option value="">-- No Rounds Exist --</option>}
                            {competition.rounds.map((r: any) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-4">
                          {!selectedRoundId ? (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                              Please create a round in the "Rounds" tab before managing pairings.
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="text-xs font-semibold text-slate-650 uppercase tracking-wider bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 flex justify-between">
                                <span>Round Course: {selectedRound?.course.name}</span>
                                <span>{selectedRound?.matches?.length || 0} Matches Configured</span>
                              </div>

                              {!selectedRound?.matches || selectedRound.matches.length === 0 ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 italic">
                                  No matches set up for this round. Assign participants into matches/groups on the right.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 gap-4">
                                  {selectedRound.matches.map((match: any, index: number) => (
                                    <div key={match.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 relative group">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <h4 className="font-extrabold text-slate-800 text-sm">Match #{index + 1}</h4>
                                          <span className="inline-block bg-slate-100 text-slate-655 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 mt-1 uppercase">
                                            Type: {match.type}
                                          </span>
                                        </div>
                                        <button
                                          onClick={() => handleDeleteMatch(match.id)}
                                          className="p-1.5 bg-white border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-655 rounded-lg transition-colors"
                                          title="Delete Match"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                                        {match.matchPlayers.map((mp: any) => {
                                          const part = competition.participants.find((p: any) => p.id === mp.participantId)
                                          const name = part?.userId ? part.user?.name : part?.dummyName
                                          const calculated = getPlayerCalculatedAllowance(mp, match, selectedRound, competition.participants)
                                          const isOverridden = mp.handicapAllowance !== null && mp.handicapAllowance !== undefined

                                          const inputVal = overrideMatchPlayerAllowances[mp.id] !== undefined
                                            ? overrideMatchPlayerAllowances[mp.id]
                                            : (mp.handicapAllowance !== null ? String(mp.handicapAllowance) : String(calculated))

                                          const isDirty = overrideMatchPlayerAllowances[mp.id] !== undefined && overrideMatchPlayerAllowances[mp.id] !== (mp.handicapAllowance !== null ? String(mp.handicapAllowance) : String(calculated))

                                          return (
                                            <div key={mp.id} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex justify-between items-center text-xs gap-3">
                                              <div>
                                                <span className="font-extrabold text-slate-700">{name || "Unknown Player"}</span>
                                                {part?.team && (
                                                  <span className="ml-1.5 text-[10px] text-cyan-600 font-bold">[{part.team.name}]</span>
                                                )}
                                                <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-slate-450 font-mono">
                                                  <span>HC: {part?.compHandicap !== null && part?.compHandicap !== undefined ? part.compHandicap.toFixed(1) : "-"}</span>
                                                  <span>(PH: {part ? getPlayingHandicap(part, selectedRound) : "-"})</span>
                                                </div>
                                              </div>

                                              {(match.type === "SINGLES" || match.type === "TEAM_MATCHPLAY") && (
                                                <div className="flex items-center space-x-1.5 flex-shrink-0">
                                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Vorgabe:</label>
                                                  <input
                                                    type="number"
                                                    value={inputVal}
                                                    onChange={e => setOverrideMatchPlayerAllowances(prev => ({ ...prev, [mp.id]: e.target.value }))}
                                                    className={`w-11 bg-white border rounded px-1.5 py-0.5 text-center text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none ${
                                                      isOverridden 
                                                        ? 'border-cyan-400 text-cyan-700 bg-cyan-50/50' 
                                                        : 'border-slate-300 text-slate-700'
                                                    }`}
                                                  />
                                                  {isDirty && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleSaveMatchPlayerAllowance(mp.id)}
                                                      disabled={savingMatchPlayerAllowance[mp.id]}
                                                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded transition-colors disabled:opacity-50"
                                                    >
                                                      {savingMatchPlayerAllowance[mp.id] ? "..." : "Save"}
                                                    </button>
                                                  )}
                                                  {isOverridden && (
                                                    <button
                                                      type="button"
                                                      onClick={async () => {
                                                        setSavingMatchPlayerAllowance(prev => ({ ...prev, [mp.id]: true }))
                                                        try {
                                                          await updateMatchPlayerAllowance(mp.id, competition.id, null)
                                                          setOverrideMatchPlayerAllowances(prev => {
                                                            const next = { ...prev }
                                                            delete next[mp.id]
                                                            return next
                                                          })
                                                          router.refresh()
                                                        } catch (err) {
                                                          console.error(err)
                                                          alert("Failed to reset allowance")
                                                        } finally {
                                                          setSavingMatchPlayerAllowance(prev => ({ ...prev, [mp.id]: false }))
                                                        }
                                                      }}
                                                      className="text-[9px] font-bold text-red-500 hover:text-red-700"
                                                      title="Reset to default calculated Vorgabe"
                                                    >
                                                      Reset
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>

                                      {(match.type === "SINGLES" || match.type === "TEAM_MATCHPLAY") && (
                                        <div className="flex flex-col space-y-2 pt-3 border-t border-slate-100 mt-2 text-xs">
                                          <div className="text-[10px] text-slate-450 font-semibold italic">
                                            Calculated using {match.allowanceType || "75%"} handicap allowance base difference.
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="checkbox"
                                              id={`playUntilEnd-${match.id}`}
                                              checked={match.playUntilEnd}
                                              onChange={() => handleTogglePlayUntilEnd(match.id, match.playUntilEnd)}
                                              className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 bg-white cursor-pointer"
                                            />
                                            <label htmlFor={`playUntilEnd-${match.id}`} className="text-slate-655 font-semibold select-none cursor-pointer">
                                              Bis zum Ende spielen (kein vorzeitiges Ende)
                                            </label>
                                          </div>
                                          <div className="flex items-center space-x-2 pt-1">
                                            <label className="text-slate-500 font-semibold">Holes (Löcher):</label>
                                            <input
                                              type="text"
                                              value={overrideHoleRanges[match.id] !== undefined ? overrideHoleRanges[match.id] : (match.holeRange ?? "1-18")}
                                              onChange={e => setOverrideHoleRanges(prev => ({ ...prev, [match.id]: e.target.value }))}
                                              placeholder="1-18"
                                              className="w-20 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-center text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleSaveHoleRange(match.id)}
                                              disabled={savingHoleRange[match.id]}
                                              className="px-2.5 py-1 bg-emerald-655 hover:bg-emerald-500 text-slate-800 hover:text-emerald-950 font-bold text-[10px] rounded transition-colors disabled:opacity-50"
                                            >
                                              {savingHoleRange[match.id] ? "Saving..." : "Save"}
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <form onSubmit={handleAddMatch} className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                            <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider mb-2">Create Match / Group</h3>

                            {pairingError && (
                              <div className="bg-red-50 border border-red-200 text-red-505 px-3 py-2 rounded-lg text-xs">
                                {pairingError}
                              </div>
                            )}
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Match Format</label>
                              <select
                                value={matchType}
                                onChange={e => setMatchType(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                required
                              >
                                <option value="SINGLES">SINGLES (Matchplay or Group)</option>
                                <option value="TEAM_MATCHPLAY">TEAM MATCHPLAY (2 vs 2 Best Ball Matchplay)</option>
                                <option value="4BALL">FOURBALL (2 vs 2 Best Ball)</option>
                                <option value="CHAPMAN">CHAPMAN (Chapman-System)</option>
                                <option value="GROUP">STANDARD GROUP (Strokeplay / Stableford)</option>
                              </select>
                            </div>

                            {(matchType === "SINGLES" || matchType === "TEAM_MATCHPLAY") && (
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-xs font-semibold text-slate-500 mb-1">Handicap Allowance Calculation</label>
                                  <select
                                    value={allowanceType}
                                    onChange={e => setAllowanceType(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-emerald-500"
                                  >
                                    <option value="75%">75% Difference of Playing HCP (Default)</option>
                                    <option value="50%">50% Difference of Playing HCP</option>
                                    <option value="100%">100% Difference of Playing HCP</option>
                                    <option value="0%">Scratch / 0% Allowance</option>
                                  </select>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id="newPlayUntilEnd"
                                    checked={playUntilEnd}
                                    onChange={e => setPlayUntilEnd(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 bg-white cursor-pointer"
                                  />
                                  <label htmlFor="newPlayUntilEnd" className="text-xs text-slate-500 font-semibold select-none cursor-pointer">
                                    Bis zum Ende spielen (kein vorzeitiges Ende)
                                  </label>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-500 mb-1">Hole Range (e.g. 1-18, 1-9, 10-18)</label>
                                  <input
                                    type="text"
                                    value={holeRange}
                                    onChange={e => setHoleRange(e.target.value)}
                                    placeholder="1-18"
                                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-700"
                                  />
                                </div>
                              </div>
                            )}

                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-2">
                                Assign Players ({selectedPartIds.length} Selected)
                              </label>
                              
                              {competition.participants.length === 0 ? (
                                <p className="text-xs text-slate-450 italic">No registered participants to pair.</p>
                              ) : (
                                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-white space-y-2 divide-y divide-slate-100 scrollbar-thin">
                                  {competition.participants.map((p: any) => {
                                    const name = p.userId ? p.user?.name : p.dummyName
                                    const isChecked = selectedPartIds.includes(p.id)

                                    return (
                                      <div 
                                        key={p.id} 
                                        onClick={() => togglePartSelection(p.id)}
                                        className={`flex items-center space-x-2 py-1.5 px-2 rounded cursor-pointer select-none text-xs transition-colors ${
                                          isChecked 
                                            ? 'bg-emerald-50 text-emerald-700 font-semibold' 
                                            : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          readOnly
                                          className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-350 bg-white focus:ring-offset-white"
                                        />
                                        <div className="flex-1 truncate">
                                          <span>{name}</span>
                                          {p.team && (
                                            <span className="ml-1 text-[9px] text-cyan-600 font-bold">[{p.team.name}]</span>
                                          )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          HC: {p.compHandicap !== null && p.compHandicap !== undefined ? p.compHandicap.toFixed(1) : "-"}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>

                            <button
                              type="submit"
                              disabled={isCreatingPairing || !selectedRoundId || competition.participants.length === 0}
                              className="w-full flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-sm transition-colors disabled:opacity-50 shadow-sm"
                            >
                              <Plus size={16} />
                              <span>{isCreatingPairing ? "Pairing..." : "Create Pairing"}</span>
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Sub-tab 2: Result Audit Log */}
            {adminSubTab === 'audit' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-650">Result Audit Trace Log</h4>
                  <span className="text-xs text-slate-500 font-mono font-bold">{competition.auditLogs?.length || 0} entries</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm w-full">
                  <table className="w-full text-xs text-left border-collapse table-auto">
                    <thead className="bg-slate-50 text-slate-650 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 w-36">Time</th>
                        <th className="px-4 py-3 w-40">User (Who)</th>
                        <th className="px-4 py-3 w-28">Action</th>
                        <th className="px-4 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 bg-white font-mono text-[11px]">
                      {competition.auditLogs?.map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 text-slate-500 font-medium">
                            {new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-slate-800">
                            {log.userName || log.userId || "System"}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] ${
                              log.action === 'SCORE_CLEAR' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-pre-line text-slate-600 font-medium">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                      {(!competition.auditLogs || competition.auditLogs.length === 0) && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic font-sans text-xs">
                            No logs registered yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-tab 3: Danger Zone Resets */}
            {adminSubTab === 'danger' && (
              <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 text-red-750">
                  <ShieldAlert className="flex-shrink-0 text-red-500 mt-0.5" size={20} />
                  <div>
                    <h5 className="font-extrabold text-sm text-red-950 uppercase">Danger Area resets</h5>
                    <p className="text-xs mt-1 text-red-800 leading-relaxed font-semibold">
                      Perform bulk score deletions here. These modifications will wipe registered scores permanently and record a score clear action in the audit trail.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 max-w-xl divide-y divide-slate-100">
                  
                  {/* Reset all scores */}
                  <div className="py-4 space-y-2">
                    <h5 className="font-bold text-xs text-slate-700 uppercase">1. Reset ALL Competition Scores</h5>
                    <p className="text-[11px] text-slate-500 font-semibold">Deletes every score recorded for all rounds and players in this competition.</p>
                    <button
                      onClick={handleResetAll}
                      disabled={isResetting}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs transition-colors shadow-sm"
                    >
                      {isResetting ? "Processing..." : "Reset All Competition Scores"}
                    </button>
                  </div>

                  {/* Reset Scores for Round X */}
                  <div className="py-4 space-y-3">
                    <h5 className="font-bold text-xs text-slate-700 uppercase">2. Reset Scores for Specific Round</h5>
                    <div className="flex gap-3 items-end max-w-sm">
                      <div className="flex-1 text-xs">
                        <select
                          value={dangerResetRoundId}
                          onChange={e => setDangerResetRoundId(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                        >
                          <option value="">-- Choose Round --</option>
                          {competition.rounds.map((r: any) => (
                            <option key={r.id} value={r.id}>{r.name} ({r.course.name})</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={handleResetRound}
                        disabled={isResetting || !dangerResetRoundId}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded text-xs transition-colors h-[34px]"
                      >
                        Reset Round
                      </button>
                    </div>
                  </div>

                  {/* Reset Scores for Player Y */}
                  <div className="py-4 space-y-3">
                    <h5 className="font-bold text-xs text-slate-700 uppercase">3. Reset Scores for Specific Player</h5>
                    <div className="flex gap-3 items-end max-w-sm">
                      <div className="flex-1 text-xs">
                        <select
                          value={dangerResetPlayerId}
                          onChange={e => setDangerResetPlayerId(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                        >
                          <option value="">-- Choose Player --</option>
                          {competition.participants.map((p: any) => {
                            const name = p.userId ? (p.user?.name || p.user?.email) : p.dummyName
                            return (
                              <option key={p.id} value={p.id}>{name}</option>
                            )
                          })}
                        </select>
                      </div>
                      <button
                        onClick={handleResetPlayer}
                        disabled={isResetting || !dangerResetPlayerId}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded text-xs transition-colors h-[34px]"
                      >
                        Reset Player
                      </button>
                    </div>
                  </div>

                  {/* Reset Scores for Player Y in Round X */}
                  <div className="py-4 space-y-3">
                    <h5 className="font-bold text-xs text-slate-700 uppercase">4. Reset Player's Scores on Specific Round</h5>
                    <div className="flex gap-3 items-end">
                      <div className="text-xs w-48">
                        <label className="block text-[10px] text-slate-500 font-bold mb-0.5 uppercase">Round</label>
                        <select
                          value={dangerResetRoundId}
                          onChange={e => setDangerResetRoundId(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                        >
                          <option value="">-- Choose Round --</option>
                          {competition.rounds.map((r: any) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="text-xs w-48">
                        <label className="block text-[10px] text-slate-500 font-bold mb-0.5 uppercase">Player</label>
                        <select
                          value={dangerResetPlayerId}
                          onChange={e => setDangerResetPlayerId(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-sm"
                        >
                          <option value="">-- Choose Player --</option>
                          {competition.participants.map((p: any) => {
                            const name = p.userId ? (p.user?.name || p.user?.email) : p.dummyName
                            return (
                              <option key={p.id} value={p.id}>{name}</option>
                            )
                          })}
                        </select>
                      </div>
                      <button
                        onClick={handleResetPlayerRound}
                        disabled={isResetting || !dangerResetRoundId || !dangerResetPlayerId}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded text-xs transition-colors h-[34px]"
                      >
                        Reset Scores
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Matchplay scorecard popup modal */}
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
        />
      )}

      {/* Landscape scorecard popup modal */}
      {selectedParticipantForScorecard && (
        <PlayerScorecardModal
          selectedParticipantForScorecard={selectedParticipantForScorecard}
          selectedRoundIdForScorecard={selectedRoundIdForScorecard}
          competition={competition}
          selectedLeaderboardType={selectedLeaderboardType}
          onClose={() => {
            setSelectedParticipantForScorecard(null)
            setSelectedRoundIdForScorecard(null)
          }}
        />
      )}

      {/* Team scorecard popup modal */}
      {selectedTeamForScorecard && (
        <TeamScorecardModal
          selectedTeamForScorecard={selectedTeamForScorecard}
          competition={competition}
          onClose={() => setSelectedTeamForScorecard(null)}
        />
      )}
    </div>
  )
}
