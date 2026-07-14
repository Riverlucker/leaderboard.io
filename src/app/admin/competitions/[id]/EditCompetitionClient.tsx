"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft, Save, Plus, Trash2, Calendar, 
  Settings, Layers, Users, Users2, ShieldAlert,
  Edit2, Check, X
} from "lucide-react"
import { 
  updateCompetitionGeneral, 
  addRound, deleteRound, updateRoundHoles,
  addTeam, deleteTeam, updateTeamColor,
  addParticipant, deleteParticipant, 
  addMatch, deleteMatch, updateMatchAllowance, updateMatchPlayUntilEnd, updateMatchHoleRange,
  updateMatchPlayerAllowance
} from "../actions"
import { TEAM_COLOR_LIST, getTeamColorConfig } from "@/lib/teamColors"
import { getPlayingHandicap, getMatchAllowance, getPlayerCalculatedAllowance, parseHoleRangeString, getHoleRangeString } from "@/app/CompetitionClientView"

// Helper to format date for input type="date"
const formatDateInput = (dateVal: any) => {
  if (!dateVal) return ""
  return new Date(dateVal).toISOString().split('T')[0]
}

// Helper to format date for input type="datetime-local"
const formatDateTimeInput = (dateVal: any) => {
  if (!dateVal) return ""
  const date = new Date(dateVal)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formatCompType = (type: string) => {
  switch (type) {
    case "STROKEPLAY_GROSS":
      return "Strokeplay Gross"
    case "NETTO_STABLEFORD":
      return "Netto Stableford"
    case "MATCHPLAY":
      return "Matchplay (Ryder Cup)"
    default:
      return type
  }
}

export function EditCompetitionClient({
  competition,
  courses,
  users
}: {
  competition: any
  courses: any[]
  users: any[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'settings' | 'rounds' | 'teams' | 'participants' | 'pairings'>('settings')

  // Get unique courses played in this competition's rounds
  const uniqueCoursesMap = new Map<string, any>()
  for (const round of (competition.rounds || [])) {
    if (round.course && !uniqueCoursesMap.has(round.course.id)) {
      uniqueCoursesMap.set(round.course.id, round.course)
    }
  }
  const uniqueCourses = Array.from(uniqueCoursesMap.values())

  // General Settings Form state
  const [name, setName] = useState(competition.name)
  const [uniqueSlug, setUniqueSlug] = useState(competition.uniqueSlug)
  const [type, setType] = useState(competition.type)
  const [isTeamComp, setIsTeamComp] = useState(competition.isTeamComp)
  const [showRelToPar, setShowRelToPar] = useState(competition.showRelToPar || false)
  const [selectedExtraLeaderboards, setSelectedExtraLeaderboards] = useState<string[]>(competition.extraLeaderboards || [])
  const [startDate, setStartDate] = useState(formatDateInput(competition.startDate))
  const [endDate, setEndDate] = useState(formatDateInput(competition.endDate))
  const [cssConfig, setCssConfig] = useState(competition.cssConfig || "")
  const [bgImage, setBgImage] = useState(competition.bgImage || "")
  const [generalError, setGeneralError] = useState("")
  const [generalSuccess, setGeneralSuccess] = useState(false)
  const [isSavingGeneral, setIsSavingGeneral] = useState(false)

  // Add Round Form state
  const [roundName, setRoundName] = useState("")
  const [roundCourseId, setRoundCourseId] = useState(courses[0]?.id || "")
  const [roundStart, setRoundStart] = useState("")
  const [roundEnd, setRoundEnd] = useState("")
  const [roundError, setRoundError] = useState("")
  const [isAddingRound, setIsAddingRound] = useState(false)
  const [holesPreset, setHolesPreset] = useState<'ALL' | 'FRONT' | 'BACK' | 'FRONT_TWICE' | 'BACK_TWICE' | 'RANGE' | 'CUSTOM'>('ALL')
  const [roundHoleRange, setRoundHoleRange] = useState("")
  const [customHoles, setCustomHoles] = useState<number[]>(Array.from({ length: 18 }, (_, i) => i + 1))

  // Edit Round state
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null)
  const [editingHolesPreset, setEditingHolesPreset] = useState<'ALL' | 'FRONT' | 'BACK' | 'FRONT_TWICE' | 'BACK_TWICE' | 'RANGE' | 'CUSTOM'>('ALL')
  const [editingHoleRange, setEditingHoleRange] = useState("")
  const [editingCustomHoles, setEditingCustomHoles] = useState<number[]>([])
  const [isUpdatingRoundHoles, setIsUpdatingRoundHoles] = useState(false)
  const [editingRoundError, setEditingRoundError] = useState("")

  // Add Team Form state
  const [teamName, setTeamName] = useState("")
  const [teamError, setTeamError] = useState("")
  const [isAddingTeam, setIsAddingTeam] = useState(false)

  // Add Participant Form state
  const [participantMode, setParticipantMode] = useState<'registered' | 'dummy'>('registered')
  const [partUserId, setPartUserId] = useState("")
  const [partDummyName, setPartDummyName] = useState("")
  const [partHandicap, setPartHandicap] = useState("")
  const [partTeamId, setPartTeamId] = useState("")
  const [partError, setPartError] = useState("")
  const [isAddingParticipant, setIsAddingParticipant] = useState(false)

  // Pairings / Matches Form state
  const [selectedRoundId, setSelectedRoundId] = useState(competition.rounds[0]?.id || "")
  const [matchType, setMatchType] = useState("SINGLES")
  const [allowanceType, setAllowanceType] = useState("75%")
  const [playUntilEnd, setPlayUntilEnd] = useState(false)
  const [holeRange, setHoleRange] = useState("1-18")
  const [overrideAllowances, setOverrideAllowances] = useState<Record<string, string>>({})
  const [savingAllowance, setSavingAllowance] = useState<Record<string, boolean>>({})
  const [overrideMatchPlayerAllowances, setOverrideMatchPlayerAllowances] = useState<Record<string, string>>({})
  const [savingMatchPlayerAllowance, setSavingMatchPlayerAllowance] = useState<Record<string, boolean>>({})
  const [overrideHoleRanges, setOverrideHoleRanges] = useState<Record<string, string>>({})
  const [savingHoleRange, setSavingHoleRange] = useState<Record<string, boolean>>({})
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([])
  const [pairingError, setPairingError] = useState("")
  const [isCreatingPairing, setIsCreatingPairing] = useState(false)
  const [localTeamColors, setLocalTeamColors] = useState<Record<string, string>>({})

  // Pre-populate match holeRange state from round holesPlayed
  useEffect(() => {
    const r = competition.rounds.find((x: any) => x.id === selectedRoundId)
    if (r) {
      setHoleRange(getHoleRangeString(r))
    }
  }, [selectedRoundId, competition.rounds])

  // Actions
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingGeneral(true)
    setGeneralError("")
    setGeneralSuccess(false)

    try {
      await updateCompetitionGeneral(competition.id, {
        name,
        uniqueSlug,
        type,
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
      setGeneralError(err.message || "Failed to update settings.")
    } finally {
      setIsSavingGeneral(false)
    }
  }

  const handleAddRound = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingRound(true)
    setRoundError("")

    try {
      let holesPlayed: number[] = []
      let ninePreset: string | null = null
      if (holesPreset === 'ALL') {
        holesPlayed = Array.from({ length: 18 }, (_, i) => i + 1)
      } else if (holesPreset === 'FRONT') {
        holesPlayed = Array.from({ length: 9 }, (_, i) => i + 1)
      } else if (holesPreset === 'BACK') {
        holesPlayed = Array.from({ length: 9 }, (_, i) => i + 10)
      } else if (holesPreset === 'FRONT_TWICE') {
        holesPlayed = Array.from({ length: 18 }, (_, i) => i + 1)
        ninePreset = 'FRONT_9_TWICE'
      } else if (holesPreset === 'BACK_TWICE') {
        holesPlayed = Array.from({ length: 18 }, (_, i) => i + 1)
        ninePreset = 'BACK_9_TWICE'
      } else if (holesPreset === 'RANGE') {
        holesPlayed = parseHoleRangeString(roundHoleRange)
      } else if (holesPreset === 'CUSTOM') {
        holesPlayed = [...customHoles]
      }

      if (holesPlayed.length === 0) {
        throw new Error("Please select at least one hole to play.")
      }

      await addRound(competition.id, {
        name: roundName,
        courseId: roundCourseId,
        startDate: roundStart || null,
        endDate: roundEnd || null,
        holesPlayed,
        ninePreset
      })
      setRoundName("")
      setRoundStart("")
      setRoundEnd("")
      setHolesPreset('ALL')
      setRoundHoleRange("")
      setCustomHoles(Array.from({ length: 18 }, (_, i) => i + 1))
      router.refresh()
    } catch (err: any) {
      setRoundError(err.message || "Failed to add round.")
    } finally {
      setIsAddingRound(false)
    }
  }

  const handleDeleteRound = async (roundId: string) => {
    if (confirm("Are you sure you want to delete this round? All matches and scores in this round will be deleted.")) {
      try {
        await deleteRound(roundId, competition.id)
        router.refresh()
      } catch (e) {
        console.error(e)
        alert("Failed to delete round.")
      }
    }
  }

  const handleStartEditRound = (round: any) => {
    setEditingRoundId(round.id)
    setEditingRoundError("")
    
    const holes = round.holesPlayed || []
    setEditingCustomHoles(holes)
    setEditingHoleRange(holes.join(","))
    
    // Set preset based on current holes and round preset
    if (round.ninePreset === 'FRONT_9_TWICE') {
      setEditingHolesPreset('FRONT_TWICE')
    } else if (round.ninePreset === 'BACK_9_TWICE') {
      setEditingHolesPreset('BACK_TWICE')
    } else if (holes.length === 18 && holes.every((h: number, idx: number) => h === idx + 1)) {
      setEditingHolesPreset('ALL')
    } else if (holes.length === 9 && holes[0] === 1 && holes[8] === 9) {
      setEditingHolesPreset('FRONT')
    } else if (holes.length === 9 && holes[0] === 10 && holes[8] === 18) {
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

  const handleUpdateRoundHolesSubmit = async (roundId: string) => {
    setIsUpdatingRoundHoles(true)
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
      } else if (editingHolesPreset === 'CUSTOM') {
        holes = [...editingCustomHoles]
      }

      if (holes.length === 0) {
        throw new Error("Please select at least one hole.")
      }

      await updateRoundHoles(roundId, competition.id, holes, null, ninePreset)
      setEditingRoundId(null)
      router.refresh()
    } catch (err: any) {
      setEditingRoundError(err.message || "Failed to update holes.")
    } finally {
      setIsUpdatingRoundHoles(false)
    }
  }

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingTeam(true)
    setTeamError("")

    try {
      await addTeam(competition.id, teamName)
      setTeamName("")
      router.refresh()
    } catch (err: any) {
      setTeamError(err.message || "Failed to add team.")
    } finally {
      setIsAddingTeam(false)
    }
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (confirm("Are you sure you want to delete this team? Participants will be unassigned from this team.")) {
      try {
        await deleteTeam(teamId, competition.id)
        router.refresh()
      } catch (e) {
        console.error(e)
        alert("Failed to delete team.")
      }
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

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingParticipant(true)
    setPartError("")

    try {
      const hcVal = partHandicap.trim() !== "" ? parseFloat(partHandicap) : null
      if (hcVal !== null && isNaN(hcVal)) {
        throw new Error("Handicap must be a valid number.")
      }

      await addParticipant(competition.id, {
        userId: participantMode === 'registered' ? partUserId : null,
        dummyName: participantMode === 'dummy' ? partDummyName : null,
        compHandicap: hcVal,
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

  const handleDeleteParticipant = async (partId: string) => {
    if (confirm("Are you sure you want to remove this participant? All their scores and match pairings in this competition will be deleted.")) {
      try {
        await deleteParticipant(partId, competition.id)
        router.refresh()
      } catch (e) {
        console.error(e)
        alert("Failed to remove participant.")
      }
    }
  }

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingPairing(true)
    setPairingError("")

    try {
      if (!selectedRoundId) {
        throw new Error("Please select a round first.")
      }
      if (selectedPartIds.length === 0) {
        throw new Error("Please select at least one player.")
      }

      await addMatch(selectedRoundId, competition.id, {
        type: matchType,
        participantIds: selectedPartIds,
        allowanceType: (matchType === "SINGLES" || matchType === "TEAM_MATCHPLAY") ? allowanceType : null,
        playUntilEnd: (matchType === "SINGLES" || matchType === "TEAM_MATCHPLAY") ? playUntilEnd : false,
        holeRange: (matchType === "SINGLES" || matchType === "TEAM_MATCHPLAY") ? holeRange : null
      })

      setSelectedPartIds([])
      setPlayUntilEnd(false)
      setHoleRange("1-18")
      router.refresh()
    } catch (err: any) {
      setPairingError(err.message || "Failed to create match.")
    } finally {
      setIsCreatingPairing(false)
    }
  }

  const handleSaveAllowance = async (matchId: string) => {
    const val = overrideAllowances[matchId]
    if (val === undefined) return
    const parsed = parseInt(val)
    if (isNaN(parsed)) return

    setSavingAllowance(prev => ({ ...prev, [matchId]: true }))
    try {
      await updateMatchAllowance(matchId, competition.id, parsed)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to save allowance.")
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

  const handleTogglePlayUntilEnd = async (matchId: string, currentVal: boolean) => {
    try {
      await updateMatchPlayUntilEnd(matchId, competition.id, !currentVal)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to update play until end setting.")
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
      alert("Failed to update hole range.")
    } finally {
      setSavingHoleRange(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const handleDeleteMatch = async (matchId: string) => {
    if (confirm("Are you sure you want to delete this match? The pairing will be removed but scores are kept unless referenced by the players.")) {
      try {
        await deleteMatch(matchId, competition.id)
        router.refresh()
      } catch (e) {
        console.error(e)
        alert("Failed to delete match.")
      }
    }
  }

  const togglePartSelection = (partId: string) => {
    if (selectedPartIds.includes(partId)) {
      setSelectedPartIds(selectedPartIds.filter(id => id !== partId))
    } else {
      setSelectedPartIds([...selectedPartIds, partId])
    }
  }

  const selectedRound = competition.rounds.find((r: any) => r.id === selectedRoundId)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <Link 
            href="/admin/competitions" 
            className="inline-flex items-center space-x-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors mb-2"
          >
            <ArrowLeft size={16} />
            <span>Back to Competitions</span>
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-100 flex items-center gap-2">
            <span>{competition.name}</span>
            <span className="text-sm font-normal text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded uppercase font-mono tracking-wider">
              {competition.type}
            </span>
          </h1>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-800 overflow-x-auto whitespace-nowrap scrollbar-thin">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-medium transition-all ${
            activeTab === 'settings' 
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/30' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
          }`}
        >
          <Settings size={16} />
          <span>General Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('rounds')}
          className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-medium transition-all ${
            activeTab === 'rounds' 
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/30' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
          }`}
        >
          <Layers size={16} />
          <span>Rounds ({competition.rounds.length})</span>
        </button>

        {isTeamComp && (
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-medium transition-all ${
              activeTab === 'teams' 
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/30' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
            }`}
          >
            <Users2 size={16} />
            <span>Teams ({competition.teams.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('participants')}
          className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-medium transition-all ${
            activeTab === 'participants' 
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/30' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
          }`}
        >
          <Users size={16} />
          <span>Participants ({competition.participants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pairings')}
          className={`flex items-center space-x-2 px-6 py-3 border-b-2 text-sm font-medium transition-all ${
            activeTab === 'pairings' 
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/30' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
          }`}
        >
          <Calendar size={16} />
          <span>Pairings & Matches</span>
        </button>
      </div>

      {/* Tabs Content */}
      <div className="mt-6">
        
        {/* Tab 1: General Settings */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <form onSubmit={handleSaveGeneral} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
                <h3 className="text-lg font-semibold border-b border-slate-850 pb-3">Competition Configuration</h3>

                {generalError && (
                  <div className="bg-red-950/60 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
                    {generalError}
                  </div>
                )}
                {generalSuccess && (
                  <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-lg text-sm">
                    Settings successfully saved!
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-400 mb-2">Competition Name</label>
                    <input 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 font-bold text-slate-200 focus:ring-2 focus:ring-emerald-500" 
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Format / Type</label>
                    <select
                      value={type}
                      onChange={e => setType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-250 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="STROKEPLAY_GROSS">Strokeplay Gross (Strokes count)</option>
                      <option value="NETTO_STABLEFORD">Netto Stableford (Points based on HC)</option>
                      <option value="MATCHPLAY">Matchplay (Ryder Cup style)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Unique Link Slug</label>
                    <input 
                      value={uniqueSlug} 
                      onChange={e => setUniqueSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))} 
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 font-mono text-sm text-slate-300 focus:ring-2 focus:ring-emerald-500" 
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Start Date</label>
                    <input 
                      type="date"
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-300 focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">End Date</label>
                    <input 
                      type="date"
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)} 
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-300 focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-400 mb-2">Background Image File (Stored in DB)</label>
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
                      className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                    />
                    {bgImage && (
                      <div className="mt-3 relative w-full h-32 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                        <img 
                          src={bgImage} 
                          alt="Background Preview" 
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setBgImage("")}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-md transition-colors"
                          title="Remove Background Image"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-400 mb-2">Custom CSS Settings (JSON or text)</label>
                    <textarea 
                      value={cssConfig} 
                      onChange={e => setCssConfig(e.target.value)} 
                      placeholder='e.g. { "primaryColor": "#10B981" }'
                      rows={4}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 font-mono text-xs text-slate-300 focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2.5 pt-2">
                    <label className="block text-sm font-semibold text-slate-400 uppercase">Enable Extra Side Leaderboards</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-955 border border-slate-800 p-4 rounded-xl">
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
                        const disabled = (opt.needsTeam && !isTeamComp) || (opt.hideForModus && type === opt.hideForModus)
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
                              className="w-4 h-4 text-emerald-500 rounded bg-slate-900 border-slate-700 focus:ring-emerald-500"
                            />
                            <span className="font-semibold text-slate-300">{opt.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isTeamCompGeneral"
                        checked={isTeamComp}
                        onChange={e => setIsTeamComp(e.target.checked)}
                        className="w-4 h-4 text-emerald-500 border-slate-700 rounded bg-slate-950 focus:ring-emerald-500"
                      />
                      <label htmlFor="isTeamCompGeneral" className="text-sm text-slate-300 select-none cursor-pointer">
                        Team Competition Mode
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="showRelToParGeneral"
                        checked={showRelToPar}
                        onChange={e => setShowRelToPar(e.target.checked)}
                        className="w-4 h-4 text-emerald-500 border-slate-700 rounded bg-slate-950 focus:ring-emerald-500"
                      />
                      <label htmlFor="showRelToParGeneral" className="text-sm text-slate-300 select-none cursor-pointer">
                        Show leaderboard +/- relative to par
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingGeneral}
                    className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Save size={16} />
                    <span>{isSavingGeneral ? "Saving..." : "Save Settings"}</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">At a Glance</h4>
                <div className="space-y-4">
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-450 text-sm">Rounds Setup</span>
                    <span className="font-bold text-slate-200">{competition.rounds.length}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-450 text-sm">Teams Active</span>
                    <span className="font-bold text-slate-200">{competition.isTeamComp ? competition.teams.length : "Disabled"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-450 text-sm">Total Players</span>
                    <span className="font-bold text-slate-200">{competition.participants.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450 text-sm">Scoring Format</span>
                    <span className="font-semibold text-emerald-400">{formatCompType(competition.type)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Rounds */}
        {activeTab === 'rounds' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-lg font-bold">Configured Rounds</h3>
              
              {competition.rounds.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                  No rounds created yet. Set up at least one round to score this tournament.
                </div>
              ) : (
                <div className="space-y-4">
                  {competition.rounds.map((round: any) => {
                    const isEditing = editingRoundId === round.id

                    return (
                      <div key={round.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                        {isEditing ? (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                              <div>
                                <h4 className="font-bold text-slate-200 text-lg">Edit Holes for {round.name}</h4>
                                <p className="text-xs text-emerald-400 font-medium">Course: {round.course.name}</p>
                              </div>
                              <button 
                                type="button"
                                onClick={() => setEditingRoundId(null)}
                                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                                title="Cancel"
                              >
                                <X size={18} />
                              </button>
                            </div>

                            {editingRoundError && (
                              <div className="bg-red-950/60 border border-red-800 text-red-300 px-3 py-2 rounded text-xs">
                                {editingRoundError}
                              </div>
                            )}

                            <div>
                              <label className="block text-xs font-semibold text-slate-400 mb-1">Holes to Play</label>
                              <select
                                value={editingHolesPreset}
                                onChange={e => setEditingHolesPreset(e.target.value as any)}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500"
                              >
                                <option value="ALL">All 18 Holes</option>
                                <option value="FRONT">Front Nine (Holes 1-9)</option>
                                <option value="BACK">Back Nine (Holes 10-18)</option>
                                <option value="FRONT_TWICE">Front Nine Twice (18 holes)</option>
                                <option value="BACK_TWICE">Back Nine Twice (18 holes)</option>
                                <option value="RANGE">Hole Range Expression</option>
                                <option value="CUSTOM">Custom Hole Selection</option>
                              </select>
                            </div>

                            {editingHolesPreset === 'RANGE' && (
                              <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Hole Range Expression</label>
                                <input
                                  type="text"
                                  value={editingHoleRange}
                                  onChange={e => setEditingHoleRange(e.target.value)}
                                  placeholder="e.g. 1-10,12,14 or 1-9,1-3"
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                                  required
                                />
                              </div>
                            )}

                            {editingHolesPreset === 'CUSTOM' && (
                              <div className="bg-slate-950 border border-slate-800 rounded p-3 space-y-2">
                                <span className="block text-xs font-semibold text-slate-400">Select Holes:</span>
                                <div className="grid grid-cols-6 gap-2">
                                  {Array.from({ length: 18 }, (_, i) => i + 1).map(holeNum => {
                                    const isChecked = editingCustomHoles.includes(holeNum)
                                    return (
                                      <label key={holeNum} className={`flex items-center justify-center p-1.5 border rounded cursor-pointer select-none transition-all ${
                                        isChecked 
                                          ? 'border-emerald-500 bg-emerald-950/20 text-emerald-400' 
                                          : 'border-slate-850 bg-slate-900/30 text-slate-500 hover:border-slate-700'
                                      }`}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            if (isChecked) {
                                              setEditingCustomHoles(editingCustomHoles.filter(h => h !== holeNum))
                                            } else {
                                              setEditingCustomHoles([...editingCustomHoles, holeNum])
                                            }
                                          }}
                                          className="sr-only"
                                        />
                                        <span className="text-xs font-bold">{holeNum}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="flex space-x-2 pt-2 justify-end border-t border-slate-800">
                              <button
                                type="button"
                                onClick={() => setEditingRoundId(null)}
                                className="px-4 py-1.5 border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateRoundHolesSubmit(round.id)}
                                disabled={isUpdatingRoundHoles}
                                className="flex items-center space-x-1 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Check size={14} />
                                <span>{isUpdatingRoundHoles ? "Saving..." : "Save Holes"}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <h4 className="font-bold text-slate-200 text-lg">{round.name}</h4>
                              <p className="text-sm text-emerald-400 font-medium">Course: {round.course.name}</p>
                              <p className="text-xs text-slate-400 font-medium">
                                Holes: {round.holesPlayed && round.holesPlayed.length > 0 ? (
                                  round.holesPlayed.length === 18 ? "All 18" :
                                  round.holesPlayed.length === 9 && round.holesPlayed[0] === 1 && round.holesPlayed[8] === 9 ? "Front 9 (1-9)" :
                                  round.holesPlayed.length === 9 && round.holesPlayed[0] === 10 && round.holesPlayed[8] === 18 ? "Back 9 (10-18)" :
                                  round.holesPlayed.join(", ")
                                ) : "All 18"}
                              </p>
                              {round.startDate && (
                                <p className="text-xs text-slate-500 font-mono pt-1">
                                  Starts: {new Date(round.startDate).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditRound(round)}
                                className="p-2 bg-slate-950 border border-slate-800 hover:bg-emerald-950/40 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors"
                                title="Edit Holes"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRound(round.id)}
                                className="p-2 bg-slate-950 border border-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                title="Delete Round"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <form onSubmit={handleAddRound} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <h3 className="text-md font-semibold text-slate-350 uppercase tracking-wider mb-2">Add New Round</h3>

                {roundError && (
                  <div className="bg-red-950/60 border border-red-800 text-red-300 px-3 py-2 rounded text-xs">
                    {roundError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Round Name</label>
                  <input
                    type="text"
                    value={roundName}
                    onChange={e => setRoundName(e.target.value)}
                    placeholder="e.g. Round 1"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Golf Course</label>
                  <select
                    value={roundCourseId}
                    onChange={e => setRoundCourseId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                    required
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Start Date/Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={roundStart}
                    onChange={e => setRoundStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">End Date/Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={roundEnd}
                    onChange={e => setRoundEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Holes to Play</label>
                  <select
                    value={holesPreset}
                    onChange={e => setHolesPreset(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="ALL">All 18 Holes</option>
                    <option value="FRONT">Front Nine (Holes 1-9)</option>
                    <option value="BACK">Back Nine (Holes 10-18)</option>
                    <option value="FRONT_TWICE">Front Nine Twice (18 holes)</option>
                    <option value="BACK_TWICE">Back Nine Twice (18 holes)</option>
                    <option value="RANGE">Hole Range Expression</option>
                    <option value="CUSTOM">Custom Hole Selection</option>
                  </select>
                </div>

                {holesPreset === 'RANGE' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Hole Range Expression</label>
                    <input
                      type="text"
                      value={roundHoleRange}
                      onChange={e => setRoundHoleRange(e.target.value)}
                      placeholder="e.g. 1-10,12,14 or 1-9,1-3"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                      required
                    />
                  </div>
                )}

                {holesPreset === 'CUSTOM' && (
                  <div className="bg-slate-950 border border-slate-800 rounded p-3 space-y-2">
                    <span className="block text-xs font-semibold text-slate-400">Select Holes:</span>
                    <div className="grid grid-cols-6 gap-2">
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(holeNum => {
                        const isChecked = customHoles.includes(holeNum)
                        return (
                          <label key={holeNum} className={`flex items-center justify-center p-1.5 border rounded cursor-pointer select-none transition-all ${
                            isChecked 
                              ? 'border-emerald-500 bg-emerald-950/20 text-emerald-400' 
                              : 'border-slate-850 bg-slate-900/30 text-slate-500 hover:border-slate-700'
                          }`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setCustomHoles(customHoles.filter(h => h !== holeNum))
                                } else {
                                  setCustomHoles([...customHoles, holeNum])
                                }
                              }}
                              className="sr-only"
                            />
                            <span className="text-xs font-bold">{holeNum}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAddingRound}
                  className="w-full flex items-center justify-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded text-sm transition-colors disabled:opacity-50"
                >
                  <Plus size={16} />
                  <span>{isAddingRound ? "Adding..." : "Add Round"}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: Teams (Conditional) */}
        {activeTab === 'teams' && isTeamComp && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-lg font-bold">Teams</h3>

              {competition.teams.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                  No teams added yet. Create teams to group players.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {competition.teams.map((team: any, tIdx: number) => {
                    const membersCount = competition.participants.filter((p: any) => p.teamId === team.id).length
                    const selectedColor = localTeamColors[team.id] !== undefined ? localTeamColors[team.id] : (team.color || "")
                    const teamConfig = getTeamColorConfig(selectedColor, tIdx)
                    const defaultAssignedColorKey = TEAM_COLOR_LIST[tIdx % TEAM_COLOR_LIST.length]

                    return (
                      <div key={team.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`w-3.5 h-3.5 rounded-full ${teamConfig.badge} border border-slate-950 shadow-sm`} />
                            <h4 className="font-bold text-slate-200 text-base">{team.name}</h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{membersCount} Assigned Players</p>
                        </div>

                        {/* 9x1 color picker */}
                        <div className="flex flex-col space-y-1 bg-slate-950 p-2 rounded-lg border border-slate-800/80 w-fit">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block text-center mb-0.5">Team Color</span>
                          <div className="grid grid-cols-9 gap-1">
                            {TEAM_COLOR_LIST.map((colorKey) => {
                              const config = getTeamColorConfig(colorKey, 0)
                              const isSelected = selectedColor === colorKey || (!selectedColor && colorKey === defaultAssignedColorKey)
                              return (
                                <button
                                  key={colorKey}
                                  type="button"
                                  onClick={() => handleUpdateTeamColor(team.id, colorKey)}
                                  className={`w-3.5 h-3.5 rounded-full ${config.badge} transition-all cursor-pointer ${
                                    isSelected 
                                      ? 'ring-2 ring-white scale-125 border border-slate-900 shadow' 
                                      : 'opacity-40 hover:opacity-100 hover:scale-110'
                                  }`}
                                  title={config.name}
                                />
                              )
                            })}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="p-2 bg-slate-950 border border-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg transition-colors h-fit self-center"
                          title="Delete Team"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <form onSubmit={handleAddTeam} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <h3 className="text-md font-semibold text-slate-350 uppercase tracking-wider mb-2">Create New Team</h3>

                {teamError && (
                  <div className="bg-red-950/60 border border-red-800 text-red-300 px-3 py-2 rounded text-xs">
                    {teamError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Team Name</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    placeholder="e.g. Team Europe"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingTeam}
                  className="w-full flex items-center justify-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded text-sm transition-colors disabled:opacity-50"
                >
                  <Plus size={16} />
                  <span>{isAddingTeam ? "Creating..." : "Create Team"}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 4: Participants */}
        {activeTab === 'participants' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-lg font-bold">Participants List</h3>

              {competition.participants.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                  No participants registered yet. Use the sidebar to add players.
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-950 text-slate-450 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Player</th>
                        <th className="px-4 py-3 text-center">Comp Handicap</th>
                        {uniqueCourses.map(course => (
                          <th key={course.id} className="px-4 py-3 text-center text-xs font-semibold text-slate-450 uppercase tracking-wider">
                            {course.name.replace("Diamond - ", "")} HCP
                          </th>
                        ))}
                        {isTeamComp && <th className="px-4 py-3">Team</th>}
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60">
                      {competition.participants.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-850/20">
                          <td className="px-4 py-3.5">
                            <div>
                              <div className="font-semibold text-slate-200">
                                {p.userId ? p.user?.name : p.dummyName}
                              </div>
                              <div className="text-xs text-slate-550 font-mono">
                                {p.userId ? `Registered (${p.user?.email})` : 'Dummy Player'}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-cyan-400">
                            {p.compHandicap !== null && p.compHandicap !== undefined ? p.compHandicap.toFixed(1) : "-"}
                          </td>
                          {uniqueCourses.map(course => {
                            const tee = course.tees?.find((t: any) => t.name.toLowerCase() === 'yellow') ||
                                        course.tees?.find((t: any) => t.name.toLowerCase() === 'white') ||
                                        course.tees?.[0]
                            
                            let playingHandicapStr = "-"
                            if (tee && p.compHandicap !== null && p.compHandicap !== undefined) {
                              const coursePar = course.holes?.length > 0 ? course.holes.reduce((sum: number, h: any) => sum + h.par, 0) : 72
                              const courseHandicap = (p.compHandicap * tee.slope / 113) + (tee.courseRating - coursePar)
                              const playingHandicap = Math.round(courseHandicap)
                              playingHandicapStr = String(playingHandicap)
                            }
                            
                            return (
                              <td key={course.id} className="px-4 py-3.5 text-center font-bold text-emerald-450">
                                {playingHandicapStr}
                              </td>
                            )
                          })}
                          {isTeamComp && (
                            <td className="px-4 py-3.5">
                              {p.team ? (
                                <span className="bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 text-xs px-2 py-0.5 rounded-full font-medium">
                                  {p.team.name}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-xs">Unassigned</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => handleDeleteParticipant(p.id)}
                              className="p-1.5 bg-slate-950 hover:bg-red-950/40 border border-slate-800 text-slate-450 hover:text-red-400 rounded transition-colors"
                              title="Remove Participant"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <form onSubmit={handleAddParticipant} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-5">
                <h3 className="text-md font-semibold text-slate-350 uppercase tracking-wider mb-2">Register Participant</h3>

                {partError && (
                  <div className="bg-red-950/60 border border-red-800 text-red-300 px-3 py-2 rounded text-xs">
                    {partError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Player Type</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setParticipantMode('registered')}
                      className={`py-1 text-xs font-medium rounded ${
                        participantMode === 'registered' 
                          ? 'bg-slate-800 text-slate-100 shadow' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Registered User
                    </button>
                    <button
                      type="button"
                      onClick={() => setParticipantMode('dummy')}
                      className={`py-1 text-xs font-medium rounded ${
                        participantMode === 'dummy' 
                          ? 'bg-slate-800 text-slate-100 shadow' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Dummy Player
                    </button>
                  </div>
                </div>

                {participantMode === 'registered' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Select Registered User</label>
                    <select
                      value={partUserId}
                      onChange={e => {
                        setPartUserId(e.target.value)
                        // Auto-fill general handicap if available
                        const u = users.find(usr => usr.id === e.target.value)
                        if (u && u.handicap !== null && u.handicap !== undefined) {
                          setPartHandicap(String(u.handicap))
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                      required
                    >
                      <option value="">-- Choose User --</option>
                      {users
                        // Exclude users already participating
                        .filter(u => !competition.participants.some((p: any) => p.userId === u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email} {u.handicap !== null && u.handicap !== undefined ? `(HC: ${u.handicap})` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Player Display Name</label>
                    <input
                      type="text"
                      value={partDummyName}
                      onChange={e => setPartDummyName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Competition Handicap</label>
                  <input
                    type="number"
                    step="0.1"
                    value={partHandicap}
                    onChange={e => setPartHandicap(e.target.value)}
                    placeholder="Defaults to general handicap"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                  />
                </div>

                {isTeamComp && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Assign Team</label>
                    <select
                      value={partTeamId}
                      onChange={e => setPartTeamId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="">-- No Team (Individual) --</option>
                      {competition.teams.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAddingParticipant}
                  className="w-full flex items-center justify-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded text-sm transition-colors disabled:opacity-50"
                >
                  <Plus size={16} />
                  <span>{isAddingParticipant ? "Registering..." : "Add Participant"}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 5: Pairings & Matches */}
        {activeTab === 'pairings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <h3 className="text-lg font-bold">Matches & Pairings</h3>
                <div className="flex items-center space-x-2">
                  <label className="text-xs text-slate-450 font-semibold uppercase tracking-wider">Select Round:</label>
                  <select
                    value={selectedRoundId}
                    onChange={e => {
                      setSelectedRoundId(e.target.value)
                      setSelectedPartIds([])
                    }}
                    className="bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-200 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    {competition.rounds.length === 0 && <option value="">-- No Rounds Exist --</option>}
                    {competition.rounds.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedRoundId ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                  Please create a round in the "Rounds" tab before managing pairings.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs font-semibold text-slate-450 uppercase tracking-widest bg-slate-950 px-4 py-2 rounded-lg border border-slate-900 flex justify-between">
                    <span>Round Course: {selectedRound?.course.name}</span>
                    <span>{selectedRound?.matches?.length || 0} Matches Configured</span>
                  </div>

                  {!selectedRound?.matches || selectedRound.matches.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                      No matches set up for this round. Assign participants into matches/groups on the right.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {selectedRound.matches.map((match: any, index: number) => (
                        <div key={match.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3 relative group">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-200 text-sm">Match #{index + 1}</h4>
                              <span className="inline-block bg-slate-950 text-slate-450 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-850 mt-1 uppercase">
                                Type: {match.type}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteMatch(match.id)}
                              className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded transition-colors"
                              title="Delete Pairing"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border-t border-slate-850/60 pt-3">
                            {match.matchPlayers.map((mp: any) => {
                              // Find this participant in our competition.participants list to get handicap and team
                              const part = competition.participants.find((p: any) => p.id === mp.participantId)
                              const name = part?.userId ? part.user?.name : part?.dummyName
                              const calculated = getPlayerCalculatedAllowance(mp, match, selectedRound, competition.participants)
                              const isOverridden = mp.handicapAllowance !== null && mp.handicapAllowance !== undefined

                              const inputVal = overrideMatchPlayerAllowances[mp.id] !== undefined
                                ? overrideMatchPlayerAllowances[mp.id]
                                : (mp.handicapAllowance !== null ? String(mp.handicapAllowance) : String(calculated))

                              const isDirty = overrideMatchPlayerAllowances[mp.id] !== undefined && overrideMatchPlayerAllowances[mp.id] !== (mp.handicapAllowance !== null ? String(mp.handicapAllowance) : String(calculated))

                              return (
                                <div key={mp.id} className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex justify-between items-center text-xs gap-3">
                                  <div>
                                    <span className="font-bold text-slate-200">{name || "Unknown Player"}</span>
                                    {part?.team && (
                                      <span className="ml-1.5 text-[10px] text-cyan-400 font-bold">[{part.team.name}]</span>
                                    )}
                                    <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-slate-500 font-mono">
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
                                        className={`w-11 bg-slate-900 border rounded px-1.5 py-0.5 text-center text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none ${
                                          isOverridden 
                                            ? 'border-cyan-500 text-cyan-400 bg-cyan-950/40' 
                                            : 'border-slate-700 text-slate-300'
                                        }`}
                                      />
                                      {isDirty && (
                                        <button
                                          type="button"
                                          onClick={() => handleSaveMatchPlayerAllowance(mp.id)}
                                          disabled={savingMatchPlayerAllowance[mp.id]}
                                          className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] rounded transition-colors disabled:opacity-50"
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
                                          className="text-[9px] font-bold text-red-400 hover:text-red-500"
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
                            <div className="flex flex-col space-y-2 pt-3 border-t border-slate-850/60 mt-2 text-xs">
                              <div className="text-[10px] text-slate-500 font-semibold italic">
                                Calculated using {match.allowanceType || "75%"} handicap allowance base difference.
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`playUntilEnd-${match.id}`}
                                  checked={match.playUntilEnd}
                                  onChange={() => handleTogglePlayUntilEnd(match.id, match.playUntilEnd)}
                                  className="w-3.5 h-3.5 rounded text-emerald-500 border-slate-800 bg-slate-900 focus:ring-offset-slate-950 cursor-pointer"
                                />
                                <label htmlFor={`playUntilEnd-${match.id}`} className="text-xs text-slate-450 font-semibold select-none cursor-pointer">
                                  Bis zum Ende spielen (kein vorzeitiges Ende)
                                </label>
                              </div>
                              <div className="flex items-center space-x-2 pt-1">
                                <label className="text-xs text-slate-450 font-semibold">Holes (Löcher):</label>
                                <input
                                  type="text"
                                  value={overrideHoleRanges[match.id] !== undefined ? overrideHoleRanges[match.id] : (match.holeRange ?? "1-18")}
                                  onChange={e => setOverrideHoleRanges(prev => ({ ...prev, [match.id]: e.target.value }))}
                                  placeholder="1-18"
                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-slate-250 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveHoleRange(match.id)}
                                  disabled={savingHoleRange[match.id]}
                                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-[10px] rounded transition-colors"
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
              <form onSubmit={handleAddMatch} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
                <h3 className="text-md font-semibold text-slate-350 uppercase tracking-wider mb-2">Create Match / Group</h3>

                {pairingError && (
                  <div className="bg-red-950/60 border border-red-800 text-red-300 px-3 py-2 rounded text-xs">
                    {pairingError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Match Format</label>
                  <select
                    value={matchType}
                    onChange={e => setMatchType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
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
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Handicap Allowance Calculation</label>
                      <select
                        value={allowanceType}
                        onChange={e => setAllowanceType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
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
                        className="w-3.5 h-3.5 rounded text-emerald-500 border-slate-800 bg-slate-900 focus:ring-offset-slate-955 cursor-pointer"
                      />
                      <label htmlFor="newPlayUntilEnd" className="text-xs text-slate-400 font-semibold select-none cursor-pointer">
                        Bis zum Ende spielen (kein vorzeitiges Ende)
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Hole Range (e.g. 1-18, 1-9, 10-18)</label>
                      <input
                        type="text"
                        value={holeRange}
                        onChange={e => setHoleRange(e.target.value)}
                        placeholder="1-18"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">
                    Assign Players ({selectedPartIds.length} Selected)
                  </label>
                  
                  {competition.participants.length === 0 ? (
                    <p className="text-xs text-slate-550 italic">No registered participants to pair.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-lg p-2 bg-slate-950 space-y-2 divide-y divide-slate-900 scrollbar-thin">
                      {competition.participants.map((p: any) => {
                        const name = p.userId ? p.user?.name : p.dummyName
                        const isChecked = selectedPartIds.includes(p.id)

                        return (
                          <div 
                            key={p.id} 
                            onClick={() => togglePartSelection(p.id)}
                            className={`flex items-center space-x-2 py-1.5 px-2 rounded cursor-pointer select-none text-xs transition-colors ${
                              isChecked 
                                ? 'bg-emerald-950/30 text-emerald-300 font-semibold' 
                                : 'text-slate-400 hover:bg-slate-900/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="w-3.5 h-3.5 rounded text-emerald-500 border-slate-800 bg-slate-900 focus:ring-offset-slate-950"
                            />
                            <div className="flex-1 truncate">
                              <span>{name}</span>
                              {p.team && (
                                <span className="ml-1 text-[9px] text-cyan-500">[{p.team.name}]</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
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
                  className="w-full flex items-center justify-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded text-sm transition-colors disabled:opacity-50"
                >
                  <Plus size={16} />
                  <span>{isCreatingPairing ? "Pairing..." : "Create Pairing"}</span>
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
