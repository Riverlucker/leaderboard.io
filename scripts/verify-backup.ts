import { PGlite } from "@electric-sql/pglite"
import { readFileSync, writeFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { getRyderCupMatchWeight } from "../src/lib/cup-scoring"

async function main() {
  const path = process.argv[2]
  if (!path?.startsWith("scratch/db-backup-")) throw new Error("Lokalen Sicherungspfad angeben.")
  const backup = JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as {schemaVersion?:number;tables:Record<string, Record<string, unknown>[]>}
  const db = new PGlite()
  try {
    await db.exec(readFileSync("prisma/migrations/00000000000000_baseline/migration.sql","utf8"))
    const version = backup.schemaVersion || (backup.tables.Match.some(m=>"weight" in m) ? 2 : 1)
    const stabilization = readFileSync("prisma/migrations/20261027160000_stabilize_scores/migration.sql","utf8")
    const profiles = readFileSync("prisma/migrations/20261029160000_profile_invitations/migration.sql","utf8")
    if (version >= 2) await db.exec(stabilization)
    if (version >= 3) await db.exec(profiles)
    await db.transaction(async tx => {
      for (const [table, rows] of Object.entries(backup.tables)) {
        if (!/^[A-Za-z]+$/.test(table)) throw new Error("Ungültige Tabelle.")
        for (const row of rows) {
          const columns = Object.keys(row)
          if (columns.some(c => !/^[A-Za-z]+$/.test(c))) throw new Error("Ungültiges Feld.")
          await tx.query(`INSERT INTO "${table}" (${columns.map(c=>`"${c}"`).join(",")}) VALUES (${columns.map((_,i)=>`$${i+1}`).join(",")})`,Object.values(row))
        }
      }
    })
    const matches = await db.query<{id:string;type:string;holeRange:string|null;name:string;weight?:number}>(`SELECT m.id,m.type,m."holeRange",${version>=2?'m.weight,':''}r.name FROM "Match" m JOIN "Round" r ON r.id=m."roundId"`)
    const oldWeights = new Map(matches.rows.map(m => [m.id,getRyderCupMatchWeight(m,{name:m.name})]))
    if (version < 2) await db.transaction(tx => tx.exec(stabilization))
    if (version < 3) await db.transaction(tx => tx.exec(profiles))
    for (const row of (await db.query<{id:string;weight:number}>(`SELECT id,weight FROM "Match"`)).rows) {
      if (oldWeights.get(row.id) !== row.weight) throw new Error("Matchgewicht wurde verändert.")
    }
    for (const [table, rows] of Object.entries(backup.tables)) {
      const count = (await db.query<{count:number}>(`SELECT COUNT(*)::integer AS count FROM "${table}"`)).rows[0].count
      if (count !== rows.length) throw new Error("Zeilenzahl weicht ab.")
    }
    const report = {restored:true, migrationVerified:true, preservedMatches:matches.rows.length, tableCount:Object.keys(backup.tables).length,verifiedAt:new Date().toISOString()}
    writeFileSync(`${path}.verified.json`,JSON.stringify(report,null,2))
    console.log(JSON.stringify(report,null,2))
  } finally {await db.close()}
}
main().catch(() => {console.error("Wiederherstellungs- oder Migrationsprüfung fehlgeschlagen. Keine Produktivänderung durchführen.");process.exitCode=1})
