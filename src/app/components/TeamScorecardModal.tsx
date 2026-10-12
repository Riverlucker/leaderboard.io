"use client"

import React from "react"
import { X, Share2, CheckCircle, RefreshCw } from "lucide-react"
import { getHandicapStrokesOnHole, calculateStablefordPoints, getRoundHoleInfo } from "@/lib/scoring"
import { getPlayingHandicap, getCompactName } from "../CompetitionClientView"

interface TeamScorecardModalProps {
  selectedTeamForScorecard: any
  competition: any
  selectedLeaderboardType?: string
  onClose: () => void
  onShare?: () => void
  shareCopied?: boolean
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function TeamScorecardModal({
  selectedTeamForScorecard,
  competition,
  selectedLeaderboardType,
  onClose,
  onShare,
  shareCopied,
  onRefresh,
  isRefreshing
}: TeamScorecardModalProps) {
  const currentTeam = competition?.teams?.find((t: any) => t.id === selectedTeamForScorecard?.id) || selectedTeamForScorecard
  const is4Ball2BestBall = selectedLeaderboardType === 'FOUR_BALL_TWO_BEST_BALL'

  const teamMembers = competition.participants.filter((p: any) => 
    currentTeam?.id ? p.teamId === currentTeam.id : true
  )

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl space-y-4 overflow-hidden max-h-[92vh] flex flex-col text-slate-800">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                {currentTeam?.name || "Team"}
              </h3>
              {is4Ball2BestBall && (
                <span className="text-[10px] sm:text-xs font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  4 Ball 2 Best Ball Netto
                </span>
              )}
            </div>
            <p className="text-xs text-slate-550 mt-0.5">
              Spieler: {teamMembers.map((p: any) => p.userId ? (p.user?.name || p.user?.email) : p.dummyName).join(", ")}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {onShare && (
              <button
                onClick={onShare}
                className="p-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors shadow-sm focus:outline-none cursor-pointer"
                title="Copy Scorecard Share Link"
              >
                {shareCopied ? (
                  <CheckCircle size={16} className="text-emerald-600 animate-pulse" />
                ) : (
                  <Share2 size={16} />
                )}
              </button>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors shadow-sm focus:outline-none cursor-pointer"
                title="Scorekarte aktualisieren"
              >
                <RefreshCw size={16} className={isRefreshing ? "animate-spin text-emerald-600" : ""} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-sm focus:outline-none cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-8 scrollbar-thin">
          {competition.rounds.map((round: any, roundIdx: number) => {
            // In Peninsula Challenge, round 1 was individual only
            const isPeninsulaR1 = competition.uniqueSlug === 'peninsula-challenge' && round.name?.toLowerCase().includes('sonntag')
            if (is4Ball2BestBall && isPeninsulaR1) {
              return (
                <div key={round.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                  <span><strong>{round.name}:</strong> Nicht Teil der Team-Wertung (nur Runden 2-4).</span>
                  <span className="font-mono text-slate-400">Runde 1</span>
                </div>
              )
            }

            const members = [...teamMembers].sort((a: any, b: any) => {
              const aHcp = a.manualRoundHandicaps?.find((m: any) => m.roundId === round.id)?.teamHandicapValue ?? 0
              const bHcp = b.manualRoundHandicaps?.find((m: any) => m.roundId === round.id)?.teamHandicapValue ?? 0
              return aHcp - bHcp
            })

            if (members.length === 0) return null

            const frontHoleNums = Array.from({ length: 9 }, (_, i) => i + 1)
            const backHoleNums = Array.from({ length: 9 }, (_, i) => i + 10)

            const activeRoundHoles = round.holesPlayed && round.holesPlayed.length > 0
              ? round.holesPlayed
              : Array.from({ length: 18 }, (_, i) => i + 1)

            const frontHolesPlayed = frontHoleNums.filter(num => activeRoundHoles.includes(num))
            const backHolesPlayed = backHoleNums.filter(num => activeRoundHoles.includes(num))

            const renderTeamHoleColumns = (holeNums: number[]) => {
              if (holeNums.length === 0) return null

              const sumPar = holeNums.reduce((sum, num) => {
                const hole = round.course.holes.find((h: any) => h.number === num)
                return sum + (hole?.par || 4)
              }, 0)

              // Compute stats for each member
              const mStats = members.map((m: any) => {
                let totalStrokes = 0
                let totalPoints = 0
                
                let courseHandicap = 0
                if (is4Ball2BestBall) {
                  const manualRec = m.manualRoundHandicaps?.find((mr: any) => mr.roundId === round.id)
                  if (manualRec?.teamHandicapValue !== null && manualRec?.teamHandicapValue !== undefined) {
                    courseHandicap = manualRec.teamHandicapValue
                  } else if (m.user?.name?.toLowerCase().includes('lee')) {
                    courseHandicap = 0
                  } else {
                    courseHandicap = Math.round(getPlayingHandicap(m, round) * 0.85)
                  }
                } else {
                  courseHandicap = getPlayingHandicap(m, round)
                }
                
                const list = holeNums.map(num => {
                  const adjusted = getRoundHoleInfo(round, num)
                  const hole = round.course.holes.find((h: any) => h.number === num)
                  if (!hole) return { displayVal: "-", diff: 0, pts: 0, net: null, hcpStrokes: 0, isWiped: false, gross: null }

                  const holePar = adjusted ? adjusted.par : hole.par
                  const holeStrokeIndex = adjusted ? adjusted.strokeIndex : hole.strokeIndex
                  const hcpStrokes = getHandicapStrokesOnHole(courseHandicap, holeStrokeIndex)

                  const score = m.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)

                  let displayVal = "-"
                  let diff = 0
                  let pts = 0
                  let net: number | null = null
                  let isWiped = false
                  let gross: number | null = null

                  if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
                    if (score.status === 'WIPED') {
                      displayVal = "/"
                      isWiped = true
                      totalStrokes += holePar + 3
                    } else if (score.grossStrokes !== null) {
                      displayVal = String(score.grossStrokes)
                      gross = score.grossStrokes
                      totalStrokes += score.grossStrokes
                      diff = score.grossStrokes - holePar
                      net = Math.max(0, score.grossStrokes - hcpStrokes)
                      const pStableford = calculateStablefordPoints(score.grossStrokes, holePar, hcpStrokes, true)
                      if (pStableford !== null) pts = pStableford
                    }
                  }

                  totalPoints += pts
                  return { displayVal, diff, pts, net, hcpStrokes, isWiped, gross, score }
                })

                return { list, totalStrokes, totalPoints, courseHandicap }
              })

              // For 4 Ball 2 Best Ball Netto: determine which 2 scores counted per hole
              const holeBest2 = holeNums.map((num, i) => {
                const validList = mStats
                  .map((ms, pIdx) => ({ pIdx, ...ms.list[i] }))
                  .filter(item => item.net !== null)
                  .sort((a, b) => (a.net as number) - (b.net as number))

                const countingPIndices = new Set<number>()
                let teamHoleNet = 0
                if (validList.length >= 2) {
                  countingPIndices.add(validList[0].pIdx)
                  countingPIndices.add(validList[1].pIdx)
                  teamHoleNet = (validList[0].net as number) + (validList[1].net as number)
                } else if (validList.length === 1) {
                  countingPIndices.add(validList[0].pIdx)
                  const hole = round.course.holes.find((h: any) => h.number === num)
                  teamHoleNet = (validList[0].net as number) + ((hole?.par || 4) + 3)
                }

                const hole = round.course.holes.find((h: any) => h.number === num)
                const holePar = hole?.par || 4
                const teamHolePar = holePar * 2
                const rel = teamHoleNet - teamHolePar

                return {
                  countingPIndices,
                  teamHoleNet,
                  teamHolePar,
                  rel,
                  hasScore: validList.length > 0
                }
              })

              const sectionTeamNet = holeBest2.reduce((sum, h) => sum + h.teamHoleNet, 0)
              const sectionTeamPar = holeBest2.reduce((sum, h) => sum + h.teamHolePar, 0)
              const sectionRel = sectionTeamNet - sectionTeamPar

              return (
                <div className="overflow-x-auto border border-slate-200 rounded-xl w-full shadow-sm">
                  <table className="w-full text-[10px] text-center border-collapse">
                    <thead className="bg-slate-50 text-slate-650">
                      <tr className="border-b border-slate-200">
                        <th className="px-2 py-1.5 text-left font-extrabold border-r border-slate-200 w-28 text-[10px] bg-slate-100/50 text-slate-850">Loch</th>
                        {holeNums.map(num => (
                          <th key={num} className="px-1 py-1 border-r border-slate-200/80 font-black w-8 md:w-10 text-[10px] text-slate-700">
                            {num}
                          </th>
                        ))}
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
                    </thead>
                    <tbody className="bg-white text-slate-800">
                      {members.map((p: any, pIdx: number) => {
                        const ms = mStats[pIdx]
                        const name = p.userId ? (p.user?.name || p.user?.email) : p.dummyName
                        const compact = getCompactName(name || "", members.map((x: any) => x.userId ? (x.user?.name || x.user?.email) : x.dummyName).filter(Boolean))

                        return (
                          <React.Fragment key={p.id}>
                            <tr className="bg-slate-50/40 text-[9px] text-slate-555 border-t border-slate-100">
                              <td className="px-2 py-1 text-left border-r border-slate-200 font-medium">
                                {compact} (Vorgabe {ms.courseHandicap})
                              </td>
                              {holeNums.map((num, i) => {
                                const hcpStrokes = ms.list[i].hcpStrokes
                                return (
                                  <td key={num} className="px-1 py-0.5 border-r border-slate-200/80 font-bold text-cyan-600 font-mono">
                                    {hcpStrokes === 1 ? "•" : hcpStrokes >= 2 ? "••" : ""}
                                  </td>
                                )
                              })}
                              <td className="px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-600">{ms.courseHandicap}</td>
                            </tr>

                            <tr className="border-b border-slate-100">
                              <td className="px-2 py-1.5 text-left font-bold text-slate-700 border-r border-slate-200 text-[10px]">
                                {compact} {is4Ball2BestBall ? '(Schläge / Netto)' : '(Schläge)'}
                              </td>
                              {holeNums.map((num, i) => {
                                const { displayVal, isWiped, net } = ms.list[i]
                                const isCounting = is4Ball2BestBall && holeBest2[i].countingPIndices.has(pIdx)

                                return (
                                  <td 
                                    key={num} 
                                    className={`px-1 py-1 border-r border-slate-200/85 font-mono text-[10px] ${
                                      isCounting ? 'bg-emerald-50 text-emerald-800 font-black' : 'text-slate-600'
                                    }`}
                                  >
                                    <div className="flex flex-col items-center justify-center leading-tight">
                                      <span className={isWiped ? 'text-red-500 font-black' : ''}>{displayVal}</span>
                                      {is4Ball2BestBall && net !== null && (
                                        <span className={`text-[8px] font-bold ${isCounting ? 'text-emerald-700' : 'text-slate-400'}`}>
                                          (N:{net})
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )
                              })}
                              <td className="px-1.5 py-1.5 font-extrabold text-[10px] bg-slate-50/50">{ms.totalStrokes}</td>
                            </tr>
                          </React.Fragment>
                        )
                      })}

                      {is4Ball2BestBall ? (
                        <>
                          {/* Team Net row */}
                          <tr className="bg-emerald-50/60 text-emerald-950 font-bold border-t-2 border-emerald-300">
                            <td className="px-2 py-1.5 text-left border-r border-slate-200 text-[10px] text-emerald-900 font-extrabold">
                              Team Netto (2 Best)
                            </td>
                            {holeNums.map((num, i) => (
                              <td key={num} className="px-1 py-1.5 border-r border-slate-200/80 font-mono text-[11px] text-emerald-800 font-black">
                                {holeBest2[i].teamHoleNet}
                              </td>
                            ))}
                            <td className="px-1.5 py-1.5 font-mono font-black text-[11px] text-emerald-900 bg-emerald-100">
                              {sectionTeamNet}
                            </td>
                          </tr>

                          {/* 2x Par row */}
                          <tr className="bg-slate-100 text-slate-700 font-medium border-t border-slate-200 text-[9px]">
                            <td className="px-2 py-1 text-left border-r border-slate-200 font-semibold">
                              Netto Par (2x Par)
                            </td>
                            {holeNums.map((num, i) => (
                              <td key={num} className="px-1 py-0.5 border-r border-slate-200/80 font-mono text-slate-500">
                                {holeBest2[i].teamHolePar}
                              </td>
                            ))}
                            <td className="px-1.5 py-1 font-mono font-bold text-slate-600 bg-slate-200/60">
                              {sectionTeamPar}
                            </td>
                          </tr>

                          {/* Relative to Par */}
                          <tr className="bg-emerald-100/70 text-emerald-950 font-black border-t border-emerald-300 text-[10px]">
                            <td className="px-2 py-1.5 text-left border-r border-slate-200 font-extrabold text-emerald-950">
                              Relativ zu Par
                            </td>
                            {holeNums.map((num, i) => {
                              const r = holeBest2[i].rel
                              const str = r === 0 ? "E" : (r > 0 ? `+${r}` : String(r))
                              const clr = r < 0 ? "text-emerald-700" : (r > 0 ? "text-red-700" : "text-slate-600")
                              return (
                                <td key={num} className={`px-1 py-1 border-r border-slate-200/80 font-mono font-black ${clr}`}>
                                  {str}
                                </td>
                              )
                            })}
                            <td className={`px-1.5 py-1.5 font-mono font-black text-[11px] ${sectionRel < 0 ? 'text-emerald-700' : (sectionRel > 0 ? 'text-red-700' : 'text-slate-700')} bg-emerald-200/70`}>
                              {sectionRel === 0 ? "E" : (sectionRel > 0 ? `+${sectionRel}` : String(sectionRel))}
                            </td>
                          </tr>
                        </>
                      ) : (
                        <tr className="bg-emerald-50/50 text-emerald-950 font-bold border-t border-slate-300">
                          <td className="px-2 py-1.5 text-left border-r border-slate-200 text-[10px] text-emerald-900 font-extrabold">
                            Team Bestball
                          </td>
                          {holeNums.map((num, i) => {
                            const pts = Math.max(...mStats.map((ms: any) => ms.list[i].pts), 0)
                            return (
                              <td key={num} className="px-1 py-1.5 border-r border-slate-200/80 font-mono text-[11px] text-emerald-700 font-black">
                                {pts}
                              </td>
                            )
                          })}
                          <td className="px-1.5 py-1.5 font-mono font-black text-[11px] text-emerald-800 bg-emerald-100/50">
                            {holeNums.reduce((sum, num, i) => sum + Math.max(...mStats.map((ms: any) => ms.list[i].pts), 0), 0)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            }

            return (
              <div key={round.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-800">
                    Runde {roundIdx + 1}: {round.name} ({round.course.name})
                  </h4>
                </div>
                {frontHolesPlayed.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-extrabold text-xs text-slate-550 uppercase tracking-wider">Front 9</h5>
                    {renderTeamHoleColumns(frontHolesPlayed)}
                  </div>
                )}
                {backHolesPlayed.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-extrabold text-xs text-slate-550 uppercase tracking-wider">Back 9</h5>
                    {renderTeamHoleColumns(backHolesPlayed)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
