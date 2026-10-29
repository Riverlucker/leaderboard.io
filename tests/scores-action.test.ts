import { beforeEach, describe, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  auth:vi.fn(), db:{
    user:{findUnique:vi.fn()}, competition:{findUniqueOrThrow:vi.fn()},
    round:{findUniqueOrThrow:vi.fn(),findUnique:vi.fn()},
    participant:{findUniqueOrThrow:vi.fn(),findUnique:vi.fn(),findFirst:vi.fn()},
    hole:{findUniqueOrThrow:vi.fn()},match:{findMany:vi.fn()},
    score:{upsert:vi.fn()},auditLog:{create:vi.fn()},
  },
}))
vi.mock("server-only",()=>({}))
vi.mock("@/auth",()=>({auth:mock.auth}))
vi.mock("@/lib/prisma",()=>({default:mock.db}))
vi.mock("@/lib/transaction",()=>({atomic:(work: (db:typeof mock.db)=>Promise<unknown>)=>work(mock.db)}))
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}))
import { saveBatchScores } from "@/app/actions/scores"

const input = {participantId:"player",roundId:"round",holeId:"hole",grossStrokes:4,status:null}
const tee={id:"tee",name:"Yellow",slope:113,courseRating:72}
beforeEach(()=>{
  vi.resetAllMocks()
  mock.auth.mockResolvedValue({user:{id:"user"}})
  mock.db.user.findUnique.mockResolvedValue({id:"user",name:"Echter Spieler",email:null,role:"USER"})
  mock.db.competition.findUniqueOrThrow.mockResolvedValue({type:"NETTO_STABLEFORD"})
  const round={id:"round",competitionId:"comp",courseId:"course",tee,holesPlayed:[1,2],ninePreset:"FRONT_9_TWICE",course:{tees:[tee],holes:[{id:"h1",courseId:"course",number:1,par:4,strokeIndex:1},{id:"hole",courseId:"course",number:2,par:4,strokeIndex:2}]}}
  mock.db.round.findUniqueOrThrow.mockResolvedValue(round)
  mock.db.round.findUnique.mockResolvedValue(round)
  const player={id:"player",competitionId:"comp",compHandicap:20,manualRoundHandicaps:[{roundId:"round",handicapValue:1,tee}],user:{name:"Mitspieler"}}
  mock.db.participant.findUniqueOrThrow.mockResolvedValue(player)
  mock.db.participant.findUnique.mockResolvedValue(player)
  mock.db.participant.findFirst.mockResolvedValue({id:"own"})
  mock.db.match.findMany.mockResolvedValue([{holeRange:"1-2",matchPlayers:[{participantId:"own"},{participantId:"player"}]}])
  mock.db.hole.findUniqueOrThrow.mockResolvedValue({id:"hole",number:2,par:4,strokeIndex:2,courseId:"course"})
  mock.db.score.upsert.mockResolvedValue({id:"saved"})
})

describe("Öffentliche Score-Action",()=>{
  it("verweigert den direkten Aufruf ohne Anmeldung",async()=>{
    mock.auth.mockResolvedValue(null)
    await expect(saveBatchScores("comp",[input],"forged","Gefälscht")).rejects.toThrow("Nicht angemeldet")
    expect(mock.db.score.upsert).not.toHaveBeenCalled()
  })
  it("bezieht den Auditautor aus der Sitzung und speichert die Neun-Loch-Anpassung",async()=>{
    await saveBatchScores("comp",[input],"forged","Gefälscht")
    expect(mock.db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({userId:"user",userName:"Echter Spieler"})}))
    expect(mock.db.score.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where:{participantId_roundId_holeId:{participantId:"player",roundId:"round",holeId:"hole"}},
      update:expect.objectContaining({points:3,netStrokes:3}),
    }))
  })
  it("verweigert ein Loch von einem fremden Platz",async()=>{
    mock.db.hole.findUniqueOrThrow.mockResolvedValue({courseId:"foreign"})
    await expect(saveBatchScores("comp",[{...input,holeId:"foreign"}],"","")).rejects.toThrow("Golfplatz")
    expect(mock.db.score.upsert).not.toHaveBeenCalled()
  })
  it("verweigert die Eingabe für ein fremdes Flight",async()=>{
    mock.db.match.findMany.mockResolvedValue([])
    await expect(saveBatchScores("comp",[input],"","")).rejects.toThrow("Flight")
    expect(mock.db.score.upsert).not.toHaveBeenCalled()
  })
  it("verwendet individuelle Abschläge und bewahrt manuelle Vorgabe null",async()=>{
    mock.db.participant.findUniqueOrThrow.mockResolvedValue({id:"player",competitionId:"comp",compHandicap:50,manualRoundHandicaps:[{roundId:"round",handicapValue:0,tee:{...tee,courseRating:80}}]})
    await saveBatchScores("comp",[input],"","")
    expect(mock.db.score.upsert).toHaveBeenCalledWith(expect.objectContaining({update:expect.objectContaining({points:2,netStrokes:4})}))
  })
})
