import { beforeEach, expect,it,vi } from "vitest"
import { newInvitationToken, invitationExpiry } from "@/lib/invitation-token"
const mock=vi.hoisted(()=>({auth:vi.fn(),invitation:vi.fn(),user:vi.fn()}))
vi.mock("@/auth",()=>({auth:mock.auth}))
vi.mock("@/lib/prisma",()=>({default:{profileInvitation:{findUnique:mock.invitation},user:{findUnique:mock.user}}}))
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error(`REDIRECT:${url}`)}}))
vi.mock("@/app/profile/ProfileForm",()=>({ProfileForm:()=>null}))
import ProfilePage from "@/app/profile/page"
const token=newInvitationToken()
beforeEach(()=>{
  vi.clearAllMocks();mock.auth.mockResolvedValue(null)
  mock.invitation.mockResolvedValue({usedAt:null,expiresAt:invitationExpiry(),user:{name:"Christoph",email:"player@example.com",image:null}})
})
it("öffnet gültige Links wiederholt als Einrichtung, ohne Schreiboperation",async()=>{
  for(let i=0;i<2;i++) {
    const page=await ProfilePage({searchParams:Promise.resolve({player:token})})
    expect(page.props).toMatchObject({invitation:true,token,name:"Christoph"})
  }
  expect(mock.invitation).toHaveBeenCalledTimes(2)
})
it("führt bei einem verbrauchten Link zur Anmeldung mit Profil-Rücksprung",async()=>{
  mock.invitation.mockResolvedValue({usedAt:new Date(),expiresAt:invitationExpiry()})
  await expect(ProfilePage({searchParams:Promise.resolve({player:token})})).rejects.toThrow("REDIRECT:/login?callbackUrl=%2Fprofile")
})
it("öffnet nach Anmeldung ausschließlich das eigene globale Profil",async()=>{
  mock.auth.mockResolvedValue({user:{id:"self"}})
  mock.user.mockResolvedValue({name:"Mein Profil",email:"self@example.com",image:null})
  const page=await ProfilePage({searchParams:Promise.resolve({})})
  expect(mock.user).toHaveBeenCalledWith({where:{id:"self"},select:{name:true,email:true,image:true}})
  expect(page.props.name).toBe("Mein Profil")
})
