import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
let stage = "Initialisierung"
async function main() {
  const base = process.argv[2] || "http://localhost:3100"
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("Nur lokalen Testserver angeben.")
  const competitionRows = await db.competition.findMany({select:{uniqueSlug:true,type:true}})
  const representatives = [...new Map(competitionRows.map(c=>[c.type,c])).values()]
  const report: {view:string;status:number;safe?:boolean}[] = []
  for (const route of ["/", "/login", "/api/auth/session"]) {
    stage = route
    const response=await fetch(`${base}${route}`)
    if (response.status!==200) throw new Error("Öffentliche Seite nicht erreichbar.")
    if (route==="/api/auth/session" && await response.text()!=="null") throw new Error("Unerwartete Gastsitzung.")
    report.push({view:route,status:response.status})
  }
  for (const route of ["/admin","/admin/users","/admin/courses","/admin/competitions"]) {
    stage = route
    const response=await fetch(`${base}${route}`,{redirect:"manual"})
    if (![303,307].includes(response.status) || !response.headers.get("location")?.includes("/login")) throw new Error("Adminzugriff ist nicht gesperrt.")
    report.push({view:route,status:response.status})
  }
  for (const competition of representatives) {
    stage = competition.type
    const response=await fetch(`${base}/?comp=${encodeURIComponent(competition.uniqueSlug)}`)
    const html=await response.text()
    const normalized=html.replaceAll('\\"','"')
    if (response.status!==200 || /\$2[aby]\$\d{2}\$/.test(html) || /"(password|phoneNumber|emailVerified|enteredBy)"\s*:/.test(normalized)) throw new Error("Öffentliche Turnierantwort fehlerhaft oder enthält private Daten.")
    report.push({view:competition.type,status:response.status,safe:true})
  }
  console.log(JSON.stringify({passed:true,checks:report},null,2))
}
main().catch(()=>{console.error(`Smoke-Test fehlgeschlagen bei ${stage}. Antwortdetails lokal prüfen; keine Zugangsdaten oder Benutzerdaten ausgeben.`);process.exitCode=1}).finally(()=>db.$disconnect())
