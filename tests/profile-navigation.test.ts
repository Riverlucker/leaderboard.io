import { expect, it } from "vitest"
import { profileDestination, profileInvitationUrl, safeProfileReturn } from "@/lib/profile-navigation"

it("übersetzt das Ziel aus dem Link für beliebige Wettbewerbe", () => {
  expect(profileDestination("TRRC26/agenda")).toBe("/?comp=TRRC26&tab=agenda")
  expect(profileDestination("Wintercup_27/details")).toBe("/?comp=Wintercup_27&tab=details")
  expect(profileInvitationUrl("token", "TRRC26/agenda")).toBe("https://leaderboard.sc/profile/?player=token&RDIR=TRRC26/agenda")
  expect(profileInvitationUrl("token")).toBe("https://leaderboard.sc/profile/?player=token")
})

it.each([undefined, "", "https://evil.example/agenda", "//evil.example", "../agenda", "TRRC26/agenda?next=https://evil.example", "TRRC26/agenda#fragment", "TRRC26/agenda\n"])("verwirft unsichere oder ungültige Einladungsziele: %s", value => {
  expect(profileDestination(value)).toBe("/profile")
})

it("erhält ein sicheres Agenda-Ziel bei einer erforderlichen Anmeldung", () => {
  expect(safeProfileReturn("/?comp=TRRC26&tab=agenda")).toBe("/?comp=TRRC26&tab=agenda")
  for (const value of ["https://evil.example", "//evil.example", "/?comp=x&tab=agenda&next=https://evil.example", "/?comp=x&tab=agenda\n"]) {
    expect(safeProfileReturn(value)).toBe("/")
  }
  expect(() => profileInvitationUrl("token", "https://evil.example")).toThrow()
})
