// Compact invitation destinations only address a competition tab on this site.
export function profileDestination(value: string | null | undefined): string {
  const match = typeof value === "string" ? /^([a-zA-Z0-9_-]{1,100})\/([a-zA-Z0-9_-]{1,40})$/.exec(value) : null
  return match ? `/?comp=${match[1]}&tab=${match[2]}` : "/profile"
}

export function profileInvitationUrl(token: string, destination?: string): string {
  if (destination && profileDestination(destination) === "/profile") throw new Error("Ungültiges Weiterleitungsziel.")
  return `https://leaderboard.sc/profile/?player=${encodeURIComponent(token)}${destination ? `&RDIR=${destination}` : ""}`
}

export function safeProfileReturn(value: string | null) {
  if (value === "/profile") return value
  // Accept only the canonical URL we generate, never external or nested URLs.
  return value && /^\/\?comp=[a-zA-Z0-9_-]{1,100}&tab=[a-zA-Z0-9_-]{1,40}$/.test(value) ? value : "/"
}
