"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { 
  X, Filter, Calendar, MapPin, Hash, Award, RefreshCw, ChevronRight, 
  Camera, Mail, Shield, Check, AlertCircle, Trophy, Star, Clock, Edit2
} from "lucide-react"
import { getPlayerRoundHistory, PlayerHistoryRound } from "@/app/actions/playerHistory"
import { 
  getPlayerProfile, 
  updateUserProfile, 
  submitHandicapRequest, 
  reviewHandicapRequest,
  UserProfileData 
} from "@/app/actions/playerProfile"

interface PlayerProfileModalProps {
  player: {
    userId?: string | null
    dummyName?: string | null
    name: string
    stars?: number | null
    competitionId?: string | null
  }
  onClose: () => void
  onOpenScorecard?: (round: any, participant: any, competition: any) => void
}

export function PlayerProfileModal({ player, onClose, onOpenScorecard }: PlayerProfileModalProps) {
  // Profile data state
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileData, setProfileData] = useState<UserProfileData | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Edit Email state
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [emailValue, setEmailValue] = useState("")
  const [isSavingEmail, setIsSavingEmail] = useState(false)

  // Photo upload state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handicap Request state
  const [showHcpRequestModal, setShowHcpRequestModal] = useState(false)
  const [requestedHcp, setRequestedHcp] = useState("")
  const [requestReason, setRequestReason] = useState("")
  const [isSubmittingHcp, setIsSubmittingHcp] = useState(false)
  const [hcpError, setHcpError] = useState<string | null>(null)

  // Admin Review state
  const [isReviewingHcp, setIsReviewingHcp] = useState(false)

  // Rounds History state
  const [roundsLoading, setRoundsLoading] = useState(true)
  const [rounds, setRounds] = useState<PlayerHistoryRound[]>([])
  const [roundsError, setRoundsError] = useState<string | null>(null)

  // Filters state
  const [lastXFilter, setLastXFilter] = useState<string>("All")
  const [periodFilter, setPeriodFilter] = useState<string>("All")
  const [courseFilter, setCourseFilter] = useState<string>("All")
  const [holesFilter, setHolesFilter] = useState<string>("All")

  // Load Profile
  const loadProfile = async () => {
    setProfileLoading(true)
    setProfileError(null)
    const res = await getPlayerProfile({
      userId: player.userId,
      dummyName: player.dummyName,
      competitionId: player.competitionId
    })

    if (res.success && res.data) {
      setProfileData(res.data)
      setEmailValue(res.data.email || "")
      setCanEdit(!!res.canEdit)
      setIsSuperAdmin(!!res.isSuperAdmin)
    } else {
      setProfileError(res.error || "Profil konnte nicht geladen werden.")
    }
    setProfileLoading(false)
  }

  // Load Round History
  const loadHistory = async () => {
    setRoundsLoading(true)
    setRoundsError(null)
    const res = await getPlayerRoundHistory({
      userId: player.userId,
      dummyName: player.dummyName
    })
    if (res.success && res.data) {
      setRounds(res.data)
    } else {
      setRoundsError(res.error || "Rundenhistorie konnte nicht geladen werden.")
    }
    setRoundsLoading(false)
  }

  useEffect(() => {
    loadProfile()
    loadHistory()
  }, [player.userId, player.dummyName])

  // Handle Photo Upload with Portrait Format Validation
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profileData || profileData.id === "dummy") return

    setPhotoError(null)
    setIsUploadingPhoto(true)

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = async () => {
        const { naturalWidth: w, naturalHeight: h } = img

        // Strict Requirement: Portrait-Format (Höhe muss mindestens so groß sein wie Breite)
        if (h < w) {
          setPhotoError("Bitte lade ein Foto im Hochformat (Portrait) hoch (Höhe ≥ Breite).")
          setIsUploadingPhoto(false)
          if (fileInputRef.current) fileInputRef.current.value = ""
          return
        }

        // Compress image using canvas maintaining portrait aspect ratio
        try {
          const maxDim = 800
          let targetW = w
          let targetH = h

          if (h > maxDim) {
            targetW = Math.round((w * maxDim) / h)
            targetH = maxDim
          }

          const canvas = document.createElement("canvas")
          canvas.width = targetW
          canvas.height = targetH
          const ctx = canvas.getContext("2d")

          if (ctx) {
            ctx.drawImage(img, 0, 0, targetW, targetH)
            const compressedBase64 = canvas.toDataURL("image/jpeg", 0.8)

            const updateRes = await updateUserProfile({
              userId: profileData.id,
              image: compressedBase64
            })

            if (updateRes.success) {
              setProfileData(prev => prev ? { ...prev, image: compressedBase64 } : null)
              setActionSuccess("Profilfoto erfolgreich aktualisiert!")
              setTimeout(() => setActionSuccess(null), 3000)
            } else {
              setPhotoError(updateRes.error || "Fehler beim Speichern des Fotos.")
            }
          }
        } catch (err: any) {
          setPhotoError("Fehler bei der Bildkomprimierung.")
        } finally {
          setIsUploadingPhoto(false)
          if (fileInputRef.current) fileInputRef.current.value = ""
        }
      }

      img.onerror = () => {
        setPhotoError("Ungültige Bilddatei.")
        setIsUploadingPhoto(false)
      }

      img.src = event.target?.result as string
    }

    reader.onerror = () => {
      setPhotoError("Fehler beim Lesen der Datei.")
      setIsUploadingPhoto(false)
    }

    reader.readAsDataURL(file)
  }

  // Handle Save Email
  const handleSaveEmail = async () => {
    if (!profileData || profileData.id === "dummy") return
    setIsSavingEmail(true)
    setProfileError(null)

    const res = await updateUserProfile({
      userId: profileData.id,
      email: emailValue
    })

    if (res.success) {
      setProfileData(prev => prev ? { ...prev, email: emailValue.trim().toLowerCase() } : null)
      setIsEditingEmail(false)
      setActionSuccess("E-Mail-Adresse erfolgreich aktualisiert!")
      setTimeout(() => setActionSuccess(null), 3000)
    } else {
      setProfileError(res.error || "Fehler beim Aktualisieren der E-Mail.")
    }
    setIsSavingEmail(false)
  }

  // Handle Submit Handicap Request
  const handleSubmitHandicapRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileData || profileData.id === "dummy") return

    const parsedHcp = parseFloat(requestedHcp.replace(",", "."))
    if (isNaN(parsedHcp)) {
      setHcpError("Bitte ein gültiges Handicap eingeben (z.B. 5.4 oder -2.0).")
      return
    }

    setIsSubmittingHcp(true)
    setHcpError(null)

    const res = await submitHandicapRequest({
      userId: profileData.id,
      requestedHandicap: parsedHcp,
      reason: requestReason,
      competitionId: player.competitionId || undefined
    })

    if (res.success) {
      setShowHcpRequestModal(false)
      setRequestedHcp("")
      setRequestReason("")
      setActionSuccess("Handicap-Änderungsantrag erfolgreich eingereicht! Die Spielleitung wurde informiert.")
      setTimeout(() => setActionSuccess(null), 4000)
      loadProfile()
    } else {
      setHcpError(res.error || "Fehler beim Einreichen des Antrags.")
    }
    setIsSubmittingHcp(false)
  }

  // Handle Admin Review of Handicap Request
  const handleReviewHcp = async (action: "APPROVE" | "REJECT") => {
    if (!profileData?.pendingHandicapRequest) return
    setIsReviewingHcp(true)

    const res = await reviewHandicapRequest({
      requestId: profileData.pendingHandicapRequest.id,
      action,
      applyToFutureCompetitions: true
    })

    if (res.success) {
      setActionSuccess(action === "APPROVE" ? "Handicap-Änderung genehmigt!" : "Antrag abgelehnt.")
      setTimeout(() => setActionSuccess(null), 3000)
      loadProfile()
    } else {
      setProfileError(res.error || "Fehler beim Bearbeiten des Antrags.")
    }
    setIsReviewingHcp(false)
  }

  // Courses for filter
  const availableCourses = useMemo(() => {
    const courseSet = new Set<string>()
    rounds.forEach(r => {
      if (r.courseName) courseSet.add(r.courseName)
    })
    return Array.from(courseSet).sort()
  }, [rounds])

  // Filtered rounds logic
  const filteredRounds = useMemo(() => {
    let result = [...rounds]

    if (periodFilter !== "All") {
      const now = new Date()
      let cutoff = new Date(0)
      if (periodFilter === "Last month") {
        cutoff = new Date(now.setMonth(now.getMonth() - 1))
      } else if (periodFilter === "Last 3 months") {
        cutoff = new Date(now.setMonth(now.getMonth() - 3))
      } else if (periodFilter === "Last Year") {
        cutoff = new Date(now.setFullYear(now.getFullYear() - 1))
      }
      result = result.filter(r => new Date(r.date) >= cutoff)
    }

    if (courseFilter !== "All") {
      result = result.filter(r => r.courseName === courseFilter)
    }

    if (holesFilter !== "All") {
      if (holesFilter === "9") {
        result = result.filter(r => r.holesPlayedCount === 9)
      } else if (holesFilter === "9 or more") {
        result = result.filter(r => r.holesPlayedCount >= 9)
      } else if (holesFilter === "18") {
        result = result.filter(r => r.holesPlayedCount === 18)
      } else if (holesFilter === "less than 9") {
        result = result.filter(r => r.holesPlayedCount < 9)
      }
    }

    if (lastXFilter !== "All") {
      const limit = parseInt(lastXFilter, 10)
      if (!isNaN(limit)) {
        result = result.slice(0, limit)
      }
    }

    return result
  }, [rounds, periodFilter, courseFilter, holesFilter, lastXFilter])

  // Stars badge: ONLY shown when viewing in a competition where badges/stars are enabled (e.g. TRRC)
  const currentComp = profileData?.activeCompetitions?.find(c => String(c.id) === String(player.competitionId))
  const isBadgeCompetition = player.stars !== undefined && player.stars !== null 
    ? true 
    : Boolean(currentComp?.hasBadges)

  const starsCount = isBadgeCompetition 
    ? (player.stars !== undefined && player.stars !== null ? player.stars : (currentComp?.stars ?? null))
    : null

  const showStars = isBadgeCompetition && starsCount !== null && starsCount !== undefined

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[80] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Spielerprofil
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {profileData?.name || player.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Alerts */}
        {canEdit && <Link href="/profile" className="block border-b border-slate-200 px-5 py-3 text-sm font-semibold text-emerald-700">Mein eigenes Profil mit Foto und Passwort verwalten →</Link>}
        {actionSuccess && (
          <div className="bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 flex items-center space-x-2 shadow-sm animate-in fade-in">
            <Check size={16} />
            <span>{actionSuccess}</span>
          </div>
        )}
        {profileError && (
          <div className="bg-red-500 text-white text-xs font-semibold px-4 py-2.5 flex items-center space-x-2 shadow-sm animate-in fade-in">
            <AlertCircle size={16} />
            <span>{profileError}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          
          {/* TOP PROFILE CARD */}
          <div className="p-5 sm:p-6 bg-gradient-to-br from-slate-50 via-white to-slate-100/60 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              
              {/* Portrait with stars straddling the upper photo edge */}
              <div className="relative group shrink-0">
                
                {showStars && (
                  <div aria-label={`${starsCount} Sterne`} className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-0.5 text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {starsCount > 0 ? (
                      Array.from({ length: starsCount }).map((_, i) => (
                        <Star key={i} size={24} className="shrink-0 fill-amber-300/90 stroke-amber-100/90" />
                      ))
                    ) : (
                      <span className="text-xl font-black uppercase tracking-wider whitespace-nowrap">0 ★</span>
                    )}
                  </div>
                )}

                {/* Portrait Image Container (Sensible, uniform size: 112px x 144px -> 3:4 portrait) */}
                <div className="w-28 h-36 rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-md relative flex items-center justify-center">
                  {profileData?.image ? (
                    <img
                      src={profileData.image}
                      alt={profileData.name || "Spielerfoto"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-200/50">
                      <Camera size={32} className="opacity-40 mb-1" />
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Portrait</span>
                    </div>
                  )}

                  {/* Upload Overlay if CanEdit */}
                  {canEdit && profileData?.id !== "dummy" && (
                    <label 
                      className="absolute inset-0 bg-slate-950/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-2 text-center"
                      title="Neues Portrait-Foto hochladen (Format: Hochformat)"
                    >
                      <Camera size={20} className="mb-1 text-emerald-400" />
                      <span className="text-[9px] font-bold leading-tight">Foto ändern (Portrait)</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}

                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white p-2">
                      <RefreshCw size={20} className="animate-spin text-emerald-400 mb-1" />
                      <span className="text-[9px] font-bold">Wird geladen...</span>
                    </div>
                  )}
                </div>

                {photoError && (
                  <p className="text-[10px] text-red-600 font-semibold mt-1 max-w-[120px] text-center leading-tight">
                    {photoError}
                  </p>
                )}
              </div>

              {/* Player Details & Actions */}
              <div className="flex-1 w-full space-y-3.5 text-center sm:text-left">
                
                {/* Name & Role */}
                <div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      {profileData?.name || player.name}
                    </h2>
                    {profileData?.role === "SUPER_ADMIN" && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                        <Shield size={10} /> Superadmin
                      </span>
                    )}
                    {profileData?.role === "ADMIN" && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                        <Shield size={10} /> Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    {canEdit ? "Dein Spielerprofil" : "Öffentliches Spielerprofil"}
                  </p>
                </div>

                {/* Email (Editable for CanEdit) */}
                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs">
                  <Mail size={13} className="text-slate-400 shrink-0" />
                  {isEditingEmail ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="email"
                        value={emailValue}
                        onChange={e => setEmailValue(e.target.value)}
                        placeholder="neue@email.com"
                        className="px-2 py-1 text-xs border border-emerald-500 rounded-lg bg-white text-slate-900 focus:outline-none ring-2 ring-emerald-500/20"
                      />
                      <button
                        onClick={handleSaveEmail}
                        disabled={isSavingEmail}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {isSavingEmail ? "..." : "Speichern"}
                      </button>
                      <button
                        onClick={() => { setIsEditingEmail(false); setEmailValue(profileData?.email || "") }}
                        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] cursor-pointer"
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 font-medium font-mono text-[11px]">
                        {profileData?.email || "Keine E-Mail hinterlegt"}
                      </span>
                      {canEdit && profileData?.id !== "dummy" && (
                        <button
                          onClick={() => setIsEditingEmail(true)}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded transition-colors cursor-pointer"
                          title="E-Mail-Adresse bearbeiten"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Handicap Block with Request Workflow */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Handicap:</span>
                    <span className="text-sm font-black font-mono text-emerald-600">
                      {profileData?.handicap !== null && profileData?.handicap !== undefined 
                        ? profileData.handicap.toFixed(1) 
                        : "–"}
                    </span>
                  </div>

                  {/* Pending Request Indicator */}
                  {profileData?.pendingHandicapRequest ? (
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-semibold">
                      <Clock size={13} className="text-amber-600 animate-spin" />
                      <span>
                        Beantragt: <strong>{profileData.pendingHandicapRequest.requestedHandicap.toFixed(1)}</strong> (In Prüfung)
                      </span>

                      {/* Admin Quick Review inside profile */}
                      {(isSuperAdmin || canEdit) && (
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handleReviewHcp("APPROVE")}
                            disabled={isReviewingHcp}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
                            title="Antrag genehmigen"
                          >
                            Genehmigen
                          </button>
                          <button
                            onClick={() => handleReviewHcp("REJECT")}
                            disabled={isReviewingHcp}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                            title="Antrag ablehnen"
                          >
                            Ablehnen
                          </button>
                        </div>
                      )}
                    </div>
                  ) : canEdit && profileData?.id !== "dummy" ? (
                    <button
                      onClick={() => setShowHcpRequestModal(true)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      Handicap-Änderung beantragen
                    </button>
                  ) : null}
                </div>

                {/* Active & Upcoming Competitions */}
                {profileData?.activeCompetitions && profileData.activeCompetitions.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 text-center sm:text-left">
                      Aktive & Zukünftige Wettbewerbe
                    </span>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      {profileData.activeCompetitions.map(comp => (
                        <a
                          key={comp.id}
                          href={`/?comp=${comp.uniqueSlug}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 hover:text-emerald-700 rounded-lg text-xs font-semibold transition-all shadow-2xs group"
                          title="Zu diesem Turnier wechseln"
                        >
                          <Trophy size={11} className="text-amber-500" />
                          <span>{comp.name}</span>
                          {comp.teamName && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                              {comp.teamName}
                            </span>
                          )}
                          <ChevronRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* HANDICAP REQUEST MODAL DIALOG */}
          {showHcpRequestModal && (
            <div className="p-4 bg-emerald-950/10 border-b border-emerald-200 animate-in fade-in">
              <form onSubmit={handleSubmitHandicapRequest} className="bg-white p-4 rounded-xl border border-emerald-300 shadow-md max-w-lg mx-auto space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <Award size={15} className="text-emerald-600" />
                    Handicap-Änderung beantragen
                  </h4>
                  <button 
                    type="button" 
                    onClick={() => setShowHcpRequestModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Der Antrag wird an die Spielleitung deiner Wettbewerbe weitergeleitet. 
                  <strong> Wichtig:</strong> Eine Handicap-Änderung verändert niemals rückwirkend vergangene Ergebnisse, sondern nur künftige Spielvorgaben.
                </p>

                {hcpError && (
                  <p className="text-xs text-red-600 font-bold">{hcpError}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Neues Handicap *</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={requestedHcp}
                      onChange={e => setRequestedHcp(e.target.value)}
                      placeholder="z.B. 5.4"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Begründung (optional)</label>
                    <input
                      type="text"
                      value={requestReason}
                      onChange={e => setRequestReason(e.target.value)}
                      placeholder="z.B. Turnierergebnis GC Eichenheim"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowHcpRequestModal(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingHcp}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingHcp ? "Wird gesendet..." : "Antrag absenden"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ROUNDS FILTER BAR */}
          <div className="bg-slate-100/70 p-4 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Last X Filter */}
            <div>
              <label className="font-bold text-slate-600 block mb-1 flex items-center space-x-1">
                <Hash size={12} className="text-slate-400" />
                <span>Letzte X</span>
              </label>
              <select
                value={lastXFilter}
                onChange={e => setLastXFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="All">Alle</option>
                <option value="50">50</option>
                <option value="20">20</option>
                <option value="10">10</option>
                <option value="5">5</option>
              </select>
            </div>

            {/* Period Filter */}
            <div>
              <label className="font-bold text-slate-600 block mb-1 flex items-center space-x-1">
                <Calendar size={12} className="text-slate-400" />
                <span>Zeitraum</span>
              </label>
              <select
                value={periodFilter}
                onChange={e => setPeriodFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="All">Alle</option>
                <option value="Last month">Letzter Monat</option>
                <option value="Last 3 months">Letzte 3 Monate</option>
                <option value="Last Year">Letztes Jahr</option>
              </select>
            </div>

            {/* Golf Course Filter */}
            <div>
              <label className="font-bold text-slate-600 block mb-1 flex items-center space-x-1">
                <MapPin size={12} className="text-slate-400" />
                <span>Golfplatz</span>
              </label>
              <select
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 truncate"
              >
                <option value="All">Alle Plätze</option>
                {availableCourses.map((cName, idx) => (
                  <option key={idx} value={cName}>{cName}</option>
                ))}
              </select>
            </div>

            {/* Holes Played Filter */}
            <div>
              <label className="font-bold text-slate-600 block mb-1 flex items-center space-x-1">
                <Filter size={12} className="text-slate-400" />
                <span>Gespielte Löcher</span>
              </label>
              <select
                value={holesFilter}
                onChange={e => setHolesFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="All">Alle</option>
                <option value="9">9 Löcher</option>
                <option value="9 or more">9 oder mehr</option>
                <option value="18">18 Löcher</option>
                <option value="less than 9">weniger als 9</option>
              </select>
            </div>
          </div>

          {/* RECENT ROUNDS TABLE */}
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span>Kürzlich gespielte Runden</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  {filteredRounds.length}
                </span>
              </h3>
            </div>

            {roundsLoading ? (
              <div className="py-12 text-center text-slate-500 space-y-3">
                <RefreshCw size={24} className="animate-spin mx-auto text-emerald-600" />
                <p className="text-xs font-semibold">Lade Rundenhistorie...</p>
              </div>
            ) : roundsError ? (
              <div className="py-8 text-center text-red-600 bg-red-50 rounded-xl border border-red-200 p-4 text-xs font-semibold">
                {roundsError}
              </div>
            ) : filteredRounds.length === 0 ? (
              <div className="py-12 text-center text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-1">
                <p className="font-bold text-sm text-slate-700">Keine Runden gefunden</p>
                <p className="text-xs">Es wurden keine gespielten Runden für die gewählten Kriterien gefunden.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs bg-white">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Datum</th>
                      <th className="px-3.5 py-2.5">Platz & Wettbewerb</th>
                      <th className="px-3.5 py-2.5 text-center">Löcher</th>
                      <th className="px-3.5 py-2.5 text-center">Bruttopunkte</th>
                      <th className="px-3.5 py-2.5 text-center">Nettopunkte</th>
                      <th className="px-3.5 py-2.5 text-center">Schlagzahl</th>
                      <th className="px-2 py-2.5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {filteredRounds.map((r, idx) => {
                      const grossColor = r.grossRelToPar < 0 ? "text-emerald-600 font-black" : r.grossRelToPar > 0 ? "text-slate-700 font-extrabold" : "text-slate-800 font-bold"
                      const netColor = r.netRelToPar < 0 ? "text-emerald-600 font-black" : r.netRelToPar > 0 ? "text-slate-700 font-extrabold" : "text-slate-800 font-bold"

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-3 font-semibold text-slate-700 whitespace-nowrap">
                            {r.dateFormatted}
                          </td>
                          <td className="px-3.5 py-3 max-w-[220px]">
                            <div className="font-bold text-slate-900 truncate">{r.courseName}</div>
                            <div className="text-[10px] text-slate-500 truncate">{r.competitionName}</div>
                          </td>
                          <td className="px-3.5 py-3 text-center font-mono font-medium text-slate-600">
                            {r.holesPlayedText}
                          </td>

                          {/* Interactive Bruttopunkte */}
                          <td className="px-3.5 py-3 text-center">
                            <button
                              onClick={() => onOpenScorecard?.(r.round, r.participant, r.competition)}
                              disabled={!onOpenScorecard}
                              className={`px-2.5 py-1 rounded-lg border border-slate-200 transition-colors font-mono ${grossColor} ${
                                onOpenScorecard ? "hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer" : "cursor-default"
                              }`}
                              title={`Brutto Stableford: ${r.grossStablefordPoints} Pkt (${r.grossRelToParFormatted}).${onOpenScorecard ? " Klick für Scorekarte." : ""}`}
                            >
                              {r.grossStablefordPoints} <span className="text-[10px] opacity-75">({r.grossRelToParFormatted})</span>
                            </button>
                          </td>

                          {/* Interactive Nettopunkte */}
                          <td className="px-3.5 py-3 text-center">
                            <button
                              onClick={() => onOpenScorecard?.(r.round, r.participant, r.competition)}
                              disabled={!onOpenScorecard}
                              className={`px-2.5 py-1 rounded-lg border border-slate-200 transition-colors font-mono ${netColor} ${
                                onOpenScorecard ? "hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer" : "cursor-default"
                              }`}
                              title={`Netto Stableford: ${r.netStablefordPoints} Pkt (${r.netRelToParFormatted}).${onOpenScorecard ? " Klick für Scorekarte." : ""}`}
                            >
                              {r.netStablefordPoints} <span className="text-[10px] opacity-75">({r.netRelToParFormatted})</span>
                            </button>
                          </td>

                          {/* Interactive Schlagzahl */}
                          <td className="px-3.5 py-3 text-center">
                            <button
                              onClick={() => onOpenScorecard?.(r.round, r.participant, r.competition)}
                              disabled={!onOpenScorecard}
                              className={`px-2.5 py-1 rounded-lg border font-mono font-bold transition-colors ${
                                onOpenScorecard 
                                  ? "border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-900 cursor-pointer" 
                                  : "border-slate-100 text-slate-700 cursor-default"
                              }`}
                              title={onOpenScorecard ? "Klick für detaillierte Scorekarte" : undefined}
                            >
                              {r.totalStrokes}
                              {r.hasWipedHoles && <span className="text-[10px] text-red-500 font-extrabold ml-1" title="Enthält gestrichenes Loch">*</span>}
                            </button>
                          </td>

                          <td className="px-2 py-3 text-right">
                            {onOpenScorecard && (
                              <button
                                onClick={() => onOpenScorecard(r.round, r.participant, r.competition)}
                                className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Scorekarte öffnen"
                              >
                                <ChevronRight size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// Backwards-compatibility export for PlayerHistoryModal
export const PlayerHistoryModal = PlayerProfileModal
