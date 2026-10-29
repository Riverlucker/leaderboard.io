import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
async function main() {
  // Counts only. Never print credentials, passwords, player data or connection URLs.
  const duplicates = await db.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) FROM (SELECT 1 FROM "Score" GROUP BY "participantId","roundId","holeId" HAVING COUNT(*) > 1) d`
  const orphans = await db.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) FROM "Score" s LEFT JOIN "Round" r ON r.id=s."roundId" WHERE r.id IS NULL`
  const inconsistent = await db.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) FROM "Score" s JOIN "Round" r ON r.id=s."roundId" JOIN "Participant" p ON p.id=s."participantId" JOIN "Hole" h ON h.id=s."holeId" WHERE r."competitionId"<>p."competitionId" OR r."courseId"<>h."courseId"`
  const counts = {duplicateGroups:Number(duplicates[0].count), orphanScores:Number(orphans[0].count), inconsistentScores:Number(inconsistent[0].count)}
  console.log(JSON.stringify(counts,null,2))
  if (Object.values(counts).some(Boolean)) throw new Error("Migration blockiert: Ergebnisse müssen ausdrücklich abgeglichen werden.")
}
main().catch(() => {console.error("Preflight fehlgeschlagen. Verbindung und gegebenenfalls die gemeldeten Datenkonflikte prüfen.");process.exitCode=1}).finally(() => db.$disconnect())
