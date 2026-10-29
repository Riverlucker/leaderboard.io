import { randomBytes, createHash } from "node:crypto"

export const INVITATION_DAYS = 14
export function newInvitationToken() { return randomBytes(32).toString("base64url") }
export function invitationHash(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Ungültiger Einladungslink.")
  return createHash("sha256").update(token).digest("hex")
}
export function invitationExpiry(now = new Date()) { return new Date(now.getTime() + INVITATION_DAYS * 86400000) }

export function validateProfileEmail(value: string) {
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Bitte eine gültige E-Mail-Adresse eingeben.")
  return email
}
export function validateProfilePassword(value: string) {
  if (value.length < 10 || Buffer.byteLength(value, "utf8") > 72) throw new Error("Das Passwort benötigt mindestens 10 Zeichen und darf höchstens 72 UTF-8-Bytes lang sein.")
}
