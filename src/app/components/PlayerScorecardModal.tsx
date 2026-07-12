"use client"

import React from "react"
import { X } from "lucide-react"
import { getHandicapStrokesOnHole, calculateStablefordPoints, getRoundHoleInfo } from "@/lib/scoring"
import { getPlayingHandicap } from "../CompetitionClientView"

interface PlayerScorecardModalProps {
  selectedParticipantForScorecard: any
  selectedRoundIdForScorecard: string | null
  competition: any
  selectedLeaderboardType: string
  onClose: () => void
}

export function PlayerScorecardModal({
  selectedParticipantForScorecard,
  selectedRoundIdForScorecard,
  competition,
  selectedLeaderboardType,
  onClose
}: PlayerScorecardModalProps) {
  return (
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
            onClick={onClose}
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
                          <td className="px-2 py-1.5 text-left font-bold text-slate-50 border-r border-slate-200 text-[10px]">
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
  )
}
