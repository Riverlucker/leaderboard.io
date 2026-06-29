"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft, Save, Plus, Trash2, Calendar, 
  Settings, Layers, Users, Users2, ShieldAlert 
} from "lucide-react"
import { 
  updateCompetitionGeneral, 
  addRound, deleteRound, 
  addTeam, deleteTeam, 
  addParticipant, deleteParticipant, 
  addMatch, deleteMatch 
} from "../actions"

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

  // General Settings Form state
  const [name, setName] = useState(competition.name)
  const [uniqueSlug, setUniqueSlug] = useState(competition.uniqueSlug)
  const [type, setType] = useState(competition.type)
  const [isTeamComp, setIsTeamComp] = useState(competition.isTeamComp)
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
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([])
  const [pairingError, setPairingError] = useState("")
  const [isCreatingPairing, setIsCreatingPairing] = useState(false)

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
        startDate: startDate || null,
        endDate: endDate || null,
        cssConfig: cssConfig || null,
        bgImage: bgImage || null
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
      await addRound(competition.id, {
        name: roundName,
        courseId: roundCourseId,
        startDate: roundStart || null,
        endDate: roundEnd || null
      })
      setRoundName("")
      setRoundStart("")
      setRoundEnd("")
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
        participantIds: selectedPartIds
      })

      setSelectedPartIds([])
      router.refresh()
    } catch (err: any) {
      setPairingError(err.message || "Failed to create match.")
    } finally {
      setIsCreatingPairing(false)
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
                    <label className="block text-sm text-slate-400 mb-2">Background Image URL (Optional)</label>
                    <input 
                      value={bgImage} 
                      onChange={e => setBgImage(e.target.value)} 
                      placeholder="https://example.com/golf-course.jpg"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-300 focus:ring-2 focus:ring-emerald-500" 
                    />
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
                </div>

                <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
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
                  {competition.rounds.map((round: any) => (
                    <div key={round.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-200 text-lg">{round.name}</h4>
                        <p className="text-sm text-emerald-400 font-medium">Course: {round.course.name}</p>
                        {round.startDate && (
                          <p className="text-xs text-slate-500 font-mono">
                            Starts: {new Date(round.startDate).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteRound(round.id)}
                        className="p-2 bg-slate-950 border border-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                        title="Delete Round"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
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
                  {competition.teams.map((team: any) => {
                    const membersCount = competition.participants.filter((p: any) => p.teamId === team.id).length

                    return (
                      <div key={team.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-200 text-base">{team.name}</h4>
                          <p className="text-xs text-slate-500 mt-1">{membersCount} Assigned Players</p>
                        </div>
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="p-2 bg-slate-950 border border-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
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
                        {isTeamComp && <th className="px-4 py-3">Team</th>
                        }
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

                              return (
                                <div key={mp.id} className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 flex justify-between items-center text-xs">
                                  <div>
                                    <span className="font-semibold text-slate-300">{name || "Unknown Player"}</span>
                                    {part?.team && (
                                      <span className="ml-2 text-[10px] text-cyan-400">({part.team.name})</span>
                                    )}
                                  </div>
                                  <span className="font-bold text-cyan-500 font-mono">
                                    HC: {part?.compHandicap !== null && part?.compHandicap !== undefined ? part.compHandicap.toFixed(1) : "-"}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
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
                    <option value="4BALL">FOURBALL (2 vs 2 Best Ball)</option>
                    <option value="CHAPMAN">CHAPMAN (Chapman-System)</option>
                    <option value="GROUP">STANDARD GROUP (Strokeplay / Stableford)</option>
                  </select>
                </div>

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
