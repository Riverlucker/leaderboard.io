import type { Prisma } from "@prisma/client"

// Explicit allowlists for every browser boundary. Never spread a database User.
export const publicUserSelect = {
  id: true, name: true, image: true, handicap: true, homeCourse: true,
} satisfies Prisma.UserSelect

export const adminUserSelect = {
  ...publicUserSelect, email: true, phoneNumber: true, role: true,
} satisfies Prisma.UserSelect

export const publicScoreSelect = {
  id: true, participantId: true, roundId: true, holeId: true,
  grossStrokes: true, netStrokes: true, points: true, status: true,
  createdAt: true, updatedAt: true, hole: true,
} satisfies Prisma.ScoreSelect
