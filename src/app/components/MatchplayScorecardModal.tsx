"use client"

import React from "react"
import { X } from "lucide-react"
import { getRoundHoleInfo } from "@/lib/scoring"
import {
  getPlayingHandicap,
  getMatchAllowance,
  getMatchHoleStrokesMap,
  getCompactName,
  parseHoleRange
} from "../CompetitionClientView"
import { getTeamColorConfig } from "@/lib/teamColors"

interface MatchplayScorecardModalProps {
  selectedMatchForScorecard: any
  selectedMatchRoundForScorecard: any
  competition: any
  onClose: () => void
  computeMatchplayStatus: (match: any, round: any) => any
}

export function MatchplayScorecardModal({
  selectedMatchForScorecard,
  selectedMatchRoundForScorecard,
  competition,
  onClose,
  computeMatchplayStatus
}: MatchplayScorecardModalProps) {
  const round = selectedMatchRoundForScorecard
  const match = selectedMatchForScorecard

  const isTeamMatchplay = match.type === 'TEAM_MATCHPLAY'
  const pIds = match.matchPlayers.map((mp: any) => mp.participantId)
  const players = pIds.map((id: string) => competition.participants.find((x: any) => x.id === id)).filter(Boolean)

  const team1 = isTeamMatchplay ? competition.teams.find((t: any) => t.id === players[0]?.teamId) : null
  const team2 = isTeamMatchplay ? competition.teams.find((t: any) => t.id === players[2]?.teamId) : null

  const team1Idx = isTeamMatchplay ? competition.teams.findIndex((t: any) => t.id === players[0]?.teamId) : 0
  const team2Idx = isTeamMatchplay ? competition.teams.findIndex((t: any) => t.id === players[2]?.teamId) : 1

  const team1Color = isTeamMatchplay && team1 
    ? getTeamColorConfig(team1.color, team1Idx === -1 ? 0 : team1Idx) 
    : getTeamColorConfig(null, 0) // default emerald

  const team2Color = isTeamMatchplay && team2 
    ? getTeamColorConfig(team2.color, team2Idx === -1 ? 1 : team2Idx) 
    : getTeamColorConfig(null, 1) // default red

  if (players.length === 0) {
    return (
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">Unknown Players</h3>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  let p1 = players[0]
  let p2 = players[1]
  let p3 = players[2]
  let p4 = players[3]

  let team1Players: any[] = []
  let team2Players: any[] = []
  let p1Allowance = 0, p2Allowance = 0, p3Allowance = 0, p4Allowance = 0, allowance = 0
  let strokesMap1: any = {}, strokesMap2: any = {}, strokesMap3: any = {}, strokesMap4: any = {}

  const getInitials = (name: string) => {
    if (!name) return ""
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const allNames = competition.participants.map((p: any) =>
    p.userId ? p.user?.name : p.dummyName
  ).filter((n: any): n is string => typeof n === 'string' && n.length > 0)

  const roundHoles = round.holesPlayed && round.holesPlayed.length > 0
    ? [...round.holesPlayed].sort((a: number, b: number) => a - b)
    : Array.from({ length: 18 }, (_, i) => i + 1)

  const matchHoles = parseHoleRange(match.holeRange, roundHoles)

  if (isTeamMatchplay && players.length === 4) {
    const teamIds = Array.from(new Set(players.map((x: any) => x.teamId))).filter(Boolean)
    let team1Id = teamIds[0]
    let team2Id = teamIds[1]

    const christoph = players.find((x: any) => (x.user?.name || x.dummyName || "").toLowerCase().includes("christoph"))
    if (christoph && christoph.teamId === team2Id) {
      const temp = team1Id
      team1Id = team2Id
      team2Id = temp
    }

    team1Players = players.filter((x: any) => x.teamId === team1Id)
    team2Players = players.filter((x: any) => x.teamId === team2Id)
    team1Players.sort((a: any, b: any) => getPlayingHandicap(a, round) - getPlayingHandicap(b, round))
    team2Players.sort((a: any, b: any) => getPlayingHandicap(a, round) - getPlayingHandicap(b, round))

    p1 = team1Players[0]
    p2 = team1Players[1]
    p3 = team2Players[0]
    p4 = team2Players[1]

    const hcp1 = getPlayingHandicap(p1, round)
    const hcp2 = getPlayingHandicap(p2, round)
    const hcp3 = getPlayingHandicap(p3, round)
    const hcp4 = getPlayingHandicap(p4, round)

    const minPH = Math.min(hcp1, hcp2, hcp3, hcp4)

    p1Allowance = hcp1 - minPH
    p2Allowance = hcp2 - minPH
    p3Allowance = hcp3 - minPH
    p4Allowance = hcp4 - minPH

    strokesMap1 = getMatchHoleStrokesMap(matchHoles, round, p1Allowance)
    strokesMap2 = getMatchHoleStrokesMap(matchHoles, round, p2Allowance)
    strokesMap3 = getMatchHoleStrokesMap(matchHoles, round, p3Allowance)
    strokesMap4 = getMatchHoleStrokesMap(matchHoles, round, p4Allowance)
  } else {
    if (players.length >= 2) {
      p1 = players[0]
      p2 = players[1]
    }
    const hcp1 = getPlayingHandicap(p1, round)
    const hcp2 = getPlayingHandicap(p2, round)
    const allowanceVal = getMatchAllowance(match, hcp1, hcp2)
    allowance = allowanceVal
    p1Allowance = hcp1 > hcp2 ? allowanceVal : 0
    p2Allowance = hcp2 > hcp1 ? allowanceVal : 0
    strokesMap1 = getMatchHoleStrokesMap(matchHoles, round, p1Allowance)
    strokesMap2 = getMatchHoleStrokesMap(matchHoles, round, p2Allowance)
  }

  const name1 = getCompactName(p1.userId ? p1.user?.name : p1.dummyName || "", allNames)
  const name2 = p2 ? getCompactName(p2.userId ? p2.user?.name : p2.dummyName || "", allNames) : ""
  const name3 = p3 ? getCompactName(p3.userId ? p3.user?.name : p3.dummyName || "", allNames) : ""
  const name4 = p4 ? getCompactName(p4.userId ? p4.user?.name : p4.dummyName || "", allNames) : ""

  const frontHoleNums = matchHoles
    .filter(num => num >= 1 && num <= 9)
    .filter(num => {
      const hole = round.course.holes.find((h: any) => h.number === num)
      if (!hole) return false
      const score1 = p1.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
      const score2 = p2 ? p2.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id) : null
      const score3 = p3 ? p3.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id) : null
      const score4 = p4 ? p4.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id) : null
      const scores = [score1, score2, score3, score4].filter(Boolean)
      return !(scores.length > 0 && scores.every((s: any) => s.status === 'NOT_PLAYED'))
    })

  const backHoleNums = matchHoles
    .filter(num => num >= 10 && num <= 18)
    .filter(num => {
      const hole = round.course.holes.find((h: any) => h.number === num)
      if (!hole) return false
      const score1 = p1.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)
      const score2 = p2 ? p2.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id) : null
      const score3 = p3 ? p3.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id) : null
      const score4 = p4 ? p4.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id) : null
      const scores = [score1, score2, score3, score4].filter(Boolean)
      return !(scores.length > 0 && scores.every((s: any) => s.status === 'NOT_PLAYED'))
    })

  const renderMatchplayHoleTable = (holeNums: number[]) => {
    if (holeNums.length === 0) return null

    const sumPar = holeNums.reduce((sum, num) => {
      const hole = round.course.holes.find((h: any) => h.number === num)
      return sum + (hole?.par || 4)
    }, 0)

    let runningLead = 0
    const standingsAtHole: Record<number, string> = {}
    const holeWinner: Record<number, '1' | '2' | 'halved' | null> = {}
    const netValuesAtHole: Record<number, Record<number, number>> = {}

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
      const score2 = p2 ? p2.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id) : null
      const score3 = p3 ? p3.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id) : null
      const score4 = p4 ? p4.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id) : null

      const strokes1 = getMatchHoleStrokes(score1)
      const strokes2 = getMatchHoleStrokes(score2)
      const strokes3 = isTeamMatchplay ? getMatchHoleStrokes(score3) : null
      const strokes4 = isTeamMatchplay ? getMatchHoleStrokes(score4) : null

      // Exclude hole if all unplayed
      if (strokes1 === null && strokes2 === null && strokes3 === null && strokes4 === null) {
        continue
      }

      const getNet = (strokes: number | null, strokesGiven: number) => {
        if (strokes === null) return 999
        if (strokes === 99) return 99
        return strokes - strokesGiven
      }

      const net1 = getNet(strokes1, strokesMap1[num] || 0)
      const net2 = getNet(strokes2, strokesMap2[num] || 0)
      const net3 = getNet(strokes3, strokesMap3[num] || 0)
      const net4 = getNet(strokes4, strokesMap4[num] || 0)

      netValuesAtHole[num] = { 1: net1, 2: net2, 3: net3, 4: net4 }

      const teamNet1 = isTeamMatchplay ? Math.min(net1, net2) : net1
      const teamNet2 = isTeamMatchplay ? Math.min(net3, net4) : net2

      if (teamNet1 !== 999 && teamNet2 !== 999) {
        if (teamNet1 < teamNet2) {
          runningLead++
          holeWinner[num] = '1'
        } else if (teamNet1 > teamNet2) {
          runningLead--
          holeWinner[num] = '2'
        } else {
          holeWinner[num] = 'halved'
        }

        if (competition.shortTrackLimit !== null && competition.shortTrackLimit !== undefined) {
          if (runningLead > competition.shortTrackLimit) {
            runningLead = competition.shortTrackLimit
          } else if (runningLead < -competition.shortTrackLimit) {
            runningLead = -competition.shortTrackLimit
          }
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

    const renderPlayerRow = (p: any, displayName: string, allowanceVal: number, strokesMap: any, pIdx: number) => {
      let totalStrokes = 0
      let nameBg = "bg-slate-50/50 text-slate-700 font-bold"
      const isGreen = isTeamMatchplay ? (pIdx === 1 || pIdx === 2) : (pIdx === 1)
      if (isGreen) {
        nameBg = `${team1Color.bg} ${team1Color.text} font-extrabold border-l-2 ${team1Color.border}`
      } else {
        nameBg = `${team2Color.bg} ${team2Color.text} font-extrabold border-l-2 ${team2Color.border}`
      }

      return (
        <tr className="border-b border-slate-200">
          <td className={`px-3 py-2 text-left border-r border-slate-200 text-[10px] truncate max-w-[110px] ${nameBg}`}>
            {displayName}
            {allowanceVal > 0 && ` (${allowanceVal})`}
          </td>
          {holeNums.map(num => {
            const adjusted = getRoundHoleInfo(round, num)
            const hole = round.course.holes.find((h: any) => h.number === num)
            if (!hole) return <td key={num} className="border-r border-slate-200/80">-</td>

            const holePar = adjusted ? adjusted.par : hole.par
            const score = p.scores.find((s: any) => s.roundId === round.id && s.holeId === hole.id)

            let displayVal = "-"
            let diff = 0
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
              }
            }

            const wonTeam = holeWinner[num]
            const won = (pIdx === 1 && wonTeam === '1' && netValuesAtHole[num]?.[1] === Math.min(netValuesAtHole[num]?.[1], netValuesAtHole[num]?.[2])) ||
                        (pIdx === 2 && wonTeam === '1' && netValuesAtHole[num]?.[2] === Math.min(netValuesAtHole[num]?.[1], netValuesAtHole[num]?.[2])) ||
                        (pIdx === 3 && wonTeam === '2' && netValuesAtHole[num]?.[3] === Math.min(netValuesAtHole[num]?.[3], netValuesAtHole[num]?.[4])) ||
                        (pIdx === 4 && wonTeam === '2' && netValuesAtHole[num]?.[4] === Math.min(netValuesAtHole[num]?.[3], netValuesAtHole[num]?.[4])) ||
                        (!isTeamMatchplay && pIdx === 1 && wonTeam === '1') ||
                        (!isTeamMatchplay && pIdx === 2 && wonTeam === '2')

            let cellBg = "text-slate-800"
            if (won) {
              if (isTeamMatchplay) {
                if (pIdx === 1 || pIdx === 2) {
                  const otherNet = pIdx === 1 ? netValuesAtHole[num]?.[2] : netValuesAtHole[num]?.[1]
                  const myNet = netValuesAtHole[num]?.[pIdx]
                  cellBg = myNet < otherNet ? `${team1Color.bg} ${team1Color.text} font-black` : `${team1Color.bg} ${team1Color.text}`
                } else {
                  const otherNet = pIdx === 3 ? netValuesAtHole[num]?.[4] : netValuesAtHole[num]?.[3]
                  const myNet = netValuesAtHole[num]?.[pIdx]
                  cellBg = myNet < otherNet ? `${team2Color.bg} ${team2Color.text} font-black` : `${team2Color.bg} ${team2Color.text}`
                }
              } else {
                if (pIdx === 1) {
                  cellBg = `${team1Color.bg} ${team1Color.text} font-extrabold`
                } else {
                  cellBg = `${team2Color.bg} ${team2Color.text} font-extrabold`
                }
              }
            }

            const strokeCount = allowanceVal > 0 ? (strokesMap[num] || 0) : 0
            const markerMarkup = getMarkerMarkup(displayVal, diff, isWiped)

            return (
              <td key={num} className={`px-1 py-2 border-r border-slate-200/80 relative font-bold text-[11px] transition-colors duration-150 ${cellBg}`}>
                <div className="flex items-center justify-center h-7 relative w-full">
                  <span className={isWiped ? 'text-red-650 font-black' : ''}>{displayVal}</span>
                  {markerMarkup}
                  {strokeCount > 0 && (
                    <div className="absolute top-1 right-1 flex space-x-[1.5px]" title={`${strokeCount} allowance strokes given on this hole`}>
                      {Array.from({ length: strokeCount }).map((_, idx) => (
                        <div key={idx} className="w-[4px] h-[4px] bg-cyan-500 rounded-full" />
                      ))}
                    </div>
                  )}
                </div>
              </td>
            )
          })}
          <td className="px-1.5 py-2 font-extrabold text-slate-850 text-[10px] bg-slate-50/50">{totalStrokes}</td>
        </tr>
      )
    }

    return (
      <div className="overflow-x-auto border border-slate-200 rounded-xl w-full shadow-sm">
        <table className="w-full text-[10px] text-center border-collapse">
          <thead className="bg-slate-50 text-slate-650">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 text-left font-extrabold border-r border-slate-200 w-28 text-[10px] text-slate-800 bg-slate-100/50">Hole</th>
              {holeNums.map(num => {
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
            {renderPlayerRow(p1, name1, p1Allowance, strokesMap1, 1)}

            {isTeamMatchplay && p2 && renderPlayerRow(p2, name2, p2Allowance, strokesMap2, 2)}

            {/* Running Match Score Row */}
            <tr className="border-b border-slate-200 bg-slate-50/40 text-[9px]">
              <td className="px-3 py-1.5 text-left font-bold text-slate-555 border-r border-slate-200 bg-slate-50/60">
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

            {isTeamMatchplay ? (
              <>
                {p3 && renderPlayerRow(p3, name3, p3Allowance, strokesMap3, 3)}
                {p4 && renderPlayerRow(p4, name4, p4Allowance, strokesMap4, 4)}
              </>
            ) : (
              p2 && renderPlayerRow(p2, name2, p2Allowance, strokesMap2, 2)
            )}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 overflow-hidden max-h-[90vh] flex flex-col text-slate-800">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Matchplay Scorecard
            </h3>
            <p className="text-xs text-slate-550">
              Round: {round.name} | Course: {round.course.name}
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
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="font-bold text-slate-600 block">Allowance</span>
                <span className="text-sm font-black text-slate-900">
                  {isTeamMatchplay
                    ? `${getInitials(name1)}:${p1Allowance}, ${p2 ? `${getInitials(name2)}:${p2Allowance}` : ""}, ${p3 ? `${getInitials(name3)}:${p3Allowance}` : ""}, ${p4 ? `${getInitials(name4)}:${p4Allowance}` : ""}`
                    : `${allowance} strokes`
                  }
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-600 block">Calculation Method</span>
                <span className="text-sm font-black text-slate-900">{match.allowanceType || "75%"} base</span>
              </div>
              {competition.shortTrackLimit !== null && competition.shortTrackLimit !== undefined && (
                <div>
                  <span className="font-bold text-red-500 block">Short Track</span>
                  <span className="text-sm font-black text-red-650 font-black">Max {competition.shortTrackLimit} Up</span>
                </div>
              )}
              <div>
                <span className="font-bold text-slate-600 block">Holes</span>
                <span className="text-sm font-black text-slate-900">{match.holeRange || "1-18"}</span>
              </div>
              <div>
                <span className="font-bold text-slate-600 block">Status</span>
                {(() => {
                  const { statusText, lead, holesPlayed } = computeMatchplayStatus(match, round)
                  let statusColor = "text-slate-655"
                  if (holesPlayed > 0) {
                    if (lead > 0) statusColor = "text-emerald-600 font-extrabold"
                    else if (lead < 0) statusColor = "text-red-600 font-extrabold"
                  }
                  return (
                    <span className={`text-sm font-black uppercase ${statusColor}`}>
                      {statusText}
                    </span>
                  )
                })()}
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
        </div>
      </div>
    </div>
  )
}
