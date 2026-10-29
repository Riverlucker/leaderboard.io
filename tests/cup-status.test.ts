import { describe, expect, it } from "vitest"
import { computeRyderCupStatus, calculateRyderCupPoints } from "@/app/components/RyderCupBoard"

const holes=Array.from({length:18},(_,i)=>({id:`h${i+1}`,number:i+1,par:4,strokeIndex:i+1}))
const round={id:"r",name:"Finale",holesPlayed:holes.map(h=>h.number),course:{holes,tees:[]}}
function fixture(a:number[],b:number[],overrides={}) {
  const players=[{id:"a",teamId:"diamonds",compHandicap:0,manualRoundHandicaps:[{roundId:"r",handicapValue:0}],scores:a.map((grossStrokes,i)=>({roundId:"r",holeId:holes[i].id,grossStrokes}))},
    {id:"b",teamId:"hearts",compHandicap:0,manualRoundHandicaps:[{roundId:"r",handicapValue:0}],scores:b.map((grossStrokes,i)=>({roundId:"r",holeId:holes[i].id,grossStrokes}))}]
  const match={id:"m",type:"SINGLES",allowanceType:"75%",matchPlayers:[{participantId:"a"},{participantId:"b"}],...overrides}
  return {players,match,competition:{participants:players,teams:[{id:"diamonds",name:"Diamonds"},{id:"hearts",name:"Hearts"}],rounds:[{...round,matches:[match]}]}}
}

describe("Ryder-Cup-Matchabschluss",()=>{
  it("erkennt das vorzeitige 10&8 und wertet spätere Eingaben nicht weiter",()=>{
    const {match,competition}=fixture(Array(18).fill(3),Array(18).fill(4))
    expect(computeRyderCupStatus(match,round,competition,"diamonds","hearts")).toMatchObject({isFinished:true,holesPlayed:10,lead:10,statusText:"10&8"})
  })
  it("respektiert das Weiterspielen bis zum Ende",()=>{
    const {match,competition}=fixture(Array(10).fill(3),Array(10).fill(4),{playUntilEnd:true})
    expect(computeRyderCupStatus(match,round,competition,"diamonds","hearts").isFinished).toBe(false)
  })
  it("beendet ein Match nicht bei einer einzelnen Eingabe am letzten Loch",()=>{
    const {match,competition,players}=fixture([],[])
    players[0].scores=[{roundId:"r",holeId:"h18",grossStrokes:3}]
    players[1].scores=[{roundId:"r",holeId:"h18",grossStrokes:4}]
    expect(computeRyderCupStatus(match,round,competition,"diamonds","hearts")).toMatchObject({isFinished:false,holesPlayed:1})
  })
  it("berücksichtigt manuelle Matchvorgaben im Teamstand",()=>{
    const {match,competition,players}=fixture([4],[4],{handicapAllowance:18})
    players[1].compHandicap=18
    players[1].manualRoundHandicaps[0].handicapValue=18
    expect(computeRyderCupStatus(match,round,competition,"diamonds","hearts")).toMatchObject({lead:-1,team2Allowance:[18]})
  })
  it("teilt ein halbes Match in Viertelpunkte für Team und MVP",()=>{
    const {competition}=fixture(Array(18).fill(4),Array(18).fill(4),{weight:.5})
    const result=calculateRyderCupPoints(competition)
    expect(result.diamondPoints).toBe(.25)
    expect(result.heartsPoints).toBe(.25)
    expect(result.sortedMvp.map(p=>p.points)).toEqual([.25,.25])
  })
})
