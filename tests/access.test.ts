import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    user: {findUnique: vi.fn()}, round: {findUnique: vi.fn()},
    participant: {findUnique: vi.fn(), findFirst: vi.fn()}, match: {findMany: vi.fn(), findUnique: vi.fn()},
  },
}))
vi.mock("server-only", () => ({}))
vi.mock("@/auth", () => ({auth: mocks.auth}))
vi.mock("@/lib/prisma", () => ({default: mocks.db}))
import { requireAdmin, requireUser, assertScoreAccess, requireMatchScorer } from "@/lib/access"

const actor = {id:"user",name:"Spieler",email:null,role:"USER" as const}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({user: {id:"user",role:"SUPER_ADMIN"}})
  mocks.db.user.findUnique.mockResolvedValue(actor)
  mocks.db.round.findUnique.mockResolvedValue({id:"round",competitionId:"comp",holesPlayed:[1,2]})
  mocks.db.participant.findUnique.mockResolvedValue({id:"other",competitionId:"comp"})
  mocks.db.participant.findFirst.mockResolvedValue({id:"own",userId:"user"})
  mocks.db.match.findMany.mockResolvedValue([{holeRange:"1-2",matchPlayers:[{participantId:"own"},{participantId:"other"}]}])
})

describe("Serverseitige Zugriffsprüfung", () => {
  it("weist Gäste und gelöschte Benutzer zurück", async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(requireUser()).rejects.toThrow("Nicht angemeldet")
    mocks.auth.mockResolvedValue({user:{id:"removed"}})
    mocks.db.user.findUnique.mockResolvedValue(null)
    await expect(requireUser()).rejects.toThrow("Nicht angemeldet")
  })
  it("ignoriert eine alte Adminrolle im JWT", async () => {
    await expect(requireAdmin()).rejects.toThrow("Nur Administratoren")
    mocks.db.user.findUnique.mockResolvedValue({...actor,role:"ADMIN"})
    await expect(requireAdmin()).resolves.toMatchObject({role:"ADMIN"})
  })
  it("erlaubt das eigene Flight und sperrt fremde Flights", async () => {
    await expect(assertScoreAccess(actor,"other","round","comp",1)).resolves.toBeUndefined()
    mocks.db.match.findMany.mockResolvedValue([{matchPlayers:[{participantId:"own"}]}])
    await expect(assertScoreAccess(actor,"other","round","comp",1)).rejects.toThrow("Flight")
  })
  it("erlaubt ohne Paarung ausschließlich eigene Scores", async () => {
    mocks.db.match.findMany.mockResolvedValue([])
    await expect(assertScoreAccess(actor,"other","round","comp",1)).rejects.toThrow("Flight")
    mocks.db.participant.findUnique.mockResolvedValue({id:"own",competitionId:"comp"})
    await expect(assertScoreAccess(actor,"own","round","comp",1)).resolves.toBeUndefined()
  })
  it("prüft Wettbewerb und Lochauswahl auch für Admins", async () => {
    await expect(assertScoreAccess({...actor,role:"ADMIN"},"other","round","wrong",1)).rejects.toThrow("Wettbewerb")
    await expect(assertScoreAccess({...actor,role:"ADMIN"},"other","round","comp",18)).rejects.toThrow("Loch")
  })
  it("verlangt für Wintercup-Ergebnisse die tatsächliche Partieteilnahme", async () => {
    mocks.db.match.findUnique.mockResolvedValue({round:{competitionId:"comp"},matchPlayers:[]})
    mocks.db.participant.findFirst.mockResolvedValue(null)
    await expect(requireMatchScorer("match","comp")).rejects.toThrow("Teilnehmer")
  })
})
