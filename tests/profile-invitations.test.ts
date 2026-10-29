import { beforeEach, describe, expect, it, vi } from "vitest"
import { invitationHash, newInvitationToken, invitationExpiry, validateProfilePassword, validateProfileEmail } from "@/lib/invitation-token"
import { safeProfileReturn } from "@/lib/profile-navigation"
import { invitationMessage } from "@/lib/invitation-message"

const mock=vi.hoisted(()=>({
  actor:vi.fn(),hash:vi.fn(),compare:vi.fn(),
  db:{profileInvitation:{findUnique:vi.fn(),updateMany:vi.fn(),deleteMany:vi.fn(),create:vi.fn()},user:{findUniqueOrThrow:vi.fn(),findFirst:vi.fn(),update:vi.fn()}},
}))
vi.mock("server-only",()=>({}))
vi.mock("@/lib/access",()=>({requireUser:mock.actor}))
vi.mock("@/lib/prisma",()=>({default:mock.db}))
vi.mock("@/lib/transaction",()=>({atomic:(work:(db:typeof mock.db)=>Promise<unknown>)=>work(mock.db)}))
vi.mock("bcryptjs",()=>({default:{hash:mock.hash,compare:mock.compare}}))
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}))
import { savePersonalProfile } from "@/app/profile/actions"
import { issueProfileInvitations } from "@/lib/profile-invitations"

const token=newInvitationToken()
const input={token,email:"PLAYER@example.com",password:"Ein-neues-Passwort",currentPassword:""}
beforeEach(()=>{
  vi.clearAllMocks()
  mock.actor.mockResolvedValue({id:"user"})
  mock.db.profileInvitation.findUnique.mockResolvedValue({tokenHash:invitationHash(token),userId:"user",usedAt:null,expiresAt:invitationExpiry()})
  mock.db.profileInvitation.updateMany.mockResolvedValue({count:1})
  mock.db.user.findUniqueOrThrow.mockResolvedValue({id:"user",email:"old@example.com",password:"existing-hash",name:"Spieler"})
  mock.db.user.findFirst.mockResolvedValue(null)
  mock.hash.mockResolvedValue("new-hash")
  mock.compare.mockResolvedValue(true)
})

describe("Persönliche Profileinladungen",()=>{
  it("erzeugt zufällige Tokens und speichert ausschließlich Hashes",async()=>{
    const a=newInvitationToken(),b=newInvitationToken()
    expect(a).not.toBe(b);expect(a).toHaveLength(43)
    expect(invitationHash(a)).toHaveLength(64)
    expect(()=>invitationHash("Christoph")).toThrow()
    const issued=await issueProfileInvitations(mock.db as never,["user","user"])
    expect(issued).toHaveLength(1)
    expect(mock.db.profileInvitation.create).toHaveBeenCalledWith({data:expect.objectContaining({tokenHash:invitationHash(issued[0].token)})})
    expect(JSON.stringify(mock.db.profileInvitation.create.mock.calls)).not.toContain(issued[0].token)
  })
  it("ersetzt das Passwort per Einladung ohne altes Passwort und ohne Foto",async()=>{
    await expect(savePersonalProfile(input)).resolves.toEqual({success:true,reauthenticate:true})
    expect(mock.actor).not.toHaveBeenCalled()
    expect(mock.compare).not.toHaveBeenCalled()
    expect(mock.db.user.update).toHaveBeenCalledWith({where:{id:"user"},data:expect.objectContaining({email:"player@example.com",password:"new-hash",sessionVersion:{increment:1},image:undefined})})
  })
  it("weist benutzte, abgelaufene und erfundene Links vor dem Passwort-Hashing zurück",async()=>{
    for(const link of [null,{usedAt:new Date(),expiresAt:invitationExpiry()},{usedAt:null,expiresAt:new Date(0)}]) {
      mock.db.profileInvitation.findUnique.mockResolvedValue(link)
      expect((await savePersonalProfile(input)).success).toBe(false)
    }
    expect(mock.hash).not.toHaveBeenCalled();expect(mock.db.user.update).not.toHaveBeenCalled()
  })
  it("weist die zweite gleichzeitige Beanspruchung zurück",async()=>{
    mock.db.profileInvitation.updateMany.mockResolvedValue({count:0})
    expect((await savePersonalProfile(input)).success).toBe(false)
    expect(mock.db.user.update).not.toHaveBeenCalled()
  })
  it("verbraucht einen Link bei ungültigem Profil nicht",async()=>{
    expect((await savePersonalProfile({...input,email:"ungültig"})).success).toBe(false)
    expect(mock.db.profileInvitation.updateMany).not.toHaveBeenCalled()
  })
  it("verlangt ohne Einladung für Passwortänderungen das aktuelle Passwort",async()=>{
    mock.compare.mockResolvedValue(false)
    expect((await savePersonalProfile({...input,token:undefined})).success).toBe(false)
    expect(mock.db.user.update).not.toHaveBeenCalled()
  })
  it("sperrt doppelte E-Mail-Adressen, ohne den Link zu verbrauchen",async()=>{
    mock.db.user.findFirst.mockResolvedValue({id:"another"})
    expect((await savePersonalProfile(input)).success).toBe(false)
    expect(mock.db.profileInvitation.updateMany).not.toHaveBeenCalled()
  })
  it("begrenzt Passwörter und verhindert externe Login-Weiterleitungen",()=>{
    expect(()=>validateProfilePassword("kurz")).toThrow()
    expect(()=>validateProfilePassword("ä".repeat(40))).toThrow()
    expect(validateProfileEmail(" Test@Example.com ")).toBe("test@example.com")
    expect(safeProfileReturn("https://evil.example")).toBe("/")
    expect(safeProfileReturn("/profile")).toBe("/profile")
  })
  it("erzeugt persönliche WhatsApp-Texte mit Profil- und Agenda-Link",()=>{
    const text=invitationMessage("Christoph Strehl","https://leaderboard.sc/profile/?player=TOKEN","Ryder Cup","TRRC26")
    expect(text).toContain("Hallo Christoph,")
    expect(text).toContain("Profilfoto")
    expect(text).toContain("https://leaderboard.sc/?comp=TRRC26&tab=agenda")
  })
})
