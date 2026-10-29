export interface ProfileParticipant {
  userId?: string | null
  dummyName?: string | null
  user?: { name?: string | null; email?: string | null } | null
  stars?: number | null
}

export function profilePlayer(participant: ProfileParticipant, competition: {id: string; hasBadges?: boolean}) {
  return {
    userId: participant.userId,
    dummyName: participant.dummyName,
    name: (participant.userId ? participant.user?.name || participant.user?.email : participant.dummyName) || "Spieler",
    stars: competition.hasBadges ? participant.stars : undefined,
    competitionId: competition.id,
  }
}
