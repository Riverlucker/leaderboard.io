import { PrismaClient } from "@prisma/client"
import { mkdirSync, writeFileSync } from "node:fs"
import { gzipSync } from "node:zlib"

const db = new PrismaClient()
const tables = ["User","Course","Tee","Hole","Competition","Team","Participant","Round","Match","MatchPlayer","Score","Account","Session","AuditLog","ManualCourseHandicap","ManualRoundHandicap","HandicapRequest"]
async function main() {
  const snapshot = await db.$transaction(async tx => {
    const result: Record<string, Record<string, unknown>[]> = {}
    for (const table of tables) result[table] = await tx.$queryRawUnsafe(`SELECT * FROM "${table}"`)
    const invitationTable = await tx.$queryRaw<{name:string|null}[]>`SELECT to_regclass('"ProfileInvitation"')::text AS name`
    if (invitationTable[0].name) result.ProfileInvitation = await tx.$queryRaw`SELECT * FROM "ProfileInvitation"`
    return result
  }, {isolationLevel:"RepeatableRead", timeout:60000})
  mkdirSync("scratch", {recursive:true})
  // Ignored local file contains sensitive data. Never commit or print its contents.
  const path = `scratch/db-backup-${new Date().toISOString().replace(/[:.]/g,"-")}.json.gz`
  const schemaVersion = snapshot.ProfileInvitation ? 3 : snapshot.Match.some(m=>"weight" in m) ? 2 : 1
  writeFileSync(path,gzipSync(JSON.stringify({createdAt:new Date().toISOString(),schemaVersion,tables:snapshot})))
  console.log(JSON.stringify({path, counts:Object.fromEntries(Object.entries(snapshot).map(([table,rows]) => [table,rows.length]))},null,2))
}
main().catch(() => {console.error("Datenbanksicherung fehlgeschlagen.");process.exitCode=1}).finally(() => db.$disconnect())
