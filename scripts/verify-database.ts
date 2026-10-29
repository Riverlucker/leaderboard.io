import { PrismaClient } from "@prisma/client"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { getRyderCupMatchWeight } from "../src/lib/cup-scoring"

const db=new PrismaClient()
async function main() {
  const path=process.argv[2]
  if (!path?.startsWith("scratch/db-backup-")) throw new Error("Sicherungspfad erforderlich.")
  const backup=JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as {tables:Record<string, Record<string,unknown>[]>}
  const previousScores=new Map(backup.tables.Score.map(row=>[row.id,row]))
  const currentScores=await db.score.findMany()
  let comparedScores=0
  for (const row of currentScores) {
    const before=previousScores.get(row.id)
    if (!before) continue
    for (const key of ["participantId","roundId","holeId","grossStrokes","netStrokes","points","status","enteredBy"] as const) {
      if (row[key]!==before[key]) throw new Error("Ein bestehender Score weicht von der Sicherung ab.")
    }
    comparedScores++
  }
  if (comparedScores!==previousScores.size) throw new Error("Es fehlen Scores aus der Sicherung.")
  const rounds=new Map(backup.tables.Round.map(row=>[row.id,row]))
  const matches=new Map((await db.match.findMany()).map(row=>[row.id,row]))
  for (const before of backup.tables.Match) {
    const expected=getRyderCupMatchWeight({type:String(before.type),holeRange:before.holeRange as string|null},{name:String(rounds.get(before.roundId)?.name)})
    if (matches.get(String(before.id))?.weight!==expected) throw new Error("Matchgewicht stimmt nicht mit der Sicherung überein.")
  }
  console.log(JSON.stringify({verified:true,preservedScores:comparedScores,preservedMatches:backup.tables.Match.length},null,2))
}
main().catch(()=>{console.error("Datenabgleich fehlgeschlagen. Abweichungen prüfen; es wurden keine Daten geändert.");process.exitCode=1}).finally(()=>db.$disconnect())
