import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const baseline = readFileSync("prisma/migrations/00000000000000_baseline/migration.sql", "utf8")
const migration = readFileSync("prisma/migrations/20261027160000_stabilize_scores/migration.sql", "utf8")

async function fixture(db: PGlite) {
  await db.exec(baseline)
  await db.exec(`
    INSERT INTO "Course" (id,name) VALUES ('course','Testplatz');
    INSERT INTO "Hole" (id,"courseId",number,par,"strokeIndex") VALUES ('hole','course',1,4,1);
    INSERT INTO "Competition" (id,"uniqueSlug",name,type,"extraLeaderboards") VALUES ('comp','test','Test','RYDER_CUP','{}');
    INSERT INTO "Participant" (id,"competitionId","dummyName") VALUES ('player','comp','Testspieler');
    INSERT INTO "Round" (id,"competitionId","courseId",name,"holesPlayed") VALUES ('round','comp','course','Tag 1 VM','{1,2,3,4,5,6,7,8,9}');
    INSERT INTO "Match" (id,"roundId",type,"holeRange") VALUES ('match','round','SINGLES','1-9');
    INSERT INTO "Score" (id,"participantId","holeId","roundId","grossStrokes",points,"updatedAt") VALUES ('score','player','hole','round',4,2,now());
  `)
}

describe("PostgreSQL-Migration ohne Datenverlust", () => {
  let db: PGlite
  beforeAll(async () => {db = new PGlite(); await fixture(db); await db.exec(migration)})
  afterAll(async () => {await db?.close()})
  it("erhält existierende Scores und friert alte Matchgewichte ein", async () => {
    expect((await db.query<{points:number}>(`SELECT points FROM "Score" WHERE id='score'`)).rows[0].points).toBe(2)
    expect((await db.query<{weight:number}>(`SELECT weight FROM "Match" WHERE id='match'`)).rows[0].weight).toBe(.5)
    await db.exec(`UPDATE "Round" SET name='Umbenannt' WHERE id='round'`)
    expect((await db.query<{weight:number}>(`SELECT weight FROM "Match" WHERE id='match'`)).rows[0].weight).toBe(.5)
  })
  it("speichert halbe und Viertelpunkte exakt", async () => {
    for (const points of [.5,.25,.75]) {
      await db.query(`UPDATE "Score" SET points=$1 WHERE id='score'`,[points])
      expect((await db.query<{points:number}>(`SELECT points FROM "Score" WHERE id='score'`)).rows[0].points).toBe(points)
    }
  })
  it("verhindert doppelte Scores und verwaiste Runden", async () => {
    await expect(db.exec(`INSERT INTO "Score" (id,"participantId","holeId","roundId","updatedAt") VALUES ('duplicate','player','hole','round',now())`)).rejects.toThrow(/unique/i)
    await expect(db.exec(`INSERT INTO "Score" (id,"participantId","holeId","roundId","updatedAt") VALUES ('orphan','player','hole','missing',now())`)).rejects.toThrow(/foreign key/i)
  })
  it("rollt eine teilweise gespeicherte Scoreänderung bei Fehler zurück", async () => {
    const before = (await db.query<{points:number}>(`SELECT points FROM "Score" WHERE id='score'`)).rows[0].points
    await expect(db.transaction(async tx => {
      await tx.exec(`UPDATE "Score" SET points=99 WHERE id='score'`)
      await tx.exec(`INSERT INTO "AuditLog" (id,"competitionId",action,details) VALUES ('bad','missing','SCORE_UPDATE','test')`)
    })).rejects.toThrow()
    expect((await db.query<{points:number}>(`SELECT points FROM "Score" WHERE id='score'`)).rows[0].points).toBe(before)
  })
  it("entfernt beim Rundenlöschen zugehörige Scores", async () => {
    await db.exec(`DELETE FROM "Round" WHERE id='round'`)
    expect((await db.query(`SELECT * FROM "Score"`)).rows).toHaveLength(0)
  })
})

it("bricht bei widersprüchlichen Duplikaten ab, statt sie zu löschen", async () => {
  const db = new PGlite()
  try {
    await fixture(db)
    await db.exec(`INSERT INTO "Score" (id,"participantId","holeId","roundId","grossStrokes","updatedAt") VALUES ('duplicate','player','hole','round',7,now())`)
    await expect(db.transaction(tx => tx.exec(migration))).rejects.toThrow(/Duplicate scores/)
    expect((await db.query(`SELECT * FROM "Score"`)).rows).toHaveLength(2)
    expect((await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='Match' AND column_name='weight'`)).rows).toHaveLength(0)
  } finally {await db.close()}
})
