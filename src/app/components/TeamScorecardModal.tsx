"use client"

import React from "react"
import { X } from "lucide-react"
import { getHandicapStrokesOnHole, calculateStablefordPoints, getRoundHoleInfo } from "@/lib/scoring"
import { getPlayingHandicap, getCompactName } from "../CompetitionClientView"

interface TeamScorecardModalProps {
  selectedTeamForScorecard: any
  competition: any
  onClose: () => void
}

export function TeamScorecardModal({
  selectedTeamForScorecard,
  competition,
  onClose
}: TeamScorecardModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 overflow-hidden max-h-[90vh] flex flex-col text-slate-800">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Team Scorecard: {selectedTeamForScorecard.name}
            </h3>
            <p className="text-xs text-slate-550">
              Members: {competition.participants.filter((p: any) => p.teamId === selectedTeamForScorecard.id).map((p: any) => p.userId ? (p.user?.name || p.user?.email) : p.dummyName).join(" & ")}
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
          {competition.rounds.map((round: any) => {
            const members = competition.participants
              .filter((p: any) => p.teamId === selectedTeamForScorecard.id)
              .sort((a: any, b: any) => getPlayingHandicap(a, round) - getPlayingHandicap(b, round))

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

              let totalTeamStableford = 0

              const getMemberStats = (m: any) => {
                let totalStrokes = 0
                let totalPoints = 0
                const courseHandicap = getPlayingHandicap(m, round)
                
                const list = holeNums.map(num => {
                  const adjusted = getRoundHoleInfo(round, num)
                  const hole = round.course.holes.find((h: any) => h.number === num)
                  if (!hole) return { displayVal: "-", diff: 0, pts: 0, hcpStrokes: 0, isWiped: false }

                  const holePar = adjusted ? adjusted.par : hole.par
                  const holeStrokeIndex = adjusted ? adjusted.strokeIndex : hole.strokeIndex
                  const hcpStrokes = getHandicapStrokesOnHole(courseHandicap, holeStrokeIndex)

                  const score = m.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)

                  let displayVal = "-"
                  let diff = 0
                  let pts = 0
                  let isWiped = false

                  if (score && (score.grossStrokes !== null || (score.status !== null && score.status !== 'NOT_PLAYED'))) {
                    if (score.status === 'WIPED') {
                      displayVal = "/"
                      isWiped = true
                      totalStrokes += holePar + 3
                    } else if (score.grossStrokes !== null) {
                      displayVal = String(score.grossStrokes)
                      totalStrokes += score.grossStrokes
                      diff = score.grossStrokes - holePar
                      const pStableford = calculateStablefordPoints(score.grossStrokes, holePar, hcpStrokes, true)
                      if (pStableford !== null) pts = pStableford
                    }
                  }

                  totalPoints += pts
                  return { displayVal, diff, pts, hcpStrokes, isWiped, score }
                })

                return { list, totalStrokes, totalPoints, courseHandicap }
              }

              const mStats = members.map((m: any) => getMemberStats(m))

              const teamBestballPts = holeNums.map((num, i) => {
                const pts = Math.max(...mStats.map((ms: any) => ms.list[i].pts), 0)
                totalTeamStableford += pts
                return pts
              })

              const renderPlayerRows = (p: any, ms: any, idx: number) => {
                const name = p.userId ? (p.user?.name || p.user?.email) : p.dummyName
                const compact = getCompactName(name || "", competition.participants.map((x: any) => x.userId ? (x.user?.name || x.user?.email) : x.dummyName).filter(Boolean))

                return (
                  <React.Fragment key={p.id}>
                    <tr className="bg-slate-50/40 text-[9px] text-slate-555 border-t border-slate-100">
                      <td className="px-2 py-1 text-left border-r border-slate-200 font-medium">
                        {compact} (Shots)
                      </td>
                      {holeNums.map((num, i) => {
                        const hcpStrokes = ms.list[i].hcpStrokes
                        return (
                          <td key={num} className="px-1 py-0.5 border-r border-slate-200/80 font-bold text-cyan-600 font-mono">
                            {hcpStrokes === 1 ? "|" : hcpStrokes >= 2 ? "||" : ""}
                          </td>
                        )
                      })}
                      <td className="px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-600">{ms.courseHandicap}</td>
                    </tr>

                    <tr className="border-b border-slate-100">
                      <td className="px-2 py-1.5 text-left font-bold text-slate-700 border-r border-slate-200 text-[10px]">
                        {compact} (Strokes)
                      </td>
                      {holeNums.map((num, i) => {
                        const { displayVal, diff, isWiped, score } = ms.list[i]
                        const adjusted = getRoundHoleInfo(round, num)
                        const hole = round.course.holes.find((h: any) => h.number === num)
                        const holePar = adjusted ? adjusted.par : (hole?.par || 4)

                        let markerMarkup = null
                        if (displayVal !== '-' && displayVal !== '/' && score?.grossStrokes) {
                          if (diff === -1) {
                            markerMarkup = (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-[18px] h-[18px] border border-emerald-500 rounded-full opacity-80" />
                              </div>
                            )
                          } else if (diff <= -2) {
                            markerMarkup = (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="absolute w-[18px] h-[18px] border border-emerald-500 rounded-full opacity-80" />
                                <div className="absolute w-[12px] h-[12px] border border-emerald-500 rounded-full opacity-80" />
                              </div>
                            )
                          } else if (diff === 1) {
                            markerMarkup = (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-[14px] h-[14px] border border-red-500 rounded-none opacity-80" />
                              </div>
                            )
                          } else if (diff === 2) {
                            markerMarkup = (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="absolute w-[20px] h-[20px] border border-red-500 rounded-none opacity-80" />
                                <div className="absolute w-[14px] h-[14px] border border-red-500 rounded-none opacity-80" />
                              </div>
                            )
                          } else if (diff >= 3) {
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
                          <td key={num} className="px-1 py-1.5 border-r border-slate-200/85 relative font-bold text-[11px] text-slate-800">
                            <div className="flex items-center justify-center h-6 relative w-full">
                              <span className={isWiped ? 'text-red-650 font-black' : ''}>{displayVal}</span>
                              {markerMarkup}
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-1.5 py-1.5 font-extrabold text-[10px] bg-slate-50/50">{ms.totalStrokes}</td>
                    </tr>

                    <tr className="border-b border-slate-200 text-slate-650 bg-slate-50/20">
                      <td className="px-2 py-1 text-left font-medium text-slate-550 border-r border-slate-200 text-[9px]">
                        {compact} (Points)
                      </td>
                      {holeNums.map((num, i) => {
                        const pts = ms.list[i].pts
                        return (
                          <td key={num} className="px-1 py-1 border-r border-slate-200/80 font-mono text-[10px]">
                            {pts}
                          </td>
                        )
                      })}
                      <td className="px-1.5 py-1 font-mono font-bold text-[9px] bg-slate-50/50">{ms.totalPoints}</td>
                    </tr>
                  </React.Fragment>
                )
              }

              return (
                <div key={round.id} className="space-y-3">
                  <h4 className="font-extrabold text-sm text-slate-800 flex justify-between items-center">
                    <span>Round: {round.name} | Course: {round.course.name}</span>
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl w-full shadow-sm">
                    <table className="w-full text-[10px] text-center border-collapse">
                      <thead className="bg-slate-50 text-slate-650">
                        <tr className="border-b border-slate-200">
                          <th className="px-2 py-1.5 text-left font-extrabold border-r border-slate-200 w-24 text-[10px] bg-slate-100/50 text-slate-850">Hole</th>
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
                        {renderPlayerRows(members[0], mStats[0], 1)}
                        {members[1] && renderPlayerRows(members[1], mStats[1], 2)}

                        <tr className="bg-emerald-50/50 text-emerald-950 font-bold border-t border-slate-300">
                          <td className="px-2 py-1.5 text-left border-r border-slate-200 text-[10px] text-emerald-900 font-extrabold">
                            Team Bestball
                          </td>
                          {holeNums.map((num, i) => (
                            <td key={num} className="px-1 py-1.5 border-r border-slate-200/80 font-mono text-[11px] text-emerald-700 font-black">
                              {teamBestballPts[i]}
                            </td>
                          ))}
                          <td className="px-1.5 py-1.5 font-mono font-black text-[11px] text-emerald-800 bg-emerald-100/50">
                            {totalTeamStableford}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            }

            return (
              <div key={round.id} className="space-y-6">
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
