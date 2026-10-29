import { describe, expect, it } from "vitest"
import { calculateCourseHandicap, getHandicapStrokesOnHole, calculateStablefordPoints, getRoundHoleInfo, assignLeaderboardRanks } from "@/lib/scoring"
import { getPlayingHandicap, getMatchAllowance, getMatchHoleStrokesMap, parseHoleRange } from "@/lib/matchplay"
import { formatCupScore, getRyderCupMatchWeight } from "@/lib/cup-scoring"
import { assertScoreValue, canManageUser, holeNumbers } from "@/lib/access-policy"

const holes = Array.from({length: 18}, (_, i) => ({id: String(i + 1), number: i + 1, par: 4, strokeIndex: i + 1}))
const tee = {id: "yellow", name: "Yellow", slope: 113, courseRating: 72}
const round = {id: "r", name: "Finale", course: {holes, tees: [tee]}, tee}

describe("Golfwertung", () => {
  it("berücksichtigt Slope und Course Rating", () => {
    expect(calculateCourseHandicap(18, tee, 72)).toBe(18)
    expect(calculateCourseHandicap(18, {...tee, slope: 130, courseRating: 73}, 72)).toBe(22)
  })
  it("verteilt positive und Plusvorgaben korrekt", () => {
    expect([1, 2, 18].map(h => getHandicapStrokesOnHole(19, h))).toEqual([2, 1, 1])
    expect([1, 17, 18].map(h => getHandicapStrokesOnHole(-2, h))).toEqual([0, -1, -1])
  })
  it("bewahrt eine manuelle Nullvorgabe und individuelle Abschläge", () => {
    expect(getPlayingHandicap({compHandicap: 20, manualRoundHandicaps: [{roundId: "r", handicapValue: 0}]}, round)).toBe(0)
    expect(getPlayingHandicap({compHandicap: 20, manualRoundHandicaps: [{roundId: "r", tee: {...tee, slope: 113, courseRating: 74}}]}, round)).toBe(22)
  })
  it("unterscheidet gestrichene, ungespielte und gespielte Löcher", () => {
    expect(calculateStablefordPoints(0, 4, 1)).toBe(0)
    expect(calculateStablefordPoints(null, 4, 1)).toBeNull()
    expect(calculateStablefordPoints(5, 4, 1)).toBe(2)
    expect(calculateStablefordPoints(5, 4, 1, false)).toBe(1)
  })
  it("wendet beide Neun-Loch-Schleifen an", () => {
    expect(getRoundHoleInfo({...round, ninePreset: "FRONT_9_TWICE"}, 10)).toMatchObject({number: 1, strokeIndex: 2})
    expect(getRoundHoleInfo({...round, ninePreset: "BACK_9_TWICE"}, 1)).toMatchObject({number: 10, strokeIndex: 9})
    expect(parseHoleRange("1-9,1-9", [])).toEqual(Array.from({length:18},(_,i)=>i+1))
    expect(holeNumbers("10-18,10-18", [])).toEqual(Array.from({length:18},(_,i)=>i+1))
  })
  it("verteilt Matchvorgaben auf tatsächlich gespielte Löcher", () => {
    expect(getMatchAllowance({allowanceType: "75%"}, 10, 20)).toBe(8)
    expect(getMatchAllowance({handicapAllowance: 0}, 10, 20)).toBe(0)
    const map = getMatchHoleStrokesMap([1,2,3,4,5,6,7,8,9], round, 10)
    expect(Object.values(map).reduce((a,b) => a+b, 0)).toBe(10)
  })
  it("ordnet geteilte Plätze und ungespielte Teilnehmer", () => {
    const results = assignLeaderboardRanks([{id:"a",holesPlayed:18,totalPoints:36},{id:"b",holesPlayed:18,totalPoints:36},{id:"c",holesPlayed:18,totalPoints:35},{id:"d",holesPlayed:0,totalPoints:0}])
    expect(results.map(r => r.rank)).toEqual(["T1","T1","3","-"])
  })
})

describe("Cup-Punkte und bestehende Gewichte", () => {
  it.each([[0,"0"],[0.25,"¼"],[0.5,"½"],[0.75,"¾"],[1.25,"1 ¼"],[1.75,"1 ¾"]])("zeigt %s exakt als %s", (value, display) => {
    expect(formatCupScore(Number(value))).toBe(display)
  })
  it("erhält die bisherige Regel und bevorzugt explizite Gewichte", () => {
    expect(getRyderCupMatchWeight({type:"SINGLES",holeRange:"1-9"},round)).toBe(.5)
    expect(getRyderCupMatchWeight({type:"SINGLES",holeRange:"10-18"},round)).toBe(1)
    expect(getRyderCupMatchWeight({type:"SINGLES"},{name:"Tag 1 VM"})).toBe(.5)
    expect(getRyderCupMatchWeight({type:"SINGLES",weight:1},{name:"Tag 1 VM"})).toBe(1)
    expect(formatCupScore(getRyderCupMatchWeight({type:"SINGLES",weight:.5},round)/2)).toBe("¼")
  })
})

describe("Eingaben und Rollen", () => {
  it("verhindert Rechteausweitung durch normale Administratoren", () => {
    expect(canManageUser("ADMIN","USER","ADMIN")).toBe(false)
    expect(canManageUser("ADMIN","SUPER_ADMIN","USER")).toBe(false)
    expect(canManageUser("ADMIN","USER","USER")).toBe(true)
    expect(canManageUser("SUPER_ADMIN","USER","ADMIN")).toBe(true)
  })
  it("weist manipulierte Scores und Lochbereiche zurück", () => {
    for (const value of [-1,0,1.5,NaN,100]) expect(() => assertScoreValue(value,null)).toThrow()
    expect(() => assertScoreValue(4,"WIPED")).toThrow()
    expect(() => assertScoreValue(null,"INVALID")).toThrow()
    expect(() => assertScoreValue(0,"WIPED")).not.toThrow()
    expect(() => holeNumbers("1-99",[])).toThrow()
    expect(() => holeNumbers("1-3,3",[])).toThrow()
    expect(holeNumbers("10-18",[])).toEqual([10,11,12,13,14,15,16,17,18])
  })
})
