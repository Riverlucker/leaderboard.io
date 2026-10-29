import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { expect,it } from "vitest"
import { invitationHash,newInvitationToken } from "@/lib/invitation-token"

it("bewahrt bestehende Konten und verbraucht eine Einladung nur mit erfolgreicher Profiländerung",async()=>{
  const db=new PGlite()
  try {
    await db.exec(readFileSync("prisma/migrations/00000000000000_baseline/migration.sql","utf8"))
    await db.exec(`INSERT INTO "User" (id,name,password,email) VALUES ('user','Spieler','old-password','old@example.com'),('other','Andere Person',null,'taken@example.com')`)
    await db.exec(readFileSync("prisma/migrations/20261029160000_profile_invitations/migration.sql","utf8"))
    expect((await db.query<{sessionVersion:number}>(`SELECT "sessionVersion" FROM "User" WHERE id='user'`)).rows[0].sessionVersion).toBe(0)
    const token=newInvitationToken(),hash=invitationHash(token)
    await db.query(`INSERT INTO "ProfileInvitation" ("tokenHash","userId","expiresAt") VALUES ($1,'user',now()+interval '14 days')`,[hash])
    // GET-like reads, including previews, do not claim an invitation.
    for(let i=0;i<2;i++) expect((await db.query<{usedAt:Date|null}>(`SELECT "usedAt" FROM "ProfileInvitation" WHERE "tokenHash"=$1`,[hash])).rows[0].usedAt).toBeNull()
    await expect(db.transaction(async tx=>{
      await tx.query(`UPDATE "ProfileInvitation" SET "usedAt"=now() WHERE "tokenHash"=$1 AND "usedAt" IS NULL`,[hash])
      await tx.exec(`UPDATE "User" SET email='taken@example.com' WHERE id='user'`)
    })).rejects.toThrow()
    expect((await db.query<{usedAt:Date|null}>(`SELECT "usedAt" FROM "ProfileInvitation" WHERE "tokenHash"=$1`,[hash])).rows[0].usedAt).toBeNull()
    await db.transaction(async tx=>{
      const claim=await tx.query(`UPDATE "ProfileInvitation" SET "usedAt"=now() WHERE "tokenHash"=$1 AND "usedAt" IS NULL AND "expiresAt">now() RETURNING "tokenHash"`,[hash])
      expect(claim.rows).toHaveLength(1)
      await tx.exec(`UPDATE "User" SET password='new-password',"sessionVersion"="sessionVersion"+1 WHERE id='user'`)
    })
    const second=await db.query(`UPDATE "ProfileInvitation" SET "usedAt"=now() WHERE "tokenHash"=$1 AND "usedAt" IS NULL RETURNING "tokenHash"`,[hash])
    expect(second.rows).toHaveLength(0)
    expect((await db.query<{sessionVersion:number}>(`SELECT "sessionVersion" FROM "User" WHERE id='user'`)).rows[0].sessionVersion).toBe(1)
  } finally {await db.close()}
})
