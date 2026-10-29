import { expect,it,vi } from "vitest"
const mock=vi.hoisted(()=>({config:vi.fn(),user:vi.fn()}))
vi.mock("next-auth",()=>({default:(config:unknown)=>{mock.config(config);return {}}}))
vi.mock("next-auth/providers/credentials",()=>({default:(config:unknown)=>config}))
vi.mock("@/lib/prisma",()=>({default:{user:{findUnique:mock.user}}}))
import "@/auth"
type Token={id:string;sessionVersion?:number;name?:string|null;email?:string|null;role?:string}
const callbacks=(mock.config.mock.calls[0][0] as {callbacks:{jwt:(params:{token:Token;user?:{id:string;role:string;sessionVersion:number}})=>Promise<Token|null>}}).callbacks
it("invalidiert bestehende Sitzungen nach einer Passwortänderung",async()=>{
  mock.user.mockResolvedValue({id:"user",sessionVersion:1,role:"USER",name:"Spieler",email:"player@example.com"})
  expect(await callbacks.jwt({token:{id:"user",sessionVersion:0}})).toBeNull()
  expect(await callbacks.jwt({token:{id:"user",sessionVersion:1}})).toMatchObject({id:"user",sessionVersion:1})
})
it("erhält alte Sitzungen vor der ersten Passwortänderung",async()=>{
  mock.user.mockResolvedValue({id:"user",sessionVersion:0,role:"USER"})
  expect(await callbacks.jwt({token:{id:"user"}})).not.toBeNull()
})
it("bindet neue Anmeldungen an die aktuelle Sitzungsversion",async()=>{
  expect(await callbacks.jwt({token:{id:"user"},user:{id:"user",role:"ADMIN",sessionVersion:2}})).toMatchObject({sessionVersion:2,role:"ADMIN"})
})
