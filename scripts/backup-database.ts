import { PrismaClient } from "@prisma/client"
import { mkdirSync, writeFileSync } from "node:fs"
import { gzipSync } from "node:zlib"

const db = new PrismaClient()
const tables = ["User","Course","Tee","Hole","Competition","Team","Participant","Round","Match","MatchPlayer","Score","Account","Session","AuditLog","ManualCourseHandicap","ManualRoundHandicap","HandicapRequest"]
async function main() {
  const snapshot = await db.$transaction(async tx => {
    const result: Record<string, Record<string, unknown>[]> = {}
    for (const table of tables) result[table] = await tx.$queryRawUnsafe(`SELECT * FROM "${table}"`)
    return result
  }, {isolationLevel:"RepeatableRead", timeout:60000})
  mkdirSync("scratch", {recursive:true})
  // Ignored local file contains sensitive data. Never commit or print its contents.
  const path = `scratch/db-backup-${new Date().toISOString().replace(/[:.]/g,"-")}.json.gz`
  writeFileSync(path,gzipSync(JSON.stringify({createdAt:new Date().toISOString(), tables:snapshot})))
  console.log(JSON.stringify({path, counts:Object.fromEntries(Object.entries(snapshot).map(([table,rows]) => [table,rows.length]))},null,2))
}
main().catch(() => {console.error("Datenbanksicherung fehlgeschlagen.");process.exitCode=1}).finally(() => db.$disconnect())
