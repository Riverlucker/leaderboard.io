"use client"

import { useState, useEffect } from "react"
import { signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { 
  Trophy, BookOpen, Key, LogOut, CheckCircle, 
  Settings, ChevronRight, Users, Play, Edit, 
  HelpCircle, Eye, RefreshCw, X, Loader2, Save, Trash2, ShieldAlert
} from "lucide-react"

import { 
  calculateCourseHandicap, 
  getHandicapStrokesOnHole, 
  calculateStablefordPoints, 
  assignLeaderboardRanks,
  getRoundHoleInfo
} from "@/lib/scoring"

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
  addParticipant, 
  deleteParticipant,
  updateParticipant
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

  // compute totalCompHoles
  let totalCompHoles = 0
  for (const round of (competition.rounds || [])) {
    totalCompHoles += round.holesPlayed && round.holesPlayed.length > 0 ? round.holesPlayed.length : 18
  }


  
  // Leaderboard filters
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>("TOTAL")
  const [selectedLeaderboardType, setSelectedLeaderboardType] = useState<string>("MAIN")
  
  // Scorecard modal state
  const [selectedParticipantForScorecard, setSelectedParticipantForScorecard] = useState<any | null>(null)
  const [selectedRoundIdForScorecard, setSelectedRoundIdForScorecard] = useState<string | null>(null)
  const [selectedMatchForScorecard, setSelectedMatchForScorecard] = useState<any | null>(null)
  const [selectedMatchRoundForScorecard, setSelectedMatchRoundForScorecard] = useState<any | null>(null)
  
  // Score Entry state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  
  // Score Entry setup state (persisted in localStorage)
  const [selectedRoundId, setSelectedRoundId] = useState("")
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [entryMode, setEntryMode] = useState<'LIVE' | 'BULK'>('LIVE')
  const [setupConfirmed, setSetupConfirmed] = useState(false)
  const [liveHoleIndex, setLiveHoleIndex] = useState(0)
  const [focusInputId, setFocusInputId] = useState("")

  // Admin section sub-tab
  const [adminSubTab, setAdminSubTab] = useState<'configure' | 'audit' | 'danger'>('configure')
  const [configureSubTab, setConfigureSubTab] = useState<'general' | 'rounds' | 'teams' | 'participants'>('general')

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
  const [newRoundHolesPreset, setNewRoundHolesPreset] = useState<'ALL' | 'FRONT' | 'BACK' | 'CUSTOM'>('ALL')
  const [newRoundCustomHoles, setNewRoundCustomHoles] = useState<number[]>(Array.from({ length: 18 }, (_, i) => i + 1))
  const [isAddingRound, setIsAddingRound] = useState(false)
  const [roundError, setRoundError] = useState("")

  // Edit Round inline state
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null)
  const [editingHolesPreset, setEditingHolesPreset] = useState<'ALL' | 'FRONT' | 'BACK' | 'CUSTOM'>('ALL')
  const [editingCustomHoles, setEditingCustomHoles] = useState<number[]>([])
  const [editingRoundTeeId, setEditingRoundTeeId] = useState("")
  const [isUpdatingRound, setIsUpdatingRound] = useState(false)
  const [editingRoundError, setEditingRoundError] = useState("")

  // Admin teams state
  const [newTeamName, setNewTeamName] = useState("")
  const [isAddingTeam, setIsAddingTeam] = useState(false)
  const [teamError, setTeamError] = useState("")

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

  const handleToggleEntryMode = (newMode: 'LIVE' | 'BULK') => {
    const rounds = competition.rounds || []
    const scoringRound = rounds.find((r: any) => r.id === selectedRoundId) || rounds[0]
    const scoringPlayers = competition.participants.filter((p: any) => selectedPlayerIds.includes(p.id))

    const activeHoles = scoringRound?.holesPlayed && scoringRound.holesPlayed.length > 0
      ? [...scoringRound.holesPlayed].sort((a: number, b: number) => a - b)
      : Array.from({ length: 18 }, (_, i) => i + 1)

    if (newMode === 'LIVE') {
      const firstIncompleteIdx = findFirstIncompleteHoleIndex(scoringRound, scoringPlayers)
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
      }

      if (savedMode === 'LIVE' || savedMode === 'BULK') setEntryMode(savedMode)
      if (savedConfirmed === 'true' && initialRoundId) {
        const r = competition.rounds.find((round: any) => round.id === initialRoundId) || competition.rounds[0]
        const pl = competition.participants.filter((p: any) => activePlayerIds.includes(p.id))
        
        let holeIndex = 0
        if (savedHoleIdx !== null) {
          holeIndex = parseInt(savedHoleIdx)
        } else {
          holeIndex = findFirstIncompleteHoleIndex(r, pl)
        }
        setLiveHoleIndex(holeIndex)
        setSetupConfirmed(true)
      } else {
        setSetupConfirmed(false)
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

  // Pre-select first round if none selected
  useEffect(() => {
    if (!selectedRoundId && competition.rounds.length > 0) {
      setSelectedRoundId(competition.rounds[0].id)
    }
  }, [competition.rounds, selectedRoundId])

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

  // Helper: Retrieve active playing handicap for a player in a round (checks manual override first)
  const getPlayingHandicap = (p: any, round: any) => {
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

  const getMatchAllowance = (match: any, hcpA: number, hcpB: number) => {
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

  const getMatchHandicapStrokesOnHole = (allowance: number, strokeIndex: number) => {
    const base = Math.floor(allowance / 18)
    const remainder = allowance % 18
    return base + (strokeIndex <= remainder ? 1 : 0)
  }

  const parseHoleRange = (rangeStr: string | null | undefined, roundHoles: number[]): number[] => {
    if (!rangeStr) return roundHoles.length > 0 ? roundHoles : Array.from({ length: 18 }, (_, i) => i + 1)
    const parts = rangeStr.split('-')
    if (parts.length === 2) {
      const start = parseInt(parts[0])
      const end = parseInt(parts[1])
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        return Array.from({ length: end - start + 1 }, (_, i) => start + i)
      }
    }
    return roundHoles.length > 0 ? roundHoles : Array.from({ length: 18 }, (_, i) => i + 1)
  }

  const getMatchHoleStrokesMap = (matchHoles: number[], round: any, allowance: number) => {
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

  const getCompactName = (fullName: string, allNames: string[]) => {
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

  const computeMatchplayStatus = (match: any, round: any) => {
    const p1 = competition.participants.find((p: any) => p.id === match.matchPlayers[0]?.participantId)
    const p2 = competition.participants.find((p: any) => p.id === match.matchPlayers[1]?.participantId)
    if (!p1 || !p2) return { statusText: "Unknown Players", holesPlayed: 0, totalHoles: 18, allowance: 0, player1Name: "Unknown", player2Name: "Unknown", player1Allowance: 0, player2Allowance: 0, isFinished: false }

    const hcp1 = getPlayingHandicap(p1, round)
    const hcp2 = getPlayingHandicap(p2, round)

    const allowance = getMatchAllowance(match, hcp1, hcp2)
    const p1Allowance = hcp1 > hcp2 ? allowance : 0
    const p2Allowance = hcp2 > hcp1 ? allowance : 0

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

        const remaining = matchHoles.length - holesPlayedCount
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
      totalHoles: matchHoles.length,
      allowance,
      player1Name: name1,
      player2Name: name2,
      player1Allowance: p1Allowance,
      player2Allowance: p2Allowance,
      isFinished: decidedInfo !== null || holesPlayedCount === matchHoles.length
    }
  }

  // Helper: Find the first hole index where any player's score is missing
  const findFirstIncompleteHoleIndex = (scoringRound: any, scoringPlayers: any[]) => {
    if (!scoringRound || !scoringPlayers || scoringPlayers.length === 0) return 0
    const activeHoles = scoringRound.holesPlayed && scoringRound.holesPlayed.length > 0
      ? [...scoringRound.holesPlayed].sort((a: number, b: number) => a - b)
      : Array.from({ length: 18 }, (_, i) => i + 1)

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
          const roundHoles = round.holesPlayed && round.holesPlayed.length > 0 
            ? round.holesPlayed 
            : Array.from({ length: 18 }, (_, i) => i + 1)

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
          const roundHoles = round.holesPlayed && round.holesPlayed.length > 0 
            ? round.holesPlayed 
            : Array.from({ length: 18 }, (_, i) => i + 1)

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
          const roundHoles = round.holesPlayed && round.holesPlayed.length > 0 
            ? round.holesPlayed 
            : Array.from({ length: 18 }, (_, i) => i + 1)

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
          const roundHoles = round.holesPlayed && round.holesPlayed.length > 0 
            ? round.holesPlayed 
            : Array.from({ length: 18 }, (_, i) => i + 1)

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
          const roundHoles = round.holesPlayed && round.holesPlayed.length > 0 
            ? round.holesPlayed 
            : Array.from({ length: 18 }, (_, i) => i + 1)

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
          const roundHoles = round.holesPlayed && round.holesPlayed.length > 0 
            ? round.holesPlayed 
            : Array.from({ length: 18 }, (_, i) => i + 1)

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
          const roundHoles = ar.holesPlayed && ar.holesPlayed.length > 0 ? ar.holesPlayed : Array.from({ length: 18 }, (_, i) => i + 1)
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

      // First calculate individual stats for mapping
      const playerStats = competition.participants.map((p: any) => {
        let points = 0
        let strokes = 0
        
        for (const round of activeRounds) {
          const courseHandicap = getPlayingHandicap(p, round)
          const roundHoles = round.holesPlayed && round.holesPlayed.length > 0 
            ? round.holesPlayed 
            : Array.from({ length: 18 }, (_, i) => i + 1)

          for (const holeNum of roundHoles) {
            const hole = round.course.holes.find((h: any) => h.number === holeNum)
            if (!hole) continue

            const adjusted = getRoundHoleInfo(round, holeNum)
            const holePar = adjusted ? adjusted.par : hole.par
            const holeStrokeIndex = adjusted ? adjusted.strokeIndex : hole.strokeIndex

            const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
            if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
              if (score.status === 'WIPED') {
                strokes += isStroke ? (holePar + 3) : 0 // wiped hole is triple bogey in strokeplay gross
              } else if (score.grossStrokes !== null) {
                strokes += score.grossStrokes
                const hcpStrokes = getHandicapStrokesOnHole(courseHandicap, holeStrokeIndex)
                const pts = calculateStablefordPoints(score.grossStrokes, holePar, hcpStrokes, isNet)
                if (pts !== null) points += pts
              }
            }
          }
        }
        return { id: p.id, teamId: p.teamId, points, strokes }
      })

      // Aggregate by Team
      const teamEntries = competition.teams.map((t: any) => {
        const members = playerStats.filter((ps: any) => ps.teamId === t.id)
        const teamPoints = members.reduce((sum: number, m: any) => sum + m.points, 0)
        const teamStrokes = members.reduce((sum: number, m: any) => sum + m.strokes, 0)
        const memberNames = competition.participants
          .filter((p: any) => p.teamId === t.id)
          .map((p: any) => p.userId ? (p.user?.name || p.user?.email) : p.dummyName)
          .join(", ")

        return {
          teamId: t.id,
          team: t,
          name: t.name,
          memberNames,
          totalPoints: isStroke ? teamStrokes : teamPoints, // for sorting generic
          totalStrokes: teamStrokes,
          holesPlayed: activeRounds.length
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
      if (newRoundHolesPreset === 'ALL') {
        holes = Array.from({ length: 18 }, (_, i) => i + 1)
      } else if (newRoundHolesPreset === 'FRONT') {
        holes = Array.from({ length: 9 }, (_, i) => i + 1)
      } else if (newRoundHolesPreset === 'BACK') {
        holes = Array.from({ length: 9 }, (_, i) => i + 10)
      } else {
        holes = [...newRoundCustomHoles].sort((a, b) => a - b)
      }

      if (holes.length === 0) throw new Error("Please select at least one hole.")

      await addRound(competition.id, {
        name: newRoundName,
        courseId: newRoundCourseId,
        startDate: newRoundStart || null,
        endDate: newRoundEnd || null,
        holesPlayed: holes,
        teeId: newRoundTeeId || null
      })

      setNewRoundName("")
      setNewRoundStart("")
      setNewRoundEnd("")
      setNewRoundHolesPreset('ALL')
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

    if (holes.length === 18) {
      setEditingHolesPreset('ALL')
    } else if (holes.length === 9 && holes[0] === 1) {
      setEditingHolesPreset('FRONT')
    } else if (holes.length === 9 && holes[0] === 10) {
      setEditingHolesPreset('BACK')
    } else {
      setEditingHolesPreset('CUSTOM')
    }
  }

  const handleUpdateRoundSubmit = async (roundId: string) => {
    setIsUpdatingRound(true)
    setEditingRoundError("")
    try {
      let holes: number[] = []
      if (editingHolesPreset === 'ALL') {
        holes = Array.from({ length: 18 }, (_, i) => i + 1)
      } else if (editingHolesPreset === 'FRONT') {
        holes = Array.from({ length: 9 }, (_, i) => i + 1)
      } else if (editingHolesPreset === 'BACK') {
        holes = Array.from({ length: 9 }, (_, i) => i + 10)
      } else {
        holes = [...editingCustomHoles].sort((a, b) => a - b)
      }

      await updateRoundHoles(roundId, competition.id, holes, editingRoundTeeId)
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
      <header className="border-b border-slate-250 bg-white/70 backdrop-blur-md sticky top-0 z-40 px-4 py-2 md:py-4 shadow-sm flex justify-between items-center h-12 md:h-16 landscape:h-10">
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
          {session ? (
            <div className="flex items-center space-x-1.5 md:space-x-2">
              <span className="text-xs text-slate-655 font-medium hidden md:inline landscape:hidden">Logged in as {session.user.name || session.user.email}</span>
              <button 
                onClick={() => signOut({ callbackUrl: `/?comp=${competition.uniqueSlug}` })}
                className="p-1 md:p-1.5 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-655 rounded-lg border border-slate-200 transition-colors shadow-sm"
                title="Log Out"
              >
                <LogOut size={16} className="landscape:w-3.5 landscape:h-3.5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setActiveTab('scores')}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-255 text-xs font-semibold rounded-lg transition-all shadow-sm landscape:py-0.5 landscape:px-2"
            >
              <Key size={14} className="landscape:w-3 landscape:h-3" />
              <span>Login to Score</span>
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white/60 backdrop-blur-md border-b border-slate-200 sticky top-12 md:top-16 landscape:top-10 z-30 flex justify-center shadow-sm h-10 md:h-14 landscape:h-8.5">
        <div className="flex w-full max-w-7xl px-4 h-full">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-2 md:py-4 text-center text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center space-x-1.5 md:space-x-2 landscape:py-1 ${
              activeTab === 'leaderboard'
                ? 'text-emerald-600 bg-white/40 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
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
                ? 'text-emerald-600 bg-white/40 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
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
                ? 'text-emerald-600 bg-white/40 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
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
                  ? 'text-emerald-600 bg-white/40 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
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
            <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center bg-white/60 backdrop-blur-sm border border-slate-200 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold text-slate-500 uppercase">View Round</span>
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
                <span className="text-xs font-bold text-slate-500 uppercase">Leaderboard</span>
                <select
                  value={selectedLeaderboardType}
                  onChange={e => setSelectedLeaderboardType(e.target.value)}
                  className="bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-1.5 text-sm font-black text-emerald-850 focus:ring-emerald-500 focus:outline-none cursor-pointer shadow-sm transition-all"
                >
                  <option value="MAIN">Main Standings ({competition.type === 'NETTO_STABLEFORD' ? 'Stableford Netto' : competition.type})</option>
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
                  {competition.rounds.some((r: any) => r.matches?.some((m: any) => m.type === "SINGLES")) && (
                    <option value="MATCHPLAY">Matchplays</option>
                  )}
                </select>
              </div>
            </div>

            {/* Standings Table (Matchplay) */}
            {selectedLeaderboardType === 'MATCHPLAY' ? (
              <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-100/50 text-slate-550 uppercase tracking-wider text-xs border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-4">Round</th>
                      <th className="px-5 py-4">Match</th>
                      <th className="px-5 py-4 text-center">Holes</th>
                      <th className="px-5 py-4 text-right">Standing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white/30 text-slate-700">
                    {(() => {
                      const matchplayList: any[] = []
                      const roundsToUse = selectedRoundFilter === 'TOTAL'
                        ? competition.rounds
                        : competition.rounds.filter((r: any) => r.id === selectedRoundFilter)

                      for (const r of roundsToUse) {
                        const singlesMatches = (r.matches || []).filter((m: any) => m.type === 'SINGLES')
                        for (const m of singlesMatches) {
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

                      const getMatchCategory = (mInfo: any) => {
                        if (mInfo.status.isFinished) return 3 // Finished
                        if (mInfo.status.holesPlayed > 0) return 1 // Live (In progress)
                        return 2 // Not started
                      }

                      evaluated.sort((a, b) => {
                        const catA = getMatchCategory(a)
                        const catB = getMatchCategory(b)
                        if (catA !== catB) return catA - catB

                        // Finished matches: newest round first
                        if (catA === 3) {
                          const dateA = new Date(a.round.startDate).getTime()
                          const dateB = new Date(b.round.startDate).getTime()
                          return dateB - dateA
                        }

                        // Live / Not started: oldest round first
                        const dateA = new Date(a.round.startDate).getTime()
                        const dateB = new Date(b.round.startDate).getTime()
                        return dateA - dateB
                      })

                      return evaluated.map(({ round, match, status }) => {
                        const { statusText, holesPlayed, totalHoles, player1Name, player2Name, player1Allowance, player2Allowance } = status
                        return (
                          <tr key={match.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => {
                            setSelectedMatchForScorecard(match)
                            setSelectedMatchRoundForScorecard(round)
                          }}>
                            <td className="px-5 py-4 font-bold text-slate-900">{round.name}</td>
                            <td className="px-5 py-4">
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
                            </td>
                            <td className="px-5 py-4 text-center font-mono text-slate-600">
                              {holesPlayed}/{totalHoles}
                            </td>
                            <td className={`px-5 py-4 text-right font-black text-sm md:text-base ${statusText === "Not Started" ? "text-slate-400 font-bold" : "text-emerald-600"}`}>
                              {statusText}
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            ) : !selectedLeaderboardType.startsWith('TEAM_') ? (
              <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
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
                      <th className="px-2 py-2.5 md:px-5 md:py-4 text-right w-12 md:w-16">Cards</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white/30 text-slate-700">
                    {leaderboardList.map((entry) => {
                      const totalHolesForFilter = selectedRoundFilter === 'TOTAL'
                        ? totalCompHoles
                        : (competition.rounds.find((r: any) => r.id === selectedRoundFilter)?.holesPlayed?.length || 18)

                      return (
                        <tr key={entry.participantId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-2 py-2.5 md:px-5 md:py-4 text-center font-extrabold font-mono text-slate-700">
                            {entry.rank}
                          </td>
                          <td className="px-3 py-2.5 md:px-5 md:py-4">
                            <div className="font-extrabold text-slate-900 text-sm md:text-base leading-tight">{entry.name}</div>
                            <div className="text-[10px] md:text-xs text-slate-500 font-mono mt-0.5">
                              HCP Index: {entry.participant.compHandicap !== null ? entry.participant.compHandicap.toFixed(1) : "-"}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 md:px-5 md:py-4 text-center text-emerald-600 font-black text-base md:text-xl">
                            {competition.showRelToPar && (selectedLeaderboardType === 'MAIN' || selectedLeaderboardType === 'STABLEFORD_NETTO' || selectedLeaderboardType === 'STABLEFORD_BRUTTO')
                              ? (entry.relToPar === 0 ? "Even" : (entry.relToPar < 0 ? String(entry.relToPar) : `+${entry.relToPar}`))
                              : (selectedLeaderboardType === 'BIRDIE' ? `${entry.totalPoints} (${entry.pars})` : entry.totalPoints)
                            }
                          </td>
                          <td className="px-2 py-2.5 md:px-4 md:py-4 text-center text-slate-600 font-semibold font-mono">
                            {entry.holesPlayed}/{totalHolesForFilter}
                          </td>
                          
                          {/* Round points columns */}
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
                                    setSelectedParticipantForScorecard(entry.participant)
                                    setSelectedRoundIdForScorecard(round.id)
                                  }}
                                  className="px-2 py-0.5 md:px-2.5 md:py-1 text-xs font-extrabold bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-250 text-slate-700 hover:text-emerald-600 rounded-md transition-all font-mono shadow-sm"
                                  title={`View Round ${round.name} Scorecard`}
                                >
                                  {displayVal}
                                </button>
                              </td>
                            )
                          })}

                          <td className="px-2 py-2.5 md:px-5 md:py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedParticipantForScorecard(entry.participant)
                                setSelectedRoundIdForScorecard(null)
                              }}
                              className="p-1 md:p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-emerald-600 rounded-lg transition-colors shadow-sm"
                              title="View Full Scorecard"
                            >
                              <Eye size={16} className="landscape:w-3.5 landscape:h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Standings Table (Teams) */
              <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-100/50 text-slate-550 uppercase tracking-wider text-xs border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-4 text-center w-14">Rank</th>
                      <th className="px-5 py-4">Team</th>
                      <th className="px-5 py-4">Members</th>
                      <th className="px-5 py-4 text-center w-28">
                        {selectedLeaderboardType === 'TEAM_STROKEPLAY' ? 'Gross Strokes' : 'Stableford Points'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white/30 text-slate-750">
                    {leaderboardList.map((entry) => (
                      <tr key={entry.teamId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4.5 text-center font-extrabold font-mono text-slate-700">
                          {entry.rank}
                        </td>
                        <td className="px-5 py-4.5 font-bold text-slate-900 text-base">
                          {entry.name}
                        </td>
                        <td className="px-5 py-4.5 text-sm text-slate-500 italic max-w-sm truncate">
                          {entry.memberNames}
                        </td>
                        <td className="px-5 py-4.5 text-center text-emerald-600 font-black text-xl">
                          {entry.totalPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Details */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Settings */}
              <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-xl font-bold border-b border-slate-150 pb-3" style={{ color: primaryColor }}>
                  Competition Settings
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 block font-medium">Format Modus</span>
                    <span className="text-slate-800 font-bold uppercase">{competition.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Type</span>
                    <span className="text-slate-800 font-bold">
                      {competition.isTeamComp ? "Team Competition" : "Individual Competition"}
                    </span>
                  </div>
                  {competition.startDate && (
                    <div>
                      <span className="text-slate-500 block font-medium">Start Date</span>
                      <span className="text-slate-800 font-bold">
                        {new Date(competition.startDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {competition.endDate && (
                    <div>
                      <span className="text-slate-500 block font-medium">End Date</span>
                      <span className="text-slate-800 font-bold">
                        {new Date(competition.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rounds List */}
              <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-xl font-bold border-b border-slate-150 pb-3">Rounds Schedule</h3>
                <div className="space-y-4">
                  {competition.rounds.map((round: any) => {
                    const holeCount = round.holesPlayed && round.holesPlayed.length > 0 ? round.holesPlayed.length : 18
                    const teeLabel = round.tee ? ` (${round.tee.name})` : ""

                    return (
                      <div key={round.id} className="bg-white/40 backdrop-blur-sm border border-slate-200/60 p-4 rounded-xl flex justify-between items-center">
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-slate-800">{round.name}</h4>
                          <p className="text-xs text-emerald-650 font-bold">
                            {round.course.name}{teeLabel}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Holes played: {holeCount} holes
                          </p>
                        </div>
                        {round.startDate && (
                          <div className="text-right text-xs text-slate-600 font-mono font-bold">
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
            <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 h-fit">
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
                      <div className="font-semibold text-sm text-slate-850 truncate max-w-[150px]">{name}</div>
                      <div className="text-xs font-mono font-bold text-cyan-600">
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
                  <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
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
                        const idx = findFirstIncompleteHoleIndex(r, pl)
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
                    <div className="flex justify-between items-center bg-white/60 backdrop-blur-sm border border-slate-200 p-4 rounded-xl shadow-sm text-slate-800 w-full">
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
                      />
                    ) : (
                      <BulkScorecardEntry
                        round={selectedScoringRound}
                        selectedParticipants={selectedScoringPlayers}
                        session={session}
                        onScoreSaved={() => router.refresh()}
                        initialFocusId={focusInputId}
                        onToggleMode={handleToggleEntryMode}
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
                            <div className="flex gap-4 mb-2.5">
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
                                  checked={newRoundHolesPreset === 'CUSTOM'}
                                  onChange={() => {
                                    setNewRoundHolesPreset('CUSTOM')
                                    setNewRoundCustomHoles([1])
                                  }}
                                />
                                <span>Custom</span>
                              </label>
                            </div>

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
                                    <div className="flex gap-4">
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
                                          checked={editingHolesPreset === 'CUSTOM'}
                                          onChange={() => {
                                            setEditingHolesPreset('CUSTOM')
                                            setEditingCustomHoles([1])
                                          }}
                                        />
                                        <span>Custom</span>
                                      </label>
                                    </div>

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
                        {competition.teams.map((t: any) => (
                          <div key={t.id} className="py-3 flex justify-between items-center">
                            <div>
                              <span className="font-extrabold text-slate-800">{t.name}</span>
                              <span className="text-xs text-slate-400 font-mono ml-2">
                                ({t.participants?.length || 0} members)
                              </span>
                            </div>
                            <button
                              onClick={() => triggerDeleteTeam(t.id)}
                              className="p-1 bg-white hover:bg-red-50 border border-slate-200 rounded text-slate-400 hover:text-red-600 shadow-sm"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
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
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 overflow-hidden max-h-[90vh] flex flex-col text-slate-800">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Matchplay Scorecard
                </h3>
                <p className="text-xs text-slate-550">
                  Round: {selectedMatchRoundForScorecard.name} | Course: {selectedMatchRoundForScorecard.course.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedMatchForScorecard(null)
                  setSelectedMatchRoundForScorecard(null)
                }}
                className="p-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-sm focus:outline-none"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 scrollbar-thin">
              {(() => {
                const round = selectedMatchRoundForScorecard
                const match = selectedMatchForScorecard

                const p1 = competition.participants.find((p: any) => p.id === match.matchPlayers[0]?.participantId)
                const p2 = competition.participants.find((p: any) => p.id === match.matchPlayers[1]?.participantId)
                if (!p1 || !p2) return <p className="text-center text-slate-500 italic">Unknown Players</p>

                const hcp1 = getPlayingHandicap(p1, round)
                const hcp2 = getPlayingHandicap(p2, round)

                const allowance = getMatchAllowance(match, hcp1, hcp2)

                const p1Allowance = hcp1 > hcp2 ? allowance : 0
                const p2Allowance = hcp2 > hcp1 ? allowance : 0

                const allNames = competition.participants.map((p: any) =>
                  p.userId ? p.user?.name : p.dummyName
                ).filter((n: any): n is string => typeof n === 'string' && n.length > 0)

                const name1 = getCompactName(p1.userId ? p1.user?.name : p1.dummyName || "", allNames)
                const name2 = getCompactName(p2.userId ? p2.user?.name : p2.dummyName || "", allNames)

                const roundHoles = round.holesPlayed && round.holesPlayed.length > 0
                  ? [...round.holesPlayed].sort((a: number, b: number) => a - b)
                  : Array.from({ length: 18 }, (_, i) => i + 1)

                const matchHoles = parseHoleRange(match.holeRange, roundHoles)
                const strokesMap = getMatchHoleStrokesMap(matchHoles, round, allowance)

                const frontHoleNums = matchHoles.filter(num => num >= 1 && num <= 9)
                const backHoleNums = matchHoles.filter(num => num >= 10 && num <= 18)

                const renderMatchplayHoleTable = (holeNums: number[]) => {
                  let sumPar = 0
                  let sumStrokes1 = 0
                  let sumStrokes2 = 0

                  let runningLead = 0
                  const standingsAtHole: Record<number, string> = {}
                  const holeWinner: Record<number, '1' | '2' | 'halved' | null> = {}

                  const getMatchHoleStrokes = (score: any) => {
                    if (!score) return null
                    if (score.status === 'WIPED') return 99
                    if (score.status === 'NOT_PLAYED') return null
                    return score.grossStrokes
                  }

                  for (const num of matchHoles) {
                    const hole = round.course.holes.find((h: any) => h.number === num)
                    if (!hole) continue
                    const score1 = p1.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
                    const score2 = p2.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)

                    const strokes1 = getMatchHoleStrokes(score1)
                    const strokes2 = getMatchHoleStrokes(score2)

                    if (strokes1 !== null && strokes2 !== null) {
                      const strokesGiven = strokesMap[num] || 0
                      const net1Calculated = hcp1 > hcp2 ? (strokes1 === 99 ? 99 : strokes1 - strokesGiven) : strokes1
                      const net2Calculated = hcp2 > hcp1 ? (strokes2 === 99 ? 99 : strokes2 - strokesGiven) : strokes2

                      if (net1Calculated < net2Calculated) {
                        runningLead++
                        holeWinner[num] = '1'
                      } else if (net1Calculated > net2Calculated) {
                        runningLead--
                        holeWinner[num] = '2'
                      } else {
                        holeWinner[num] = 'halved'
                      }

                      if (runningLead === 0) {
                        standingsAtHole[num] = "AS"
                      } else if (runningLead > 0) {
                        standingsAtHole[num] = `+${runningLead}`
                      } else {
                        standingsAtHole[num] = `${runningLead}`
                      }
                    } else {
                      standingsAtHole[num] = "-"
                      holeWinner[num] = null
                    }
                  }

                  const getMarkerMarkup = (displayVal: string, diff: number, isWiped: boolean) => {
                    if (displayVal === '-' || displayVal === '/' || isWiped) return null
                    if (diff === -1) {
                      return (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-[18px] h-[18px] border border-emerald-500 rounded-full opacity-80" />
                        </div>
                      )
                    } else if (diff <= -2) {
                      return (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="absolute w-[18px] h-[18px] border border-emerald-500 rounded-full opacity-80" />
                          <div className="absolute w-[12px] h-[12px] border border-emerald-500 rounded-full opacity-80" />
                        </div>
                      )
                    } else if (diff === 1) {
                      return (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-[14px] h-[14px] border border-red-500 rounded-none opacity-80" />
                        </div>
                      )
                    } else if (diff === 2) {
                      return (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="absolute w-[20px] h-[20px] border border-red-500 rounded-none opacity-80" />
                          <div className="absolute w-[14px] h-[14px] border border-red-500 rounded-none opacity-80" />
                        </div>
                      )
                    } else if (diff >= 3) {
                      return (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="absolute w-[26px] h-[26px] border border-red-500 rounded-none opacity-80" />
                          <div className="absolute w-[20px] h-[20px] border border-red-500 rounded-none opacity-80" />
                          <div className="absolute w-[14px] h-[14px] border border-red-500 rounded-none opacity-80" />
                        </div>
                      )
                    }
                    return null
                  }

                  return (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl w-full shadow-sm">
                      <table className="w-full text-[10px] text-center border-collapse">
                        <thead className="bg-slate-50 text-slate-650">
                          <tr className="border-b border-slate-200">
                            <th className="px-3 py-2 text-left font-extrabold border-r border-slate-200 w-28 text-[10px] text-slate-800 bg-slate-100/50">Hole</th>
                            {holeNums.map(num => {
                              const adjusted = getRoundHoleInfo(round, num)
                              const hole = round.course.holes.find((h: any) => h.number === num)
                              const holePar = adjusted ? adjusted.par : (hole?.par || 4)
                              sumPar += holePar
                              return (
                                <th key={num} className="px-1 py-1 border-r border-slate-200/80 font-black w-8 md:w-10 text-[10px] text-slate-700">
                                  {num}
                                </th>
                              )
                            })}
                            <th className="px-1.5 py-1 font-bold w-12 text-slate-700 text-[10px]">Total</th>
                          </tr>
                          <tr className="border-b border-slate-200 text-[9px] text-slate-550">
                            <td className="px-3 py-1 text-left border-r border-slate-200">Par</td>
                            {holeNums.map(num => {
                              const adjusted = getRoundHoleInfo(round, num)
                              const hole = round.course.holes.find((h: any) => h.number === num)
                              const holePar = adjusted ? adjusted.par : (hole?.par || 4)
                              return (
                                <td key={num} className="px-1 py-0.5 border-r border-slate-200/80 font-mono">
                                  {holePar}
                                </td>
                              )
                            })}
                            <td className="px-1.5 py-1.5 font-bold font-mono text-[9px]">{sumPar}</td>
                          </tr>
                          <tr className="border-b border-slate-200 text-[9px] text-slate-550">
                            <td className="px-3 py-1 text-left border-r border-slate-200">Index</td>
                            {holeNums.map(num => {
                              const adjusted = getRoundHoleInfo(round, num)
                              const hole = round.course.holes.find((h: any) => h.number === num)
                              const holeStrokeIndex = adjusted ? adjusted.strokeIndex : (hole?.strokeIndex || 1)
                              return (
                                <td key={num} className="px-1 py-0.5 border-r border-slate-200/80 font-mono">
                                  {holeStrokeIndex}
                                </td>
                              )
                            })}
                            <td className="px-1.5 py-1.5 font-mono text-[9px]">-</td>
                          </tr>
                        </thead>
                        <tbody className="bg-white text-slate-800">
                          {/* Player 1 Row */}
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 text-left font-bold text-slate-700 border-r border-slate-200 text-[10px] bg-slate-50/50 truncate max-w-[110px]">
                              {name1}
                              {p1Allowance > 0 && ` (${p1Allowance})`}
                            </td>
                            {holeNums.map(num => {
                              const adjusted = getRoundHoleInfo(round, num)
                              const hole = round.course.holes.find((h: any) => h.number === num)
                              if (!hole) return <td key={num} className="border-r border-slate-200/80">-</td>

                              const holePar = adjusted ? adjusted.par : hole.par
                              const score = p1.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)

                              let displayVal = "-"
                              let diff = 0
                              let isWiped = false

                              if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
                                if (score.status === 'WIPED') {
                                  displayVal = "/"
                                  isWiped = true
                                  sumStrokes1 += holePar + 3
                                } else if (score.grossStrokes !== null) {
                                  displayVal = String(score.grossStrokes)
                                  sumStrokes1 += score.grossStrokes
                                  diff = score.grossStrokes - holePar
                                }
                              }

                              const won = holeWinner[num] === '1'
                              const hasStroke = p1Allowance > 0 && (strokesMap[num] || 0) > 0
                              const markerMarkup = getMarkerMarkup(displayVal, diff, isWiped)

                              return (
                                <td key={num} className={`px-1 py-2 border-r border-slate-200/80 relative font-bold text-[11px] transition-colors duration-150 ${won ? 'bg-emerald-50 text-emerald-800' : 'text-slate-800'}`}>
                                  <div className="flex items-center justify-center h-7 relative w-full">
                                    <span className={isWiped ? 'text-red-650 font-black' : ''}>{displayVal}</span>
                                    {markerMarkup}
                                    {hasStroke && (
                                      <div className="absolute top-1 right-1 w-[5px] h-[5px] bg-cyan-500 rounded-full" title="Allowance stroke given on this hole" />
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                            <td className="px-1.5 py-2 font-extrabold text-slate-850 text-[10px] bg-slate-50/50">{sumStrokes1}</td>
                          </tr>

                          {/* Running Match Score Row */}
                          <tr className="border-b border-slate-200 bg-slate-50/40 text-[9px]">
                            <td className="px-3 py-1.5 text-left font-bold text-slate-500 border-r border-slate-200 bg-slate-50/60">
                              Match Score
                            </td>
                            {holeNums.map(num => {
                              const val = standingsAtHole[num] || "-"
                              const isPositive = val.startsWith("+")
                              const isNegative = val.startsWith("-")
                              let colorClass = "text-slate-500 font-semibold"
                              if (isPositive) colorClass = "text-emerald-600 font-black bg-emerald-50/30"
                              if (isNegative) colorClass = "text-red-600 font-black bg-red-50/30"
                              if (val === "AS") colorClass = "text-slate-800 font-bold bg-slate-100/30"

                              return (
                                <td key={num} className={`px-1 py-1.5 border-r border-slate-200/80 font-mono ${colorClass}`}>
                                  {val}
                                </td>
                              )
                            })}
                            <td className="px-1.5 py-1.5 font-bold font-mono">-</td>
                          </tr>

                          {/* Player 2 Row */}
                          <tr className="border-b border-slate-200">
                            <td className="px-3 py-2 text-left font-bold text-slate-700 border-r border-slate-200 text-[10px] bg-slate-50/50 truncate max-w-[110px]">
                              {name2}
                              {p2Allowance > 0 && ` (${p2Allowance})`}
                            </td>
                            {holeNums.map(num => {
                              const adjusted = getRoundHoleInfo(round, num)
                              const hole = round.course.holes.find((h: any) => h.number === num)
                              if (!hole) return <td key={num} className="border-r border-slate-200/80">-</td>

                              const holePar = adjusted ? adjusted.par : hole.par
                              const score = p2.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)

                              let displayVal = "-"
                              let diff = 0
                              let isWiped = false

                              if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
                                if (score.status === 'WIPED') {
                                  displayVal = "/"
                                  isWiped = true
                                  sumStrokes2 += holePar + 3
                                } else if (score.grossStrokes !== null) {
                                  displayVal = String(score.grossStrokes)
                                  sumStrokes2 += score.grossStrokes
                                  diff = score.grossStrokes - holePar
                                }
                              }

                              const won = holeWinner[num] === '2'
                              const hasStroke = p2Allowance > 0 && (strokesMap[num] || 0) > 0
                              const markerMarkup = getMarkerMarkup(displayVal, diff, isWiped)

                              return (
                                <td key={num} className={`px-1 py-2 border-r border-slate-200/80 relative font-bold text-[11px] transition-colors duration-150 ${won ? 'bg-emerald-50 text-emerald-800' : 'text-slate-800'}`}>
                                  <div className="flex items-center justify-center h-7 relative w-full">
                                    <span className={isWiped ? 'text-red-650 font-black' : ''}>{displayVal}</span>
                                    {markerMarkup}
                                    {hasStroke && (
                                      <div className="absolute top-1 right-1 w-[5px] h-[5px] bg-cyan-500 rounded-full" title="Allowance stroke given on this hole" />
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                            <td className="px-1.5 py-2 font-extrabold text-slate-850 text-[10px] bg-slate-50/50">{sumStrokes2}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )
                }

                return (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="font-bold text-slate-600 block">Allowance</span>
                        <span className="text-sm font-black text-slate-900">{allowance} strokes</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-600 block">Calculation Method</span>
                        <span className="text-sm font-black text-slate-900">{match.allowanceType || "75%"} base</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-600 block">Holes</span>
                        <span className="text-sm font-black text-slate-900">{match.holeRange || "1-18"}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-600 block">Status</span>
                        <span className="text-sm font-black text-emerald-600 uppercase">
                          {(() => {
                            const { statusText } = computeMatchplayStatus(match, round)
                            return statusText
                          })()}
                        </span>
                      </div>
                    </div>

                    {frontHoleNums.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-extrabold text-xs text-slate-550 uppercase tracking-wider">Front 9</h4>
                        {renderMatchplayHoleTable(frontHoleNums)}
                      </div>
                    )}

                    {backHoleNums.length > 0 && (
                      <div className="space-y-2 pt-4">
                        <h4 className="font-extrabold text-xs text-slate-555 uppercase tracking-wider">Back 9</h4>
                        {renderMatchplayHoleTable(backHoleNums)}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Landscape scorecard popup modal */}
      {selectedParticipantForScorecard && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 overflow-hidden max-h-[90vh] flex flex-col text-slate-800">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {selectedParticipantForScorecard.userId ? (selectedParticipantForScorecard.user?.name || selectedParticipantForScorecard.user?.email) : selectedParticipantForScorecard.dummyName}
                </h3>
                <p className="text-xs text-slate-550">
                  Competition Handicap Index: {selectedParticipantForScorecard.compHandicap !== null ? selectedParticipantForScorecard.compHandicap.toFixed(1) : "-"}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedParticipantForScorecard(null)
                  setSelectedRoundIdForScorecard(null)
                }}
                className="p-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-sm focus:outline-none"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 scrollbar-thin">
              {competition.rounds
                .filter((r: any) => !selectedRoundIdForScorecard || r.id === selectedRoundIdForScorecard)
                .map((round: any) => {
                  const tee = round.tee ||
                              round.course.tees.find((t: any) => t.name.toLowerCase().includes('yellow')) ||
                              round.course.tees.find((t: any) => t.name.toLowerCase().includes('white')) ||
                              round.course.tees[0]

                  // Sum course par
                  const coursePar = round.course.holes.reduce((sum: number, h: any) => sum + h.par, 0)
                  
                  // Course Handicap
                  const courseHandicap = getPlayingHandicap(selectedParticipantForScorecard, round)

                  const frontHoleNums = Array.from({ length: 9 }, (_, i) => i + 1)
                  const backHoleNums = Array.from({ length: 9 }, (_, i) => i + 10)

                  const activeRoundHoles = round.holesPlayed && round.holesPlayed.length > 0
                    ? round.holesPlayed
                    : Array.from({ length: 18 }, (_, i) => i + 1)

                  const frontHolesPlayed = frontHoleNums.filter(num => activeRoundHoles.includes(num))
                  const backHolesPlayed = backHoleNums.filter(num => activeRoundHoles.includes(num))

                  const renderHoleColumns = (holeNums: number[]) => {
                    let sumPar = 0
                    let sumStrokes = 0
                    let sumPoints = 0

                    return (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl w-full">
                        <table className="w-full text-[10px] text-center border-collapse">
                          <thead className="bg-slate-50 text-slate-650">
                            <tr className="border-b border-slate-200">
                              <th className="px-2 py-1 text-left font-extrabold border-r border-slate-200 w-16 text-[10px]">Hole</th>
                              {holeNums.map(num => {
                                const adjusted = getRoundHoleInfo(round, num)
                                const hole = round.course.holes.find((h: any) => h.number === num)
                                const holePar = adjusted ? adjusted.par : (hole?.par || 4)
                                sumPar += holePar
                                return (
                                  <th key={num} className="px-1 py-1 border-r border-slate-200/80 font-black w-8 md:w-10 text-[10px] text-slate-700">
                                    {num}
                                  </th>
                                )
                              })}
                              <th className="px-1.5 py-1 font-bold w-12 text-slate-700 text-[10px]">Total</th>
                            </tr>
                            <tr className="border-b border-slate-200 text-[9px] text-slate-550">
                              <td className="px-2 py-1 text-left border-r border-slate-200">Par</td>
                              {holeNums.map(num => {
                                const adjusted = getRoundHoleInfo(round, num)
                                const hole = round.course.holes.find((h: any) => h.number === num)
                                const holePar = adjusted ? adjusted.par : (hole?.par || 4)
                                return (
                                  <td key={num} className="px-1 py-0.5 border-r border-slate-200/80 font-mono">
                                    {holePar}
                                  </td>
                                )
                              })}
                              <td className="px-1.5 py-1.5 font-bold font-mono text-[9px]">{sumPar}</td>
                            </tr>
                            <tr className="border-b border-slate-200 text-[9px] text-slate-550">
                              <td className="px-2 py-1 text-left border-r border-slate-200">Index</td>
                              {holeNums.map(num => {
                                const adjusted = getRoundHoleInfo(round, num)
                                const hole = round.course.holes.find((h: any) => h.number === num)
                                const holeStrokeIndex = adjusted ? adjusted.strokeIndex : (hole?.strokeIndex || 1)
                                return (
                                  <td key={num} className="px-1 py-0.5 border-r border-slate-200/80 font-mono">
                                    {holeStrokeIndex}
                                  </td>
                                )
                              })}
                              <td className="px-1.5 py-1.5 font-mono text-[9px]">-</td>
                            </tr>
                            <tr className="border-b border-slate-200 text-[9px] text-slate-550">
                              <td className="px-2 py-1 text-left border-r border-slate-200">Shots</td>
                              {holeNums.map(num => {
                                const adjusted = getRoundHoleInfo(round, num)
                                const hole = round.course.holes.find((h: any) => h.number === num)
                                const holeStrokeIndex = adjusted ? adjusted.strokeIndex : (hole?.strokeIndex || 1)
                                const hcpStrokes = getHandicapStrokesOnHole(courseHandicap, holeStrokeIndex)
                                return (
                                  <td key={num} className="px-1 py-0.5 border-r border-slate-200/80 font-bold text-cyan-600 font-mono">
                                    {hcpStrokes === 1 ? "|" : hcpStrokes >= 2 ? "||" : ""}
                                  </td>
                                )
                              })}
                              <td className="px-1.5 py-1.5 font-mono font-bold text-cyan-600 text-[9px]">
                                {courseHandicap}
                              </td>
                            </tr>
                          </thead>
                          <tbody className="bg-white text-slate-800">
                            {/* Gross Strokes Row */}
                            <tr className="border-b border-slate-200">
                              <td className="px-2 py-1.5 text-left font-bold text-slate-700 border-r border-slate-200 text-[10px]">Strokes</td>
                              {holeNums.map(num => {
                                const adjusted = getRoundHoleInfo(round, num)
                                const hole = round.course.holes.find((h: any) => h.number === num)
                                if (!hole) return <td key={num} className="border-r border-slate-200/80">-</td>

                                const holePar = adjusted ? adjusted.par : hole.par

                                const score = selectedParticipantForScorecard.scores.find(
                                  (s: any) => s.roundId === round.id && s.holeId === hole.id
                                )

                                let displayVal = "-"
                                let diff = 0
                                let isWiped = false
                                
                                if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
                                  if (score.status === 'WIPED') {
                                    displayVal = "/"
                                    isWiped = true
                                    sumStrokes += holePar + 3 // wiped hole is triple bogey
                                  } else if (score.grossStrokes !== null) {
                                    displayVal = String(score.grossStrokes)
                                    sumStrokes += score.grossStrokes
                                    diff = score.grossStrokes - holePar
                                  }
                                }

                                // Style circle/square markers (more compact)
                                let markerMarkup = null
                                if (displayVal !== '-' && displayVal !== '/' && score?.grossStrokes) {
                                  if (diff === -1) {
                                    // Birdie: single circle
                                    markerMarkup = (
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-[18px] h-[18px] border border-emerald-500 rounded-full opacity-80" />
                                      </div>
                                    )
                                  } else if (diff <= -2) {
                                    // Eagle: double circle
                                    markerMarkup = (
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="absolute w-[18px] h-[18px] border border-emerald-500 rounded-full opacity-80" />
                                        <div className="absolute w-[12px] h-[12px] border border-emerald-500 rounded-full opacity-80" />
                                      </div>
                                    )
                                  } else if (diff === 1) {
                                    // Bogey: single rectangle
                                    markerMarkup = (
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-[14px] h-[14px] border border-red-500 rounded-none opacity-80" />
                                      </div>
                                    )
                                  } else if (diff === 2) {
                                    // Double Bogey: double rectangle
                                    markerMarkup = (
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="absolute w-[20px] h-[20px] border border-red-500 rounded-none opacity-80" />
                                        <div className="absolute w-[14px] h-[14px] border border-red-500 rounded-none opacity-80" />
                                      </div>
                                    )
                                  } else if (diff >= 3) {
                                    // Triple bogey or worse: three rectangles
                                    markerMarkup = (
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="absolute w-[26px] h-[26px] border border-red-500 rounded-none opacity-80" />
                                        <div className="absolute w-[20px] h-[20px] border border-red-500 rounded-none opacity-80" />
                                        <div className="absolute w-[14px] h-[14px] border border-red-500 rounded-none opacity-80" />
                                      </div>
                                    )
                                  }
                                }

                                return (
                                  <td key={num} className="px-1 py-1.5 border-r border-slate-200/80 relative font-bold text-slate-800 text-[11px]">
                                    <div className="flex items-center justify-center h-7 relative w-full">
                                      <span className={isWiped ? 'text-red-650 font-black' : ''}>{displayVal}</span>
                                      {markerMarkup}
                                    </div>
                                  </td>
                                )
                              })}
                              <td className="px-1.5 py-1.5 font-extrabold text-slate-850 text-[10px]">{sumStrokes}</td>
                            </tr>

                            {/* Stableford Points Row */}
                            <tr>
                              <td className="px-2 py-1.5 text-left font-bold text-slate-500 border-r border-slate-200 text-[10px]">
                                Points {selectedLeaderboardType === 'STABLEFORD_BRUTTO' ? '(gross)' : '(netto)'}
                              </td>
                              {holeNums.map(num => {
                                const adjusted = getRoundHoleInfo(round, num)
                                const hole = round.course.holes.find((h: any) => h.number === num)
                                if (!hole) return <td key={num} className="border-r border-slate-200/80">-</td>

                                const holePar = adjusted ? adjusted.par : hole.par
                                const holeStrokeIndex = adjusted ? adjusted.strokeIndex : hole.strokeIndex

                                const score = selectedParticipantForScorecard.scores.find(
                                  (s: any) => s.roundId === round.id && s.holeId === hole.id
                                )

                                let pts = null
                                if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
                                  if (score.status === 'WIPED') {
                                    pts = 0
                                  } else if (score.grossStrokes !== null) {
                                    const isNet = selectedLeaderboardType !== 'STABLEFORD_BRUTTO'
                                    const hcpStrokes = isNet ? getHandicapStrokesOnHole(courseHandicap, holeStrokeIndex) : 0
                                    pts = calculateStablefordPoints(score.grossStrokes, holePar, hcpStrokes, isNet)
                                  }
                                }

                                if (pts !== null) {
                                  sumPoints += pts
                                }

                                return (
                                  <td key={num} className="px-1 py-1.5 border-r border-slate-200/80 font-extrabold text-emerald-600 font-mono text-[10px]">
                                    {pts !== null ? pts : "-"}
                                  </td>
                                )
                              })}
                              <td className="px-1.5 py-1.5 font-black text-emerald-600 font-mono text-[10px]">{sumPoints}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )
                  }

                  return (
                    <div key={round.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                      <div>
                        <h4 className="text-base font-extrabold text-slate-800">{round.name}</h4>
                        <p className="text-xs text-slate-550">
                          Course: <span className="font-semibold text-emerald-650">{round.course.name}</span> | Tee: <span className="text-slate-700">{tee?.name || "Standard"}</span> (Rating: {tee?.courseRating || "-"}, Slope: {tee?.slope || "-"})
                        </p>
                      </div>

                      <div className="space-y-4">
                        {frontHolesPlayed.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Front Nine</div>
                            {renderHoleColumns(frontHolesPlayed)}
                          </div>
                        )}

                        {backHolesPlayed.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Back Nine</div>
                            {renderHoleColumns(backHolesPlayed)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
