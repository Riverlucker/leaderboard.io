import { beforeEach, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  committed:false, rolledBack:false,
  db:{competition:{findUnique:vi.fn()},course:{findFirst:vi.fn()},score:{count:vi.fn()},round:{deleteMany:vi.fn(),create:vi.fn()}},
}))
vi.mock("server-only",()=>({}))
vi.mock("@/lib/prisma",()=>({default:mock.db}))
vi.mock("@/lib/access",()=>({requireAdmin:vi.fn().mockResolvedValue({id:"admin",role:"ADMIN"})}))
vi.mock("@/lib/transaction",()=>({atomic: async (work:(db:typeof mock.db)=>Promise<unknown>)=>{
  try {const result=await work(mock.db);mock.committed=true;return result}
  catch(error) {mock.rolledBack=true;throw error}
}}))
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}))
import { seedClFormatCompetition } from "@/app/actions/wintercup"

beforeEach(()=>{
  mock.committed=false;mock.rolledBack=false
  mock.db.competition.findUnique.mockResolvedValue({id:"comp",participants:[{id:"a"},{id:"b"}],rounds:[],cssConfig:null})
  mock.db.course.findFirst.mockResolvedValue({id:"course",tees:[{id:"tee"}],holes:[]})
  mock.db.score.count.mockResolvedValue(0)
  mock.db.round.deleteMany.mockResolvedValue({count:0})
  mock.db.round.create.mockRejectedValue(new Error("Simulierter Datenbankfehler"))
})

it("fängt Generierungsfehler erst nach dem Transaktions-Rollback ab",async()=>{
  const log=vi.spyOn(console,"error").mockImplementation(()=>{})
  try {
    await expect(seedClFormatCompetition("comp")).resolves.toMatchObject({success:false})
    expect(mock.db.round.deleteMany).toHaveBeenCalled()
    expect(mock.rolledBack).toBe(true)
    expect(mock.committed).toBe(false)
  } finally {log.mockRestore()}
})
